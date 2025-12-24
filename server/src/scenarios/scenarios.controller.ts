import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { ProjectRoleGuard } from "../authz/project-role.guard";
import { ProjectRoles } from "../authz/project-roles.decorator";
import { ScenariosService } from "./scenarios.service";

@UseGuards(SessionGuard)
@Controller("/api/projects/:projectId/scenarios")
export class ScenariosController {
  constructor(private readonly service: ScenariosService) {}

  // -------- Versions --------

  @Get("versions")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  listVersions(
    @Param("projectId") projectId: string,
    @Query("scenario") scenario: string,
    @Query("includeArchived") includeArchived?: string,
  ) {
    const sc = String(scenario ?? "").trim();
    if (!sc) throw new BadRequestException("Missing scenario");
    const inc = includeArchived === "true";
    return this.service.listVersions(projectId, sc, inc);
  }

  @Post("versions")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  createVersion(
    @Param("projectId") projectId: string,
    @Body() body: { scenario: string; name?: string; notes?: string },
    @Req() req: any,
  ) {
    const scenario = String(body?.scenario ?? "").trim();
    if (!scenario) throw new BadRequestException("Missing scenario");
    return this.service.createVersion({
      projectId,
      scenario,
      name: body?.name,
      notes: body?.notes,
      userId: req.user?.id,
    });
  }

  @Post("versions/:versionId/clone")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  cloneVersion(
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
    @Body() body: { name?: string; notes?: string },
    @Req() req: any,
  ) {
    return this.service.cloneVersion({
      projectId,
      versionId,
      name: body?.name,
      notes: body?.notes,
      userId: req.user?.id,
    });
  }

  @Post("versions/:versionId/freeze")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  freezeVersion(
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException("Missing user id");
    return this.service.freezeVersion({ projectId, versionId, userId });
  }

  @Post("versions/:versionId/archive")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  archiveVersion(
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException("Missing user id");
    return this.service.setArchived({ projectId, versionId, archived: true, userId });
  }

  @Post("versions/:versionId/restore")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  restoreVersion(
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException("Missing user id");
    return this.service.setArchived({ projectId, versionId, archived: false, userId });
  }

  @Post("versions/:versionId/set-active")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  setActive(
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
  ) {
    return this.service.setActiveVersion({ projectId, versionId });
  }

  // -------- Lines --------

  @Get("lines")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  listLines(
    @Param("projectId") projectId: string,
    @Query("versionId") versionId: string,
  ) {
    const vid = String(versionId ?? "").trim();
    if (!vid) throw new BadRequestException("Missing versionId");
    return this.service.listLines(projectId, vid);
  }

  @Post("lines/bulk-upsert")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  bulkUpsertLines(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      versionId: string;
      items: Array<{
        id?: string;
        wbs: Record<string, string>;
        tariffaCodice: string;
        description?: string | null;
        uom?: string | null;

        qty?: number;
        unitPrice?: number;
        
        rowType?: "LINE" | "GROUP";
        sortIndex?: number;
        parentLineId?: string | null;

        qtyModelSuggested?: number | null;
        qtySource?: "MANUAL" | "MODEL" | "MODEL_PLUS_MARGIN" | "IMPORT";
        marginPct?: number | null;

        pacchettoCodice?: string | null;
        materialeCodice?: string | null;
        fornitoreId?: string | null;
      }>;
    },
  ) {
    const versionId = String(body?.versionId ?? "").trim();
    if (!versionId) throw new BadRequestException("Missing versionId");
    const items = body?.items ?? [];
    if (!Array.isArray(items)) throw new BadRequestException("items must be an array");
    return this.service.bulkUpsertLines(projectId, versionId, items);
  }

  @Post("lines/:lineId/delete")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  deleteLine(
    @Param("projectId") projectId: string,
    @Param("lineId") lineId: string,
  ) {
    const id = String(lineId ?? "").trim();
    if (!id) throw new BadRequestException("Missing lineId");
    return this.service.deleteLine(projectId, id);
  }

}
