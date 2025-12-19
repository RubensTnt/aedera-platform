// src/core/bim/bimMappingStore.ts

export type BimMappingRow = {
  globalId: string;
  wbsNodeId: string | null;
  tariffaCodice: string | null;
  pacchettoCodice: string | null;

  // opzionali (già in ElementParams nel tuo overlay)
  codiceMateriale?: string | null;
  fornitoreId?: string | null;
};

type ModelCache = {
  projectId: string;
  rowsByGlobalId: Map<string, BimMappingRow>;
  updatedAt: number;
};

const cacheByModelId = new Map<string, ModelCache>();

export function setBimMappingForModel(
  modelId: string,
  projectId: string,
  rows: BimMappingRow[],
) {
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

export function patchBimMappingRows(
  modelId: string,
  projectId: string,
  patchRows: BimMappingRow[],
) {
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
