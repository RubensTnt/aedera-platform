import { Module } from "@nestjs/common";
import { DatiWbsController } from "./dati-wbs.controller";
import { DatiWbsService } from "./dati-wbs.service";

@Module({
  controllers: [DatiWbsController],
  providers: [DatiWbsService],
})
export class DatiWbsModule {}
