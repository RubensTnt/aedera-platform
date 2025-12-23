// server/src/element-params/element-params.service.ts

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, ElementParamType } from "@prisma/client";

function isStringArray(x: any): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

function isSupplierIdArray(x: any): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string" && v.trim().length > 0);
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
    const data = {
      label: typeof patch.label === "string" ? patch.label.trim() : undefined,
      isMulti: typeof patch.isMulti === "boolean" ? patch.isMulti : undefined,
      optionsJson: patch.optionsJson !== undefined ? patch.optionsJson : undefined,
      isActive: typeof patch.isActive === "boolean" ? patch.isActive : undefined,
      isRequired: typeof patch.isRequired === "boolean" ? patch.isRequired : undefined,
      isReadOnly: typeof patch.isReadOnly === "boolean" ? patch.isReadOnly : undefined,
      ifcClassFilter:
        patch.ifcClassFilter !== undefined ? (patch.ifcClassFilter ?? null) : undefined,
    };

    const r = await this.prisma.elementParamDefinition.updateMany({
      where: { id, projectId },
      data,
    });

    if (r.count === 0) throw new BadRequestException("Wrong projectId");

    return this.prisma.elementParamDefinition.findUnique({ where: { id } });
  }

  // ---------- VALUES ----------

  /**
   * Ritorna values[guid][key] = valueJson
   */
  async bulkGetValues(projectId: string, modelId: string, guids: string[], keys?: string[]) {
    const cleanGuids = (guids ?? []).map((g) => String(g ?? "").trim()).filter(Boolean);
    if (!modelId || cleanGuids.length === 0) return { definitions: [], values: {} };

    const defs = await this.prisma.elementParamDefinition.findMany({
      where: {
        projectId,
        ...(keys?.length ? { key: { in: keys } } : {}),
        isActive: true,
      },
      select: {
        id: true,
        key: true,
        label: true,
        type: true,
        isMulti: true,
        isRequired: true,
        isReadOnly: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!defs.length) {
      const empty: Record<string, Record<string, any>> = {};
      for (const g of cleanGuids) empty[g] = {};
      return { definitions: [], values: empty };
    }

    const rows = await this.prisma.elementParamValue.findMany({
      where: {
        projectId,
        modelId,
        guid: { in: cleanGuids },
        definitionId: { in: defs.map((d) => d.id) },
      },
      select: { guid: true, definitionId: true, valueJson: true },
    });

    const defById = new Map(defs.map((d) => [d.id, d]));
    const values: Record<string, Record<string, any>> = {};
    for (const g of cleanGuids) values[g] = {};

    for (const r of rows) {
      const def = defById.get(r.definitionId);
      if (!def) continue;
      values[r.guid][def.key] = r.valueJson;
    }

    return { definitions: defs, values };
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
    if (!modelId || !guid) throw new BadRequestException("Missing modelId/guid");

    const cleanGuid = String(guid).trim();
    const cleanKey = String(key).trim();
    if (!cleanGuid || !cleanKey) throw new BadRequestException("Missing guid/key");

    const def = await this.prisma.elementParamDefinition.findUnique({
      where: { projectId_key: { projectId, key: cleanKey } },
    });
    if (!def) throw new NotFoundException(`Param definition not found: ${cleanKey}`);
    if (!def.isActive) throw new BadRequestException(`Param not active: ${cleanKey}`);
    if (def.isReadOnly) throw new BadRequestException(`Param is read-only: ${cleanKey}`);

    // ---- Validation by type
    if (def.type === "STRING") {
      if (def.isMulti) {
        if (!isStringArray(value)) throw new BadRequestException("Expected string[]");
      } else {
        if (value !== null && typeof value !== "string") throw new BadRequestException("Expected string");
      }
    }

    if (def.type === "SUPPLIER") {
      // tu hai scelto: fornitori MULTI (supplierId[])
      if (!def.isMulti) {
        throw new BadRequestException("SUPPLIER param must be multi (supplierId[])");
      }
      if (value !== null && value !== undefined) {
        if (!isSupplierIdArray(value)) throw new BadRequestException("Expected supplierId[]");
        const ids = value as string[];
        const count = await this.prisma.supplier.count({
          where: { projectId, id: { in: ids }, isActive: true },
        });
        if (count !== ids.length) throw new BadRequestException("One or more suppliers not found or inactive");
      }
    }

    const existing = await this.prisma.elementParamValue.findUnique({
      where: {
        modelId_guid_definitionId: { modelId, guid: cleanGuid, definitionId: def.id },
      },
      select: { id: true, valueJson: true },
    });

    const oldValue = existing?.valueJson ?? null;
    const newValue = value ?? null;

    const updated = await this.prisma.elementParamValue.upsert({
      where: {
        modelId_guid_definitionId: { modelId, guid: cleanGuid, definitionId: def.id },
      },
      update: { valueJson: newValue },
      create: {
        projectId,
        modelId,
        guid: cleanGuid,
        definitionId: def.id,
        valueJson: newValue,
      },
    });

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      await this.prisma.elementParamHistory.create({
        data: {
          projectId,
          modelId,
          guid: cleanGuid,
          kind: "PARAM",
          definitionId: def.id,
          oldValueJson: (oldValue ?? Prisma.JsonNull) as any,
          newValueJson: (newValue ?? Prisma.JsonNull) as any,
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
    if (!modelId) throw new BadRequestException("Missing modelId");

    const clean = (items ?? [])
      .map((it) => ({
        guid: String((it as any).guid ?? "").trim(),
        key: String((it as any).key ?? "").trim(),
        value: (it as any).value ?? null,
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

      // preload existing values
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

      // SUPPLIER validate once
      const supplierIdsToCheck = new Set<string>();
      for (const it of clean) {
        const def = defByKey.get(it.key)!;
        if (def.type === "SUPPLIER") {
          if (!def.isMulti) throw new BadRequestException("SUPPLIER param must be multi (supplierId[])");
          if (it.value != null) {
            if (!isSupplierIdArray(it.value)) throw new BadRequestException("Expected supplierId[]");
            for (const sid of it.value as string[]) supplierIdsToCheck.add(sid);
          }
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
            if (it.value !== null && typeof it.value !== "string") throw new BadRequestException("Expected string");
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
            oldValueJson: (oldValue ?? Prisma.JsonNull) as any,
            newValueJson: (newValue ?? Prisma.JsonNull) as any,
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
    if (!modelId || !guid) throw new BadRequestException("Missing modelId/guid");
    return this.prisma.elementParamHistory.findMany({
      where: { projectId, modelId, guid },
      orderBy: { changedAt: "desc" },
      take: 200,
    });
  }
}
