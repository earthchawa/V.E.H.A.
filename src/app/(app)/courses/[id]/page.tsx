import { notFound } from "next/navigation";
import type { Material } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { offeringAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { formatBytes, formatDateTime, termLabel } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
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
  for (const m of offering.materials) byWeek.set(m.week, [...(byWeek.get(m.week) ?? []), m]);
  const groups = [...byWeek.entries()].sort(([a], [b]) => (a ?? -1) - (b ?? -1));

  return (
    <div>
      <PageHeader
        eyebrow={`${offering.course.code} · ${termLabel(offering.term)}${offering.section !== "1" ? ` · Sec ${offering.section}` : ""}`}
        title={offering.course.title}
        description={
          <>
            {offering.course.titleTh && <div>{offering.course.titleTh}</div>}
            <div className="mt-1 text-subtle">
              {instructors.map((e) => e.user.fullName).join(", ") || "No instructor assigned"}
            </div>
          </>
        }
      />
      {offering.course.description && <p className="-mt-4 mb-8 max-w-3xl text-sm text-muted">{offering.course.description}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 className="mb-4 text-sm font-semibold">Materials</h2>
          {groups.length === 0 && (
            <div className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-sm text-muted">
              No materials yet.
            </div>
          )}
          <div className="space-y-8">
            {groups.map(([week, items]) => (
              <div key={week ?? "none"}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle">
                  {week == null ? "General" : week === 0 ? "Before class" : `Week ${week}`}
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {items.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="badge w-10 justify-center bg-surface-3 font-mono text-muted">
                        {m.type === "FILE" ? (m.fileName?.split(".").pop()?.slice(0, 4).toUpperCase() ?? "FILE") : "LINK"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={m.type === "FILE" ? `/api/materials/${m.id}/download` : m.url!}
                            target={m.type === "LINK" ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className="font-medium transition hover:text-accent"
                          >
                            {m.title}
                          </a>
                          {!m.isPublished && <span className="badge bg-amber-500/10 text-amber-300">Hidden</span>}
                        </div>
                        {m.description && <p className="mt-0.5 text-sm text-muted">{m.description}</p>}
                        <p className="mt-0.5 text-xs text-subtle">
                          {m.fileName && `${m.fileName} · ${formatBytes(m.sizeBytes)} · `}
                          {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex gap-2">
                          <form action={toggleMaterialAction}>
                            <input type="hidden" name="materialId" value={m.id} />
                            <button className="btn-secondary">{m.isPublished ? "Hide" : "Publish"}</button>
                          </form>
                          <form action={deleteMaterialAction}>
                            <input type="hidden" name="materialId" value={m.id} />
                            <button className="btn-danger">Delete</button>
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

        {canManage && (
          <aside className="space-y-6">
            <section className="card">
              <h2 className="card-title">Add material</h2>
              <AddMaterialForm offeringId={offering.id} />
            </section>
            <section className="card">
              <h2 className="card-title">Cadets <span className="font-normal text-subtle">{students.length}</span></h2>
              <ul className="max-h-96 space-y-1.5 overflow-y-auto text-sm">
                {students.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="font-mono text-xs leading-5 text-subtle">{e.user.username}</span>
                    <span>{e.user.fullName}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
