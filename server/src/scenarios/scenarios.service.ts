import { BadRequestException, ForbiddenException, NotFoundException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, ScenarioType, ScenarioVersionStatus, QtySource } from "@prisma/client";

function toScenarioType(s: string): ScenarioType {
  const v = s.toUpperCase().trim();
  if (!(v in ScenarioType)) throw new BadRequestException(`Unknown scenario: ${s}`);
  return ScenarioType[v as keyof typeof ScenarioType];
}

@Injectable()
export class ScenariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listVersions(projectId: string, scenarioStr: string, includeArchived: boolean) {
    const scenario = toScenarioType(scenarioStr);

    const [active, versions] = await Promise.all([
      this.prisma.scenarioActiveVersion.findUnique({
        where: { projectId_scenario: { projectId, scenario } },
        select: { versionId: true },
      }),
      this.prisma.scenarioVersion.findMany({
        where: {
          projectId,
          scenario,
          ...(includeArchived ? {} : { archivedAt: null }),
        },
        orderBy: [{ versionNo: "asc" }],
      }),
    ]);

    return { activeVersionId: active?.versionId ?? null, versions };
  }

  async createVersion(input: {
    projectId: string;
    scenario: string;
    name?: string;
    notes?: string;
    userId?: string;
  }) {
    const scenario = toScenarioType(input.scenario);

    const max = await this.prisma.scenarioVersion.aggregate({
      where: { projectId: input.projectId, scenario },
      _max: { versionNo: true },
    });
    const nextNo = (max._max.versionNo ?? 0) + 1;

    const created = await this.prisma.scenarioVersion.create({
      data: {
        projectId: input.projectId,
        scenario,
        versionNo: nextNo,
        status: ScenarioVersionStatus.DRAFT,
        name: input.name ?? null,
        notes: input.notes ?? null,
        createdByUserId: input.userId ?? null,
      },
    });

    // se non esiste activeVersion, la settiamo automaticamente (evita “nessuna baseline”)
    await this.prisma.scenarioActiveVersion.upsert({
      where: { projectId_scenario: { projectId: input.projectId, scenario } },
      update: {}, // non cambiamo active se già esiste
      create: {
        projectId: input.projectId,
        scenario,
        versionId: created.id,
      },
    });

    return created;
  }

  async cloneVersion(input: { projectId: string; versionId: string; name?: string; notes?: string; userId?: string }) {
    const base = await this.prisma.scenarioVersion.findFirst({
      where: { id: input.versionId, projectId: input.projectId, archivedAt: null },
      include: { lines: true },
    });
    if (!base) throw new NotFoundException("Base version not found");

    const max = await this.prisma.scenarioVersion.aggregate({
      where: { projectId: input.projectId, scenario: base.scenario },
      _max: { versionNo: true },
    });
    const nextNo = (max._max.versionNo ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.scenarioVersion.create({
        data: {
          projectId: input.projectId,
          scenario: base.scenario,
          versionNo: nextNo,
          status: ScenarioVersionStatus.DRAFT,
          name: input.name ?? base.name ?? null,
          notes: input.notes ?? null,
          derivedFromVersionId: base.id,
          createdByUserId: input.userId ?? null,
        },
      });

      if (base.lines.length) {
        const rows: Prisma.BoqLineCreateManyInput[] = base.lines.map((l) => ({
          projectId: input.projectId,
          versionId: created.id,

          wbsKey: l.wbsKey,
          wbs: (l.wbs ?? {}) as Prisma.InputJsonValue,

          tariffaCodice: l.tariffaCodice,
          description: l.description,
          uom: l.uom,

          qty: l.qty,
          unitPrice: l.unitPrice,
          amount: l.amount,

          qtyModelSuggested: l.qtyModelSuggested,
          qtySource: l.qtySource,
          marginPct: l.marginPct,

          pacchettoCodice: l.pacchettoCodice,
          materialeCodice: l.materialeCodice,
          fornitoreId: l.fornitoreId,
        }));

        await tx.boqLine.createMany({ data: rows });
      }

      return created;
    });
  }

  async freezeVersion(input: { projectId: string; versionId: string; userId: string }) {
    const v = await this.prisma.scenarioVersion.findFirst({
      where: { id: input.versionId, projectId: input.projectId, archivedAt: null },
    });
    if (!v) throw new NotFoundException("Version not found");
    if (v.status === ScenarioVersionStatus.LOCKED) return { ok: true };

    // Validazioni base: almeno non “vuoto”
    const count = await this.prisma.boqLine.count({ where: { projectId: input.projectId, versionId: v.id } });
    if (count === 0) throw new BadRequestException("Cannot freeze an empty version");

    await this.prisma.scenarioVersion.update({
      where: { id: v.id },
      data: {
        status: ScenarioVersionStatus.LOCKED,
        lockedAt: new Date(),
        lockedByUserId: input.userId,
      },
    });

    return { ok: true };
  }

  async setArchived(input: { projectId: string; versionId: string; archived: boolean; userId: string }) {
    const v = await this.prisma.scenarioVersion.findFirst({
      where: { id: input.versionId, projectId: input.projectId },
    });
    if (!v) throw new NotFoundException("Version not found");

    // se è active, impedirlo (o obbligare a cambiare active prima)
    const active = await this.prisma.scenarioActiveVersion.findUnique({
      where: { projectId_scenario: { projectId: input.projectId, scenario: v.scenario } },
      select: { versionId: true },
    });
    if (input.archived && active?.versionId === v.id) {
      throw new BadRequestException("Cannot archive the active version. Set another active version first.");
    }

    await this.prisma.scenarioVersion.update({
      where: { id: v.id },
      data: input.archived
        ? { archivedAt: new Date(), archivedByUserId: input.userId }
        : { archivedAt: null, archivedByUserId: null },
    });

    return { ok: true };
  }

  async setActiveVersion(input: { projectId: string; versionId: string }) {
    const v = await this.prisma.scenarioVersion.findFirst({
      where: { id: input.versionId, projectId: input.projectId, archivedAt: null },
      select: { id: true, scenario: true },
    });
    if (!v) throw new NotFoundException("Version not found");

    await this.prisma.scenarioActiveVersion.upsert({
      where: { projectId_scenario: { projectId: input.projectId, scenario: v.scenario } },
      update: { versionId: v.id },
      create: { projectId: input.projectId, scenario: v.scenario, versionId: v.id },
    });

    return { ok: true };
  }

  async listLines(projectId: string, versionId: string) {
    const version = await this.prisma.scenarioVersion.findFirst({
      where: { id: versionId, projectId },
      select: { id: true, status: true },
    });
    if (!version) throw new NotFoundException("Version not found");

    const items = await this.prisma.boqLine.findMany({
      where: { projectId, versionId },
      orderBy: [{ wbsKey: "asc" }, { tariffaCodice: "asc" }],
    });

    return { versionStatus: version.status, items };
  }

  private async getRequiredWbsKeys(projectId: string): Promise<string[]> {
    // Usa la tua tabella WbsLevelSetting (ce l’hai già nel modulo WBS)
    const rows = await this.prisma.wbsLevelSetting.findMany({
      where: { projectId, enabled: true, required: true },
      orderBy: [{ sortIndex: "asc" }],
      select: { levelKey: true },
    });
    return rows.map((r) => r.levelKey);
  }

  private buildWbsKey(requiredKeys: string[], wbs: Record<string, string>) {
    for (const k of requiredKeys) {
      const v = String(wbs?.[k] ?? "").trim();
      if (!v) throw new BadRequestException(`Missing required WBS level: ${k}`);
    }
    return requiredKeys.map((k) => `${k}=${String(wbs[k]).trim()}`).join("|");
  }

  async bulkUpsertLines(
    projectId: string,
    versionId: string,
    items: Array<any>,
  ) {
    const version = await this.prisma.scenarioVersion.findFirst({
      where: { id: versionId, projectId, archivedAt: null },
      select: { id: true, status: true },
    });
    if (!version) throw new NotFoundException("Version not found");
    if (version.status === ScenarioVersionStatus.LOCKED) throw new ForbiddenException("Version is locked");

    const requiredKeys = await this.getRequiredWbsKeys(projectId);

    // split create/update: per update richiediamo id
    const toCreate: Prisma.BoqLineCreateManyInput[] = [];
    const toUpdate: Array<{ id: string; data: Prisma.BoqLineUpdateInput }> = [];

    for (const it of items) {
      const wbs = (it?.wbs ?? {}) as Record<string, string>;
      const wbsKey = this.buildWbsKey(requiredKeys, wbs);

      const tariffaCodice = String(it?.tariffaCodice ?? "").trim();
      if (!tariffaCodice) throw new BadRequestException("tariffaCodice is required");

      const qty = Number.isFinite(Number(it?.qty)) ? Number(it.qty) : 0;
      const unitPrice = Number.isFinite(Number(it?.unitPrice)) ? Number(it.unitPrice) : 0;
      const amount = qty * unitPrice;

      const qtySource = it?.qtySource ? (it.qtySource as QtySource) : QtySource.MANUAL;

      const common = {
        wbsKey,
        wbs,
        tariffaCodice,
        description: it?.description ?? null,
        uom: it?.uom ?? null,
        qty,
        unitPrice,
        amount,
        qtyModelSuggested: it?.qtyModelSuggested ?? null,
        qtySource,
        marginPct: it?.marginPct ?? null,
        pacchettoCodice: it?.pacchettoCodice ?? null,
        materialeCodice: it?.materialeCodice ?? null,
        fornitoreId: it?.fornitoreId ?? null,
      };

      if (it?.id) {
        toUpdate.push({ id: String(it.id), data: common });
      } else {
        toCreate.push({
          projectId,
          versionId,
          ...common,
        } as Prisma.BoqLineCreateManyInput);
      }
    }

    // transazione: update uno-a-uno + createMany
    await this.prisma.$transaction(async (tx) => {
      for (const u of toUpdate) {
        await tx.boqLine.update({
          where: { id: u.id },
          data: u.data,
        });
      }
      if (toCreate.length) {
        await tx.boqLine.createMany({ data: toCreate });
      }
    });

    return { created: toCreate.length, updated: toUpdate.length };
  }
}
