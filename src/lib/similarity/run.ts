import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { checkAll, type Segment } from "./engine";

/** Re-run the similarity check for every submission of an assignment and store the results. */
export async function recheckAssignment(assignmentId: string): Promise<void> {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { submissions: { select: { id: true, content: true, segments: true } } },
  });
  if (!assignment.checkSimilarity) {
    await db.$transaction([
      db.similarityMatch.deleteMany({ where: { assignmentId } }),
      db.submission.updateMany({ where: { assignmentId }, data: { similarity: null, checkedAt: null } }),
    ]);
    return;
  }

  const result = checkAll(
    assignment.submissions.map((s) => ({ id: s.id, content: s.content, segments: s.segments as Segment[] })),
    // Starter text and the instructions themselves (cadets often paste the questions into answers).
    [assignment.baseText, assignment.instructions].filter(Boolean).join("\n\n"),
    { ignoreCommon: assignment.ignoreCommon },
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
    ...[...result.similarity].map(([id, similarity]) =>
      db.submission.update({ where: { id }, data: { similarity, checkedAt: now } }),
    ),
  ]);
}
