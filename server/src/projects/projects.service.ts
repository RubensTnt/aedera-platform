import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.project.findMany({ orderBy: { createdAt: "desc" } });
  }

  create(data: { id?: string; name: string; code?: string }) {
    return this.prisma.project.create({ data });
  }
}
