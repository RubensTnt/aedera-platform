-- CreateTable
CREATE TABLE "IfcModel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IfcModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IfcModel_projectId_idx" ON "IfcModel"("projectId");

-- AddForeignKey
ALTER TABLE "IfcModel" ADD CONSTRAINT "IfcModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
