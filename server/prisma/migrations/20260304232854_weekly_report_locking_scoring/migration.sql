/*
  Warnings:

  - The `status` column on the `WeeklyReportScore` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "WeeklyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVISION_REQUESTED', 'RESUBMITTED', 'APPROVED');

-- AlterTable
ALTER TABLE "WeeklyReportAnswer" ADD COLUMN     "answerHtml" TEXT,
ADD COLUMN     "answerMd" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "teacherComment" TEXT,
ADD COLUMN     "teacherEditedAt" TIMESTAMP(3),
ADD COLUMN     "teacherScore" INTEGER;

-- AlterTable
ALTER TABLE "WeeklyReportScore" ADD COLUMN     "isPublishedToStudent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "revisionNote" TEXT,
ADD COLUMN     "revisionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "WeeklyReportStatus" NOT NULL DEFAULT 'DRAFT';
