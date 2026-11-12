import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { checkAll, type CheckInput, type Segment } from "./engine";

/** Upper bound on past submissions pulled into one check (keeps a check well under a second or two). */
const MAX_PAST_SUBMISSIONS = 600;

type Tx = Prisma.TransactionClient;

/** The assignment's reference library as check inputs; ids encode where each came from. */
async function referenceInputs(tx: Tx, assignmentId: string): Promise<CheckInput[]> {
  const sources = await tx.similaritySource.findMany({
    where: { assignmentId },
    orderBy: { createdAt: "asc" },
    include: {
      pastAssignment: {
        select: { submissions: { select: { id: true, content: true, segments: true }, take: MAX_PAST_SUBMISSIONS } },
      },
    },
  });
  // Documents first, so the cap below only ever trims past submissions, never a text the instructor added.
  const docs: CheckInput[] = [];
  const past: CheckInput[] = [];
  for (const src of sources) {
    if (src.kind === "DOCUMENT") docs.push({ id: `${src.id}|`, content: src.content, segments: src.segments as Segment[] });
    else for (const sub of src.pastAssignment?.submissions ?? []) past.push({ id: `${src.id}|${sub.id}`, content: sub.content, segments: sub.segments as Segment[] });
  }
  return [...docs, ...past.slice(0, MAX_PAST_SUBMISSIONS)];
}

/**
 * Re-run the similarity check for every submission of an assignment and store the results.
 *
 * Runs under a per-assignment advisory lock: when several cadets submit at once (near a deadline), the checks
 * queue instead of overlapping. Overlapping checks would each work from a stale list of submissions and then
 * collide on SimilarityMatch's unique (aId, bId), failing a submission that had already been saved.
 */
export async function recheckAssignment(assignmentId: string): Promise<void> {
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`similarity:${assignmentId}`}))`;
      await recheckLocked(tx, assignmentId);
    },
    { maxWait: 20_000, timeout: 180_000 },
  );
}

async function recheckLocked(tx: Tx, assignmentId: string): Promise<void> {
  const assignment = await tx.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { submissions: { select: { id: true, content: true, segments: true } } },
  });
  if (!assignment.checkSimilarity) {
    await tx.similarityMatch.deleteMany({ where: { assignmentId } });
    await tx.sourceMatch.deleteMany({ where: { submission: { assignmentId } } });
    await tx.submission.updateMany({ where: { assignmentId }, data: { similarity: null, checkedAt: null } });
    return;
  }

  const result = checkAll(
    assignment.submissions.map((s) => ({ id: s.id, content: s.content, segments: s.segments as Segment[] })),
    // Starter text and the instructions themselves (cadets often paste the questions into answers).
    [assignment.baseText, assignment.instructions].filter(Boolean).join("\n\n"),
    { ignoreCommon: assignment.ignoreCommon, refs: await referenceInputs(tx, assignmentId) },
  );
  const now = new Date();
  await tx.similarityMatch.deleteMany({ where: { assignmentId } });
  await tx.similarityMatch.createMany({
    data: result.matches.map((m) => ({
      assignmentId,
      aId: m.aId,
      bId: m.bId,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      spansA: m.spansA as Prisma.InputJsonValue,
      spansB: m.spansB as Prisma.InputJsonValue,
    })),
  });
  await tx.sourceMatch.deleteMany({ where: { submission: { assignmentId } } });
  await tx.sourceMatch.createMany({
    data: result.refMatches.map((m) => {
      const [sourceId, refSubmissionId] = m.refId.split("|");
      return { submissionId: m.subId, sourceId, refSubmissionId: refSubmissionId || null, score: m.score, spans: m.spans as Prisma.InputJsonValue };
    }),
  });
  for (const [id, similarity] of result.similarity) await tx.submission.update({ where: { id }, data: { similarity, checkedAt: now } });
}
