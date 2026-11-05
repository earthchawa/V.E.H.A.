-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'CODE';

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "language" TEXT,
ADD COLUMN     "starter" JSONB NOT NULL DEFAULT '{}';

