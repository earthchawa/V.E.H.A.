import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { termLabel } from "@/lib/format";
import { unenrollAction } from "../../actions";
import { EnrollForm } from "./EnrollForm";

export default async function OfferingAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offering = await db.courseOffering.findUnique({
    where: { id },
    include: {
      course: true,
      term: true,
      enrollments: {
        include: { user: { select: { username: true, fullName: true } } },
        orderBy: [{ role: "desc" }, { user: { username: "asc" } }],
      },
    },
  });
  if (!offering) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/courses" className="text-sm text-brand-600 hover:underline">← ภาคเรียน & วิชา</Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {offering.course.code} {offering.course.titleTh || offering.course.title}
        </h1>
        <p className="text-sm text-slate-500">{termLabel(offering.term)} · กลุ่ม {offering.section} ·{" "}
          <Link href={`/courses/${offering.id}`} className="text-brand-600 hover:underline">ไปหน้าวิชา</Link>
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <section className="card"><h2 className="mb-4 font-semibold">เพิ่มอาจารย์ / นักเรียน</h2><EnrollForm offeringId={offering.id} /></section>
        <section className="card overflow-x-auto">
          <h2 className="mb-4 font-semibold">รายชื่อ ({offering.enrollments.length})</h2>
          <table className="table">
            <thead><tr><th>รหัส</th><th>ชื่อ</th><th>บทบาทในวิชา</th><th /></tr></thead>
            <tbody>
              {offering.enrollments.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono">{e.user.username}</td>
                  <td>{e.user.fullName}</td>
                  <td>{e.role === "INSTRUCTOR" ? "อาจารย์ผู้สอน" : "นักเรียน"}</td>
                  <td className="text-right">
                    <form action={unenrollAction}>
                      <input type="hidden" name="enrollmentId" value={e.id} />
                      <button className="btn-danger">นำออก</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
