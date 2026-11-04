import { notFound } from "next/navigation";
import type { Material } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { offeringAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { formatBytes, formatDateTime, termLabel } from "@/lib/format";
import { AddMaterialForm } from "./AddMaterialForm";
import { deleteMaterialAction, toggleMaterialAction } from "./actions";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await offeringAccess(user, id);
  if (!access) notFound();
  const canManage = access === "manage";

  const offering = await db.courseOffering.findUnique({
    where: { id },
    include: {
      course: true,
      term: true,
      enrollments: {
        include: { user: { select: { id: true, username: true, fullName: true } } },
        orderBy: { user: { username: "asc" } },
      },
      materials: {
        where: canManage ? {} : { isPublished: true },
        orderBy: [{ week: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!offering) notFound();

  const instructors = offering.enrollments.filter((e) => e.role === "INSTRUCTOR");
  const students = offering.enrollments.filter((e) => e.role === "STUDENT");

  const byWeek = new Map<number | null, Material[]>();
  for (const m of offering.materials) {
    byWeek.set(m.week, [...(byWeek.get(m.week) ?? []), m]);
  }
  const groups = [...byWeek.entries()].sort(([a], [b]) => (a ?? -1) - (b ?? -1));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-brand-600">
          {offering.course.code} · {termLabel(offering.term)}
          {offering.section !== "1" ? ` · กลุ่ม ${offering.section}` : ""}
        </div>
        <h1 className="text-2xl font-semibold">{offering.course.titleTh || offering.course.title}</h1>
        {offering.course.titleTh && <div className="text-slate-500">{offering.course.title}</div>}
        <div className="mt-1 text-sm text-slate-500">
          อาจารย์: {instructors.map((e) => e.user.fullName).join(", ") || "—"}
        </div>
        {offering.course.description && <p className="mt-3 max-w-3xl text-sm text-slate-700">{offering.course.description}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="card">
          <h2 className="mb-4 font-semibold">เอกสารประกอบการสอน</h2>
          {groups.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีเอกสาร</p>}
          <div className="space-y-6">
            {groups.map(([week, items]) => (
              <div key={week ?? "none"}>
                <h3 className="mb-2 text-sm font-semibold text-slate-500">
                  {week == null ? "ทั่วไป" : week === 0 ? "ก่อนเริ่มเรียน" : `สัปดาห์ที่ ${week}`}
                </h3>
                <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                  {items.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-start gap-3 p-3">
                      <span className="mt-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                        {m.type === "FILE" ? "ไฟล์" : "ลิงก์"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={m.type === "FILE" ? `/api/materials/${m.id}/download` : m.url!}
                          target={m.type === "LINK" ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {m.title}
                        </a>
                        {!m.isPublished && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">ยังไม่เผยแพร่</span>
                        )}
                        {m.description && <p className="text-sm text-slate-600">{m.description}</p>}
                        <p className="text-xs text-slate-400">
                          {m.fileName && `${m.fileName} · ${formatBytes(m.sizeBytes)} · `}
                          {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex gap-2">
                          <form action={toggleMaterialAction}>
                            <input type="hidden" name="materialId" value={m.id} />
                            <button className="btn-secondary">{m.isPublished ? "ซ่อน" : "เผยแพร่"}</button>
                          </form>
                          <form action={deleteMaterialAction}>
                            <input type="hidden" name="materialId" value={m.id} />
                            <button className="btn-danger">ลบ</button>
                          </form>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          {canManage && (
            <section className="card">
              <h2 className="mb-4 font-semibold">เพิ่มเอกสาร</h2>
              <AddMaterialForm offeringId={offering.id} />
            </section>
          )}
          {canManage && (
            <section className="card">
              <h2 className="mb-3 font-semibold">นักเรียน ({students.length})</h2>
              <ul className="max-h-96 space-y-1 overflow-y-auto text-sm">
                {students.map((e) => (
                  <li key={e.id}>
                    <span className="text-slate-400">{e.user.username}</span> {e.user.fullName}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
