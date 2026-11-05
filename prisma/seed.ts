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
import { ACADEMY_DIVISIONS, ACADEMY_SUBJECT_AREAS } from "../src/lib/departments";

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
  await seedDivisions();

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

  if (process.argv.includes("--demo")) {
    await seedDemoOrg();
    await seedDemoAssignments();
  }

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
  await seedDemoQuiz(offering.id, teacher.id);
  await seedDemoCodeQuiz(offering.id, teacher.id);
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

/** An open demo quiz mixing all question types (no attempts yet). */
async function seedDemoQuiz(offeringId: string, teacherId: string) {
  const title = "Quiz 1: Linked lists";
  if (await db.quiz.findFirst({ where: { offeringId, title } })) return;
  const now = Date.now();
  const quiz = await db.quiz.create({
    data: {
      offeringId,
      title,
      instructions: "ทำทุกข้อ ห้ามเปิดเอกสารหรือเว็บไซต์อื่นระหว่างสอบ",
      opensAt: new Date(now - 3600_000),
      closesAt: new Date(now + 14 * 86400_000),
      timeLimitMin: 20,
      isPublished: true,
      results: "FULL",
      createdById: teacherId,
    },
  });
  const opt = (id: string, text: string, correct = false) => ({ id, text, correct });
  const questions = [
    { type: "SINGLE" as const, points: 1, prompt: "What is the time complexity of inserting at the head of a singly linked list?", options: [opt("a", "O(1)", true), opt("b", "O(log n)"), opt("c", "O(n)"), opt("d", "O(n log n)")] },
    { type: "MULTIPLE" as const, points: 2, prompt: "ข้อใดเป็นข้อดีของลิงก์ลิสต์เมื่อเทียบกับอาร์เรย์ (เลือกได้หลายข้อ)", options: [opt("a", "เพิ่ม/ลบข้อมูลตรงกลางได้โดยไม่ต้องเลื่อนสมาชิก", true), opt("b", "ขยายขนาดได้ตามต้องการ", true), opt("c", "เข้าถึงสมาชิกตามตำแหน่งได้ในเวลาคงที่"), opt("d", "ใช้หน่วยความจำน้อยกว่าเสมอ")] },
    { type: "SINGLE" as const, points: 1, prompt: "A doubly linked list node stores a pointer to the previous node.", options: [opt("t", "True", true), opt("f", "False")] },
    { type: "SHORT" as const, points: 1, prompt: "What is the name of the first node in a linked list?", accepted: ["head", "the head", "หัว", "โหนดหัว"] },
    { type: "ESSAY" as const, points: 5, prompt: "Write a Python function reverse(head) that reverses a singly linked list and returns the new head.", codeAnswer: true },
  ];
  for (const [position, q] of questions.entries()) {
    await db.quizQuestion.create({
      data: {
        quizId: quiz.id,
        position,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        options: "options" in q ? q.options : [],
        accepted: "accepted" in q ? q.accepted : [],
        codeAnswer: "codeAnswer" in q ? q.codeAnswer : false,
      },
    });
  }
  const assignments = await db.gradeCategory.findFirst({ where: { offeringId, name: "Assignments" } });
  const position = await db.gradeItem.count({ where: { offeringId } });
  await db.gradeItem.create({
    data: { offeringId, quizId: quiz.id, title, maxPoints: questions.reduce((n, q) => n + q.points, 0), categoryId: assignments?.id ?? null, position },
  });
}

/** A coding quiz: Python (with input()) and HTML/CSS/JS, run in the browser and marked by hand. */
async function seedDemoCodeQuiz(offeringId: string, teacherId: string) {
  const title = "Quiz 2: Coding practice";
  if (await db.quiz.findFirst({ where: { offeringId, title } })) return;
  const now = Date.now();
  const quiz = await db.quiz.create({
    data: {
      offeringId,
      title,
      instructions: "เขียนโค้ดและกดรันเพื่อตรวจผลก่อนส่ง อาจารย์จะตรวจให้คะแนนเอง",
      opensAt: new Date(now - 3600_000),
      closesAt: new Date(now + 14 * 86400_000),
      timeLimitMin: 30,
      isPublished: true,
      results: "FULL",
      createdById: teacherId,
    },
  });
  const questions = [
    {
      points: 5,
      language: "python",
      prompt: "เขียนโปรแกรมรับจำนวนเต็ม n แล้วพิมพ์ผลรวมของ 1 ถึง n\nRead an integer n and print the sum 1 + 2 + … + n.",
      starter: { "main.py": "n = int(input(\"n = \"))\n# your code here\n" },
    },
    {
      points: 5,
      language: "web",
      prompt: "สร้างปุ่มที่เมื่อกดแล้วตัวเลขในหน้าจอเพิ่มขึ้นทีละ 1\nMake a button that increases a counter shown on the page.",
      starter: {
        "index.html": "<h1>Counter: <span id=\"count\">0</span></h1>\n<button id=\"add\">+1</button>\n",
        "style.css": "body {\n  font-family: sans-serif;\n}\n",
        "script.js": "// your code here\n",
      },
    },
  ];
  for (const [position, q] of questions.entries()) {
    await db.quizQuestion.create({ data: { quizId: quiz.id, position, type: "CODE", ...q } });
  }
  const position = await db.gradeItem.count({ where: { offeringId } });
  await db.gradeItem.create({ data: { offeringId, quizId: quiz.id, title, maxPoints: 10, position } });
}

/** Organisation demo: one division with two departments, an extra maths course, and an exam room. */
async function seedDemoOrg() {
  const cs = await db.department.findUniqueOrThrow({ where: { code: "CS" } });
  const math = await db.department.findUniqueOrThrow({ where: { code: "MA" } });
  await db.course.updateMany({ where: { code: { in: ["CS201", "CS202"] }, departmentId: null }, data: { departmentId: cs.id } });
  await db.user.updateMany({ where: { username: { startsWith: "66010" }, departmentId: null }, data: { departmentId: cs.id } });
  await db.user.updateMany({ where: { username: "T0001", departmentId: null }, data: { departmentId: cs.id } });

  // A maths course in the same term, taught by the demo instructor to three cadets.
  const term = await db.term.findFirstOrThrow({ where: { academicYear: 2569, semester: 2 } });
  const ma101 = await db.course.upsert({
    where: { code: "MA101" },
    create: { code: "MA101", title: "Calculus I", titleTh: "แคลคูลัส 1", credits: 3, departmentId: math.id },
    update: {},
  });
  const offering = await db.courseOffering.upsert({
    where: { courseId_termId_section: { courseId: ma101.id, termId: term.id, section: "1" } },
    create: { courseId: ma101.id, termId: term.id },
    update: {},
  });
  const people = await db.user.findMany({ where: { username: { in: ["T0001", "6601001", "6601002", "6601003"] } } });
  for (const p of people) {
    await db.enrollment.upsert({
      where: { userId_offeringId: { userId: p.id, offeringId: offering.id } },
      create: { userId: p.id, offeringId: offering.id, role: p.role === "INSTRUCTOR" ? "INSTRUCTOR" : "STUDENT" },
      update: {},
    });
  }

  if (!(await db.examNetwork.count())) {
    await db.examNetwork.create({ data: { name: "CS Lab 301", cidrs: "10.20.3.0/24" } });
  }
}

/**
 * The academy's divisions with their badges and colours. Creates missing ones; for existing ones only
 * fills in colour/logo when they are still empty, so changes made by an admin are kept.
 */
async function seedDivisions() {
  for (const [position, d] of ACADEMY_DIVISIONS.entries()) {
    const existing = await db.department.findUnique({ where: { code: d.code } });
    if (!existing) {
      await db.department.create({ data: { ...d, position } });
    } else if (!existing.color || (!existing.logoUrl && !existing.logoKey)) {
      await db.department.update({
        where: { id: existing.id },
        data: {
          color: existing.color ?? d.color,
          ...(!existing.logoUrl && !existing.logoKey ? { logoUrl: d.logoUrl } : {}),
        },
      });
    }
  }
  // Subject areas (สาขาวิชา): created when missing; they inherit their department's logo and colour.
  for (const [position, sa] of ACADEMY_SUBJECT_AREAS.entries()) {
    if (await db.department.findUnique({ where: { code: sa.code } })) continue;
    const parent = await db.department.findUnique({ where: { code: sa.parent } });
    if (!parent) continue;
    await db.department.create({ data: { code: sa.code, name: sa.name, nameTh: sa.nameTh, parentId: parent.id, position } });
  }
}
