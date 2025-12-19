import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { ProjectRoleGuard } from "../authz/project-role.guard";
import { ProjectRoles } from "../authz/project-roles.decorator";
import { WbsService } from "./wbs.service";

@UseGuards(SessionGuard)
@Controller("/api/projects/:projectId/wbs")
export class WbsController {
  constructor(private readonly service: WbsService) {}

  @Get("nodes")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  listTree(@Param("projectId") projectId: string) {
    return this.service.listTree(projectId);
  }

  @Post("nodes")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  createNode(
    @Param("projectId") projectId: string,
    @Body() body: { code: string; name: string; parentId?: string | null; sortIndex?: number },
  ) {
    if (!body?.code || !body?.name) throw new BadRequestException("Missing code/name");
    return this.service.createNode(projectId, body);
  }

  @Patch("nodes/:id")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  updateNode(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body() body: { code?: string; name?: string; parentId?: string | null; sortIndex?: number },
  ) {
    return this.service.updateNode(projectId, id, body);
  }

  @Delete("nodes/:id")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  removeNode(@Param("projectId") projectId: string, @Param("id") id: string) {
    return this.service.deleteNode(projectId, id);
  }

  @Post("ensure-paths")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER", "EDITOR")
  ensurePaths(
    @Param("projectId") projectId: string,
    @Body() body: { paths: { segments: { code: string; name?: string }[] }[] },
  ) {
    const paths = body?.paths ?? [];
    if (!Array.isArray(paths)) throw new BadRequestException("paths must be an array");
    return this.service.ensurePaths(projectId, paths);
  }

  // ✅ IMPORTANT: modelId sempre richiesto
  @Post("assignments/bulk-get")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  bulkGetAssignments(
    @Param("projectId") projectId: string,
    @Body() body: { modelId: string; guids?: string[] },
  ) {
    const modelId = String(body?.modelId ?? "").trim();
    if (!modelId) throw new BadRequestException("Missing modelId");

    const guids = body?.guids ?? [];
    if (!Array.isArray(guids)) throw new BadRequestException("guids must be an array");

    return this.service.bulkGetAssignments(projectId, modelId, guids);
  }


  @Post("assignments/bulk-set")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  bulkSetAssignments(
    @Param("projectId") projectId: string,
    @Body() body: { modelId: string; items: { guid: string; wbsNodeId: string | null }[]; source?: string },
    @Req() req: any,
  ) {
    const modelId = String(body?.modelId ?? "").trim();
    if (!modelId) throw new BadRequestException("Missing modelId");

    const items = body?.items ?? [];
    if (!Array.isArray(items)) throw new BadRequestException("items must be an array");

    return this.service.bulkSetAssignments({
      projectId,
      modelId,
      items,
      source: body?.source ?? "UI",
      changedByUserId: req.user?.id,
    });
  }
}
