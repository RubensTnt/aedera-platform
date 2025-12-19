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

  async bulkGetValues(projectId: string, modelId: string, guids: string[], keys?: string[]) {
    if (guids.length === 0) return { definitions: [], values: {} };

    const defs = await this.prisma.elementParamDefinition.findMany({
      where: {
        projectId,
        ...(keys?.length ? { key: { in: keys } } : {}),
        isActive: true,
      },
      select: { id: true, key: true, label: true, type: true, isMulti: true, isRequired: true, isReadOnly: true },
      orderBy: { createdAt: "asc" },
    });

    const values = await this.prisma.elementParamValue.findMany({
      where: {
        projectId,
        modelId,
        guid: { in: guids },
        definitionId: { in: defs.map((d) => d.id) },
      },
      select: { guid: true, definitionId: true, valueJson: true },
    });

    const defById = new Map(defs.map((d) => [d.id, d]));
    const out: Record<string, Record<string, any>> = {};
    for (const guid of guids) out[guid] = {};

    for (const v of values) {
      const def = defById.get(v.definitionId);
      if (!def) continue;
      out[v.guid][def.key] = v.valueJson;
    }

    return { definitions: defs, values: out };
  }

  async setValue(args: {
    projectId: string;
    modelId: string;
    guid: string;
    key: string;
    value: any;
    source: string;
    changedByUserId: string;
  }) {
    const { projectId, modelId, guid, key, value, source, changedByUserId } = args;
    if (!changedByUserId) throw new BadRequestException("Missing user");

    const def = await this.prisma.elementParamDefinition.findUnique({
      where: { projectId_key: { projectId, key } },
    });
    if (!def) throw new NotFoundException(`Param definition not found: ${key}`);
    if (!def.isActive) throw new BadRequestException(`Param not active: ${key}`);
    if (def.isReadOnly) throw new BadRequestException(`Param is read-only: ${key}`);

    // Validazioni minime (come prima)
    if (def.type === "STRING") {
      if (def.isMulti) {
        if (!isStringArray(value)) throw new BadRequestException("Expected string[]");
      } else {
        if (typeof value !== "string") throw new BadRequestException("Expected string");
      }
    }

    if (def.type === "SUPPLIER") {
      if (!def.isMulti) throw new BadRequestException("SUPPLIER param must be multi (supplierId[])");
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
        throw new BadRequestException("Expected supplierId[]");
      }
      const count = await this.prisma.supplier.count({
        where: { projectId, id: { in: value }, isActive: true },
      });
      if (count !== value.length) throw new BadRequestException("One or more suppliers not found or inactive");
    }

    const existing = await this.prisma.elementParamValue.findUnique({
      where: {
        modelId_guid_definitionId: {
          modelId,
          guid,
          definitionId: def.id,
        },
      },
      select: { id: true, valueJson: true },
    });

    const oldValue = existing?.valueJson ?? null;
    const newValue = value ?? null;

    const updated = await this.prisma.elementParamValue.upsert({
      where: {
        modelId_guid_definitionId: {
          modelId,
          guid,
          definitionId: def.id,
        },
      },
      update: { valueJson: newValue },
      create: {
        projectId,
        modelId,
        guid,
        definitionId: def.id,
        valueJson: newValue,
      },
    });

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      await this.prisma.elementParamHistory.create({
        data: {
          projectId,
          modelId,
          guid,
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

  async bulkSetValues(args: {
    projectId: string;
    modelId: string;
    items: { guid: string; key: string; value: any }[];
    source: string;
    changedByUserId: string;
  }) {
    const { projectId, modelId, items, source, changedByUserId } = args;
    if (!changedByUserId) throw new BadRequestException("Missing user");

    const clean = (items ?? [])
      .map((it) => ({
        guid: String(it.guid ?? "").trim(),
        key: String(it.key ?? "").trim(),
        value: it.value ?? null,
      }))
      .filter((it) => it.guid.length > 0 && it.key.length > 0);

    if (clean.length === 0) return { updated: 0 };

    const keys = [...new Set(clean.map((c) => c.key))];

    return this.prisma.$transaction(async (tx) => {
      const defs = await tx.elementParamDefinition.findMany({
        where: { projectId, key: { in: keys }, isActive: true },
      });
      const defByKey = new Map(defs.map((d) => [d.key, d]));

      for (const k of keys) {
        const d = defByKey.get(k);
        if (!d) throw new NotFoundException(`Param definition not found or inactive: ${k}`);
        if (d.isReadOnly) throw new BadRequestException(`Param is read-only: ${k}`);
      }

      const defIds = defs.map((d) => d.id);
      const guids = [...new Set(clean.map((c) => c.guid))];

      const existing = await tx.elementParamValue.findMany({
        where: {
          projectId,
          modelId,
          guid: { in: guids },
          definitionId: { in: defIds },
        },
        select: { guid: true, definitionId: true, valueJson: true },
      });

      const byKey = new Map<string, typeof existing[number]>();
      for (const e of existing) byKey.set(`${e.guid}::${e.definitionId}`, e);

      // SUPPLIER: validate all ids once
      const supplierIdsToCheck = new Set<string>();
      for (const it of clean) {
        const def = defByKey.get(it.key)!;
        if (def.type === "SUPPLIER") {
          if (!def.isMulti) throw new BadRequestException("SUPPLIER param must be multi (supplierId[])");
          if (!Array.isArray(it.value) || it.value.some((v) => typeof v !== "string")) {
            throw new BadRequestException("Expected supplierId[]");
          }
          for (const sid of it.value) supplierIdsToCheck.add(sid);
        }
      }
      if (supplierIdsToCheck.size) {
        const ids = [...supplierIdsToCheck];
        const count = await tx.supplier.count({ where: { projectId, id: { in: ids }, isActive: true } });
        if (count !== ids.length) throw new BadRequestException("One or more suppliers not found or inactive");
      }

      let updated = 0;

      for (const it of clean) {
        const def = defByKey.get(it.key)!;

        if (def.type === "STRING") {
          if (def.isMulti) {
            if (!isStringArray(it.value)) throw new BadRequestException("Expected string[]");
          } else {
            if (typeof it.value !== "string") throw new BadRequestException("Expected string");
          }
        }

        const prev = byKey.get(`${it.guid}::${def.id}`) ?? null;
        const oldValue = prev?.valueJson ?? null;
        const newValue = it.value ?? null;

        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;

        await tx.elementParamValue.upsert({
          where: {
            modelId_guid_definitionId: {
              modelId,
              guid: it.guid,
              definitionId: def.id,
            },
          },
          update: { valueJson: newValue },
          create: {
            projectId,
            modelId,
            guid: it.guid,
            definitionId: def.id,
            valueJson: newValue,
          },
        });

        await tx.elementParamHistory.create({
          data: {
            projectId,
            modelId,
            guid: it.guid,
            kind: "PARAM",
            definitionId: def.id,
            oldValueJson: oldValue as any,
            newValueJson: newValue as any,
            changedByUserId,
            source,
          },
        });

        updated++;
      }

      return { updated };
    });
  }


  // ---------- HISTORY ----------
  
  getElementHistory(projectId: string, modelId: string, guid: string) {
    return this.prisma.elementParamHistory.findMany({
      where: { projectId, modelId, guid },
      orderBy: { changedAt: "desc" },
      take: 200,
    });
  }

}
