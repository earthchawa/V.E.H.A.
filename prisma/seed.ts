/**
 * npm run db:seed        -> creates the first admin account (if missing)
 * npm run db:seed:demo   -> also creates a demo term, courses, an instructor and students
 *
 * Every account gets a random temporary password printed here; it must be changed on first login.
 * With --demo and DEMO_PASSWORD set (e.g. a public demo on Vercel), demo accounts use that
 * password instead, so no one has to dig it out of the build log.
 */
import { PrismaClient, type EnrollmentRole, type Role } from "@prisma/client";
import { generateTempPassword, hashPassword, tempPasswordExpiry } from "../src/lib/auth/password";
import { assembleContent } from "../src/lib/similarity/content";
import { recheckAssignment } from "../src/lib/similarity/run";
import { DEMO_ASSIGNMENTS } from "./demo-assignments";

const db = new PrismaClient();
const issued: [string, string, string][] = [];

async function ensureUser(username: string, fullName: string, role: Role) {
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) return existing;
  const demoPassword = process.argv.includes("--demo") ? process.env.DEMO_PASSWORD : undefined;
  const password = demoPassword || generateTempPassword();
  issued.push([username, fullName, password]);
  return db.user.create({
    data: {
      username,
      fullName,
      role,
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      tempPasswordExpiresAt: tempPasswordExpiry(Number(process.env.TEMP_PASSWORD_DAYS ?? 14)),
    },
  });
}

async function main() {
  await ensureUser(process.env.SEED_ADMIN_USERNAME || "admin", "System Administrator", "ADMIN");

  if (process.argv.includes("--demo")) {
    const term = await db.term.upsert({
      where: { academicYear_semester: { academicYear: 2569, semester: 2 } },
      create: { academicYear: 2569, semester: 2, isCurrent: (await db.term.count({ where: { isCurrent: true } })) === 0 },
      update: {},
    });
    const courses = [
      { code: "CS201", title: "Data Structures and Algorithms", titleTh: "โครงสร้างข้อมูลและอัลกอริทึม", credits: 3 },
      { code: "CS202", title: "Database Systems", titleTh: "ระบบฐานข้อมูล", credits: 3 },
    ];
    const teacher = await ensureUser("T0001", "Sqn Ldr Demo Instructor", "INSTRUCTOR");
    const students = [];
    for (let i = 1; i <= 5; i++) {
      students.push(await ensureUser(`66010${String(i).padStart(2, "0")}`, `Cadet Demo ${i}`, "STUDENT"));
    }
    for (const c of courses) {
      const course = await db.course.upsert({ where: { code: c.code }, create: c, update: {} });
      const offering = await db.courseOffering.upsert({
        where: { courseId_termId_section: { courseId: course.id, termId: term.id, section: "1" } },
        create: { courseId: course.id, termId: term.id },
        update: {},
      });
      const members: { id: string; role: EnrollmentRole }[] = [
        { id: teacher.id, role: "INSTRUCTOR" },
        ...students.map((s) => ({ id: s.id, role: "STUDENT" as const })),
      ];
      for (const { id: userId, role } of members) {
        await db.enrollment.upsert({
          where: { userId_offeringId: { userId, offeringId: offering.id } },
          create: { userId, offeringId: offering.id, role },
          update: {},
        });
      }
    }

    // CS201 also runs a second section (same instructor, two more cadets) to show copying between sections.
    const cs201 = await db.course.findUniqueOrThrow({ where: { code: "CS201" } });
    const sec2 = await db.courseOffering.upsert({
      where: { courseId_termId_section: { courseId: cs201.id, termId: term.id, section: "2" } },
      create: { courseId: cs201.id, termId: term.id, section: "2" },
      update: {},
    });
    const sec2Members: { id: string; role: EnrollmentRole }[] = [{ id: teacher.id, role: "INSTRUCTOR" }];
    for (const i of [6, 7]) {
      const s = await ensureUser(`66010${String(i).padStart(2, "0")}`, `Cadet Demo ${i}`, "STUDENT");
      sec2Members.push({ id: s.id, role: "STUDENT" });
    }
    for (const { id: userId, role } of sec2Members) {
      await db.enrollment.upsert({
        where: { userId_offeringId: { userId, offeringId: sec2.id } },
        create: { userId, offeringId: sec2.id, role },
        update: {},
      });
    }
  }

  if (process.argv.includes("--demo")) await seedDemoAssignments();

  if (issued.length) {
    console.log("\nNew accounts (temporary passwords — must be changed at first sign-in):");
    const hide = process.argv.includes("--demo") && !!process.env.DEMO_PASSWORD;
    console.table(issued.map(([username, fullName, password]) => ({ username, fullName, password: hide ? "(DEMO_PASSWORD)" : password })));
  } else {
    console.log("No new accounts (all already exist).");
  }
}

main().finally(() => db.$disconnect());

/** Two demo assignments (Python lab + Thai essay) with submissions, so the similarity report has something to show. */
async function seedDemoAssignments() {
  const offering = await db.courseOffering.findFirstOrThrow({ where: { course: { code: "CS201" }, section: "1" }, orderBy: { createdAt: "desc" } });
  const teacher = await db.user.findUniqueOrThrow({ where: { username: "T0001" } });
  for (const demo of DEMO_ASSIGNMENTS) {
    if (await db.assignment.findFirst({ where: { offeringId: offering.id, title: demo.title } })) continue;
    const assignment = await db.assignment.create({
      data: {
        offeringId: offering.id,
        title: demo.title,
        instructions: demo.instructions,
        baseText: demo.baseText,
        dueAt: new Date(Date.now() + demo.dueInDays * 86400_000),
        createdById: teacher.id,
      },
    });
    for (const sub of demo.submissions) {
      const student = await db.user.findUniqueOrThrow({ where: { username: sub.username } });
      const files = sub.file ? [{ fileName: sub.file.name, extracted: [{ text: sub.file.text, kind: "code" as const }] }] : [];
      const { content, segments } = assembleContent(sub.text ?? null, files);
      await db.submission.create({
        data: { assignmentId: assignment.id, studentId: student.id, textAnswer: sub.text ?? null, content, segments },
      });
    }
    await recheckAssignment(assignment.id);
  }
  await seedDemoGrades(offering.id, teacher.id);
}

/** Gradebook demo: weighted categories, linked + standalone items, some released scores. */
async function seedDemoGrades(offeringId: string, teacherId: string) {
  if (await db.gradeCategory.count({ where: { offeringId } })) return;
  const [hw, mid, fin] = await Promise.all(
    [["Assignments", 40], ["Midterm", 25], ["Final", 35]].map(([name, weight], position) =>
      db.gradeCategory.create({ data: { offeringId, name: name as string, weight: weight as number, position } }),
    ),
  );
  const lab = await db.assignment.findFirstOrThrow({ where: { offeringId, title: { startsWith: "Lab 3" } } });
  const essay = await db.assignment.findFirstOrThrow({ where: { offeringId, title: { startsWith: "Essay" } } });
  const items = {
    lab: await db.gradeItem.create({ data: { offeringId, assignmentId: lab.id, title: lab.title, maxPoints: 10, categoryId: hw.id, isReleased: true, position: 0 } }),
    essay: await db.gradeItem.create({ data: { offeringId, assignmentId: essay.id, title: essay.title, maxPoints: 20, categoryId: hw.id, position: 1 } }),
    midterm: await db.gradeItem.create({ data: { offeringId, title: "Midterm exam", maxPoints: 50, categoryId: mid.id, isReleased: true, position: 2 } }),
    final: await db.gradeItem.create({ data: { offeringId, title: "Final exam", maxPoints: 100, categoryId: fin.id, position: 3 } }),
  };
  const scores: [keyof typeof items, string, number, string?][] = [
    ["lab", "6601001", 9, "Clean implementation. Good use of the prev pointer in remove()."],
    ["lab", "6601002", 4, "Your submission is almost identical to another cadet's (see the similarity report). Please come and see me."],
    ["lab", "6601003", 8, "Nice idea using a generator in find(). to_list() makes find O(n) extra memory though."],
    ["essay", "6601001", 14],
    ["essay", "6601004", 13],
    ["essay", "6601005", 18],
    ["midterm", "6601001", 42],
    ["midterm", "6601002", 35],
    ["midterm", "6601003", 38],
    ["midterm", "6601004", 30],
    ["midterm", "6601005", 45],
  ];
  for (const [item, username, points, feedback] of scores) {
    const student = await db.user.findUniqueOrThrow({ where: { username } });
    await db.grade.create({ data: { itemId: items[item].id, studentId: student.id, points, feedback, gradedById: teacherId } });
  }
}
