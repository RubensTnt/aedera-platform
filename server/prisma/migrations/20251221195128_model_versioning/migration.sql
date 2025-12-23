/*
  Warnings:

  - The values [IFC_IMPORT] on the enum `ClassificationSource` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `materialeCode` on the `AederaClassification` table. All the data in the column will be lost.
  - You are about to drop the column `pacchettoCode` on the `AederaClassification` table. All the data in the column will be lost.
  - You are about to drop the column `progettazioneCode` on the `AederaClassification` table. All the data in the column will be lost.
  - You are about to drop the column `supplierId` on the `AederaClassification` table. All the data in the column will be lost.
  - You are about to drop the column `tariffaCode` on the `AederaClassification` table. All the data in the column will be lost.
  - You are about to drop the column `fileKey` on the `IfcModel` table. All the data in the column will be lost.
  - You are about to drop the column `fileName` on the `IfcModel` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `IfcModel` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ModelElement` table. All the data in the column will be lost.
  - You are about to drop the `ClassificationHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ElementQto` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[currentVersionId]` on the table `IfcModel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[projectId,label]` on the table `IfcModel` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `IfcModel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ClassificationSource_new" AS ENUM ('MANUAL', 'RULE');
ALTER TABLE "public"."AederaClassification" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "AederaClassification" ALTER COLUMN "source" TYPE "ClassificationSource_new" USING ("source"::text::"ClassificationSource_new");
ALTER TYPE "ClassificationSource" RENAME TO "ClassificationSource_old";
ALTER TYPE "ClassificationSource_new" RENAME TO "ClassificationSource";
DROP TYPE "public"."ClassificationSource_old";
ALTER TABLE "AederaClassification" ALTER COLUMN "source" SET DEFAULT 'MANUAL';
COMMIT;

-- DropForeignKey
ALTER TABLE "AederaClassification" DROP CONSTRAINT "AederaClassification_modelId_guid_fkey";

-- DropForeignKey
ALTER TABLE "AederaClassification" DROP CONSTRAINT "AederaClassification_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "ClassificationHistory" DROP CONSTRAINT "ClassificationHistory_changedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "ClassificationHistory" DROP CONSTRAINT "ClassificationHistory_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ElementQto" DROP CONSTRAINT "ElementQto_modelId_fkey";

-- DropForeignKey
ALTER TABLE "ElementQto" DROP CONSTRAINT "ElementQto_modelId_guid_fkey";

-- DropIndex
DROP INDEX "AederaClassification_projectId_idx";

-- DropIndex
DROP INDEX "AederaClassification_projectId_supplierId_idx";

-- DropIndex
DROP INDEX "ElementParamValue_modelId_idx";

-- DropIndex
DROP INDEX "ModelElement_guid_idx";

-- DropIndex
DROP INDEX "ModelElement_modelId_ifcType_idx";

-- AlterTable
ALTER TABLE "AederaClassification" DROP COLUMN "materialeCode",
DROP COLUMN "pacchettoCode",
DROP COLUMN "progettazioneCode",
DROP COLUMN "supplierId",
DROP COLUMN "tariffaCode";

-- AlterTable
ALTER TABLE "ElementParamHistory" ADD COLUMN     "wbsNodeId" TEXT;

-- AlterTable
ALTER TABLE "IfcModel" DROP COLUMN "fileKey",
DROP COLUMN "fileName",
DROP COLUMN "size",
ADD COLUMN     "currentVersionId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ModelElement" DROP COLUMN "updatedAt";

-- DropTable
DROP TABLE "ClassificationHistory";

-- DropTable
DROP TABLE "ElementQto";

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

-- CreateIndex
CREATE INDEX "IfcModelVersion_modelId_createdAt_idx" ON "IfcModelVersion"("modelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IfcModelVersion_modelId_version_key" ON "IfcModelVersion"("modelId", "version");

-- CreateIndex
CREATE INDEX "AederaClassification_modelId_guid_idx" ON "AederaClassification"("modelId", "guid");

-- CreateIndex
CREATE INDEX "ElementParamValue_projectId_modelId_guid_idx" ON "ElementParamValue"("projectId", "modelId", "guid");

-- CreateIndex
CREATE UNIQUE INDEX "IfcModel_currentVersionId_key" ON "IfcModel"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "IfcModel_projectId_label_key" ON "IfcModel"("projectId", "label");

-- CreateIndex
CREATE INDEX "ModelElement_modelId_idx" ON "ModelElement"("modelId");

-- CreateIndex
CREATE INDEX "ModelElement_modelId_guid_idx" ON "ModelElement"("modelId", "guid");

-- CreateIndex
CREATE INDEX "ModelElement_ifcType_idx" ON "ModelElement"("ifcType");

-- CreateIndex
CREATE INDEX "ModelElement_category_idx" ON "ModelElement"("category");

-- AddForeignKey
ALTER TABLE "IfcModel" ADD CONSTRAINT "IfcModel_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "IfcModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IfcModelVersion" ADD CONSTRAINT "IfcModelVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "IfcModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementParamHistory" ADD CONSTRAINT "ElementParamHistory_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
