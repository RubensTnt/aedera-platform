// src/core/bim/selectionAdapter.ts

import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import type { ModelIdMap } from "@thatopen/components";
import * as THREE from "three";
import { getAederaViewer } from "./thatopen";
import {
  type DatiWbsProps,
  getDatiWbsProps,
  setDatiWbsProps,
} from "./modelProperties";

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
      result.push({ modelId, localId, datiWbs });
    }
  }

  return result;
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
      const finalProps = setDatiWbsProps(modelId, localId, patch);
      updated.push({
        modelId,
        localId,
        datiWbs: finalProps,
      });
    }
  }

  return updated;
}
