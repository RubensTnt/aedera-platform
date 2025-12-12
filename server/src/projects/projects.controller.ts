import { Body, Controller, Get, Post } from "@nestjs/common";
import { ProjectsService } from "./projects.service";

@Controller("/api/projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Post()
  create(@Body() body: { id?: string; name: string; code?: string }) {
    return this.projects.create(body);
  }
}
