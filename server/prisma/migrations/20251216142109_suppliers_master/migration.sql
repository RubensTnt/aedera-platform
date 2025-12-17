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

-- CreateIndex
CREATE INDEX "Supplier_projectId_isActive_idx" ON "Supplier"("projectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_projectId_name_key" ON "Supplier"("projectId", "name");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
