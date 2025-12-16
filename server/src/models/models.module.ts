import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ModelsController } from "./models.controller";
import { ModelsService } from "./models.service";
import { AuthModule } from "../auth/auth.module";
import { AuthzModule } from "../authz/authz.module";

@Module({
  imports: [AuthzModule, AuthModule],
  controllers: [ModelsController],
  providers: [ModelsService],
})
export class ModelsModule {}

