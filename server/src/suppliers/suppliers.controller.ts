import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { ProjectRoleGuard } from "../authz/project-role.guard";
import { ProjectRoles } from "../authz/project-roles.decorator";
import { SuppliersService } from "./suppliers.service";

@UseGuards(SessionGuard)
@Controller("/api/projects/:projectId/suppliers")
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  // VIEWER+ -> lista fornitori (serve anche per dropdown)
  @Get()
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  list(@Param("projectId") projectId: string) {
    return this.service.list(projectId);
  }

  // ADMIN/OWNER -> crea fornitore
  @Post()
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  create(
    @Param("projectId") projectId: string,
    @Body() body: { name: string; code?: string },
  ) {
    return this.service.create(projectId, body);
  }

  // ADMIN/OWNER -> update / disattiva (soft)
  @Patch(":id")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  update(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body() body: { name?: string; code?: string | null; isActive?: boolean },
  ) {
    return this.service.update(projectId, id, body);
  }
}
