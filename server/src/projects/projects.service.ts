import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async list(opts?: { archived?: string; user?: { id: string; platformRole?: string } }) {
    const archived = opts?.archived;
    const user = opts?.user;

    const baseWhere: any = {};

    // filtro archived
    if (archived === "true") baseWhere.archivedAt = { not: null };
    else if (archived === "all") {
      // nessun filtro archivedAt
    } else {
      baseWhere.archivedAt = null; // default attivi
    }

    // filtro membership (a meno che PLATFORM_MANAGER)
    const isManager = user?.platformRole === "PLATFORM_MANAGER";

    if (!isManager) {
      // solo progetti in cui sono membro
      baseWhere.members = { some: { userId: user?.id ?? "__no_user__" } };
    }

    return this.prisma.project.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(body: { id?: string; name: string; code?: string }, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: body.id,
          name: body.name,
          code: body.code ?? null,
        },
      });

      await tx.projectMember.upsert({
        where: {
          projectId_userId: { projectId: project.id, userId },
        },
        update: { role: "OWNER" },
        create: {
          projectId: project.id,
          userId,
          role: "OWNER",
        },
      });

      // Seed param definitions (idempotente)
      await tx.elementParamDefinition.upsert({
        where: { projectId_key: { projectId: project.id, key: "codiceMateriale" } },
        update: {},
        create: {
          projectId: project.id,
          key: "codiceMateriale",
          label: "Codice materiale",
          type: "STRING",
          isMulti: false,
          isActive: true,
          isRequired: false,
          isReadOnly: false,
        },
      });

      await tx.elementParamDefinition.upsert({
        where: { projectId_key: { projectId: project.id, key: "fornitore" } },
        update: { type: "SUPPLIER", isMulti: true },
        create: {
          projectId: project.id,
          key: "fornitore",
          label: "Fornitore",
          type: "SUPPLIER",
          isMulti: true,
          isActive: true,
          isRequired: false,
          isReadOnly: false,
        },
      });

      
      await tx.elementParamDefinition.upsert({
        where: { projectId_key: { projectId: project.id, key: "tariffaCodice" } },
        update: {},
        create: {
          projectId: project.id,
          key: "tariffaCodice",
          label: "Codice tariffa",
          type: "STRING",
          isMulti: false,
          isActive: true,
          isRequired: false,
          isReadOnly: false,
        },
      });

      await tx.elementParamDefinition.upsert({
        where: { projectId_key: { projectId: project.id, key: "pacchettoCodice" } },
        update: {},
        create: {
          projectId: project.id,
          key: "pacchettoCodice",
          label: "Codice pacchetto",
          type: "STRING",
          isMulti: false,
          isActive: true,
          isRequired: false,
          isReadOnly: false,
        },
      });
return project;
    });
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
