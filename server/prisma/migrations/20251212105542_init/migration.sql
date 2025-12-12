-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementDatiWbs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ifcGlobalId" TEXT NOT NULL,
    "modelLabel" TEXT,
    "wbs0" TEXT,
    "wbs1" TEXT,
    "wbs2" TEXT,
    "wbs3" TEXT,
    "wbs4" TEXT,
    "wbs5" TEXT,
    "wbs6" TEXT,
    "wbs7" TEXT,
    "wbs8" TEXT,
    "wbs9" TEXT,
    "wbs10" TEXT,
    "tariffaCodice" TEXT,
    "pacchettoCodice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementDatiWbs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_code_idx" ON "Project"("code");

-- CreateIndex
CREATE INDEX "ElementDatiWbs_projectId_idx" ON "ElementDatiWbs"("projectId");

-- CreateIndex
CREATE INDEX "ElementDatiWbs_ifcGlobalId_idx" ON "ElementDatiWbs"("ifcGlobalId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementDatiWbs_projectId_ifcGlobalId_key" ON "ElementDatiWbs"("projectId", "ifcGlobalId");

-- AddForeignKey
ALTER TABLE "ElementDatiWbs" ADD CONSTRAINT "ElementDatiWbs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
