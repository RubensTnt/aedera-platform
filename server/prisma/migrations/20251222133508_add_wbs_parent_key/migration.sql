/*
  Warnings:

  - A unique constraint covering the columns `[projectId,parentKey,levelIndex,code]` on the table `WbsNode` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "WbsNode_projectId_code_key";

-- AlterTable
ALTER TABLE "WbsNode" ADD COLUMN     "levelIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentKey" TEXT NOT NULL DEFAULT 'ROOT';

-- CreateIndex
CREATE INDEX "WbsNode_projectId_levelIndex_parentId_idx" ON "WbsNode"("projectId", "levelIndex", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "WbsNode_projectId_parentKey_levelIndex_code_key" ON "WbsNode"("projectId", "parentKey", "levelIndex", "code");
