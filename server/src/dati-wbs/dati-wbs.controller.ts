import { Body, Controller, Param, Post } from "@nestjs/common";
import { DatiWbsService } from "./dati-wbs.service";
import { SessionGuard } from "../auth/session.guard";
import { UseGuards } from "@nestjs/common";
import { ProjectRoles } from "../authz/project-roles.decorator";
import { ProjectRoleGuard } from "../authz/project-role.guard";

@UseGuards(SessionGuard)

@Controller("/api/projects/:projectId")
export class DatiWbsController {
  constructor(private readonly service: DatiWbsService) {}

  @Post("/elements/:globalId/dati-wbs")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  upsert(
    @Param("projectId") projectId: string,
    @Param("globalId") globalId: string,
    @Body() body: Record<string, unknown>,
  ) {
    // MVP: nessuna validazione sofisticata, la aggiungiamo dopo con DTO + class-validator
    return this.service.upsert(projectId, globalId, body as any);
  }

  @Post("/dati-wbs/bulk-get")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  bulkGet(
    @Param("projectId") projectId: string,
    @Body() body: { globalIds?: string[] },
  ) {
    return this.service.bulkGet(projectId, body.globalIds ?? []);
  }
}
