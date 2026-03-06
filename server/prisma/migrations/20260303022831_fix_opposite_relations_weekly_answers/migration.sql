-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplateQuestion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "orderNo" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReportTemplateQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodReportSnapshot" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "sourceTemplateId" TEXT,
    "sourceTemplateVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodReportQuestion" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "orderNo" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PeriodReportQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReportAnswer" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rotationNo" INTEGER NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReportAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodWeekSetting" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "studentCanSeeReportScore" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PeriodWeekSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportTemplate_isActive_idx" ON "ReportTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ReportTemplateQuestion_templateId_idx" ON "ReportTemplateQuestion"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodReportSnapshot_periodId_key" ON "PeriodReportSnapshot"("periodId");

-- CreateIndex
CREATE INDEX "PeriodReportQuestion_snapshotId_idx" ON "PeriodReportQuestion"("snapshotId");

-- CreateIndex
CREATE INDEX "WeeklyReportAnswer_periodId_rotationNo_weekNo_idx" ON "WeeklyReportAnswer"("periodId", "rotationNo", "weekNo");

-- CreateIndex
CREATE INDEX "WeeklyReportAnswer_questionId_idx" ON "WeeklyReportAnswer"("questionId");

-- CreateIndex
CREATE INDEX "WeeklyReportAnswer_studentId_idx" ON "WeeklyReportAnswer"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportAnswer_periodId_studentId_rotationNo_weekNo_que_key" ON "WeeklyReportAnswer"("periodId", "studentId", "rotationNo", "weekNo", "questionId");

-- CreateIndex
CREATE INDEX "PeriodWeekSetting_periodId_weekNo_idx" ON "PeriodWeekSetting"("periodId", "weekNo");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodWeekSetting_periodId_weekNo_key" ON "PeriodWeekSetting"("periodId", "weekNo");

-- AddForeignKey
ALTER TABLE "ReportTemplateQuestion" ADD CONSTRAINT "ReportTemplateQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodReportSnapshot" ADD CONSTRAINT "PeriodReportSnapshot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodReportQuestion" ADD CONSTRAINT "PeriodReportQuestion_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PeriodReportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReportAnswer" ADD CONSTRAINT "WeeklyReportAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PeriodReportQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReportAnswer" ADD CONSTRAINT "WeeklyReportAnswer_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReportAnswer" ADD CONSTRAINT "WeeklyReportAnswer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodWeekSetting" ADD CONSTRAINT "PeriodWeekSetting_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;
