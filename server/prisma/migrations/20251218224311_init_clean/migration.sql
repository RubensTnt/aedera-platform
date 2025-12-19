/*
  Warnings:

  - The primary key for the `AederaClassification` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `elementGid` on the `AederaClassification` table. All the data in the column will be lost.
  - You are about to drop the column `ifcGlobalId` on the `ElementParamHistory` table. All the data in the column will be lost.
  - You are about to drop the column `wbsNodeId` on the `ElementParamHistory` table. All the data in the column will be lost.
  - You are about to drop the column `ifcGlobalId` on the `ElementParamValue` table. All the data in the column will be lost.
  - You are about to drop the `AssignmentRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BimElement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BimFieldMapping` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BimRawProperty` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[modelId,guid]` on the table `AederaClassification` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[modelId,guid,definitionId]` on the table `ElementParamValue` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `guid` to the `AederaClassification` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `AederaClassification` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `guid` to the `ElementParamHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `modelId` to the `ElementParamHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guid` to the `ElementParamValue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `modelId` to the `ElementParamValue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "ClassificationSource" ADD VALUE 'IFC_IMPORT';

-- DropForeignKey
ALTER TABLE "AederaClassification" DROP CONSTRAINT "AederaClassification_elementGid_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentRule" DROP CONSTRAINT "AssignmentRule_projectId_fkey";

-- DropForeignKey
ALTER TABLE "BimElement" DROP CONSTRAINT "BimElement_modelId_fkey";

-- DropForeignKey
ALTER TABLE "BimFieldMapping" DROP CONSTRAINT "BimFieldMapping_ifcModelId_fkey";

-- DropForeignKey
ALTER TABLE "BimFieldMapping" DROP CONSTRAINT "BimFieldMapping_projectId_fkey";

-- DropForeignKey
ALTER TABLE "BimRawProperty" DROP CONSTRAINT "BimRawProperty_elementGid_fkey";

-- DropForeignKey
ALTER TABLE "ElementParamHistory" DROP CONSTRAINT "ElementParamHistory_wbsNodeId_fkey";

-- DropIndex
DROP INDEX "ElementParamHistory_projectId_ifcGlobalId_changedAt_idx";

-- DropIndex
DROP INDEX "ElementParamValue_projectId_ifcGlobalId_definitionId_key";

-- AlterTable
ALTER TABLE "AederaClassification" DROP CONSTRAINT "AederaClassification_pkey",
DROP COLUMN "elementGid",
ADD COLUMN     "guid" TEXT NOT NULL,
ADD COLUMN     "id" TEXT NOT NULL,
ALTER COLUMN "source" SET DEFAULT 'MANUAL',
ADD CONSTRAINT "AederaClassification_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ElementParamHistory" DROP COLUMN "ifcGlobalId",
DROP COLUMN "wbsNodeId",
ADD COLUMN     "guid" TEXT NOT NULL,
ADD COLUMN     "modelId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ElementParamValue" DROP COLUMN "ifcGlobalId",
ADD COLUMN     "guid" TEXT NOT NULL,
ADD COLUMN     "modelId" TEXT NOT NULL;

-- DropTable
DROP TABLE "AssignmentRule";

-- DropTable
DROP TABLE "BimElement";

-- DropTable
DROP TABLE "BimFieldMapping";

-- DropTable
DROP TABLE "BimRawProperty";

-- DropEnum
DROP TYPE "AederaBimField";

-- DropEnum
DROP TYPE "DomainField";

-- DropEnum
DROP TYPE "MatcherType";

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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificationHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "oldValueJson" JSONB,
    "newValueJson" JSONB,
    "source" TEXT NOT NULL DEFAULT 'UI',
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" TEXT NOT NULL,

    CONSTRAINT "ClassificationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementQto" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "qtoJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementQto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelElement_modelId_ifcType_idx" ON "ModelElement"("modelId", "ifcType");

-- CreateIndex
CREATE INDEX "ModelElement_guid_idx" ON "ModelElement"("guid");

-- CreateIndex
CREATE UNIQUE INDEX "ModelElement_modelId_guid_key" ON "ModelElement"("modelId", "guid");

-- CreateIndex
CREATE INDEX "ClassificationHistory_projectId_modelId_guid_changedAt_idx" ON "ClassificationHistory"("projectId", "modelId", "guid", "changedAt");

-- CreateIndex
CREATE INDEX "ElementQto_modelId_idx" ON "ElementQto"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementQto_modelId_guid_key" ON "ElementQto"("modelId", "guid");

-- CreateIndex
CREATE UNIQUE INDEX "AederaClassification_modelId_guid_key" ON "AederaClassification"("modelId", "guid");

-- CreateIndex
CREATE INDEX "ElementParamHistory_projectId_modelId_guid_changedAt_idx" ON "ElementParamHistory"("projectId", "modelId", "guid", "changedAt");

-- CreateIndex
CREATE INDEX "ElementParamValue_modelId_idx" ON "ElementParamValue"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementParamValue_modelId_guid_definitionId_key" ON "ElementParamValue"("modelId", "guid", "definitionId");

-- AddForeignKey
ALTER TABLE "ModelElement" ADD CONSTRAINT "ModelElement_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "IfcModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AederaClassification" ADD CONSTRAINT "AederaClassification_modelId_guid_fkey" FOREIGN KEY ("modelId", "guid") REFERENCES "ModelElement"("modelId", "guid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationHistory" ADD CONSTRAINT "ClassificationHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationHistory" ADD CONSTRAINT "ClassificationHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementQto" ADD CONSTRAINT "ElementQto_modelId_guid_fkey" FOREIGN KEY ("modelId", "guid") REFERENCES "ModelElement"("modelId", "guid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementQto" ADD CONSTRAINT "ElementQto_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "IfcModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
