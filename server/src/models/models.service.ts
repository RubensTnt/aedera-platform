import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ModelsService {
  constructor(private prisma: PrismaService) {}

  async list(projectId: string) {
    return this.prisma.ifcModel.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        currentVersion: true,
      },
    });
  }

  /**
   * Upload = crea una NUOVA VERSIONE, mantenendo lo stesso IfcModel (modelId stabile)
   * Identità del modello: (projectId, label)
   */
  async uploadNewVersion(data: {
    projectId: string;
    label: string;
    fileName: string;
    fileKey: string;
    size?: number;
  }) {
    const exists = await this.prisma.project.findUnique({
      where: { id: data.projectId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Project not found");

    // 1) upsert del modello logico (ID stabile)
    const model = await this.prisma.ifcModel.upsert({
      where: { projectId_label: { projectId: data.projectId, label: data.label } },
      update: {},
      create: { projectId: data.projectId, label: data.label },
      select: { id: true, projectId: true, label: true },
    });

    // 2) calcola next version
    const last = await this.prisma.ifcModelVersion.findFirst({
      where: { modelId: model.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    // 3) crea la versione
    const v = await this.prisma.ifcModelVersion.create({
      data: {
        modelId: model.id,
        version: nextVersion,
        fileName: data.fileName,
        fileKey: data.fileKey,
        size: data.size,
      },
    });

    // 4) set currentVersionId
    const updated = await this.prisma.ifcModel.update({
      where: { id: model.id },
      data: { currentVersionId: v.id },
      include: { currentVersion: true },
    });

    return updated;
  }

  async indexElements(
    projectId: string,
    modelId: string,
    data: {
      elements: Array<{
        guid: string;
        ifcType: string;
        name?: string | null;
        typeName?: string | null;
        category?: string | null;
      }>;
    },
  ) {
    const model = await this.prisma.ifcModel.findFirst({
      where: { id: modelId, projectId },
      select: { id: true },
    });
    if (!model) throw new Error("IfcModel not found for project");

    const elements = (data.elements ?? [])
      .map((e) => ({
        guid: String(e.guid ?? "").trim(),
        ifcType: String(e.ifcType ?? "").trim(),
        name: e.name ?? null,
        typeName: e.typeName ?? null,
        category: e.category ?? null,
      }))
      .filter((e) => e.guid && e.ifcType);

    await this.prisma.$transaction(
      async (tx) => {
        // Nota: qui cancelli e ricrei l’indice elementi del modello.
        // Non tocchi WBS/ParamValues perché quelli sono su (modelId,guid) in altre tabelle.
        await tx.modelElement.deleteMany({ where: { modelId } });

        const CHUNK = 2000;
        for (let i = 0; i < elements.length; i += CHUNK) {
          const batch = elements.slice(i, i + CHUNK).map((e) => ({
            modelId,
            guid: e.guid,
            ifcType: e.ifcType,
            name: e.name,
            typeName: e.typeName,
            category: e.category,
          }));
          await tx.modelElement.createMany({ data: batch, skipDuplicates: true });
        }
      },
      { timeout: 60000, maxWait: 10000 },
    );

    return { ok: true, elements: elements.length };
  }

  async remove(projectId: string, modelId: string) {
    const model = await this.prisma.ifcModel.findFirst({
      where: { id: modelId, projectId },
      include: { versions: true, currentVersion: true },
    });
    if (!model) throw new NotFoundException("Model not found");

    await this.prisma.ifcModel.delete({ where: { id: modelId } });
    return model; // include versions -> serve al controller per cancellare i file
  }
}
