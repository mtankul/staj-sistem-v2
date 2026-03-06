-- CreateTable
CREATE TABLE "WeeklyEvaluationItemScore" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rotationNo" INTEGER NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "gradedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyEvaluationItemScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyEvaluationItemScore_periodId_rotationNo_weekNo_idx" ON "WeeklyEvaluationItemScore"("periodId", "rotationNo", "weekNo");

-- CreateIndex
CREATE INDEX "WeeklyEvaluationItemScore_studentId_idx" ON "WeeklyEvaluationItemScore"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyEvaluationItemScore_periodId_studentId_rotationNo_wee_key" ON "WeeklyEvaluationItemScore"("periodId", "studentId", "rotationNo", "weekNo", "itemId");
