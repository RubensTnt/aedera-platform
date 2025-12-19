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

  
  // ✅ IMPORTANT: modelId sempre richiesto
  @Post("values/bulk-get")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  bulkGetValues(
    @Param("projectId") projectId: string,
    @Body() body: { modelId: string; guids?: string[]; keys?: string[] },
  ) {
    const modelId = String(body?.modelId ?? "").trim();
    if (!modelId) throw new BadRequestException("Missing modelId");

    const guids = body?.guids ?? [];
    if (!Array.isArray(guids)) throw new BadRequestException("guids must be an array");

    return this.service.bulkGetValues(projectId, modelId, guids, body.keys);
  }


  @Post("values/bulk-set")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  bulkSetValues(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      modelId: string;
      items: { guid: string; key: string; value: any }[];
      source?: string;
    },
    @Req() req: any,
  ) {
    const modelId = String(body?.modelId ?? "").trim();
    if (!modelId) throw new BadRequestException("Missing modelId");

    const items = body?.items ?? [];
    if (!Array.isArray(items)) throw new BadRequestException("items must be an array");

    return this.service.bulkSetValues({
      projectId,
      modelId,
      items,
      source: body?.source ?? "UI",
      changedByUserId: req.user?.id,
    });
  }

  @Put("elements/:modelId/:guid/:key")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("EDITOR", "ADMIN", "OWNER")
  setValue(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Param("guid") guid: string,
    @Param("key") key: string,
    @Body() body: { value: any; source?: string },
    @Req() req: any,
  ) {
    if (!modelId) throw new BadRequestException("Missing modelId");
    if (!guid) throw new BadRequestException("Missing guid");

    return this.service.setValue({
      projectId,
      modelId,
      guid,
      key,
      value: body?.value,
      source: body?.source ?? "UI",
      changedByUserId: req.user?.id,
    });
  }


  @Get("elements/:modelId/:guid/history")
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles("VIEWER", "EDITOR", "ADMIN", "OWNER")
  history(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Param("guid") guid: string,
  ) {
    if (!modelId) throw new BadRequestException("Missing modelId");
    if (!guid) throw new BadRequestException("Missing guid");
    return this.service.getElementHistory(projectId, modelId, guid);
  }
}
