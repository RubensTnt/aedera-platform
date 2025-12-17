import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { ProjectRoleGuard } from "../authz/project-role.guard";
import { ProjectRoles } from "../authz/project-roles.decorator";
import { ElementParamsService } from "./element-params.service";

@UseGuards(SessionGuard)
@Controller("/api/projects/:projectId/params")
export class ElementParamsController {
  constructor(private readonly service: ElementParamsService) {}

  // --------- DEFINITIONS (ADMIN+) ---------

  @Get("definitions")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  listDefinitions(@Param("projectId") projectId: string) {
    return this.service.listDefinitions(projectId);
  }

  @Post("definitions")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  createDefinition(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      key: string;
      label: string;
      type: string;
      isMulti?: boolean;
      optionsJson?: any;
      isActive?: boolean;
      isRequired?: boolean;
      isReadOnly?: boolean;
      ifcClassFilter?: string | null;
    },
  ) {
    if (!body?.key || !body?.label || !body?.type) {
      throw new BadRequestException("Missing key/label/type");
    }
    return this.service.createDefinition(projectId, body as any);
  }

  @Patch("definitions/:id")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("ADMIN", "OWNER")
  updateDefinition(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body()
    body: {
      label?: string;
      isMulti?: boolean;
      optionsJson?: any;
      isActive?: boolean;
      isRequired?: boolean;
      isReadOnly?: boolean;
      ifcClassFilter?: string | null;
    },
  ) {
    return this.service.updateDefinition(projectId, id, body as any);
  }

  // --------- VALUES (VIEWER+ / EDITOR+) ---------

  @Post("values/bulk-get")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  bulkGetValues(
    @Param("projectId") projectId: string,
    @Body() body: { globalIds?: string[]; keys?: string[] },
  ) {
    return this.service.bulkGetValues(projectId, body.globalIds ?? [], body.keys);
  }

  @Put("elements/:globalId/:key")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  setValue(
    @Param("projectId") projectId: string,
    @Param("globalId") globalId: string,
    @Param("key") key: string,
    @Body() body: { value: any; source?: string },
    @Req() req: any,
  ) {
    return this.service.setValue({
      projectId,
      globalId,
      key,
      value: body?.value,
      source: body?.source ?? "UI",
      changedByUserId: req.user?.id,
    });
  }

  // --------- HISTORY (VIEWER+) ---------

  @Get("elements/:globalId/history")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  history(
    @Param("projectId") projectId: string,
    @Param("globalId") globalId: string,
  ) {
    return this.service.getElementHistory(projectId, globalId);
  }
}
