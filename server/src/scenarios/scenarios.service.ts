/* import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, ScenarioQtySource, ScenarioType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type CreateScenarioInput = {
  projectId: string;
  type: string;
  name: string;
  createdByUserId?: string;
};

type BulkSetItemsInput = {
  projectId: string;
  scenarioId: string;
  items: {
    globalId: string;
    qty?: string | number | null;
    unit?: string | null;
    unitPrice?: string | number | null;
    amount?: string | number | null;
    qtySource?: string;
    notes?: string | null;
  }[];
  changedByUserId?: string;
  source: string;
};

function toDecimalOrNull(v: any): Prisma.Decimal | null {
  if (v === undefined) return null;
  if (v === null) return null;
  const s = typeof v === "string" ? v.trim() : String(v);
  if (!s.length) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new BadRequestException(`Invalid number: ${s}`);
  return new Prisma.Decimal(n);
}

function normalizeScenarioType(t: string): ScenarioType {
  const u = String(t ?? "").trim().toUpperCase();
  if (u === "GARA") return "GARA";
  if (u === "OPERATIVO") return "OPERATIVO";
  if (u === "COSTI") return "COSTI";
  if (u === "FORECAST") return "FORECAST";
  throw new BadRequestException(`Invalid scenario type: ${t}`);
}

function normalizeQtySource(v?: string): ScenarioQtySource {
  const u = String(v ?? "").trim().toUpperCase();
  if (!u) return "MODEL";
  if (u === "MODEL") return "MODEL";
  if (u === "OVERRIDE") return "OVERRIDE";
  if (u === "MANUAL") return "MANUAL";
  throw new BadRequestException(`Invalid qtySource: ${v}`);
}

@Injectable()
export class ScenariosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string) {
    const scenarios = await this.prisma.economicScenario.findMany({
      where: { projectId },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        type: true,
        name: true,
        version: true,
        isActive: true,
        frozenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { scenarios };
  }

  async create(input: CreateScenarioInput) {
    const type = normalizeScenarioType(input.type);
    const name = String(input.name ?? "").trim();
    if (!name) throw new BadRequestException("Missing name");

    return this.prisma.economicScenario.create({
      data: {
        projectId: input.projectId,
        type,
        name,
      },
      select: {
        id: true,
        projectId: true,
        type: true,
        name: true,
        version: true,
        isActive: true,
        frozenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async get(projectId: string, scenarioId: string) {
    const s = await this.prisma.economicScenario.findFirst({
      where: { id: scenarioId, projectId },
      select: {
        id: true,
        projectId: true,
        type: true,
        name: true,
        version: true,
        isActive: true,
        frozenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!s) throw new BadRequestException("Scenario not found");
    return s;
  }

  async bulkGetItems(projectId: string, scenarioId: string, globalIds: string[]) {
    if (!globalIds.length) return { items: [] };

    // ensure scenario belongs to project
    const s = await this.prisma.economicScenario.findFirst({
      where: { id: scenarioId, projectId },
      select: { id: true },
    });
    if (!s) throw new BadRequestException("Scenario not found");

    const rows = await this.prisma.scenarioElementCost.findMany({
      where: { projectId, scenarioId, ifcGlobalId: { in: globalIds } },
      select: {
        ifcGlobalId: true,
        qty: true,
        unit: true,
        unitPrice: true,
        amount: true,
        qtySource: true,
        notes: true,
        updatedAt: true,
      },
    });

    return {
      items: rows.map((r) => ({
        globalId: r.ifcGlobalId,
        qty: r.qty?.toString() ?? null,
        unit: r.unit ?? null,
        unitPrice: r.unitPrice?.toString() ?? null,
        amount: r.amount?.toString() ?? null,
        qtySource: r.qtySource,
        notes: r.notes ?? null,
        updatedAt: r.updatedAt,
      })),
    };
  }

  async bulkSetItems(input: BulkSetItemsInput) {
    if (!input.changedByUserId) throw new BadRequestException("Missing user");

    // ensure scenario belongs to project
    const scenario = await this.prisma.economicScenario.findFirst({
      where: { id: input.scenarioId, projectId: input.projectId },
      select: { id: true, frozenAt: true },
    });
    if (!scenario) throw new BadRequestException("Scenario not found");
    if (scenario.frozenAt) throw new BadRequestException("Scenario is frozen");

    const clean = (input.items ?? [])
      .map((it) => ({
        globalId: String(it.globalId ?? "").trim(),
        qty: it.qty,
        unit: it.unit,
        unitPrice: it.unitPrice,
        amount: it.amount,
        qtySource: it.qtySource,
        notes: it.notes,
      }))
      .filter((it) => it.globalId.length > 0);

    if (!clean.length) return { updated: 0 };

    const { projectId, scenarioId } = input;

    const result = await this.prisma.$transaction(async (tx) => {
      let updated = 0;

      for (const it of clean) {
        const qty = toDecimalOrNull(it.qty);
        const unitPrice = toDecimalOrNull(it.unitPrice);
        const amount = toDecimalOrNull(it.amount);

        await tx.scenarioElementCost.upsert({
          where: { scenarioId_ifcGlobalId: { scenarioId, ifcGlobalId: it.globalId } },
          create: {
            projectId,
            scenarioId,
            ifcGlobalId: it.globalId,
            qty,
            unit: it.unit ?? null,
            unitPrice,
            amount,
            qtySource: normalizeQtySource(it.qtySource),
            notes: it.notes ?? null,
          },
          update: {
            qty,
            unit: it.unit ?? null,
            unitPrice,
            amount,
            qtySource: normalizeQtySource(it.qtySource),
            notes: it.notes ?? null,
          },
        });

        updated += 1;
      }

      return { updated };
    });

    return result;
  }
}
 */