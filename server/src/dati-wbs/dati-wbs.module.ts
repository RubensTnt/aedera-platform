import { Module } from "@nestjs/common";
import { DatiWbsController } from "./dati-wbs.controller";
import { DatiWbsService } from "./dati-wbs.service";
import { AuthModule } from "../auth/auth.module";
import { AuthzModule } from "../authz/authz.module";

@Module({
  imports: [AuthzModule, AuthModule],
  controllers: [DatiWbsController],
  providers: [DatiWbsService],
})
export class DatiWbsModule {}

