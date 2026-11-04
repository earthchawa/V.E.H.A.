-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE', 'MULTIPLE', 'SHORT', 'ESSAY');

-- CreateEnum
CREATE TYPE "QuizResults" AS ENUM ('HIDDEN', 'SCORE', 'FULL');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- AlterTable
ALTER TABLE "GradeItem" ADD COLUMN     "quizId" TEXT;

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "timeLimitMin" INTEGER,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "results" "QuizResults" NOT NULL DEFAULT 'SCORE',
    "requireSeb" BOOLEAN NOT NULL DEFAULT false,
    "sebConfigKeys" TEXT,
    "allowedIps" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB NOT NULL DEFAULT '[]',
    "accepted" JSONB NOT NULL DEFAULT '[]',
    "codeAnswer" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "points" DOUBLE PRECISION,
    "feedback" TEXT,
    "autoGraded" BOOLEAN NOT NULL DEFAULT false,
    "gradedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "QuizEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quiz_offeringId_idx" ON "Quiz"("offeringId");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_idx" ON "QuizQuestion"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_quizId_studentId_key" ON "QuizAttempt"("quizId", "studentId");

-- CreateIndex
CREATE INDEX "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "QuizEvent_attemptId_idx" ON "QuizEvent"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeItem_quizId_key" ON "GradeItem"("quizId");

-- AddForeignKey
ALTER TABLE "GradeItem" ADD CONSTRAINT "GradeItem_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizEvent" ADD CONSTRAINT "QuizEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

