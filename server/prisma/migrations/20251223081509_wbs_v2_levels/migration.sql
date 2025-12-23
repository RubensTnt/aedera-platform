-- CreateEnum
CREATE TYPE "WbsAssignmentStatus" AS ENUM ('VALID', 'INVALID');

-- CreateEnum
CREATE TYPE "WbsAssignmentSource" AS ENUM ('UI', 'IFC_IMPORT', 'RULE');

-- CreateTable
CREATE TABLE "WbsLevelSetting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "levelKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "ifcParamKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WbsLevelSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WbsAllowedValue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "levelKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WbsAllowedValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WbsAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "levelKey" TEXT NOT NULL,
    "status" "WbsAssignmentStatus" NOT NULL DEFAULT 'VALID',
    "allowedValueId" TEXT,
    "rawCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WbsAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WbsAssignmentHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "levelKey" TEXT NOT NULL,
    "assignmentId" TEXT,
    "oldStatus" "WbsAssignmentStatus",
    "newStatus" "WbsAssignmentStatus",
    "oldAllowedValueId" TEXT,
    "newAllowedValueId" TEXT,
    "oldRawCode" TEXT,
    "newRawCode" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "source" "WbsAssignmentSource" NOT NULL DEFAULT 'UI',
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WbsAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WbsLevelSetting_projectId_sortIndex_idx" ON "WbsLevelSetting"("projectId", "sortIndex");

-- CreateIndex
CREATE UNIQUE INDEX "WbsLevelSetting_projectId_levelKey_key" ON "WbsLevelSetting"("projectId", "levelKey");

-- CreateIndex
CREATE INDEX "WbsAllowedValue_projectId_levelKey_idx" ON "WbsAllowedValue"("projectId", "levelKey");

-- CreateIndex
CREATE INDEX "WbsAllowedValue_projectId_levelKey_sortIndex_idx" ON "WbsAllowedValue"("projectId", "levelKey", "sortIndex");

-- CreateIndex
CREATE UNIQUE INDEX "WbsAllowedValue_projectId_levelKey_code_key" ON "WbsAllowedValue"("projectId", "levelKey", "code");

-- CreateIndex
CREATE INDEX "WbsAssignment_projectId_modelId_idx" ON "WbsAssignment"("projectId", "modelId");

-- CreateIndex
CREATE INDEX "WbsAssignment_projectId_levelKey_status_idx" ON "WbsAssignment"("projectId", "levelKey", "status");

-- CreateIndex
CREATE INDEX "WbsAssignment_projectId_modelId_levelKey_idx" ON "WbsAssignment"("projectId", "modelId", "levelKey");

-- CreateIndex
CREATE UNIQUE INDEX "WbsAssignment_modelId_guid_levelKey_key" ON "WbsAssignment"("modelId", "guid", "levelKey");

-- CreateIndex
CREATE INDEX "WbsAssignmentHistory_projectId_modelId_guid_levelKey_change_idx" ON "WbsAssignmentHistory"("projectId", "modelId", "guid", "levelKey", "changedAt");

-- CreateIndex
CREATE INDEX "WbsAssignmentHistory_projectId_levelKey_changedAt_idx" ON "WbsAssignmentHistory"("projectId", "levelKey", "changedAt");

-- AddForeignKey
ALTER TABLE "WbsLevelSetting" ADD CONSTRAINT "WbsLevelSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsAllowedValue" ADD CONSTRAINT "WbsAllowedValue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsAssignment" ADD CONSTRAINT "WbsAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsAssignment" ADD CONSTRAINT "WbsAssignment_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "IfcModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsAssignment" ADD CONSTRAINT "WbsAssignment_allowedValueId_fkey" FOREIGN KEY ("allowedValueId") REFERENCES "WbsAllowedValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsAssignmentHistory" ADD CONSTRAINT "WbsAssignmentHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsAssignmentHistory" ADD CONSTRAINT "WbsAssignmentHistory_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WbsAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsAssignmentHistory" ADD CONSTRAINT "WbsAssignmentHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
