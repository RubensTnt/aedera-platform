-- CreateEnum
CREATE TYPE "BoqRowType" AS ENUM ('LINE', 'GROUP');

-- AlterTable
ALTER TABLE "BoqLine" ADD COLUMN     "parentLineId" TEXT,
ADD COLUMN     "rowType" "BoqRowType" NOT NULL DEFAULT 'LINE',
ADD COLUMN     "sortIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "BoqLine_projectId_versionId_sortIndex_idx" ON "BoqLine"("projectId", "versionId", "sortIndex");

-- CreateIndex
CREATE INDEX "BoqLine_projectId_versionId_parentLineId_idx" ON "BoqLine"("projectId", "versionId", "parentLineId");

-- AddForeignKey
ALTER TABLE "BoqLine" ADD CONSTRAINT "BoqLine_parentLineId_fkey" FOREIGN KEY ("parentLineId") REFERENCES "BoqLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
