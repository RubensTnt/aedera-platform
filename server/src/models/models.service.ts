import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ModelsService {
  constructor(private prisma: PrismaService) {}

  async list(projectId: string) {
    return this.prisma.ifcModel.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }


  async create(data: {
    id: string;
    projectId: string;
    label: string;
    fileName: string;
    fileKey: string;
    size?: number;
  }) {
    const exists = await this.prisma.project.findUnique({
      where: { id: data.projectId },
    });
    if (!exists) throw new NotFoundException("Project not found");

    return this.prisma.ifcModel.create({ data });
  }


  async indexElements(
    projectId: string,
    modelId: string,
    data: { elements: Array<{ guid: string; ifcType: string; name?: string | null; typeName?: string | null; category?: string | null }> },
  ) {
    const model = await this.prisma.ifcModel.findFirst({
      where: { id: modelId, projectId },
      select: { id: true },
    });
    if (!model) throw new Error('IfcModel not found for project');

    const elements = (data.elements ?? [])
      .map(e => ({
        guid: String(e.guid ?? '').trim(),
        ifcType: String(e.ifcType ?? '').trim(),
        name: e.name ?? null,
        typeName: e.typeName ?? null,
        category: e.category ?? null,
      }))
      .filter(e => e.guid && e.ifcType);

    const CHUNK = 2000;

    await this.prisma.$transaction(async (tx) => {
      // reindex completo del modello
      await tx.modelElement.deleteMany({ where: { modelId } });

      for (let i = 0; i < elements.length; i += CHUNK) {
        const batch = elements.slice(i, i + CHUNK).map(e => ({
          modelId,
          guid: e.guid,
          ifcType: e.ifcType,
          name: e.name,
          typeName: e.typeName,
          category: e.category,
        }));

        await tx.modelElement.createMany({ data: batch, skipDuplicates: true });
      }
    });

    return { ok: true, elements: elements.length };
  }


  async remove(projectId: string, modelId: string) {
    const model = await this.prisma.ifcModel.findFirst({
      where: { id: modelId, projectId },
    });
    if (!model) throw new NotFoundException("Model not found");

    await this.prisma.ifcModel.delete({ where: { id: modelId } });
    return model;
  }
 
}


