// server/src/wbs/wbs.controller.ts

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
import { WbsService } from "./wbs.service";

@UseGuards(SessionGuard)
@Controller("/api/projects/:projectId/wbs")
export class WbsController {
  constructor(private readonly service: WbsService) {}

  // -----------------------------
  // Level settings (profilo livelli)
  // -----------------------------

  @Get("levels")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  listLevels(@Param("projectId") projectId: string) {
    return this.service.listLevels(projectId);
  }

  @Post("levels/bulk-upsert")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  bulkUpsertLevels(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      items: {
        levelKey: string;
        enabled?: boolean;
        required?: boolean;
        sortIndex?: number;
        ifcParamKey?: string | null;
      }[];
    },
  ) {
    const items = body?.items ?? [];
    if (!Array.isArray(items)) throw new BadRequestException("items must be an array");
    return this.service.bulkUpsertLevels(projectId, items);
  }

  // -----------------------------
  // Allowed values (dizionario ammessi)
  // -----------------------------

  @Get("allowed-values")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  listAllowedValues(
    @Param("projectId") projectId: string,
    @Query("levels") levelsCsv?: string,
  ) {
    const levels =
      typeof levelsCsv === "string" && levelsCsv.trim().length
        ? levelsCsv
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : undefined;

    return this.service.listAllowedValues(projectId, levels);
  }

  @Post("allowed-values/bulk-upsert")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  bulkUpsertAllowedValues(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      items: {
        levelKey: string;
        code: string;
        name?: string | null;
        sortIndex?: number;
        isActive?: boolean;
      }[];
    },
  ) {
    const items = body?.items ?? [];
    if (!Array.isArray(items)) throw new BadRequestException("items must be an array");
    return this.service.bulkUpsertAllowedValues(projectId, items);
  }

  // -----------------------------
  // Assignments v2 (per livello)
  // -----------------------------

  @Post("assignments-v2/bulk-get")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  bulkGetAssignmentsV2(
    @Param("projectId") projectId: string,
    @Body() body: { modelId: string; guids: string[]; levels?: string[] },
  ) {
    const modelId = String(body?.modelId ?? "").trim();
    if (!modelId) throw new BadRequestException("Missing modelId");

    const guids = body?.guids ?? [];
    if (!Array.isArray(guids)) throw new BadRequestException("guids must be an array");

    const levels = body?.levels;
    if (levels !== undefined && !Array.isArray(levels))
      throw new BadRequestException("levels must be an array if provided");

    return this.service.bulkGetAssignmentsV2({
      projectId,
      modelId,
      guids,
      levels,
    });
  }

  @Post("assignments-v2/bulk-set")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  bulkSetAssignmentsV2(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      modelId: string;
      source?: "UI" | "IFC_IMPORT" | "RULE";
      overwrite?: boolean;
      items: { guid: string; levelKey: string; code: string | null }[];
    },
    @Req() req: any,
  ) {
    const modelId = String(body?.modelId ?? "").trim();
    if (!modelId) throw new BadRequestException("Missing modelId");

    const items = body?.items ?? [];
    if (!Array.isArray(items)) throw new BadRequestException("items must be an array");

    return this.service.bulkSetAssignmentsV2({
      projectId,
      modelId,
      source: (body?.source ?? "UI") as any,
      overwrite: typeof body?.overwrite === "boolean" ? body.overwrite : undefined,
      items,
      changedByUserId: req.user?.id,
    });
  }

    // -----------------------------
  // Promote INVALID -> VALID (se ora il rawCode è ammesso)
  // -----------------------------

  @Post("assignments-v2/promote-invalid")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  promoteInvalidAssignmentsV2(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      levelKey: string;
      modelId?: string; // opzionale: se omesso, promuove su tutti i modelli del progetto
      dryRun?: boolean; // opzionale: se true, non scrive (solo preview)
    },
    @Req() req: any,
  ) {
    const levelKey = String(body?.levelKey ?? "").trim();
    if (!levelKey) throw new BadRequestException("Missing levelKey");

    const modelId = body?.modelId ? String(body.modelId).trim() : undefined;
    const dryRun = typeof body?.dryRun === "boolean" ? body.dryRun : false;
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException("Missing user id");

    return this.service.promoteInvalidAssignmentsV2({
      projectId,
      levelKey,
      modelId,
      dryRun,
      changedByUserId: req.user?.id,
    });
  }

}
