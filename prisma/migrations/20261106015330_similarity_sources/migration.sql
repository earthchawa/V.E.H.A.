-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('DOCUMENT', 'PAST_ASSIGNMENT');

-- CreateTable
CREATE TABLE "SimilaritySource" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "segments" JSONB NOT NULL DEFAULT '[]',
    "pastAssignmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimilaritySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceMatch" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "refSubmissionId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "spans" JSONB NOT NULL,

    CONSTRAINT "SourceMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimilaritySource_assignmentId_idx" ON "SimilaritySource"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SimilaritySource_assignmentId_pastAssignmentId_key" ON "SimilaritySource"("assignmentId", "pastAssignmentId");

-- CreateIndex
CREATE INDEX "SourceMatch_submissionId_idx" ON "SourceMatch"("submissionId");

-- CreateIndex
CREATE INDEX "SourceMatch_sourceId_idx" ON "SourceMatch"("sourceId");

-- AddForeignKey
ALTER TABLE "SimilaritySource" ADD CONSTRAINT "SimilaritySource_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimilaritySource" ADD CONSTRAINT "SimilaritySource_pastAssignmentId_fkey" FOREIGN KEY ("pastAssignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimilaritySource" ADD CONSTRAINT "SimilaritySource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMatch" ADD CONSTRAINT "SourceMatch_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMatch" ADD CONSTRAINT "SourceMatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SimilaritySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

