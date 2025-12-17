import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ElementParamType } from "@prisma/client";

function isStringArray(x: any): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

@Injectable()
export class ElementParamsService {
  constructor(private prisma: PrismaService) {}

  // ---------- DEFINITIONS ----------

  listDefinitions(projectId: string) {
    return this.prisma.elementParamDefinition.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  }

  async createDefinition(projectId: string, body: any) {
    return this.prisma.elementParamDefinition.create({
      data: {
        projectId,
        key: String(body.key).trim(),
        label: String(body.label).trim(),
        type: body.type as ElementParamType,
        isMulti: !!body.isMulti,
        optionsJson: body.optionsJson ?? undefined,
        isActive: body.isActive ?? true,
        isRequired: !!body.isRequired,
        isReadOnly: !!body.isReadOnly,
        ifcClassFilter: body.ifcClassFilter ?? null,
      },
    });
  }

  async updateDefinition(projectId: string, id: string, patch: any) {
    // protezione: non permettere di cambiare projectId
    return this.prisma.elementParamDefinition.update({
      where: { id },
      data: {
        label: typeof patch.label === "string" ? patch.label.trim() : undefined,
        isMulti: typeof patch.isMulti === "boolean" ? patch.isMulti : undefined,
        optionsJson: patch.optionsJson !== undefined ? patch.optionsJson : undefined,
        isActive: typeof patch.isActive === "boolean" ? patch.isActive : undefined,
        isRequired: typeof patch.isRequired === "boolean" ? patch.isRequired : undefined,
        isReadOnly: typeof patch.isReadOnly === "boolean" ? patch.isReadOnly : undefined,
        ifcClassFilter: patch.ifcClassFilter !== undefined ? (patch.ifcClassFilter ?? null) : undefined,
      },
    }).then(async (def) => {
      // sanity: se qualcuno prova a patchare una def di un altro progetto
      if (def.projectId !== projectId) throw new BadRequestException("Wrong projectId");
      return def;
    });
  }

  // ---------- VALUES ----------

  async bulkGetValues(projectId: string, globalIds: string[], keys?: string[]) {
    if (globalIds.length === 0) return { definitions: [], values: {} };

    const defs = await this.prisma.elementParamDefinition.findMany({
      where: {
        projectId,
        // se keys è presente, filtra
        ...(keys?.length ? { key: { in: keys } } : {}),
        // normalmente UI usa solo attivi; per bulk-get meglio attivi
        isActive: true,
      },
      select: { id: true, key: true, label: true, type: true, isMulti: true, isRequired: true, isReadOnly: true },
      orderBy: { createdAt: "asc" },
    });

    const values = await this.prisma.elementParamValue.findMany({
      where: {
        projectId,
        ifcGlobalId: { in: globalIds },
        definitionId: { in: defs.map((d) => d.id) },
      },
      select: { ifcGlobalId: true, definitionId: true, valueJson: true },
    });

    // shape comoda per frontend: values[globalId][key] = valueJson
    const defById = new Map(defs.map((d) => [d.id, d]));
    const out: Record<string, Record<string, any>> = {};
    for (const gid of globalIds) out[gid] = {};

    for (const v of values) {
      const def = defById.get(v.definitionId);
      if (!def) continue;
      out[v.ifcGlobalId][def.key] = v.valueJson;
    }

    return { definitions: defs, values: out };
  }

  async setValue(args: {
    projectId: string;
    globalId: string;
    key: string;
    value: any;
    source: string;
    changedByUserId: string;
  }) {
    const { projectId, globalId, key, value, source, changedByUserId } = args;
    if (!changedByUserId) throw new BadRequestException("Missing user");

    const def = await this.prisma.elementParamDefinition.findUnique({
      where: { projectId_key: { projectId, key } },
    });
    if (!def) throw new NotFoundException(`Param definition not found: ${key}`);
    if (!def.isActive) throw new BadRequestException(`Param not active: ${key}`);
    if (def.isReadOnly) throw new BadRequestException(`Param is read-only: ${key}`);

    // Validazione minima (STRING + multi per fornitore, single per codiceMateriale)
    if (def.type === "STRING") {
      if (def.isMulti) {
        if (!isStringArray(value)) throw new BadRequestException("Expected string[]");
      } else {
        if (typeof value !== "string") throw new BadRequestException("Expected string");
      }
    }
    // altri tipi li validiamo quando li userai davvero (NUMBER/ENUM/BOOLEAN/DATE/JSON)

    if (def.type === "SUPPLIER") {
      if (!def.isMulti) {
        throw new BadRequestException("SUPPLIER param must be multi (supplierId[])");
      }

      if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
        throw new BadRequestException("Expected supplierId[]");
      }

      // Verifica che tutti i supplierId esistano, siano del progetto e attivi
      const count = await this.prisma.supplier.count({
        where: { projectId, id: { in: value }, isActive: true },
      });

      if (count !== value.length) {
        throw new BadRequestException("One or more suppliers not found or inactive");
      }
    }

    const existing = await this.prisma.elementParamValue.findUnique({
      where: {
        projectId_ifcGlobalId_definitionId: {
          projectId,
          ifcGlobalId: globalId,
          definitionId: def.id,
        },
      },
      select: { id: true, valueJson: true },
    });

    const oldValue = existing?.valueJson ?? null;
    const newValue = value ?? null;

    const updated = await this.prisma.elementParamValue.upsert({
      where: {
        projectId_ifcGlobalId_definitionId: {
          projectId,
          ifcGlobalId: globalId,
          definitionId: def.id,
        },
      },
      update: { valueJson: newValue },
      create: {
        projectId,
        ifcGlobalId: globalId,
        definitionId: def.id,
        valueJson: newValue,
      },
    });

    // Scrivi history solo se cambia davvero
    const changed = JSON.stringify(oldValue) !== JSON.stringify(newValue);
    if (changed) {
      await this.prisma.elementParamHistory.create({
        data: {
          projectId,
          ifcGlobalId: globalId,
          kind: "PARAM",
          definitionId: def.id,
          oldValueJson: oldValue as any,
          newValueJson: newValue as any,
          changedByUserId,
          source,
        },
      });
    }

    return updated;
  }

  // ---------- HISTORY ----------

  getElementHistory(projectId: string, globalId: string) {
    return this.prisma.elementParamHistory.findMany({
      where: { projectId, ifcGlobalId: globalId },
      orderBy: { changedAt: "desc" },
      take: 200,
    });
  }
}
