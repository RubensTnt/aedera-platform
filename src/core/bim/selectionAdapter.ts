// src/core/bim/selectionAdapter.ts

import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import type { ModelIdMap } from "@thatopen/components";
import * as THREE from "three";
import { getAederaViewer } from "./thatopen";
import {
  type DatiWbsProps,
  getDatiWbsProps,
  getElementRecord,
} from "./modelProperties";
import type { DatiWbsScanResult } from "./datiWbsScanner";
import { writeDatiWbs } from "./propertyIO";

// Nomi degli stili di highlighter per la heatmap DATI_WBS
const WBS_COMPLETE_STYLE = "wbs-complete";
const WBS_PARTIAL_STYLE = "wbs-partial";
const WBS_EMPTY_STYLE = "wbs-empty";

function ensureDatiWbsStyles(highlighter: OBF.Highlighter) {
  // La API espone una Map<string, HighlighterStyle>, ma per semplicità
  // usiamo "any" per non litigare con i tipi interni della libreria.
  const styles = highlighter.styles as Map<string, any>;

  if (!styles.has(WBS_COMPLETE_STYLE)) {
    styles.set(WBS_COMPLETE_STYLE, {
      color: new THREE.Color("#16a34a"), // verde (completi)
      opacity: 0.5,
      transparent: true,
      renderedFaces: 2,
    });
  }

  if (!styles.has(WBS_PARTIAL_STYLE)) {
    styles.set(WBS_PARTIAL_STYLE, {
      color: new THREE.Color("#fbbf24"), // giallo/ambra (parziali)
      opacity: 0.5,
      transparent: true,
      renderedFaces: 2,
    });
  }

  if (!styles.has(WBS_EMPTY_STYLE)) {
    styles.set(WBS_EMPTY_STYLE, {
      color: new THREE.Color("#ef4444"), // rosso (non mappati)
      opacity: 0.5,
      transparent: true,
      renderedFaces: 2,
    });
  }
}

/**
 * Alias leggibile per la mappa di selezione:
 * modelId -> insieme di localId selezionati.
 */
export type SelectionMap = ModelIdMap;

/**
 * Struttura comoda per la UI: ogni elemento selezionato,
 * con modelId + localId + DATI_WBS correnti.
 */
export interface SelectedElementWithDatiWbs {
  modelId: string;
  localId: number;
  ifcGlobalId?: string;
  datiWbs?: DatiWbsProps;
}

/**
 * Restituisce l'istanza del ThatOpen Highlighter, se disponibile.
 */
async function getHighlighterInstance() {
  const viewer = getAederaViewer();
  if (!viewer) return null;

  const { components, world } = viewer;
  const highlighter = components.get(OBF.Highlighter);

  // Evitiamo di richiamare setup più volte inutilmente
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

  // Qui ci assicuriamo che esistano anche gli stili per la heatmap DATI_WBS
  ensureDatiWbsStyles(highlighter);

  return highlighter;
}

/**
 * Ritorna la selezione corrente del viewer come ModelIdMap.
 * Se non c'è selezione, ritorna null.
 */
export async function getCurrentSelection(): Promise<SelectionMap | null> {
  const highlighter = await getHighlighterInstance();
  if (!highlighter) return null;

  // In alcuni momenti del ciclo di vita (subito dopo il load, o prima
  // che il viewer sia stato usato) selection o selection.select
  // possono essere undefined: in quel caso consideriamo la selezione vuota.
  const selectionRaw = highlighter.selection?.select;

  if (!selectionRaw) {
    return null;
  }

  const selection = selectionRaw as SelectionMap;

  try {
    if (OBC.ModelIdMapUtils.isEmpty(selection)) {
      return null;
    }
  } catch (error) {
    console.warn(
      "[SelectionAdapter] ModelIdMapUtils.isEmpty ha ricevuto una selezione non valida",
      { selection, error },
    );
    return null;
  }

  return selection;
}

/**
 * Ritorna la selezione corrente come lista "flattened"
 * con anche i DATI_WBS correnti di ogni elemento.
 */
export async function getSelectedElementsWithDatiWbs(): Promise<
  SelectedElementWithDatiWbs[]
> {
  const selection = await getCurrentSelection();
  if (!selection) return [];

  const result: SelectedElementWithDatiWbs[] = [];

  for (const [modelId, localIds] of Object.entries(selection)) {
    const ids = Array.from(localIds as Set<number>);
    for (const localId of ids) {
    const datiWbs = getDatiWbsProps(modelId, localId);
    const rec = getElementRecord(modelId, localId);
    result.push({ modelId, localId, ifcGlobalId: rec?.globalId, datiWbs });
    }
  }

  return result;
}

/**
 * Imposta la selezione corrente del viewer a partire da un modelId
 * e da una lista di localId.
 */
export async function selectElementsByLocalIds(
  modelId: string,
  localIds: number[],
): Promise<void> {
  const highlighter = await getHighlighterInstance();
  if (!highlighter) return;

  const selection: SelectionMap = {};
  selection[modelId] = new Set(localIds);

  // Usiamo l'API ufficiale del Highlighter per impostare
  // la selezione "select" e colorare gli elementi.
  await highlighter.highlightByID(
    "select",
    selection as any,
    true,   // removePrevious
    false,  // zoomToSelection
  );
}

/**
 * Applica un patch DATI_WBS a TUTTI gli elementi attualmente selezionati.
 *
 * Ritorna la lista aggiornata (modelId, localId, datiWbs finali)
 * così la UI può aggiornarsi senza dover rieffettuare query.
 */
export async function applyDatiWbsToSelection(
  patch: Partial<DatiWbsProps>,
): Promise<SelectedElementWithDatiWbs[]> {
  const selection = await getCurrentSelection();
  if (!selection) return [];

  const updated: SelectedElementWithDatiWbs[] = [];

  for (const [modelId, localIds] of Object.entries(selection)) {
    const ids = Array.from(localIds as Set<number>);
    for (const localId of ids) {
      const finalProps = writeDatiWbs(modelId, localId, patch);
      updated.push({
        modelId,
        localId,
        datiWbs: finalProps,
      });
    }
  }

  // Notifica globale: i DATI_WBS sono cambiati.
  // Questo permette a WbsTariffaView (o altri moduli) di aggiornare
  // scan + heatmap senza accoppiarsi direttamente al pannellino.
  if (typeof window !== "undefined" && updated.length > 0) {
    const modelIds = Array.from(
      new Set(updated.map((u) => u.modelId)),
    );

    window.dispatchEvent(
      new CustomEvent("aedera:datiWbsUpdated", {
        detail: { modelIds },
      }),
    );
  }

  return updated;
}


/**
 * Applica la "heatmap" DATI_WBS:
 * - verde = elementi completi
 * - giallo = elementi parziali
 * - rosso  = elementi non mappati
 *
 * Usa i risultati di scanModelDatiWbs.
 */
export async function applyDatiWbsHeatmap(
  modelId: string,
  scan: DatiWbsScanResult,
): Promise<void> {
  const highlighter = await getHighlighterInstance();
  if (!highlighter) return;

  // Puliamo eventuali applicazioni precedenti della heatmap
  (highlighter as any).clear?.(WBS_COMPLETE_STYLE);
  (highlighter as any).clear?.(WBS_PARTIAL_STYLE);
  (highlighter as any).clear?.(WBS_EMPTY_STYLE);

  // Helper per costruire una ModelIdMap a partire da una lista di localId
  const makeMap = (ids: number[]): SelectionMap => {
    const map: SelectionMap = {};
    map[modelId] = new Set(ids);
    return map;
  };

  // Completi -> verde
  if (scan.elementsByStatus.complete.length > 0) {
    await highlighter.highlightByID(
      WBS_COMPLETE_STYLE,
      makeMap(scan.elementsByStatus.complete) as any,
      false, // non rimuovere gli altri stili
      false, // niente zoom
    );
  }

  // Parziali -> giallo
  if (scan.elementsByStatus.partial.length > 0) {
    await highlighter.highlightByID(
      WBS_PARTIAL_STYLE,
      makeMap(scan.elementsByStatus.partial) as any,
      false,
      false,
    );
  }

  // Non mappati -> rosso
  if (scan.elementsByStatus.empty.length > 0) {
    await highlighter.highlightByID(
      WBS_EMPTY_STYLE,
      makeMap(scan.elementsByStatus.empty) as any,
      false,
      false,
    );
  }
}

/**
 * Rimuove solo la heatmap DATI_WBS (mantiene selezione/hover).
 */
export async function clearDatiWbsHeatmap(): Promise<void> {
  const highlighter = await getHighlighterInstance();
  if (!highlighter) return;

  (highlighter as any).clear?.(WBS_COMPLETE_STYLE);
  (highlighter as any).clear?.(WBS_PARTIAL_STYLE);
  (highlighter as any).clear?.(WBS_EMPTY_STYLE);
}

