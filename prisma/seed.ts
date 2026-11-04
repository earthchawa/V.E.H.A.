/**
 * npm run db:seed        -> creates the first admin account (if missing)
 * npm run db:seed:demo   -> also creates a demo term, courses, an instructor and students
 *
 * Every account gets a random temporary password printed here; it must be changed on first login.
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
  const password = generateTempPassword();
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
  }

  if (process.argv.includes("--demo")) await seedDemoAssignments();

  if (issued.length) {
    console.log("\nNew accounts (temporary passwords — must be changed at first sign-in):");
    console.table(issued.map(([username, fullName, password]) => ({ username, fullName, password })));
  } else {
    console.log("No new accounts (all already exist).");
  }
}

main().finally(() => db.$disconnect());

/** Two demo assignments (Python lab + Thai essay) with submissions, so the similarity report has something to show. */
async function seedDemoAssignments() {
  const offering = await db.courseOffering.findFirstOrThrow({ where: { course: { code: "CS201" } }, orderBy: { createdAt: "desc" } });
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
}
