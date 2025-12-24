import { Module } from "@nestjs/common";
import { ScenariosController } from "./scenarios.controller";
import { ScenariosService } from "./scenarios.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ScenariosController],
  providers: [ScenariosService],
})
export class ScenariosModule {}
