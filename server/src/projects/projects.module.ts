import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { AuthModule } from "../auth/auth.module";
import { AuthzModule } from "../authz/authz.module";

@Module({
  imports: [AuthzModule, AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}

