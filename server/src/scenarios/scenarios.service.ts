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

          rowType: l.rowType,
          sortIndex: l.sortIndex,
          parentLineId: null, // per MVP: lo azzeriamo e poi lo ricostruiamo lato UI/import

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

    const rows = await this.prisma.boqLine.findMany({
      where: { projectId, versionId },
      orderBy: [{ sortIndex: "asc" }, { wbsKey: "asc" }, { tariffaCodice: "asc" }],
      include: {
        parentLine: { select: { id: true } },
      },
    });

    // rimappo in modo che il frontend riceva sempre parentLineId
    const items = rows.map((r: any) => {
      const parentLineId = r.parentLine?.id ?? null;
      // non vogliamo mandare l’oggetto parentLine al frontend (non serve)
      const { parentLine, ...rest } = r;
      return { ...rest, parentLineId };
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

    // 0) quali id "reali" arrivano dalla request?
    const incomingRealIds = (items ?? [])
      .map((x: any) => String(x?.id ?? "").trim())
      .filter((id) => id && !id.startsWith("new_"));

    const incomingRealIdSet = new Set(incomingRealIds);

    // 1) quali di questi esistono già a DB?
    const existingRows = incomingRealIds.length
      ? await this.prisma.boqLine.findMany({
          where: { projectId, versionId, id: { in: incomingRealIds } },
          select: { id: true },
        })
      : [];

    const existingIdSet = new Set(existingRows.map((r) => r.id));

    // 2) prepara le liste di create e update
    // split create/update: per update richiediamo id
    type CreateRow = Prisma.BoqLineCreateInput & {
      __tempId: string;
      __parentTempId?: string | null;
      __parentRealId?: string | null;
    };

    type UpdateRow = {
      id: string;
      data: Prisma.BoqLineUpdateInput;
      __parentTempId?: string | null;
    };

    const toCreate: CreateRow[] = [];
    const toUpdate: UpdateRow[] = [];

    for (const it of items) {
      const rowType = (it?.rowType ?? "LINE") as any;
      const isGroup = rowType === "GROUP";

      const wbs = (it?.wbs ?? {}) as Record<string, string>;
      const tariffaCodice = String(it?.tariffaCodice ?? "").trim();
      const description = (it?.description ?? null) as string | null;

      let wbsKey: string;

      if (!isGroup) {
        wbsKey = this.buildWbsKey(requiredKeys, wbs);
        if (!tariffaCodice) throw new BadRequestException("tariffaCodice is required");
      } else {
        // GROUP: permette WBS incompleto
        wbsKey =
          requiredKeys.length
            ? requiredKeys.map((k) => `${k}=${String(wbs?.[k] ?? "").trim()}`).join("|")
            : "";
        if (!tariffaCodice && !description) {
          throw new BadRequestException("GROUP row requires at least tariffaCodice or description");
        }
      }

      if (!isGroup && !tariffaCodice) {
        throw new BadRequestException("tariffaCodice is required");
      }

      const qtySource = it?.qtySource ? (it.qtySource as QtySource) : QtySource.MANUAL;

      let sortIndex = Number.isFinite(Number(it?.sortIndex)) ? Number(it.sortIndex) : 0;
      if (sortIndex > 2147483647) sortIndex = 2147483647;
      if (sortIndex < 0) sortIndex = 0;      
      
      const parentLineId = it?.parentLineId ? String(it.parentLineId) : null;

      const parentLineIdRaw = it?.parentLineId ? String(it.parentLineId) : null;
      const parentTempId =
        parentLineIdRaw && parentLineIdRaw.startsWith("new_") ? parentLineIdRaw : null;
      const parentRealId =
        parentLineIdRaw && !parentLineIdRaw.startsWith("new_") ? parentLineIdRaw : null;

      const qty = isGroup ? 0 : (Number.isFinite(Number(it?.qty)) ? Number(it.qty) : 0);
      const unitPrice = isGroup ? 0 : (Number.isFinite(Number(it?.unitPrice)) ? Number(it.unitPrice) : 0);
      const amount = qty * unitPrice;

      const common = {
        wbsKey,
        wbs,
        tariffaCodice,
        description: it?.description ?? null,
        uom: it?.uom ?? null,
        qty,
        unitPrice,
        amount,
        rowType,
        sortIndex,
        qtyModelSuggested: it?.qtyModelSuggested ?? null,
        qtySource,
        marginPct: it?.marginPct ?? null,
        pacchettoCodice: it?.pacchettoCodice ?? null,
        materialeCodice: it?.materialeCodice ?? null,
        fornitoreId: it?.fornitoreId ?? null,
      };

      const idRaw = String(it?.id ?? "").trim();
      const isRealId = !!idRaw && !idRaw.startsWith("new_");
      const existsInDb = isRealId && existingIdSet.has(idRaw);

      if (existsInDb) {
        const data: Prisma.BoqLineUpdateInput = {
          ...common,
          // se parent è reale -> connect
          ...(parentRealId ? { parentLine: { connect: { id: parentRealId } } } : { parentLine: { disconnect: true } }),
        };

        toUpdate.push({
          id: String(it.id),
          data,
          __parentTempId: parentTempId, // <--- AGGIUNGI QUESTO
        });
      } else {
        // CREATE (anche se idRaw è un id “reale” ma non esiste più)
        // CREATE
        const tempId =
          typeof it?.id === "string" && it.id.startsWith("new_")
            ? it.id
            : `new_${Math.random().toString(36).slice(2)}`;

        // parent real id (non-new_) può essere:
        // - già presente a DB (ok connect subito)
        // - oppure incluso nell’import ma attualmente non esiste (va deferito)
        const parentRealIdMustBeDeferred =
          !!parentRealId && !existingIdSet.has(parentRealId) && incomingRealIdSet.has(parentRealId);

        toCreate.push({
          __tempId: tempId,
          __parentTempId: parentTempId,
          __parentRealId: parentRealIdMustBeDeferred ? parentRealId : null,

          // se l’import contiene un id reale, lo preserviamo
          ...(isRealId ? { id: idRaw } : {}),

          project: { connect: { id: projectId } },
          version: { connect: { id: versionId } },
          ...common,

          // connect parent subito solo se esiste già a DB
          ...(parentRealId && existingIdSet.has(parentRealId) ? { parentLine: { connect: { id: parentRealId } } } : {}),
        });
      }
    }

    // transazione: update uno-a-uno + createMany
    await this.prisma.$transaction(async (tx) => {
      const tempToReal = new Map<string, string>();
      const pendingFixTemp: Array<{ childRealId: string; parentTempId: string }> = [];
      const pendingFixReal: Array<{ childRealId: string; parentRealId: string }> = [];

      // 1) CREATE (prima, così i parent "reali" importati vengono creati e poi gli update possono connettersi)
      for (const c of toCreate) {
        const { __tempId, __parentTempId, __parentRealId, ...data } = c as any;

        // se parent è temp o real-deferred, nel create non lo settiamo
        if (__parentTempId || __parentRealId) {
          delete data.parentLine;
        }

        const created = await tx.boqLine.create({
          data: data as Prisma.BoqLineCreateInput,
        });

        tempToReal.set(__tempId, created.id);

        if (__parentTempId) pendingFixTemp.push({ childRealId: created.id, parentTempId: __parentTempId });
        if (__parentRealId) pendingFixReal.push({ childRealId: created.id, parentRealId: __parentRealId });
      }

      // 2) UPDATE (manca nel tuo file attuale!)
      for (const u of toUpdate) {
        await tx.boqLine.update({
          where: { id: u.id },
          data: u.data,
        });

        // Se l'UPDATE puntava a un parent "new_", lo risolviamo dopo usando tempToReal
        if (u.__parentTempId) {
          pendingFixTemp.push({ childRealId: u.id, parentTempId: u.__parentTempId });
        }
      }

      // 3) FIX dei parent "temp" (new_...)
      for (const p of pendingFixTemp) {
        const realParentId = tempToReal.get(p.parentTempId);
        if (!realParentId) continue;

        await tx.boqLine.update({
          where: { id: p.childRealId },
          data: { parentLine: { connect: { id: realParentId } } },
        });
      }

      // 4) FIX dei parent "reali" deferred (cuid importato che non esisteva e viene creato nello stesso import)
      for (const p of pendingFixReal) {
        await tx.boqLine.update({
          where: { id: p.childRealId },
          data: { parentLine: { connect: { id: p.parentRealId } } },
        });
      }
    });
    
    return { created: toCreate.length, updated: toUpdate.length };
  }

  async deleteLine(projectId: string, lineId: string) {
    const line = await this.prisma.boqLine.findFirst({
      where: { id: lineId, projectId },
      select: { id: true, versionId: true, rowType: true },
    });
    if (!line) throw new NotFoundException("Line not found");

    const version = await this.prisma.scenarioVersion.findFirst({
      where: { id: line.versionId, projectId, archivedAt: null },
      select: { status: true },
    });
    if (!version) throw new NotFoundException("Version not found");
    if (version.status === ScenarioVersionStatus.LOCKED) {
      throw new ForbiddenException("Version is locked");
    }

    await this.prisma.$transaction(async (tx) => {
      // 1) stacca eventuali figli (MVP: li riportiamo a root)
      // uso la relazione, così non dipendiamo da parentLineId scalare
      const children = await tx.boqLine.findMany({
        where: {
          projectId,
          versionId: line.versionId,
          parentLine: { is: { id: line.id } },
        },
        select: { id: true },
      });

      for (const ch of children) {
        await tx.boqLine.update({
          where: { id: ch.id },
          data: { parentLine: { disconnect: true } },
        });
      }

      // 2) elimina la riga
      await tx.boqLine.delete({ where: { id: line.id } });
    });

    return { ok: true };
  }

}
