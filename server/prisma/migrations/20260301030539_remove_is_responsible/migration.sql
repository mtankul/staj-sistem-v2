-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "nameSurname" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "photoUrl" TEXT,
    "pinHash" TEXT NOT NULL,
    "messageFlag" TEXT NOT NULL DEFAULT 'A',
    "isObserver" BOOLEAN NOT NULL DEFAULT true,
    "isCoordinator" BOOLEAN NOT NULL DEFAULT false,
    "isResponsible" BOOLEAN NOT NULL DEFAULT false,
    "practiceDays" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherHospital" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,

    CONSTRAINT "TeacherHospital_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Teacher_periodId_idx" ON "Teacher"("periodId");

-- CreateIndex
CREATE INDEX "TeacherHospital_hospitalId_idx" ON "TeacherHospital"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherHospital_teacherId_hospitalId_key" ON "TeacherHospital"("teacherId", "hospitalId");

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHospital" ADD CONSTRAINT "TeacherHospital_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHospital" ADD CONSTRAINT "TeacherHospital_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
