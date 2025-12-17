-- CreateEnum
CREATE TYPE "ElementParamType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'ENUM', 'DATE', 'JSON');

-- CreateTable
CREATE TABLE "WbsNode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WbsNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementWbsAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ifcGlobalId" TEXT NOT NULL,
    "wbsNodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementWbsAssignment_pkey" PRIMARY KEY ("id")
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
    "ifcGlobalId" TEXT NOT NULL,
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
    "ifcGlobalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "definitionId" TEXT,
    "wbsNodeId" TEXT,
    "oldValueJson" JSONB,
    "newValueJson" JSONB,
    "changedByUserId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'UI',
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElementParamHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WbsNode_projectId_parentId_idx" ON "WbsNode"("projectId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "WbsNode_projectId_code_key" ON "WbsNode"("projectId", "code");

-- CreateIndex
CREATE INDEX "ElementWbsAssignment_projectId_wbsNodeId_idx" ON "ElementWbsAssignment"("projectId", "wbsNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementWbsAssignment_projectId_ifcGlobalId_key" ON "ElementWbsAssignment"("projectId", "ifcGlobalId");

-- CreateIndex
CREATE INDEX "ElementParamDefinition_projectId_isActive_idx" ON "ElementParamDefinition"("projectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ElementParamDefinition_projectId_key_key" ON "ElementParamDefinition"("projectId", "key");

-- CreateIndex
CREATE INDEX "ElementParamValue_projectId_definitionId_idx" ON "ElementParamValue"("projectId", "definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementParamValue_projectId_ifcGlobalId_definitionId_key" ON "ElementParamValue"("projectId", "ifcGlobalId", "definitionId");

-- CreateIndex
CREATE INDEX "ElementParamHistory_projectId_ifcGlobalId_changedAt_idx" ON "ElementParamHistory"("projectId", "ifcGlobalId", "changedAt");

-- CreateIndex
CREATE INDEX "ElementParamHistory_projectId_kind_changedAt_idx" ON "ElementParamHistory"("projectId", "kind", "changedAt");

-- AddForeignKey
ALTER TABLE "WbsNode" ADD CONSTRAINT "WbsNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsNode" ADD CONSTRAINT "WbsNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WbsNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementWbsAssignment" ADD CONSTRAINT "ElementWbsAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementWbsAssignment" ADD CONSTRAINT "ElementWbsAssignment_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "ElementParamHistory" ADD CONSTRAINT "ElementParamHistory_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementParamHistory" ADD CONSTRAINT "ElementParamHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
