/*
  Warnings:

  - You are about to drop the column `sourceTemplateId` on the `PeriodReportSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `sourceTemplateVersion` on the `PeriodReportSnapshot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PeriodReportSnapshot" DROP COLUMN "sourceTemplateId",
DROP COLUMN "sourceTemplateVersion",
ADD COLUMN     "totalPoints" INTEGER NOT NULL DEFAULT 100;
