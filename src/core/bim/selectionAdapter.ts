// src/core/bim/selectionAdapter.ts

import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import type { ModelIdMap } from "@thatopen/components";
import * as THREE from "three";

import { getAederaViewer } from "./thatopen";
import { getElementRecord, getAllElements } from "./modelProperties";

import { getBimMappingRow, patchBimMappingRows, setBimMappingForModel, type BimMappingRow } from "./bimMappingStore";
import { requireProjectId, bulkSetWbsAssignments, setElementParamValue, bulkGetElementParams, bulkGetWbsAssignments } from "@core/api/aederaApi";


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
  
  const withGuid = result.filter((r) => !!r.globalId).length;
  console.log("[SEL] selected", result.length, "with globalId", withGuid, "sample", result[0]);

  return result;
}

export async function selectElementsByLocalIds(modelId: string, localIds: number[]): Promise<void> {
  const highlighter = await getHighlighterInstance();
  if (!highlighter) return;

  const selection: SelectionMap = {};
  selection[modelId] = new Set(localIds);

  await highlighter.highlightByID("select", selection as any, true, false);
}

// ----------------------
// BIM Mapping (server-based)
// ----------------------

export type SelectedElementWithBimMapping = {
  modelId: string;
  localId: number;
  globalId: string;
  wbsNodeId: string | null;
  tariffaCodice: string | null;
  pacchettoCodice: string | null;
  codiceMateriale?: string | null;
  fornitoreId?: string | null;
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
        wbsNodeId: row?.wbsNodeId ?? null,
        tariffaCodice: row?.tariffaCodice ?? null,
        pacchettoCodice: row?.pacchettoCodice ?? null,
        codiceMateriale: row?.codiceMateriale ?? null,
        fornitoreId: row?.fornitoreId ?? null,
      };
    });
}

export async function applyBimMappingToSelection(patch: {
  wbsNodeId?: string | null;
  tariffaCodice?: string | null;
  pacchettoCodice?: string | null;
  codiceMateriale?: string | null;
  fornitoreId?: string | null;
}) {
  const selected = await getSelectedElementsWithBimMapping();
  if (!selected.length) return;

  const projectId = requireProjectId();
  const modelId = selected[0].modelId;

  if ("wbsNodeId" in patch) {
    await bulkSetWbsAssignments(projectId, {
      items: selected.map((s) => ({ globalId: s.globalId, wbsNodeId: patch.wbsNodeId ?? null })),
    });
  }

  const paramPairs: Array<[keyof typeof patch, string]> = [
    ["tariffaCodice", "tariffaCodice"],
    ["pacchettoCodice", "pacchettoCodice"],
    ["codiceMateriale", "codiceMateriale"],
    ["fornitoreId", "fornitoreId"],
  ];

  for (const s of selected) {
    for (const [k, key] of paramPairs) {
      if (!(k in patch)) continue;
      await setElementParamValue(projectId, s.globalId, key, (patch as any)[k]);
    }
  }

  const updatedRows: BimMappingRow[] = selected.map((s) => ({
    globalId: s.globalId,
    wbsNodeId: "wbsNodeId" in patch ? (patch.wbsNodeId ?? null) : s.wbsNodeId,
    tariffaCodice: "tariffaCodice" in patch ? (patch.tariffaCodice ?? null) : s.tariffaCodice,
    pacchettoCodice: "pacchettoCodice" in patch ? (patch.pacchettoCodice ?? null) : s.pacchettoCodice,
    codiceMateriale: "codiceMateriale" in patch ? (patch.codiceMateriale ?? null) : s.codiceMateriale,
    fornitoreId: "fornitoreId" in patch ? (patch.fornitoreId ?? null) : s.fornitoreId,
  }));

  patchBimMappingRows(modelId, projectId, updatedRows);
}

// ----------------------
// Heatmap (mapping completeness)
// scan type contract: { elementsByStatus: { complete:number[], partial:number[], empty:number[] } }
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

  const makeMap = (ids: number[]): SelectionMap => {
    const map: SelectionMap = {};
    map[modelId] = new Set(ids);
    return map;
  };

  if (scan.elementsByStatus.complete.length > 0) {
    await highlighter.highlightByID(
      MAPPING_COMPLETE_STYLE,
      makeMap(scan.elementsByStatus.complete) as any,
      false,
      false,
    );
  }

  if (scan.elementsByStatus.partial.length > 0) {
    await highlighter.highlightByID(
      MAPPING_PARTIAL_STYLE,
      makeMap(scan.elementsByStatus.partial) as any,
      false,
      false,
    );
  }

  if (scan.elementsByStatus.empty.length > 0) {
    await highlighter.highlightByID(
      MAPPING_EMPTY_STYLE,
      makeMap(scan.elementsByStatus.empty) as any,
      false,
      false,
    );
  }
}

export async function clearBimMappingHeatmap(): Promise<void> {
  const highlighter = await getHighlighterInstance();
  if (!highlighter) return;

  (highlighter as any).clear?.(MAPPING_COMPLETE_STYLE);
  (highlighter as any).clear?.(MAPPING_PARTIAL_STYLE);
  (highlighter as any).clear?.(MAPPING_EMPTY_STYLE);
}


export async function hydrateBimMappingForModel(modelId: string, projectId?: string) {
  const pid = projectId ?? requireProjectId();

  const elements = getAllElements(modelId) ?? [];
  const globalIds = elements.map((e) => e.globalId).filter((x): x is string => !!x);

  if (!globalIds.length) {
    setBimMappingForModel(modelId, pid, []);
    return;
  }

  const [assignResp, paramsResp] = await Promise.all([
    bulkGetWbsAssignments(pid, { globalIds }),
    bulkGetElementParams(pid, {
      globalIds,
      keys: ["tariffaCodice", "pacchettoCodice", "codiceMateriale", "fornitoreId"],
    }),
  ]);

  const rows: BimMappingRow[] = globalIds.map((gid) => ({
    globalId: gid,
    wbsNodeId: assignResp.assignmentByGlobalId?.[gid] ?? null,
    tariffaCodice: paramsResp.values?.[gid]?.tariffaCodice ?? null,
    pacchettoCodice: paramsResp.values?.[gid]?.pacchettoCodice ?? null,
    codiceMateriale: paramsResp.values?.[gid]?.codiceMateriale ?? null,
    fornitoreId: paramsResp.values?.[gid]?.fornitoreId ?? null,
  }));

  setBimMappingForModel(modelId, pid, rows);
}