import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { checkAll, type CheckInput, type Segment } from "./engine";

/** Upper bound on past submissions pulled into one check (keeps a check well under a second or two). */
const MAX_PAST_SUBMISSIONS = 600;

/** The assignment's reference library as check inputs; ids encode where each came from. */
async function referenceInputs(assignmentId: string): Promise<CheckInput[]> {
  const sources = await db.similaritySource.findMany({
    where: { assignmentId },
    include: {
      pastAssignment: {
        select: { submissions: { select: { id: true, content: true, segments: true }, take: MAX_PAST_SUBMISSIONS } },
      },
    },
  });
  const refs: CheckInput[] = [];
  for (const src of sources) {
    if (src.kind === "DOCUMENT") refs.push({ id: `${src.id}|`, content: src.content, segments: src.segments as Segment[] });
    else for (const sub of src.pastAssignment?.submissions ?? []) refs.push({ id: `${src.id}|${sub.id}`, content: sub.content, segments: sub.segments as Segment[] });
  }
  return refs.slice(0, MAX_PAST_SUBMISSIONS);
}

/** Re-run the similarity check for every submission of an assignment and store the results. */
export async function recheckAssignment(assignmentId: string): Promise<void> {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { submissions: { select: { id: true, content: true, segments: true } } },
  });
  if (!assignment.checkSimilarity) {
    await db.$transaction([
      db.similarityMatch.deleteMany({ where: { assignmentId } }),
      db.sourceMatch.deleteMany({ where: { submission: { assignmentId } } }),
      db.submission.updateMany({ where: { assignmentId }, data: { similarity: null, checkedAt: null } }),
    ]);
    return;
  }

  const result = checkAll(
    assignment.submissions.map((s) => ({ id: s.id, content: s.content, segments: s.segments as Segment[] })),
    // Starter text and the instructions themselves (cadets often paste the questions into answers).
    [assignment.baseText, assignment.instructions].filter(Boolean).join("\n\n"),
    { ignoreCommon: assignment.ignoreCommon, refs: await referenceInputs(assignmentId) },
  );
  const now = new Date();
  await db.$transaction([
    db.similarityMatch.deleteMany({ where: { assignmentId } }),
    db.similarityMatch.createMany({
      data: result.matches.map((m) => ({
        assignmentId,
        aId: m.aId,
        bId: m.bId,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        spansA: m.spansA as Prisma.InputJsonValue,
        spansB: m.spansB as Prisma.InputJsonValue,
      })),
    }),
    db.sourceMatch.deleteMany({ where: { submission: { assignmentId } } }),
    db.sourceMatch.createMany({
      data: result.refMatches.map((m) => {
        const [sourceId, refSubmissionId] = m.refId.split("|");
        return { submissionId: m.subId, sourceId, refSubmissionId: refSubmissionId || null, score: m.score, spans: m.spans as Prisma.InputJsonValue };
      }),
    }),
    ...[...result.similarity].map(([id, similarity]) =>
      db.submission.update({ where: { id }, data: { similarity, checkedAt: now } }),
    ),
  ]);
}
