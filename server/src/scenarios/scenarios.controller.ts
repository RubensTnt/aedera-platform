/* import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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

  @Get("")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  list(@Param("projectId") projectId: string) {
    return this.service.list(projectId);
  }

  @Post("")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  create(
    @Param("projectId") projectId: string,
    @Body() body: { type: string; name: string },
    @Req() req: any,
  ) {
    if (!body?.type || !body?.name) throw new BadRequestException("Missing type/name");
    return this.service.create({
      projectId,
      type: body.type,
      name: body.name,
      createdByUserId: req.user?.id,
    });
  }

  @Get(":scenarioId")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  get(
    @Param("projectId") projectId: string,
    @Param("scenarioId") scenarioId: string,
  ) {
    return this.service.get(projectId, scenarioId);
  }

  @Post(":scenarioId/items/bulk-get")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  bulkGetItems(
    @Param("projectId") projectId: string,
    @Param("scenarioId") scenarioId: string,
    @Body() body: { globalIds?: string[] },
  ) {
    return this.service.bulkGetItems(projectId, scenarioId, body?.globalIds ?? []);
  }

  @Put(":scenarioId/items/bulk-set")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  bulkSetItems(
    @Param("projectId") projectId: string,
    @Param("scenarioId") scenarioId: string,
    @Body()
    body: {
      items: {
        globalId: string;
        qty?: string | number | null;
        unit?: string | null;
        unitPrice?: string | number | null;
        amount?: string | number | null;
        qtySource?: string;
        notes?: string | null;
      }[];
      source?: string;
    },
    @Req() req: any,
  ) {
    const items = body?.items ?? [];
    if (!Array.isArray(items)) throw new BadRequestException("items must be an array");

    return this.service.bulkSetItems({
      projectId,
      scenarioId,
      items,
      changedByUserId: req.user?.id,
      source: body?.source ?? "UI",
    });
  }
}
 */