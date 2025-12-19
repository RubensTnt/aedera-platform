/*
  Warnings:

  - You are about to drop the `ElementDatiWbs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ElementWbsAssignment` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AederaBimField" AS ENUM ('WBS', 'CODICE_TARIFFA', 'CODICE_PACCHETTO', 'CODICE_MATERIALE', 'CODICE_PROGETTAZIONE', 'FORNITORE');

-- CreateEnum
CREATE TYPE "DomainField" AS ENUM ('WBS', 'TARIFFA', 'PACCHETTO', 'MATERIALE', 'FORNITORE', 'PROGETTAZIONE');

-- CreateEnum
CREATE TYPE "MatcherType" AS ENUM ('EQUALS', 'STARTS_WITH', 'REGEX', 'MAP');

-- CreateEnum
CREATE TYPE "ClassificationSource" AS ENUM ('RULE', 'MANUAL');

-- DropForeignKey
ALTER TABLE "ElementDatiWbs" DROP CONSTRAINT "ElementDatiWbs_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ElementWbsAssignment" DROP CONSTRAINT "ElementWbsAssignment_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ElementWbsAssignment" DROP CONSTRAINT "ElementWbsAssignment_wbsNodeId_fkey";

-- DropTable
DROP TABLE "ElementDatiWbs";

-- DropTable
DROP TABLE "ElementWbsAssignment";

-- CreateTable
CREATE TABLE "BimElement" (
    "gid" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "ifcType" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "BimElement_pkey" PRIMARY KEY ("gid")
);

-- CreateTable
CREATE TABLE "BimRawProperty" (
    "id" TEXT NOT NULL,
    "elementGid" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "BimRawProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BimFieldMapping" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ifcModelId" TEXT,
    "field" "AederaBimField" NOT NULL,
    "source" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BimFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domainField" "DomainField" NOT NULL,
    "inputSource" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "matcher" "MatcherType" NOT NULL,
    "matchValue" TEXT NOT NULL,
    "outputRefId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AederaClassification" (
    "elementGid" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "tariffaCode" TEXT,
    "pacchettoCode" TEXT,
    "materialeCode" TEXT,
    "progettazioneCode" TEXT,
    "supplierId" TEXT,
    "source" "ClassificationSource" NOT NULL,
    "ruleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AederaClassification_pkey" PRIMARY KEY ("elementGid")
);

-- CreateIndex
CREATE INDEX "BimElement_modelId_idx" ON "BimElement"("modelId");

-- CreateIndex
CREATE INDEX "BimRawProperty_elementGid_idx" ON "BimRawProperty"("elementGid");

-- CreateIndex
CREATE INDEX "BimRawProperty_source_key_idx" ON "BimRawProperty"("source", "key");

-- CreateIndex
CREATE UNIQUE INDEX "BimRawProperty_elementGid_source_key_value_key" ON "BimRawProperty"("elementGid", "source", "key", "value");

-- CreateIndex
CREATE INDEX "BimFieldMapping_projectId_ifcModelId_idx" ON "BimFieldMapping"("projectId", "ifcModelId");

-- CreateIndex
CREATE UNIQUE INDEX "BimFieldMapping_projectId_ifcModelId_field_key" ON "BimFieldMapping"("projectId", "ifcModelId", "field");

-- CreateIndex
CREATE INDEX "AssignmentRule_projectId_domainField_priority_idx" ON "AssignmentRule"("projectId", "domainField", "priority");

-- CreateIndex
CREATE INDEX "AssignmentRule_projectId_enabled_idx" ON "AssignmentRule"("projectId", "enabled");

-- CreateIndex
CREATE INDEX "AederaClassification_projectId_idx" ON "AederaClassification"("projectId");

-- CreateIndex
CREATE INDEX "AederaClassification_projectId_wbsNodeId_idx" ON "AederaClassification"("projectId", "wbsNodeId");

-- CreateIndex
CREATE INDEX "AederaClassification_projectId_supplierId_idx" ON "AederaClassification"("projectId", "supplierId");

-- CreateIndex
CREATE INDEX "AederaClassification_projectId_modelId_idx" ON "AederaClassification"("projectId", "modelId");

-- CreateIndex
CREATE INDEX "IfcModel_projectId_label_idx" ON "IfcModel"("projectId", "label");

-- AddForeignKey
ALTER TABLE "BimElement" ADD CONSTRAINT "BimElement_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "IfcModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimRawProperty" ADD CONSTRAINT "BimRawProperty_elementGid_fkey" FOREIGN KEY ("elementGid") REFERENCES "BimElement"("gid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimFieldMapping" ADD CONSTRAINT "BimFieldMapping_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimFieldMapping" ADD CONSTRAINT "BimFieldMapping_ifcModelId_fkey" FOREIGN KEY ("ifcModelId") REFERENCES "IfcModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRule" ADD CONSTRAINT "AssignmentRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AederaClassification" ADD CONSTRAINT "AederaClassification_elementGid_fkey" FOREIGN KEY ("elementGid") REFERENCES "BimElement"("gid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AederaClassification" ADD CONSTRAINT "AederaClassification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AederaClassification" ADD CONSTRAINT "AederaClassification_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "IfcModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AederaClassification" ADD CONSTRAINT "AederaClassification_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AederaClassification" ADD CONSTRAINT "AederaClassification_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
