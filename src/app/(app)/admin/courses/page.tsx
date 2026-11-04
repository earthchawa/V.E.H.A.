import Link from "next/link";
import { db } from "@/lib/db";
import { termLabel } from "@/lib/format";
import { setCurrentTermAction } from "../actions";
import { CreateCourseForm, CreateOfferingForm, CreateTermForm } from "./forms";

export const metadata = { title: "ภาคเรียน & วิชา" };

export default async function AdminCoursesPage() {
  const [terms, courses] = await Promise.all([
    db.term.findMany({
      orderBy: [{ academicYear: "desc" }, { semester: "desc" }],
      include: {
        offerings: {
          include: { course: true, _count: { select: { enrollments: { where: { role: "STUDENT" } } } } },
          orderBy: { course: { code: "asc" } },
        },
      },
    }),
    db.course.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">ภาคเรียน & วิชา</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card"><h2 className="mb-4 font-semibold">1. เพิ่มภาคเรียน</h2><CreateTermForm /></section>
        <section className="card"><h2 className="mb-4 font-semibold">2. เพิ่มรายวิชา</h2><CreateCourseForm /></section>
        <section className="card">
          <h2 className="mb-4 font-semibold">3. เปิดวิชาในภาคเรียน</h2>
          {terms.length && courses.length ? (
            <CreateOfferingForm
              courses={courses.map((c) => ({ id: c.id, label: `${c.code} ${c.titleTh || c.title}` }))}
              terms={terms.map((t) => ({ id: t.id, label: termLabel(t), isCurrent: t.isCurrent }))}
            />
          ) : (
            <p className="text-sm text-slate-500">เพิ่มภาคเรียนและรายวิชาก่อน</p>
          )}
        </section>
      </div>

      {terms.map((t) => (
        <section key={t.id} className="card">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-semibold">{termLabel(t)}</h2>
            {t.isCurrent ? (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">ภาคเรียนปัจจุบัน</span>
            ) : (
              <form action={setCurrentTermAction}>
                <input type="hidden" name="termId" value={t.id} />
                <button className="btn-secondary text-xs">ตั้งเป็นภาคเรียนปัจจุบัน</button>
              </form>
            )}
          </div>
          {t.offerings.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีวิชาเปิด</p>
          ) : (
            <table className="table">
              <thead><tr><th>รหัส</th><th>วิชา</th><th>กลุ่ม</th><th>นักเรียน</th><th /></tr></thead>
              <tbody>
                {t.offerings.map((o) => (
                  <tr key={o.id}>
                    <td className="font-mono">{o.course.code}</td>
                    <td>{o.course.titleTh || o.course.title}</td>
                    <td>{o.section}</td>
                    <td>{o._count.enrollments}</td>
                    <td className="text-right">
                      <Link href={`/admin/offerings/${o.id}`} className="btn-secondary">จัดการอาจารย์/นักเรียน</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
