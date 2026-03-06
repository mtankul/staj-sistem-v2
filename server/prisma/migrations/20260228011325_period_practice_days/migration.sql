-- AlterTable
ALTER TABLE "Period" ADD COLUMN     "practiceDays" JSONB,
ADD COLUMN     "rot1EndWeek" INTEGER,
ADD COLUMN     "rot1StartWeek" INTEGER,
ADD COLUMN     "rot2EndWeek" INTEGER,
ADD COLUMN     "rot2StartWeek" INTEGER,
ADD COLUMN     "rotationCount" INTEGER NOT NULL DEFAULT 1;
