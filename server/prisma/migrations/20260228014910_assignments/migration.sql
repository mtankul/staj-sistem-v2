-- CreateTable
CREATE TABLE "StudentAssignment" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rotationNo" INTEGER NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capacity_lookup" ON "StudentAssignment"("periodId", "rotationNo", "dayOfWeek", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAssignment_periodId_studentId_rotationNo_key" ON "StudentAssignment"("periodId", "studentId", "rotationNo");

-- AddForeignKey
ALTER TABLE "StudentAssignment" ADD CONSTRAINT "StudentAssignment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssignment" ADD CONSTRAINT "StudentAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssignment" ADD CONSTRAINT "StudentAssignment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssignment" ADD CONSTRAINT "StudentAssignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
