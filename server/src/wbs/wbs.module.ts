import { Module } from "@nestjs/common";
import { WbsController } from "./wbs.controller";
import { WbsService } from "./wbs.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WbsController],
  providers: [WbsService],
  exports: [WbsService],
})
export class WbsModule {}
