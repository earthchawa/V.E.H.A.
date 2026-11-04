import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { termLabel } from "@/lib/format";

export const metadata = { title: "วิชาของฉัน" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const user = await requireUser();
  const { term: termParam } = await searchParams;

  const terms = await db.term.findMany({ orderBy: [{ academicYear: "desc" }, { semester: "desc" }] });
  const term = terms.find((t) => t.id === termParam) ?? terms.find((t) => t.isCurrent) ?? terms[0];

  const where: Prisma.CourseOfferingWhereInput = {
    termId: term?.id ?? "__none__",
    ...(user.role === "ADMIN" ? {} : { enrollments: { some: { userId: user.id } } }),
  };
  const offerings = await db.courseOffering.findMany({
    where,
    include: {
      course: true,
      enrollments: { where: { role: "INSTRUCTOR" }, include: { user: { select: { fullName: true } } } },
      _count: { select: { materials: { where: { isPublished: true } } } },
    },
    orderBy: { course: { code: "asc" } },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">วิชาของฉัน</h1>
          <p className="text-sm text-slate-500">{term ? termLabel(term) : "ยังไม่มีภาคเรียนในระบบ"}</p>
        </div>
        {terms.length > 1 && (
          <form className="flex items-center gap-2 text-sm">
            <label htmlFor="term" className="text-slate-500">ภาคเรียน</label>
            <select id="term" name="term" defaultValue={term?.id} className="input w-auto">
              {terms.map((t) => (
                <option key={t.id} value={t.id}>{termLabel(t)}{t.isCurrent ? " (ปัจจุบัน)" : ""}</option>
              ))}
            </select>
            <button className="btn-secondary">ดู</button>
          </form>
        )}
      </div>

      {offerings.length === 0 ? (
        <div className="card mt-6 text-center text-slate-500">
          ยังไม่มีวิชาในภาคเรียนนี้
          {user.role === "ADMIN" && (
            <> — <Link href="/admin/courses" className="text-brand-600 hover:underline">เพิ่มวิชา</Link></>
          )}
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offerings.map((o) => (
            <li key={o.id}>
              <Link href={`/courses/${o.id}`} className="card block h-full transition hover:border-brand-600 hover:shadow">
                <div className="text-xs font-semibold text-brand-600">
                  {o.course.code}{o.section !== "1" ? ` · กลุ่ม ${o.section}` : ""}
                </div>
                <div className="mt-1 font-medium">{o.course.titleTh || o.course.title}</div>
                {o.course.titleTh && <div className="text-sm text-slate-500">{o.course.title}</div>}
                <div className="mt-3 text-xs text-slate-500">
                  {o.enrollments.map((e) => e.user.fullName).join(", ") || "ยังไม่ระบุอาจารย์"}
                </div>
                <div className="mt-1 text-xs text-slate-400">เอกสาร {o._count.materials} รายการ</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
