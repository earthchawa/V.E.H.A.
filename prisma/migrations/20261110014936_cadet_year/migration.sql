-- CreateTable
CREATE TABLE "CadetYear" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "yearLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CadetYear_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CadetYear_academicYear_yearLevel_idx" ON "CadetYear"("academicYear", "yearLevel");

-- CreateIndex
CREATE UNIQUE INDEX "CadetYear_userId_academicYear_key" ON "CadetYear"("userId", "academicYear");

-- AddForeignKey
ALTER TABLE "CadetYear" ADD CONSTRAINT "CadetYear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

