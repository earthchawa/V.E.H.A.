-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "offeringId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_departmentId_createdAt_idx" ON "AuditLog"("departmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_offeringId_idx" ON "AuditLog"("offeringId");


-- Backfill existing entries (same rules as lib/audit.ts).
UPDATE "AuditLog" l SET "offeringId" = l."targetId" WHERE l."targetType" = 'CourseOffering';
UPDATE "AuditLog" l SET "offeringId" = t."offeringId" FROM "Material" t WHERE l."targetType" = 'Material' AND t."id" = l."targetId";
UPDATE "AuditLog" l SET "offeringId" = t."offeringId" FROM "Assignment" t WHERE l."targetType" = 'Assignment' AND t."id" = l."targetId";
UPDATE "AuditLog" l SET "offeringId" = a."offeringId" FROM "Submission" t JOIN "Assignment" a ON a."id" = t."assignmentId" WHERE l."targetType" = 'Submission' AND t."id" = l."targetId";
UPDATE "AuditLog" l SET "offeringId" = t."offeringId" FROM "Quiz" t WHERE l."targetType" = 'Quiz' AND t."id" = l."targetId";
UPDATE "AuditLog" l SET "offeringId" = q."offeringId" FROM "QuizQuestion" t JOIN "Quiz" q ON q."id" = t."quizId" WHERE l."targetType" = 'QuizQuestion' AND t."id" = l."targetId";
UPDATE "AuditLog" l SET "offeringId" = q."offeringId" FROM "QuizAttempt" t JOIN "Quiz" q ON q."id" = t."quizId" WHERE l."targetType" = 'QuizAttempt' AND t."id" = l."targetId";
UPDATE "AuditLog" l SET "offeringId" = t."offeringId" FROM "GradeCategory" t WHERE l."targetType" = 'GradeCategory' AND t."id" = l."targetId";
UPDATE "AuditLog" l SET "offeringId" = t."offeringId" FROM "GradeItem" t WHERE l."targetType" = 'GradeItem' AND t."id" = l."targetId";

UPDATE "AuditLog" l SET "departmentId" = c."departmentId"
  FROM "CourseOffering" o JOIN "Course" c ON c."id" = o."courseId"
  WHERE l."offeringId" = o."id";
UPDATE "AuditLog" l SET "departmentId" = c."departmentId" FROM "Course" c
  WHERE l."departmentId" IS NULL AND l."targetType" = 'Course' AND c."id" = l."targetId";
UPDATE "AuditLog" l SET "departmentId" = u."departmentId" FROM "User" u
  WHERE l."departmentId" IS NULL AND l."offeringId" IS NULL AND l."targetType" = 'User' AND u."id" = l."targetId";
UPDATE "AuditLog" l SET "departmentId" = u."departmentId" FROM "User" u
  WHERE l."departmentId" IS NULL AND l."offeringId" IS NULL AND u."id" = l."actorId";
