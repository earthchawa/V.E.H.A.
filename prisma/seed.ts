/**
 * npm run db:seed        -> creates the first admin account (if missing)
 * npm run db:seed:demo   -> also creates a demo term, courses, an instructor and students
 *
 * Every account gets a random temporary password printed here; it must be changed on first login.
 */
import { PrismaClient, type EnrollmentRole, type Role } from "@prisma/client";
import { generateTempPassword, hashPassword, tempPasswordExpiry } from "../src/lib/auth/password";

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
  await ensureUser(process.env.SEED_ADMIN_USERNAME || "admin", "ผู้ดูแลระบบ", "ADMIN");

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
    const teacher = await ensureUser("T0001", "น.ท.ตัวอย่าง สอนดี", "INSTRUCTOR");
    const students = [];
    for (let i = 1; i <= 5; i++) {
      students.push(await ensureUser(`66010${String(i).padStart(2, "0")}`, `นนอ.ทดสอบ คนที่${i}`, "STUDENT"));
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

  if (issued.length) {
    console.log("\nบัญชีที่สร้างใหม่ (รหัสผ่านชั่วคราว — ต้องเปลี่ยนเมื่อเข้าสู่ระบบครั้งแรก):");
    console.table(issued.map(([username, fullName, password]) => ({ username, fullName, password })));
  } else {
    console.log("ไม่มีบัญชีใหม่ (มีอยู่แล้วทั้งหมด)");
  }
}

main().finally(() => db.$disconnect());
