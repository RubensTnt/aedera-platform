import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectRoleGuard } from "./project-role.guard";

@Module({
  imports: [PrismaModule],
  providers: [ProjectRoleGuard],
  exports: [ProjectRoleGuard],
})
export class AuthzModule {}
