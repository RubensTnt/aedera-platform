import { Module } from "@nestjs/common";
import { DatiWbsController } from "./dati-wbs.controller";
import { DatiWbsService } from "./dati-wbs.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [DatiWbsController],
  providers: [DatiWbsService],
})
export class DatiWbsModule {}

