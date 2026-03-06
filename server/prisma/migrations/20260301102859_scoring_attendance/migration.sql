-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rotationNo" INTEGER NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "theoryAbsent" BOOLEAN NOT NULL DEFAULT false,
    "practiceAbsent" BOOLEAN NOT NULL DEFAULT false,
    "markedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReportScore" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rotationNo" INTEGER NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "gradedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReportScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyEvaluationScore" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rotationNo" INTEGER NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "gradedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyEvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_periodId_rotationNo_weekNo_idx" ON "Attendance"("periodId", "rotationNo", "weekNo");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_periodId_studentId_rotationNo_weekNo_key" ON "Attendance"("periodId", "studentId", "rotationNo", "weekNo");

-- CreateIndex
CREATE INDEX "WeeklyReportScore_periodId_rotationNo_weekNo_idx" ON "WeeklyReportScore"("periodId", "rotationNo", "weekNo");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportScore_periodId_studentId_rotationNo_weekNo_key" ON "WeeklyReportScore"("periodId", "studentId", "rotationNo", "weekNo");

-- CreateIndex
CREATE INDEX "WeeklyEvaluationScore_periodId_rotationNo_weekNo_idx" ON "WeeklyEvaluationScore"("periodId", "rotationNo", "weekNo");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyEvaluationScore_periodId_studentId_rotationNo_weekNo_key" ON "WeeklyEvaluationScore"("periodId", "studentId", "rotationNo", "weekNo");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReportScore" ADD CONSTRAINT "WeeklyReportScore_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReportScore" ADD CONSTRAINT "WeeklyReportScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyEvaluationScore" ADD CONSTRAINT "WeeklyEvaluationScore_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyEvaluationScore" ADD CONSTRAINT "WeeklyEvaluationScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
