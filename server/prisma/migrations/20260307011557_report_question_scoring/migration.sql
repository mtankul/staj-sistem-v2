-- CreateTable
CREATE TABLE "WeeklyReportQuestionScore" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rotationNo" INTEGER NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "score" DOUBLE PRECISION DEFAULT 0,
    "comment" TEXT,
    "gradedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReportQuestionScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportQuestionScore_periodId_studentId_rotationNo_wee_key" ON "WeeklyReportQuestionScore"("periodId", "studentId", "rotationNo", "weekNo", "questionId");
