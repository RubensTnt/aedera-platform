import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async list(opts?: { archived?: string }) {
    const archived = opts?.archived;

    if (archived === "all") {
      return this.prisma.project.findMany({ orderBy: { createdAt: "desc" } });
    }

    if (archived === "true") {
      return this.prisma.project.findMany({
        where: { archivedAt: { not: null } },
        orderBy: { createdAt: "desc" },
      });
    }

    // default: attivi
    return this.prisma.project.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  create(data: { id?: string; name: string; code?: string }) {
    return this.prisma.project.create({ data });
  }


  async update(id: string, body: { name?: string; code?: string }) {
    const data: any = {};
    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.code === "string") data.code = body.code.trim() || null;

    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async archive(id: string) {
    return this.prisma.project.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async restore(id: string) {
    return this.prisma.project.update({
      where: { id },
      data: { archivedAt: null },
    });
  }

}
