-- CreateTable
CREATE TABLE "EvalTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "openQuestionText" TEXT,

    CONSTRAINT "EvalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalTemplateGroup" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL DEFAULT 1,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EvalTemplateGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalTemplateItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "orderNo" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EvalTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodEvalSnapshot" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "sourceTemplateId" TEXT,
    "sourceTemplateVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "openQuestionText" TEXT,

    CONSTRAINT "PeriodEvalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodEvalGroup" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL DEFAULT 1,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PeriodEvalGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodEvalItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "orderNo" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PeriodEvalItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvalTemplate_isActive_idx" ON "EvalTemplate"("isActive");

-- CreateIndex
CREATE INDEX "EvalTemplateGroup_templateId_idx" ON "EvalTemplateGroup"("templateId");

-- CreateIndex
CREATE INDEX "EvalTemplateItem_groupId_idx" ON "EvalTemplateItem"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodEvalSnapshot_periodId_key" ON "PeriodEvalSnapshot"("periodId");

-- CreateIndex
CREATE INDEX "PeriodEvalGroup_snapshotId_idx" ON "PeriodEvalGroup"("snapshotId");

-- CreateIndex
CREATE INDEX "PeriodEvalItem_groupId_idx" ON "PeriodEvalItem"("groupId");

-- AddForeignKey
ALTER TABLE "EvalTemplateGroup" ADD CONSTRAINT "EvalTemplateGroup_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EvalTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalTemplateItem" ADD CONSTRAINT "EvalTemplateItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EvalTemplateGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodEvalSnapshot" ADD CONSTRAINT "PeriodEvalSnapshot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodEvalGroup" ADD CONSTRAINT "PeriodEvalGroup_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PeriodEvalSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodEvalItem" ADD CONSTRAINT "PeriodEvalItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PeriodEvalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
