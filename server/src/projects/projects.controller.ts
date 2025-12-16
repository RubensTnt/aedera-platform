import { Body, Controller, Get, Post, Req, Param, Patch } from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import { Query } from "@nestjs/common";
import { UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { PlatformManagerGuard } from "../auth/platform-role.guard";
import type { Request } from "express";
import { ProjectRoles } from "../authz/project-roles.decorator";
import { ProjectRoleGuard } from "../authz/project-role.guard";


@UseGuards(SessionGuard)

@Controller("/api/projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Req() req: Request, @Query("archived") archived?: string) {
    const user = (req as any).user;
    return this.projects.list({ archived, user });
  }


  @Post()
  @UseGuards(PlatformManagerGuard)
  create(@Req() req: Request, @Body() body: { id?: string; name: string; code?: string }) {
    const userId = (req as any).user.id; // set da SessionGuard
    return this.projects.create(body, userId);
  }

  @Patch(":id")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  update(@Param("id") id: string, @Body() body: any) {
    return this.projects.update(id, body);
  }

  @Post(":id/archive")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  archive(@Param("id") id: string) {
    return this.projects.archive(id);
  }

  @Post(":id/restore")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  restore(@Param("id") id: string) {
    return this.projects.restore(id);
  }
}
