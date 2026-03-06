-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COORDINATOR', 'OBSERVER', 'STUDENT');

-- CreateEnum
CREATE TYPE "Term" AS ENUM ('GUZ', 'BAHAR', 'YAZ');

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "courseId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reportWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evalWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "practicePenaltyCoef" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "theoryPenaltyCoef" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "rot1Weight" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "rot2Weight" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "absTheoryMax" INTEGER NOT NULL DEFAULT 0,
    "absPracticeMax" INTEGER NOT NULL DEFAULT 0,
    "studentCanSeeReportScores" BOOLEAN NOT NULL DEFAULT false,
    "studentCanSeeReportWeekly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "nameSurname" TEXT NOT NULL,
    "sex" TEXT,
    "photoUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "shareContact" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observer" (
    "id" TEXT NOT NULL,
    "nameSurname" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "photoUrl" TEXT,
    "pinHash" TEXT NOT NULL,
    "messageFlag" TEXT NOT NULL DEFAULT 'A',
    "isCoordinator" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priorityOrder" INTEGER NOT NULL DEFAULT 999,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dailyQuota" INTEGER NOT NULL DEFAULT 0,
    "genderRule" TEXT,
    "priorityOrder" INTEGER NOT NULL DEFAULT 999,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalContact" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "title" TEXT,

    CONSTRAINT "HospitalContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "periodId" TEXT,
    "actorRole" "Role",
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Student_periodId_studentNo_key" ON "Student"("periodId", "studentNo");

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalContact" ADD CONSTRAINT "HospitalContact_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
