import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { PROJECT_ROLES_KEY } from "./project-roles.decorator";
import type { PlatformRole, ProjectRole } from "@prisma/client";

const ROLE_RANK: Record<ProjectRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(private prisma: PrismaService, private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: any }>();

    const user = req.user;
    if (!user) throw new ForbiddenException("Missing user");

    // Superuser: platform manager
    const platformRole = user.platformRole as PlatformRole | undefined;
    if (platformRole === "PLATFORM_MANAGER") return true;

    const required = this.reflector.getAllAndOverride<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // Se non ci sono ruoli richiesti, non bloccare (ma in pratica lo useremo sempre)
    if (!required || required.length === 0) return true;

    const projectId =
      (req.params as any).projectId ??
      (req.params as any).id ??
      null;

    if (!projectId) {
      throw new ForbiddenException("Missing projectId");
    }

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
      select: { role: true },
    });

    if (!member) {
      throw new ForbiddenException("Not a project member");
    }

    const userRank = ROLE_RANK[member.role];
    const minRequiredRank = Math.min(...required.map((r) => ROLE_RANK[r]));

    if (userRank < minRequiredRank) {
      throw new ForbiddenException("Insufficient project role");
    }

    return true;
  }
}
