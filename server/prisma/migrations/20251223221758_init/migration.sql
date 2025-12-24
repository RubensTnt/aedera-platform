-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_MANAGER', 'USER');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "ElementParamType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'ENUM', 'DATE', 'JSON', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "WbsAssignmentStatus" AS ENUM ('VALID', 'INVALID');

-- CreateEnum
CREATE TYPE "WbsAssignmentSource" AS ENUM ('UI', 'IFC_IMPORT', 'RULE');

-- CreateEnum
CREATE TYPE "ScenarioType" AS ENUM ('GARA', 'PRIMA_STESURA', 'COSTI', 'FORECAST');

-- CreateEnum
CREATE TYPE "ScenarioVersionStatus" AS ENUM ('DRAFT', 'LOCKED');

-- CreateEnum
CREATE TYPE "QtySource" AS ENUM ('MANUAL', 'MODEL', 'MODEL_PLUS_MARGIN', 'IMPORT');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "IfcModel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentVersionId" TEXT,

    CONSTRAINT "IfcModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IfcModelVersion" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IfcModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelElement" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "ifcType" TEXT NOT NULL,
    "name" TEXT,
    "typeName" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelElement_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scenario" "ScenarioType" NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "status" "ScenarioVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT,
    "notes" TEXT,
    "derivedFromVersionId" TEXT,
    "createdByUserId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioActiveVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scenario" "ScenarioType" NOT NULL,
    "versionId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioActiveVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "wbsKey" TEXT NOT NULL,
    "wbs" JSONB NOT NULL,
    "tariffaCodice" TEXT NOT NULL,
    "description" TEXT,
    "uom" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyModelSuggested" DOUBLE PRECISION,
    "qtySource" "QtySource" NOT NULL DEFAULT 'MANUAL',
    "marginPct" DOUBLE PRECISION,
    "pacchettoCodice" TEXT,
    "materialeCodice" TEXT,
    "fornitoreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoqLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementParamDefinition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ElementParamType" NOT NULL,
    "optionsJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "isMulti" BOOLEAN NOT NULL DEFAULT false,
    "ifcClassFilter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementParamDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementParamValue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "valueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementParamValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementParamHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "definitionId" TEXT,
    "oldValueJson" JSONB,
    "newValueJson" JSONB,
    "changedByUserId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'UI',
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElementParamHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_code_idx" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IfcModel_currentVersionId_key" ON "IfcModel"("currentVersionId");

-- CreateIndex
CREATE INDEX "IfcModel_projectId_idx" ON "IfcModel"("projectId");

-- CreateIndex
CREATE INDEX "IfcModel_projectId_label_idx" ON "IfcModel"("projectId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "IfcModel_projectId_label_key" ON "IfcModel"("projectId", "label");

-- CreateIndex
CREATE INDEX "IfcModelVersion_modelId_createdAt_idx" ON "IfcModelVersion"("modelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IfcModelVersion_modelId_version_key" ON "IfcModelVersion"("modelId", "version");

-- CreateIndex
CREATE INDEX "ModelElement_modelId_idx" ON "ModelElement"("modelId");

-- CreateIndex
CREATE INDEX "ModelElement_modelId_guid_idx" ON "ModelElement"("modelId", "guid");

-- CreateIndex
CREATE INDEX "ModelElement_ifcType_idx" ON "ModelElement"("ifcType");

-- CreateIndex
CREATE INDEX "ModelElement_category_idx" ON "ModelElement"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ModelElement_modelId_guid_key" ON "ModelElement"("modelId", "guid");

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

-- CreateIndex
CREATE INDEX "Supplier_projectId_isActive_idx" ON "Supplier"("projectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_projectId_name_key" ON "Supplier"("projectId", "name");

-- CreateIndex
CREATE INDEX "ScenarioVersion_projectId_scenario_status_idx" ON "ScenarioVersion"("projectId", "scenario", "status");

-- CreateIndex
CREATE INDEX "ScenarioVersion_projectId_scenario_archivedAt_idx" ON "ScenarioVersion"("projectId", "scenario", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioVersion_projectId_scenario_versionNo_key" ON "ScenarioVersion"("projectId", "scenario", "versionNo");

-- CreateIndex
CREATE INDEX "ScenarioActiveVersion_projectId_versionId_idx" ON "ScenarioActiveVersion"("projectId", "versionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioActiveVersion_projectId_scenario_key" ON "ScenarioActiveVersion"("projectId", "scenario");

-- CreateIndex
CREATE INDEX "BoqLine_projectId_versionId_idx" ON "BoqLine"("projectId", "versionId");

-- CreateIndex
CREATE INDEX "BoqLine_projectId_versionId_wbsKey_idx" ON "BoqLine"("projectId", "versionId", "wbsKey");

-- CreateIndex
CREATE INDEX "BoqLine_projectId_versionId_tariffaCodice_idx" ON "BoqLine"("projectId", "versionId", "tariffaCodice");

-- CreateIndex
CREATE INDEX "ElementParamDefinition_projectId_isActive_idx" ON "ElementParamDefinition"("projectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ElementParamDefinition_projectId_key_key" ON "ElementParamDefinition"("projectId", "key");

-- CreateIndex
CREATE INDEX "ElementParamValue_projectId_definitionId_idx" ON "ElementParamValue"("projectId", "definitionId");

-- CreateIndex
CREATE INDEX "ElementParamValue_projectId_modelId_guid_idx" ON "ElementParamValue"("projectId", "modelId", "guid");

-- CreateIndex
CREATE UNIQUE INDEX "ElementParamValue_modelId_guid_definitionId_key" ON "ElementParamValue"("modelId", "guid", "definitionId");

-- CreateIndex
CREATE INDEX "ElementParamHistory_projectId_modelId_guid_changedAt_idx" ON "ElementParamHistory"("projectId", "modelId", "guid", "changedAt");

-- CreateIndex
CREATE INDEX "ElementParamHistory_projectId_kind_changedAt_idx" ON "ElementParamHistory"("projectId", "kind", "changedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IfcModel" ADD CONSTRAINT "IfcModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IfcModel" ADD CONSTRAINT "IfcModel_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "IfcModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IfcModelVersion" ADD CONSTRAINT "IfcModelVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "IfcModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelElement" ADD CONSTRAINT "ModelElement_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "IfcModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioVersion" ADD CONSTRAINT "ScenarioVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioVersion" ADD CONSTRAINT "ScenarioVersion_derivedFromVersionId_fkey" FOREIGN KEY ("derivedFromVersionId") REFERENCES "ScenarioVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioVersion" ADD CONSTRAINT "ScenarioVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioVersion" ADD CONSTRAINT "ScenarioVersion_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioVersion" ADD CONSTRAINT "ScenarioVersion_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioActiveVersion" ADD CONSTRAINT "ScenarioActiveVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioActiveVersion" ADD CONSTRAINT "ScenarioActiveVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScenarioVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqLine" ADD CONSTRAINT "BoqLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqLine" ADD CONSTRAINT "BoqLine_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScenarioVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementParamDefinition" ADD CONSTRAINT "ElementParamDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementParamValue" ADD CONSTRAINT "ElementParamValue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementParamValue" ADD CONSTRAINT "ElementParamValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "ElementParamDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementParamHistory" ADD CONSTRAINT "ElementParamHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementParamHistory" ADD CONSTRAINT "ElementParamHistory_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "ElementParamDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementParamHistory" ADD CONSTRAINT "ElementParamHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
