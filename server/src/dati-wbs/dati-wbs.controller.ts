import { Body, Controller, Param, Post } from "@nestjs/common";
import { DatiWbsService } from "./dati-wbs.service";

@Controller("/api/projects/:projectId")
export class DatiWbsController {
  constructor(private readonly service: DatiWbsService) {}

  @Post("/elements/:globalId/dati-wbs")
  upsert(
    @Param("projectId") projectId: string,
    @Param("globalId") globalId: string,
    @Body() body: Record<string, unknown>,
  ) {
    // MVP: nessuna validazione sofisticata, la aggiungiamo dopo con DTO + class-validator
    return this.service.upsert(projectId, globalId, body as any);
  }

  @Post("/dati-wbs/bulk-get")
  bulkGet(
    @Param("projectId") projectId: string,
    @Body() body: { globalIds?: string[] },
  ) {
    return this.service.bulkGet(projectId, body.globalIds ?? []);
  }
}
