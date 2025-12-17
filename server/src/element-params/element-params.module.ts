import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthzModule } from "../authz/authz.module";
import { AuthModule } from "../auth/auth.module";
import { ElementParamsController } from "./element-params.controller";
import { ElementParamsService } from "./element-params.service";

@Module({
  imports: [PrismaModule, AuthzModule, AuthModule],
  controllers: [ElementParamsController],
  providers: [ElementParamsService],
})
export class ElementParamsModule {}
