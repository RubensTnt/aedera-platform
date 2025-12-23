// src/core/bim/selectionAdapter.ts

import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import type { ModelIdMap } from "@thatopen/components";
import * as THREE from "three";

import { getAederaViewer } from "./thatopen";
import { getElementRecord, getAllElements } from "./modelProperties";

import {
  getBimMappingRow,
  patchBimMappingRows,
  setBimMappingForModel,
  type BimMappingRow,
} from "./bimMappingStore";

import {
  requireProjectId,
  bulkSetWbsAssignmentsV2,
  bulkGetWbsAssignmentsV2,
  bulkSetElementParams,
  bulkGetElementParams,
  type WbsAssignmentV2Dto,
} from "@core/api/aederaApi";

import { ALL_WBS_LEVEL_KEYS, type WbsLevelKey } from "./datiWbsProfile";
import { getModelInfo } from "./modelRegistry";

// Highlighter styles: “mapping completeness”
const MAPPING_COMPLETE_STYLE = "mapping-complete";
const MAPPING_PARTIAL_STYLE = "mapping-partial";
const MAPPING_EMPTY_STYLE = "mapping-empty";

function ensureBimMappingStyles(highlighter: OBF.Highlighter) {
  const styles = highlighter.styles as Map<string, any>;

  if (!styles.has(MAPPING_COMPLETE_STYLE)) {
    styles.set(MAPPING_COMPLETE_STYLE, {
      color: new THREE.Color("#16a34a"),
      opacity: 0.5,
      transparent: true,
      renderedFaces: 2,
    });
  }

  if (!styles.has(MAPPING_PARTIAL_STYLE)) {
    styles.set(MAPPING_PARTIAL_STYLE, {
      color: new THREE.Color("#fbbf24"),
      opacity: 0.5,
      transparent: true,
      renderedFaces: 2,
    });
  }

  if (!styles.has(MAPPING_EMPTY_STYLE)) {
    styles.set(MAPPING_EMPTY_STYLE, {
      color: new THREE.Color("#ef4444"),
      opacity: 0.5,
      transparent: true,
      renderedFaces: 2,
    });
  }
}

export type SelectionMap = ModelIdMap;

async function getHighlighterInstance() {
  const viewer = getAederaViewer();
  if (!viewer) return null;

  const { components, world } = viewer;
  const highlighter = components.get(OBF.Highlighter);

  if (!highlighter.isSetup) {
    await highlighter.setup({
      world: world as any,
      selectMaterialDefinition: {
        color: new THREE.Color("#bcf124"),
        opacity: 1,
        transparent: false,
        renderedFaces: 0,
      },
    });
  }

  ensureBimMappingStyles(highlighter);
  return highlighter;
}

export async function getCurrentSelection(): Promise<SelectionMap | null> {
  const highlighter = await getHighlighterInstance();
  if (!highlighter) return null;

  const selectionRaw = highlighter.selection?.select;
  if (!selectionRaw) return null;

  const selection = selectionRaw as SelectionMap;

  try {
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return null;
  } catch (error) {
    console.warn("[SelectionAdapter] selezione non valida", { selection, error });
    return null;
  }

  return selection;
}

type FlatSelected = { modelId: string; localId: number; globalId?: string };

async function getSelectedElements(): Promise<FlatSelected[]> {
  const selection = await getCurrentSelection();
  if (!selection) return [];

  const result: FlatSelected[] = [];

  for (const [modelId, localIds] of Object.entries(selection)) {
    const ids = Array.from(localIds as Set<number>);
    for (const localId of ids) {
      const rec = getElementRecord(modelId, localId);
      result.push({ modelId, localId, globalId: rec?.globalId });
    }
  }

  return result;
}

export async function selectElementsByLocalIds(modelId: string, localIds: number[]): Promise<void> {
  const highlighter = await getHighlighterInstance();
  if (!highlighter) return;

  const selection: any = {};
  selection[modelId] = new Set(localIds);
  await highlighter.highlightByID("select", selection as any, true, false);
}

// ----------------------
// BIM Mapping (server-based) - WBS v2-only
// ----------------------

export type SelectedElementWithBimMapping = {
  modelId: string;
  localId: number;
  globalId: string;

  wbsByLevel?: Record<string, WbsAssignmentV2Dto | null>;

  tariffaCodice: string | null;
  pacchettoCodice: string | null;
  codiceMateriale?: string | null;
  fornitoreIds?: string[] | null;
};

export async function getSelectedElementsWithBimMapping(): Promise<SelectedElementWithBimMapping[]> {
  const selection = await getSelectedElements();

  return selection
    .filter((s): s is FlatSelected & { globalId: string } => !!s.globalId)
    .map((s) => {
      const row = getBimMappingRow(s.modelId, s.globalId) ?? null;
      return {
        modelId: s.modelId,
        localId: s.localId,
        globalId: s.globalId,
        wbsByLevel: (row as any)?.wbsByLevel ?? undefined,
        tariffaCodice: row?.tariffaCodice ?? null,
        pacchettoCodice: row?.pacchettoCodice ?? null,
        codiceMateriale: row?.codiceMateriale ?? null,
        fornitoreIds: (row as any)?.fornitoreIds ?? null,
      };
    });
}

export async function applyBimMappingToSelection(patch: {
  wbsByLevel?: Partial<Record<WbsLevelKey, string | null>>;
  tariffaCodice?: string | null;
  pacchettoCodice?: string | null;
  codiceMateriale?: string | null;
  fornitoreIds?: string[] | null;
}) {
  const selected = await getSelectedElementsWithBimMapping();
  if (!selected.length) return;

  const projectId = requireProjectId();
  const modelId = selected[0].modelId;

  const serverModelId = getModelInfo(modelId)?.serverId;
  if (!serverModelId) throw new Error("Missing serverId for current model (upload id).");

  // WBS v2
  if (patch.wbsByLevel && Object.keys(patch.wbsByLevel).length) {
    const wbsItems: Array<{ guid: string; levelKey: string; code: string | null }> = [];
    for (const s of selected) {
      for (const [levelKey, code] of Object.entries(patch.wbsByLevel)) {
        wbsItems.push({ guid: s.globalId, levelKey, code: code ?? null });
      }
    }

    await bulkSetWbsAssignmentsV2(projectId, {
      modelId: serverModelId,
      source: "UI",
      overwrite: true,
      items: wbsItems,
    });
  }

  // Params
  const paramItems: Array<{ guid: string; key: string; value: any }> = [];
  const add = (key: string, value: any) => {
    for (const s of selected) paramItems.push({ guid: s.globalId, key, value });
  };

  if ("tariffaCodice" in patch) add("tariffaCodice", patch.tariffaCodice ?? null);
  if ("pacchettoCodice" in patch) add("pacchettoCodice", patch.pacchettoCodice ?? null);
  if ("codiceMateriale" in patch) add("codiceMateriale", patch.codiceMateriale ?? null);
  if ("fornitoreIds" in patch) add("fornitoreIds", patch.fornitoreIds ?? null);

  if (paramItems.length) {
    await bulkSetElementParams(projectId, {
      modelId: serverModelId,
      items: paramItems,
      source: "UI",
    });
  }

  // Update cache locale (ottimistico)
  const updatedRows: BimMappingRow[] = selected.map((s) => ({
    globalId: s.globalId,
    wbsByLevel: patch.wbsByLevel
      ? {
          ...((s as any).wbsByLevel ?? {}),
          ...Object.fromEntries(
            Object.entries(patch.wbsByLevel).map(([k, v]) => [
              k,
              v == null || v === ""
                ? null
                : ({ status: "VALID", code: v, name: null, rawCode: null } as any),
            ]),
          ),
        }
      : ((s as any).wbsByLevel ?? undefined),
    tariffaCodice: "tariffaCodice" in patch ? (patch.tariffaCodice ?? null) : s.tariffaCodice,
    pacchettoCodice:
      "pacchettoCodice" in patch ? (patch.pacchettoCodice ?? null) : s.pacchettoCodice,
    codiceMateriale:
      "codiceMateriale" in patch ? (patch.codiceMateriale ?? null) : s.codiceMateriale,
    fornitoreIds: "fornitoreIds" in patch ? (patch.fornitoreIds ?? null) : (s as any).fornitoreIds,
  }));

  patchBimMappingRows(modelId, projectId, updatedRows);
}

// ----------------------
// Heatmap (mapping completeness)
// ----------------------

export type MappingScanResult = {
  elementsByStatus: {
    complete: number[];
    partial: number[];
    empty: number[];
  };
};

export async function applyBimMappingHeatmap(modelId: string, scan: MappingScanResult): Promise<void> {
  const highlighter = await getHighlighterInstance();
  if (!highlighter) return;

  (highlighter as any).clear?.(MAPPING_COMPLETE_STYLE);
  (highlighter as any).clear?.(MAPPING_PARTIAL_STYLE);
  (highlighter as any).clear?.(MAPPING_EMPTY_STYLE);

  const makeMap = (ids: number[]) => {
    const map: any = {};
    map[modelId] = new Set(ids);
    return map;
  };

  if (scan.elementsByStatus.complete.length > 0) {
    await highlighter.highlightByID(MAPPING_COMPLETE_STYLE, makeMap(scan.elementsByStatus.complete), false, true);
  }
  if (scan.elementsByStatus.partial.length > 0) {
    await highlighter.highlightByID(MAPPING_PARTIAL_STYLE, makeMap(scan.elementsByStatus.partial), false, true);
  }
  if (scan.elementsByStatus.empty.length > 0) {
    await highlighter.highlightByID(MAPPING_EMPTY_STYLE, makeMap(scan.elementsByStatus.empty), false, true);
  }
}

export async function clearBimMappingHeatmap(modelId: string): Promise<void> {
  const highlighter = await getHighlighterInstance();
  if (!highlighter) return;

  (highlighter as any).clear?.(MAPPING_COMPLETE_STYLE);
  (highlighter as any).clear?.(MAPPING_PARTIAL_STYLE);
  (highlighter as any).clear?.(MAPPING_EMPTY_STYLE);
}

// ----------------------
// Hydrate BIM Mapping (server -> cache)
// ----------------------

export async function hydrateBimMappingForModel(modelId: string, projectId?: string) {
  const pid = projectId ?? requireProjectId();

  const elements = getAllElements(modelId) ?? [];
  const globalIds = elements.map((e) => e.globalId).filter((x): x is string => !!x);

  if (!globalIds.length) {
    setBimMappingForModel(modelId, pid, []);
    return;
  }

  const serverModelId = getModelInfo(modelId)?.serverId;
  if (!serverModelId) {
    setBimMappingForModel(modelId, pid, []);
    return;
  }

  const [assignV2Resp, paramsResp] = await Promise.all([
    bulkGetWbsAssignmentsV2(pid, {
      modelId: serverModelId,
      guids: globalIds,
      levels: ALL_WBS_LEVEL_KEYS,
    }),
    bulkGetElementParams(pid, {
      modelId: serverModelId,
      guids: globalIds,
      keys: ["tariffaCodice", "pacchettoCodice", "codiceMateriale", "fornitoreIds"],
    }),
  ]);

  const rows: BimMappingRow[] = globalIds.map((gid) => ({
    globalId: gid,
    wbsByLevel: (assignV2Resp as any).values?.[gid] ?? undefined,
    tariffaCodice: paramsResp.values?.[gid]?.tariffaCodice ?? null,
    pacchettoCodice: paramsResp.values?.[gid]?.pacchettoCodice ?? null,
    codiceMateriale: paramsResp.values?.[gid]?.codiceMateriale ?? null,
    fornitoreIds: paramsResp.values?.[gid]?.fornitoreIds ?? null,
  }));

  setBimMappingForModel(modelId, pid, rows);
}
