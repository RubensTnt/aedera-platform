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

  async remove(projectId: string, modelId: string) {
    const model = await this.prisma.ifcModel.findFirst({
      where: { id: modelId, projectId },
    });
    if (!model) throw new NotFoundException("Model not found");

    await this.prisma.ifcModel.delete({ where: { id: modelId } });
    return model;
  }
}
