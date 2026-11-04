-- AlterTable
ALTER TABLE "CourseOffering" ADD COLUMN     "gradeScale" JSONB,
ADD COLUMN     "showTotalToStudents" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "GradeCategory" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeItem" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "categoryId" TEXT,
    "assignmentId" TEXT,
    "title" TEXT NOT NULL,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "isReleased" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "points" DOUBLE PRECISION,
    "feedback" TEXT,
    "gradedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeCategory_offeringId_idx" ON "GradeCategory"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeItem_assignmentId_key" ON "GradeItem"("assignmentId");

-- CreateIndex
CREATE INDEX "GradeItem_offeringId_idx" ON "GradeItem"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_itemId_studentId_key" ON "Grade"("itemId", "studentId");

-- AddForeignKey
ALTER TABLE "GradeCategory" ADD CONSTRAINT "GradeCategory_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeItem" ADD CONSTRAINT "GradeItem_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeItem" ADD CONSTRAINT "GradeItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GradeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeItem" ADD CONSTRAINT "GradeItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GradeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
