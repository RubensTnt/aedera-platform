import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type DatiWbsPatch = Partial<{
  wbs0: string;
  wbs1: string;
  wbs2: string;
  wbs3: string;
  wbs4: string;
  wbs5: string;
  wbs6: string;
  wbs7: string;
  wbs8: string;
  wbs9: string;
  wbs10: string;
  tariffaCodice: string;
  pacchettoCodice: string;
  modelLabel: string;
}>;

@Injectable()
export class DatiWbsService {
  constructor(private prisma: PrismaService) {}

  async upsert(projectId: string, ifcGlobalId: string, patch: DatiWbsPatch) {
    return this.prisma.elementDatiWbs.upsert({
      where: { projectId_ifcGlobalId: { projectId, ifcGlobalId } },
      update: patch,
      create: { projectId, ifcGlobalId, ...patch },
    });
  }

  async bulkGet(projectId: string, globalIds: string[]) {
    if (!globalIds.length) return [];
    return this.prisma.elementDatiWbs.findMany({
      where: { projectId, ifcGlobalId: { in: globalIds } },
    });
  }
}
