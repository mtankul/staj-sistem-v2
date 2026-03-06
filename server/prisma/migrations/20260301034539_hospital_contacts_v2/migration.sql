/*
  Warnings:

  - You are about to drop the column `name` on the `HospitalContact` table. All the data in the column will be lost.
  - Added the required column `nameSurname` to the `HospitalContact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `HospitalContact` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "HospitalContact" DROP CONSTRAINT "HospitalContact_hospitalId_fkey";

-- AlterTable
ALTER TABLE "HospitalContact" DROP COLUMN "name",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nameSurname" TEXT NOT NULL,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "HospitalContact_hospitalId_idx" ON "HospitalContact"("hospitalId");

-- AddForeignKey
ALTER TABLE "HospitalContact" ADD CONSTRAINT "HospitalContact_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
