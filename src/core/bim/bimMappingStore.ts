// src/core/bim/bimMappingStore.ts

import type { WbsAssignmentV2Dto } from "@core/api/aederaApi";

export type BimMappingRow = {
  globalId: string;

  /** WBS v2: per livello */
  wbsByLevel?: Record<string, WbsAssignmentV2Dto | null>;

  tariffaCodice: string | null;
  pacchettoCodice: string | null;

  codiceMateriale?: string | null;
  fornitoreIds?: string[] | null;
};

type ModelCache = {
  projectId: string;
  rowsByGlobalId: Map<string, BimMappingRow>;
  updatedAt: number;
};

const cacheByModelId = new Map<string, ModelCache>();

export function setBimMappingForModel(modelId: string, projectId: string, rows: BimMappingRow[]) {
  cacheByModelId.set(modelId, {
    projectId,
    rowsByGlobalId: new Map(rows.map((r) => [r.globalId, r])),
    updatedAt: Date.now(),
  });

  window.dispatchEvent(new CustomEvent("aedera:bimMappingUpdated", { detail: { modelId } }));
}

export function getBimMappingRow(modelId: string, globalId: string): BimMappingRow | null {
  const cache = cacheByModelId.get(modelId);
  if (!cache) return null;
  return cache.rowsByGlobalId.get(globalId) ?? null;
}

export function patchBimMappingRows(modelId: string, projectId: string, patchRows: BimMappingRow[]) {
  const cache = cacheByModelId.get(modelId);
  if (!cache || cache.projectId !== projectId) {
    setBimMappingForModel(modelId, projectId, patchRows);
    return;
  }

  for (const r of patchRows) cache.rowsByGlobalId.set(r.globalId, r);

  cache.updatedAt = Date.now();
  window.dispatchEvent(new CustomEvent("aedera:bimMappingUpdated", { detail: { modelId } }));
}

export function clearBimMappingForModel(modelId: string) {
  cacheByModelId.delete(modelId);
  window.dispatchEvent(new CustomEvent("aedera:bimMappingUpdated", { detail: { modelId } }));
}

export function getBimMappingRows(modelId: string): BimMappingRow[] {
  const cache = cacheByModelId.get(modelId);
  if (!cache) return [];
  return Array.from(cache.rowsByGlobalId.values());
}

export function getBimMappingModelIds(projectId: string): string[] {
  const out: string[] = [];
  for (const [modelId, cache] of cacheByModelId.entries()) {
    if (cache.projectId === projectId) out.push(modelId);
  }
  return out;
}

export function listDistinctBimValues(
  modelId: string,
  field: keyof BimMappingRow,
  limit = 200,
): string[] {
  const cache = cacheByModelId.get(modelId);
  if (!cache) return [];

  const uniq = new Set<string>();
  for (const row of cache.rowsByGlobalId.values()) {
    const v = (row as any)[field];
    if (v == null) continue;

    if (Array.isArray(v)) {
      for (const it of v) {
        const s = String(it ?? "").trim();
        if (!s) continue;
        uniq.add(s);
        if (uniq.size >= limit) break;
      }
      if (uniq.size >= limit) break;
      continue;
    }

    const s = String(v).trim();
    if (!s) continue;
    uniq.add(s);
    if (uniq.size >= limit) break;
  }

  return Array.from(uniq).sort();
}
