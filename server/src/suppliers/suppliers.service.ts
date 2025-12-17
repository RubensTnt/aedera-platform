import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  list(projectId: string) {
    return this.prisma.supplier.findMany({
      where: { projectId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, isActive: true },
    });
  }

  async create(projectId: string, body: { name: string; code?: string }) {
    const name = (body?.name ?? "").trim();
    if (!name) throw new BadRequestException("Missing supplier name");

    return this.prisma.supplier.create({
      data: {
        projectId,
        name,
        code: typeof body.code === "string" ? body.code.trim() || null : null,
        isActive: true,
      },
      select: { id: true, name: true, code: true, isActive: true },
    });
  }

  async update(
    projectId: string,
    id: string,
    body: { name?: string; code?: string | null; isActive?: boolean },
  ) {
    const existing = await this.prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Supplier not found");
    if (existing.projectId !== projectId) throw new BadRequestException("Wrong projectId");

    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: typeof body.name === "string" ? body.name.trim() : undefined,
        code: body.code !== undefined ? (body.code ? body.code.trim() : null) : undefined,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      },
      select: { id: true, name: true, code: true, isActive: true },
    });
  }
}
