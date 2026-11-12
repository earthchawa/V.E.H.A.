import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/format";
import { formatPoints } from "@/lib/grades";
import { getI18n } from "@/lib/i18n/server";
import {
  acceptsSubmissions,
  studentCanSeeReport,
  submissionStatus,
  toBangkokLocal,
  uploadLimits,
} from "@/lib/assignments";
import { config } from "@/lib/config";
import { SimilarityBadge } from "@/components/SimilarityBadge";
import { AssignmentForm } from "../AssignmentForm";
import { SubmitForm } from "../SubmitForm";
import { StatusBadge } from "../StatusBadge";
import { RecheckButton } from "../ManageButtons";
import { MoreMenu, MenuConfirm } from "@/components/MoreMenu";
import { copyAssignmentAction, deleteAssignmentAction } from "../actions";
import { siblingSections } from "@/lib/sections";
import { CopyToSections } from "@/components/CopyToSections";
import { Modal } from "@/components/Modal";
import { ConfirmButton } from "../../grades/ConfirmButton";
import {
  PastAssignmentForm, AiAnswersForm,
  ReferenceDocumentForm,
  type PastOption,
} from "../ReferenceForms";
import { AI_ANSWER_VARIANTS, AI_SOURCE_PREFIX, aiAnswerModel, aiAnswersEnabled } from "@/lib/ai-answers";
import { removeReferenceAction } from "../actions";
import { InfoTip } from "@/components/InfoTip";

/** Generating AI reference answers (a server action of this page) can take a minute or two. */
export const maxDuration = 180;

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string; aid: string }>;
}) {
  const { id, aid } = await params;
  const { user, offering, canManage, students } = await loadCourse(id);
  const { t, tn, date, pct, term } = await getI18n();

  const assignment = await db.assignment.findUnique({
    where: { id: aid },
    include: { gradeItem: true },
  });
  if (
    !assignment ||
    assignment.offeringId !== offering.id ||
    (!canManage && !assignment.isPublished)
  )
    notFound();
  const base = `/courses/${offering.id}/assignments/${assignment.id}`;

  /** Title and due date on the left; the instructor's actions on the right. */
  const header = (actions?: React.ReactNode) => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">
            {assignment.title}
          </h2>
          {!assignment.isPublished && (
            <span className="badge bg-surface-3 text-muted">
              {t("asg.draft")}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          {assignment.dueAt
            ? t("asg.due", { date: date(assignment.dueAt) })
            : t("asg.noDue")}
        </p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
  const instructions = assignment.instructions && (
    <section className="card">
      <h3 className="card-title">{t("asg.instructions")}</h3>
      <div className="whitespace-pre-wrap text-sm leading-7 text-fg/90">
        {assignment.instructions}
      </div>
    </section>
  );

  // ---------- Instructor view ----------
  if (canManage) {
    const [categories, itemGrades] = await Promise.all([
      db.gradeCategory.findMany({
        where: { offeringId: offering.id },
        orderBy: { position: "asc" },
        select: { id: true, name: true },
      }),
      assignment.gradeItem
        ? db.grade.findMany({ where: { itemId: assignment.gradeItem.id } })
        : Promise.resolve([]),
    ]);
    const scoreOf = new Map(itemGrades.map((g) => [g.studentId, g.points]));
    const siblings = await siblingSections(user, offering.id);
    const [submissions, matches] = await Promise.all([
      db.submission.findMany({
        where: { assignmentId: assignment.id },
        include: {
          student: { select: { id: true, username: true, fullName: true } },
        },
      }),
      db.similarityMatch.findMany({ where: { assignmentId: assignment.id } }),
    ]);
    // Reference library: what is already linked, and which other runs of this course could be.
    const [sources, pastCandidates] = await Promise.all([
      db.similaritySource.findMany({
        where: { assignmentId: assignment.id },
        orderBy: { createdAt: "asc" },
        include: {
          matches: { select: { score: true, submissionId: true } },
          pastAssignment: {
            select: { _count: { select: { submissions: true } } },
          },
        },
      }),
      db.assignment.findMany({
        where: {
          offeringId: { not: offering.id },
          offering: { courseId: offering.courseId },
        },
        include: {
          offering: { include: { term: true } },
          _count: { select: { submissions: true } },
        },
        orderBy: [
          { offering: { term: { academicYear: "desc" } } },
          { offering: { term: { semester: "desc" } } },
          { createdAt: "asc" },
        ],
      }),
    ]);
    const linked = new Set(
      sources.map((s) => s.pastAssignmentId).filter(Boolean),
    );
    const pastOptions: PastOption[] = pastCandidates
      .filter((a) => !linked.has(a.id) && a._count.submissions > 0)
      .map((a) => ({
        id: a.id,
        label: `${term(a.offering.term)} · ${t("tc.section")} ${a.offering.section} — ${a.title}`,
        submissions: a._count.submissions,
      }));
    const byStudent = new Map(submissions.map((s) => [s.studentId, s]));
    const nameOf = new Map(submissions.map((s) => [s.id, s.student.fullName]));
    const rows = students
      .map((e) => ({ student: e.user, sub: byStudent.get(e.user.id) }))
      .sort((a, b) => (b.sub?.similarity ?? -1) - (a.sub?.similarity ?? -1));
    const pairs = matches
      .map((m) => ({ ...m, top: Math.max(m.scoreA, m.scoreB) }))
      .sort((a, b) => b.top - a.top)
      .slice(0, 8);

    return (
      <div>
        {header(
          <MoreMenu testId="assignment-more">
            <Modal
              label={<><span className="menu-icon" aria-hidden>✎</span> {t("asg.edit")}</>}
              title={t("asg.edit")}
              buttonClassName="menu-item"
              size="lg"
              testId="edit-assignment"
            >
              <AssignmentForm
                offeringId={offering.id}
                assignmentId={assignment.id}
                defaults={{
                  title: assignment.title,
                  instructions: assignment.instructions ?? "",
                  dueAt: toBangkokLocal(assignment.dueAt),
                  allowLate: assignment.allowLate,
                  isPublished: assignment.isPublished,
                  checkSimilarity: assignment.checkSimilarity,
                  ignoreCommon: assignment.ignoreCommon,
                  reportVisibility: assignment.reportVisibility,
                  baseText: assignment.baseText ?? "",
                  points: assignment.gradeItem
                    ? String(assignment.gradeItem.maxPoints)
                    : "",
                  categoryId: assignment.gradeItem?.categoryId ?? "",
                }}
                categories={categories}
                closeOnSuccess
              />
            </Modal>
            {siblings.length > 0 && (
              <CopyToSections
                action={copyAssignmentAction}
                itemId={assignment.id}
                sections={siblings}
                kind="assignment"
                itemTitle={assignment.title}
                menuItem
              />
            )}
            <MenuConfirm
              action={deleteAssignmentAction}
              name="assignmentId"
              value={assignment.id}
              message={t("asg.deleteConfirm")}
              label={t("asg.delete")}
              icon="✕"
              testId="delete-assignment"
            />
          </MoreMenu>,
        )}
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-6">
            {instructions}
            <section className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold">
                  {t("asg.submissions")}{" "}
                  <span className="font-normal text-subtle">
                    {t("asg.submittedCount", {
                      n: submissions.length,
                      total: students.length,
                    })}
                  </span>
                </h3>
                <div className="ml-auto">
                  {assignment.checkSimilarity ? (
                    <RecheckButton assignmentId={assignment.id} />
                  ) : (
                    <span className="text-xs text-subtle">
                      {t("asg.checkOff")}
                    </span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="pl-5">{t("asg.cadet")}</th>
                      <th>{t("users.status")}</th>
                      <th>{t("asg.submitted")}</th>
                      <th>{t("asg.similarity")}</th>
                      {assignment.gradeItem && <th>{t("asg.score")}</th>}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ student, sub }) => (
                      <tr key={student.id}>
                        <td className="pl-5">
                          <span className="font-mono text-xs text-subtle">
                            {student.username}
                          </span>{" "}
                          {student.fullName}
                        </td>
                        <td>
                          <StatusBadge
                            status={submissionStatus(assignment, sub)}
                          />
                        </td>
                        <td className="whitespace-nowrap text-xs text-muted">
                          {sub ? (
                            <>
                              {date(sub.submittedAt)}{" "}
                              <span className="text-subtle">
                                · {t("asg.version", { n: sub.version })}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {sub && assignment.checkSimilarity ? (
                            <SimilarityBadge score={sub.similarity} />
                          ) : (
                            <span className="text-subtle">—</span>
                          )}
                        </td>
                        {assignment.gradeItem && (
                          <td className="font-mono text-xs">
                            {scoreOf.get(student.id) != null ? (
                              `${formatPoints(scoreOf.get(student.id))} / ${formatPoints(assignment.gradeItem.maxPoints)}`
                            ) : (
                              <span className="text-subtle">—</span>
                            )}
                          </td>
                        )}
                        <td className="pr-5 text-right">
                          {sub && (
                            <Link
                              href={`${base}/report/${sub.id}`}
                              className="btn-secondary"
                            >
                              {t("asg.report")}
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            {assignment.checkSimilarity && (
              <section className="card">
                <h3 className="card-title">{t("asg.topPairs")}</h3>
                {pairs.length === 0 ? (
                  <p className="text-sm text-muted">{t("rep.noMatches")}</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {pairs.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`${base}/compare?a=${p.aId}&b=${p.bId}`}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-surface-2"
                          data-testid="pair"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {nameOf.get(p.aId)} ↔ {nameOf.get(p.bId)}
                          </span>
                          <span className="font-mono text-xs text-muted">
                            {pct(p.top)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {assignment.checkSimilarity && (
              <section className="card" data-testid="reference-library">
                <h3 className="card-title flex items-center gap-1.5">
                  {t("src.title.card")}{" "}
                  <InfoTip text={`${t("src.cardHint")} ${t(aiAnswersEnabled() ? "src.cardHint.ai" : "src.cardHint.local")}`} align="end" />
                </h3>
                {sources.length === 0 ? (
                  <p className="mb-3 text-sm text-subtle">{t("src.none")}</p>
                ) : (
                  <ul className="mb-3 space-y-2">
                    {sources.map((s) => {
                      const hit = new Set(s.matches.map((m) => m.submissionId))
                        .size;
                      const top = s.matches.reduce(
                        (n, m) => Math.max(n, m.score),
                        0,
                      );
                      const isAi =
                        s.kind === "DOCUMENT" &&
                        s.title.startsWith(AI_SOURCE_PREFIX);
                      const title = isAi
                        ? s.title.slice(AI_SOURCE_PREFIX.length)
                        : s.title;
                      return (
                        <li
                          key={s.id}
                          className="rounded-lg border border-border px-3 py-2 text-sm"
                          data-testid="reference"
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`badge mt-0.5 shrink-0 ${s.kind === "DOCUMENT" ? "bg-accent/10 text-accent" : "bg-surface-3 text-muted"}`}
                            >
                              {t(
                                isAi
                                  ? "src.kind.ai"
                                  : s.kind === "DOCUMENT"
                                    ? "src.kind.doc"
                                    : "src.kind.past",
                              )}
                            </span>
                            <span className="min-w-0 flex-1 break-words">
                              {s.url ? (
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="hover:text-accent hover:underline"
                                >
                                  {title}
                                </a>
                              ) : (
                                title
                              )}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2 text-xs text-subtle">
                            <span className="flex-1">
                              {s.kind === "PAST_ASSIGNMENT" && (
                                <>
                                  {tn(
                                    "src.subs",
                                    s.pastAssignment?._count.submissions ?? 0,
                                  )}{" "}
                                  ·{" "}
                                </>
                              )}
                              {hit
                                ? t("src.hits", { n: hit, top: pct(top) })
                                : t("src.noHits")}
                            </span>
                            <ConfirmButton
                              action={removeReferenceAction}
                              name="sourceId"
                              value={s.id}
                              message={t("src.removeConfirm")}
                              label={t("src.remove")}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <Modal
                    label={`+ ${t("src.addDoc")}`}
                    title={t("src.addDoc")}
                    buttonClassName="btn-secondary"
                    size="lg"
                    testId="add-reference-doc"
                  >
                    <ReferenceDocumentForm assignmentId={assignment.id} aiEnabled={aiAnswersEnabled()} />
                  </Modal>
                  <Modal
                    label={`+ ${t("src.addPast")}`}
                    title={t("src.addPast")}
                    buttonClassName="btn-secondary"
                    testId="add-reference-past"
                  >
                    <PastAssignmentForm
                      assignmentId={assignment.id}
                      options={pastOptions}
                    />
                  </Modal>
                  {aiAnswersEnabled() && (
                    <Modal
                      label={<><span aria-hidden>✦</span> {t("ai.button")}</>}
                      title={t("ai.title")}
                      buttonClassName="btn-secondary"
                      testId="add-reference-ai"
                    >
                      <AiAnswersForm assignmentId={assignment.id} variants={AI_ANSWER_VARIANTS} model={aiAnswerModel()} />
                    </Modal>
                  )}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    );
  }

  // ---------- Cadet view ----------
  const mine = await db.submission.findUnique({
    where: {
      assignmentId_studentId: {
        assignmentId: assignment.id,
        studentId: user.id,
      },
    },
    include: { files: { orderBy: { createdAt: "asc" } } },
  });
  const myGrade = assignment.gradeItem?.isReleased
    ? await db.grade.findUnique({
        where: {
          itemId_studentId: {
            itemId: assignment.gradeItem.id,
            studentId: user.id,
          },
        },
      })
    : null;
  const open = acceptsSubmissions(assignment);
  const canSeeReport = studentCanSeeReport(assignment);

  return (
    <div>
      {header()}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          {instructions}
          <section className="card">
            <h3 className="card-title">{t("asg.yourSubmission")}</h3>
            {open ? (
              <SubmitForm
                assignmentId={assignment.id}
                defaultText={mine?.textAnswer ?? ""}
                hasFiles={!!mine?.files.length}
                resubmit={!!mine}
                limits={uploadLimits(config.maxUploadMb)}
              />
            ) : (
              <p className="text-sm text-muted">{t("asg.closed")}</p>
            )}
          </section>
        </div>
        <aside className="space-y-6">
          <section className="card space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{t("users.status")}</span>
              <StatusBadge status={submissionStatus(assignment, mine)} />
            </div>
            {myGrade?.points != null && assignment.gradeItem && (
              <div className="rounded-lg bg-surface-2 px-3 py-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted">
                    {t("gr.yourScore")}
                  </span>
                  <span
                    className="font-mono text-lg font-semibold"
                    data-testid="assignment-score"
                  >
                    {formatPoints(myGrade.points)}{" "}
                    <span className="text-sm font-normal text-subtle">
                      / {formatPoints(assignment.gradeItem.maxPoints)}
                    </span>
                  </span>
                </div>
                {myGrade.feedback && (
                  <p className="mt-2 whitespace-pre-wrap border-t border-border pt-2 text-sm text-muted">
                    {myGrade.feedback}
                  </p>
                )}
              </div>
            )}
            {mine && (
              <>
                <p className="text-xs text-subtle">
                  {t("asg.submittedAt", { date: date(mine.submittedAt) })} ·{" "}
                  {t("asg.version", { n: mine.version })}
                </p>
                {mine.files.length > 0 && (
                  <ul className="space-y-1.5 text-sm">
                    {mine.files.map((f) => (
                      <li key={f.id} className="flex items-center gap-2">
                        <a
                          href={`/api/submission-files/${f.id}`}
                          className="min-w-0 flex-1 truncate transition hover:text-accent"
                        >
                          {f.fileName}
                        </a>
                        <span className="shrink-0 text-xs text-subtle">
                          {f.extracted
                            ? formatBytes(f.sizeBytes)
                            : t("asg.notAnalyzed")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {assignment.checkSimilarity &&
                  (canSeeReport ? (
                    <div className="flex items-center justify-between border-t border-border pt-4">
                      <SimilarityBadge score={mine.similarity} showLevel />
                      <Link
                        href={`${base}/report/${mine.id}`}
                        className="btn-secondary"
                      >
                        {t("asg.viewReport")}
                      </Link>
                    </div>
                  ) : assignment.reportVisibility === "AFTER_DUE" ? (
                    <p className="border-t border-border pt-4 text-xs text-muted">
                      {t("asg.reportAfterDue")}
                    </p>
                  ) : null)}
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
