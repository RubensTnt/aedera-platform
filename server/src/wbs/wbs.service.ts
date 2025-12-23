// server/src/wbs/wbs.service.ts

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WbsAssignmentStatus, WbsAssignmentSource, type Prisma } from "@prisma/client";

type LevelSettingInput = {
  levelKey: string;
  enabled?: boolean;
  required?: boolean;
  sortIndex?: number;
  ifcParamKey?: string | null;
};

type AllowedValueInput = {
  levelKey: string;
  code: string;
  name?: string | null;
  sortIndex?: number;
  isActive?: boolean;
};

type BulkGetAssignmentsV2Input = {
  projectId: string;
  modelId: string;
  guids: string[];
  levels?: string[];
};

type BulkSetAssignmentsV2Input = {
  projectId: string;
  modelId: string;
  items: { guid: string; levelKey: string; code: string | null }[];
  source: WbsAssignmentSource;
  overwrite?: boolean; // default: true for UI, false for IFC_IMPORT
  changedByUserId?: string;
};

function cleanKey(x: any) {
  return String(x ?? "").trim();
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

@Injectable()
export class WbsService {
  constructor(private prisma: PrismaService) {}

  // -----------------------------
  // Level settings
  // -----------------------------

  async listLevels(projectId: string) {
    return this.prisma.wbsLevelSetting.findMany({
      where: { projectId },
      orderBy: [{ sortIndex: "asc" }, { levelKey: "asc" }],
    });
  }

  async bulkUpsertLevels(projectId: string, items: LevelSettingInput[]) {
    const clean = (items ?? [])
      .map((it) => ({
        levelKey: cleanKey(it.levelKey),
        enabled: typeof it.enabled === "boolean" ? it.enabled : undefined,
        required: typeof it.required === "boolean" ? it.required : undefined,
        sortIndex: Number.isFinite(Number(it.sortIndex)) ? Number(it.sortIndex) : undefined,
        ifcParamKey: it.ifcParamKey === null ? null : it.ifcParamKey ? cleanKey(it.ifcParamKey) : undefined,
      }))
      .filter((it) => it.levelKey.length > 0);

    if (!clean.length) return { upserted: 0 };

    // dedup su levelKey (primo vince)
    const seen = new Set<string>();
    const dedup: typeof clean = [];
    for (const it of clean) {
      const k = it.levelKey;
      if (seen.has(k)) continue;
      seen.add(k);
      dedup.push(it);
    }

    return this.prisma.$transaction(async (tx) => {
      let upserted = 0;
      for (const it of dedup) {
        await tx.wbsLevelSetting.upsert({
          where: { projectId_levelKey: { projectId, levelKey: it.levelKey } },
          update: {
            ...(it.enabled !== undefined ? { enabled: it.enabled } : {}),
            ...(it.required !== undefined ? { required: it.required } : {}),
            ...(it.sortIndex !== undefined ? { sortIndex: it.sortIndex } : {}),
            ...(it.ifcParamKey !== undefined ? { ifcParamKey: it.ifcParamKey } : {}),
          },
          create: {
            projectId,
            levelKey: it.levelKey,
            enabled: it.enabled ?? true,
            required: it.required ?? false,
            sortIndex: it.sortIndex ?? 0,
            ifcParamKey: it.ifcParamKey ?? null,
          },
        });
        upserted += 1;
      }
      return { upserted };
    });
  }

  // -----------------------------
  // Allowed values
  // -----------------------------

  async listAllowedValues(projectId: string, levels?: string[]) {
    const levelKeys = levels?.map(cleanKey).filter(Boolean);
    return this.prisma.wbsAllowedValue.findMany({
      where: {
        projectId,
        ...(levelKeys?.length ? { levelKey: { in: levelKeys } } : {}),
        isActive: true,
      },
      orderBy: [{ levelKey: "asc" }, { sortIndex: "asc" }, { code: "asc" }],
    });
  }

  async bulkUpsertAllowedValues(projectId: string, items: AllowedValueInput[]) {
    const clean = (items ?? [])
      .map((it) => ({
        levelKey: cleanKey(it.levelKey),
        code: cleanKey(it.code),
        name: it.name === null ? null : it.name !== undefined ? String(it.name) : undefined,
        sortIndex: Number.isFinite(Number(it.sortIndex)) ? Number(it.sortIndex) : undefined,
        isActive: typeof it.isActive === "boolean" ? it.isActive : undefined,
      }))
      .filter((it) => it.levelKey.length > 0 && it.code.length > 0);

    if (!clean.length) return { upserted: 0 };

    // dedup su (levelKey, code) - ultimo vince
    const byKey = new Map<string, (typeof clean)[number]>();
    for (const it of clean) byKey.set(`${it.levelKey}::${it.code}`, it);
    const dedup = Array.from(byKey.values());

    return this.prisma.$transaction(async (tx) => {
      let upserted = 0;
      for (const it of dedup) {
        await tx.wbsAllowedValue.upsert({
          where: {
            projectId_levelKey_code: { projectId, levelKey: it.levelKey, code: it.code },
          },
          update: {
            ...(it.name !== undefined ? { name: it.name } : {}),
            ...(it.sortIndex !== undefined ? { sortIndex: it.sortIndex } : {}),
            ...(it.isActive !== undefined ? { isActive: it.isActive } : {}),
          },
          create: {
            projectId,
            levelKey: it.levelKey,
            code: it.code,
            name: it.name ?? null,
            sortIndex: it.sortIndex ?? 0,
            isActive: it.isActive ?? true,
          },
        });
        upserted += 1;
      }
      return { upserted };
    });
  }

  // -----------------------------
  // Assignments v2
  // -----------------------------

  private async assertModelInProject(projectId: string, modelId: string) {
    const model = await this.prisma.ifcModel.findFirst({
      where: { id: modelId, projectId },
      select: { id: true },
    });
    if (!model) throw new NotFoundException("Model not found in project");
  }

  async bulkGetAssignmentsV2(input: BulkGetAssignmentsV2Input) {
    const projectId = cleanKey(input.projectId);
    const modelId = cleanKey(input.modelId);
    const guids = uniq((input.guids ?? []).map(cleanKey).filter(Boolean));
    const levels = input.levels ? uniq(input.levels.map(cleanKey).filter(Boolean)) : undefined;

    if (!projectId) throw new BadRequestException("Missing projectId");
    if (!modelId) throw new BadRequestException("Missing modelId");
    if (!guids.length) return { items: [] };

    await this.assertModelInProject(projectId, modelId);

    const rows = await this.prisma.wbsAssignment.findMany({
      where: {
        projectId,
        modelId,
        guid: { in: guids },
        ...(levels?.length ? { levelKey: { in: levels } } : {}),
      },
      include: {
        allowedValue: true,
      },
    });

    const items = rows.map((r) => ({
      guid: r.guid,
      levelKey: r.levelKey,
      status: r.status,
      allowedValueId: r.allowedValueId,
      code: r.allowedValue ? r.allowedValue.code : null,
      name: r.allowedValue?.name ?? null,
      rawCode: r.rawCode ?? null,
    }));

    return { items };
  }

  async bulkSetAssignmentsV2(input: BulkSetAssignmentsV2Input) {
    const projectId = cleanKey(input.projectId);
    const modelId = cleanKey(input.modelId);

    if (!projectId) throw new BadRequestException("Missing projectId");
    if (!modelId) throw new BadRequestException("Missing modelId");

    const source = input.source ?? WbsAssignmentSource.UI;

    const overwrite =
      typeof input.overwrite === "boolean"
        ? input.overwrite
        : source === WbsAssignmentSource.IFC_IMPORT
          ? false
          : true;

    const changedByUserId = input.changedByUserId ? cleanKey(input.changedByUserId) : undefined;

    // history solo per UI -> serve user
    if (source === WbsAssignmentSource.UI && !changedByUserId) {
      throw new BadRequestException("Missing user");
    }

    const clean = (input.items ?? [])
      .map((it) => ({
        guid: cleanKey(it.guid),
        levelKey: cleanKey(it.levelKey),
        code: it.code === null ? null : cleanKey(it.code),
      }))
      .filter((it) => it.guid.length > 0 && it.levelKey.length > 0);

    if (!clean.length) return { updated: 0, skipped: 0 };

    await this.assertModelInProject(projectId, modelId);

    // dedup: ultimo vince su (guid, levelKey)
    const byKey = new Map<string, (typeof clean)[number]>();
    for (const it of clean) byKey.set(`${it.guid}::${it.levelKey}`, it);
    const dedup = Array.from(byKey.values());

    const guids = uniq(dedup.map((x) => x.guid));
    const levels = uniq(dedup.map((x) => x.levelKey));

    // preload existing
    const existingRows = await this.prisma.wbsAssignment.findMany({
      where: { projectId, modelId, guid: { in: guids }, levelKey: { in: levels } },
      select: {
        id: true,
        guid: true,
        levelKey: true,
        status: true,
        allowedValueId: true,
        rawCode: true,
      },
    });
    const existing = new Map<string, (typeof existingRows)[number]>();
    for (const r of existingRows) existing.set(`${r.guid}::${r.levelKey}`, r);

    // preload allowed values
    const codes = uniq(
      dedup
        .map((x) => x.code)
        .filter((x): x is string => typeof x === "string" && x.length > 0),
    );

    const allowed = codes.length
      ? await this.prisma.wbsAllowedValue.findMany({
          where: {
            projectId,
            isActive: true,
            levelKey: { in: levels },
            code: { in: codes },
          },
          select: { id: true, levelKey: true, code: true },
        })
      : [];

    const allowedMap = new Map<string, { id: string }>();
    for (const a of allowed) allowedMap.set(`${a.levelKey}::${a.code}`, { id: a.id });

    return this.prisma.$transaction(async (tx) => {
      const historyToCreate: Prisma.WbsAssignmentHistoryCreateManyInput[] = [];
      let updated = 0;
      let skipped = 0;

      for (const it of dedup) {
        const key = `${it.guid}::${it.levelKey}`;
        const prev = existing.get(key);

        // CLEAR
        const wantsClear = it.code === null || it.code.length === 0;
        if (wantsClear) {
          if (!prev) {
            skipped += 1;
            continue;
          }

          if (source === WbsAssignmentSource.UI) {
            historyToCreate.push({
              projectId,
              modelId,
              guid: it.guid,
              levelKey: it.levelKey,
              assignmentId: prev.id,
              oldStatus: prev.status,
              newStatus: null,
              oldAllowedValueId: prev.allowedValueId ?? null,
              newAllowedValueId: null,
              oldRawCode: prev.rawCode ?? null,
              newRawCode: null,
              changedByUserId: changedByUserId!,
              source,
            });
          }

          await tx.wbsAssignment.delete({ where: { id: prev.id } });
          existing.delete(key);
          updated += 1;
          continue;
        }

        // SET
        if (!overwrite && prev) {
          skipped += 1;
          continue;
        }

        const av = allowedMap.get(`${it.levelKey}::${it.code}`);
        const nextStatus = av ? WbsAssignmentStatus.VALID : WbsAssignmentStatus.INVALID;
        const nextAllowedValueId = av ? av.id : null;
        const nextRawCode = av ? null : it.code;

        const prevStatus = prev?.status ?? null;
        const prevAllowedValueId = prev?.allowedValueId ?? null;
        const prevRawCode = prev?.rawCode ?? null;

        const changed =
          !prev ||
          prevStatus !== nextStatus ||
          prevAllowedValueId !== nextAllowedValueId ||
          prevRawCode !== nextRawCode;

        if (!changed) {
          skipped += 1;
          continue;
        }

        const upserted = await tx.wbsAssignment.upsert({
          where: { modelId_guid_levelKey: { modelId, guid: it.guid, levelKey: it.levelKey } },
          update: {
            status: nextStatus,
            allowedValueId: nextAllowedValueId,
            rawCode: nextRawCode,
            projectId,
          },
          create: {
            projectId,
            modelId,
            guid: it.guid,
            levelKey: it.levelKey,
            status: nextStatus,
            allowedValueId: nextAllowedValueId,
            rawCode: nextRawCode,
          },
          select: { id: true },
        });

        existing.set(key, {
          id: upserted.id,
          guid: it.guid,
          levelKey: it.levelKey,
          status: nextStatus,
          allowedValueId: nextAllowedValueId,
          rawCode: nextRawCode,
        });

        if (source === WbsAssignmentSource.UI) {
          historyToCreate.push({
            projectId,
            modelId,
            guid: it.guid,
            levelKey: it.levelKey,
            assignmentId: upserted.id,
            oldStatus: prevStatus,
            newStatus: nextStatus,
            oldAllowedValueId: prevAllowedValueId,
            newAllowedValueId: nextAllowedValueId,
            oldRawCode: prevRawCode,
            newRawCode: nextRawCode,
            changedByUserId: changedByUserId!,
            source,
          });
        }

        updated += 1;
      }

      if (historyToCreate.length) {
        await tx.wbsAssignmentHistory.createMany({ data: historyToCreate });
      }

      return { updated, skipped, overwrite, source };
    });
  }


  async promoteInvalidAssignmentsV2(input: {
    projectId: string;
    levelKey: string;
    modelId?: string;
    dryRun?: boolean;
    changedByUserId?: string;
  }) {
    const { projectId, levelKey, modelId, dryRun, changedByUserId } = input;

    if (!changedByUserId) {
      // history.changedByUserId è required nel tuo schema
      throw new Error("Missing changedByUserId");
    }

    // 1) Allowed values attivi per livello
    const allowed = await this.prisma.wbsAllowedValue.findMany({
      where: { projectId, levelKey, isActive: true },
      select: { id: true, code: true },
    });

    const byCodeLower = new Map<string, { id: string }>();
    for (const a of allowed) {
      const code = String(a.code ?? "").trim();
      if (!code) continue;
      byCodeLower.set(code.toLowerCase(), { id: a.id });
    }

    if (byCodeLower.size === 0) {
      return {
        scanned: 0,
        promoted: 0,
        message: "Nessun allowed-value attivo per il livello.",
      };
    }

    // 2) Trova assignment INVALID con rawCode
    const invalid = await this.prisma.wbsAssignment.findMany({
      where: {
        projectId,
        levelKey,
        status: "INVALID",
        rawCode: { not: null },
        ...(modelId ? { modelId } : {}),
      },
      select: {
        id: true,
        modelId: true,
        guid: true,
        levelKey: true,
        status: true,
        allowedValueId: true,
        rawCode: true,
      },
    });

    // 3) Prepara update list
    const toPromote: Array<{
      id: string;
      modelId: string;
      guid: string;
      levelKey: string;
      oldStatus: any;
      oldAllowedValueId: string | null;
      oldRawCode: string | null;
      newAllowedValueId: string;
    }> = [];

    for (const a of invalid) {
      const raw = String(a.rawCode ?? "").trim();
      if (!raw) continue;

      const hit = byCodeLower.get(raw.toLowerCase());
      if (!hit) continue;

      toPromote.push({
        id: a.id,
        modelId: a.modelId,
        guid: a.guid,
        levelKey: a.levelKey,
        oldStatus: a.status,
        oldAllowedValueId: a.allowedValueId ?? null,
        oldRawCode: a.rawCode ?? null,
        newAllowedValueId: hit.id,
      });
    }

    if (dryRun) {
      return {
        scanned: invalid.length,
        promoted: toPromote.length,
        dryRun: true,
      };
    }

    // 4) Applica update + history (chunk per sicurezza)
    const CHUNK = 300;
    let promoted = 0;

    for (let i = 0; i < toPromote.length; i += CHUNK) {
      const chunk = toPromote.slice(i, i + CHUNK);

      // updates (uno per riga, perché allowedValueId cambia)
      const updateOps = chunk.map((u) =>
        this.prisma.wbsAssignment.update({
          where: { id: u.id },
          data: {
            status: WbsAssignmentStatus.VALID,
            allowedValueId: u.newAllowedValueId,
            rawCode: null,
          },
          select: { id: true }, // leggero
        }),
      );

      // history: createMany è più efficiente di N create
      const historyRows: Prisma.WbsAssignmentHistoryCreateManyInput[] = chunk.map((u) => ({
        projectId,
        modelId: u.modelId,
        guid: u.guid,
        levelKey: u.levelKey,

        assignmentId: u.id,

        oldStatus: u.oldStatus as WbsAssignmentStatus,
        newStatus: WbsAssignmentStatus.VALID,

        oldAllowedValueId: u.oldAllowedValueId,
        newAllowedValueId: u.newAllowedValueId,

        oldRawCode: u.oldRawCode,
        newRawCode: null,

        changedByUserId,
        source: WbsAssignmentSource.RULE,
      }));

      await this.prisma.$transaction([
        ...updateOps,
        this.prisma.wbsAssignmentHistory.createMany({
          data: historyRows,
        }),
      ]);

      promoted += chunk.length;
    }

    return {
      scanned: invalid.length,
      promoted,
    };
  }

}
