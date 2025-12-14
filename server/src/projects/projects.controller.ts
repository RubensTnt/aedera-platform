import { Body, Controller, Get, Post, Param, Patch } from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import { Query } from "@nestjs/common";
import { UseGuards } from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { PlatformManagerGuard } from "../auth/platform-role.guard";


@UseGuards(SessionGuard)

@Controller("/api/projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Query("archived") archived?: string) {
    // archived: undefined -> attivi
    // "true" -> archiviati
    // "all" -> tutti
    return this.projects.list({ archived });
  }

  @Post()
  @UseGuards(PlatformManagerGuard)
  create(@Body() body: { id?: string; name: string; code?: string }) {
    return this.projects.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: { name?: string; code?: string },
  ) {
    return this.projects.update(id, body);
  }

  @Post(":id/archive")
  archive(@Param("id") id: string) {
    return this.projects.archive(id);
  }

  @Post(":id/restore")
  restore(@Param("id") id: string) {
    return this.projects.restore(id);
  }
}
