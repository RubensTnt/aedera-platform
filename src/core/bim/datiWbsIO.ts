// src/core/bim/datiWbsIO.ts

import type { DatiWbsProps } from "@core/bim/modelProperties";
import type { WbsLevelKey } from "./datiWbsProfile";
import { ALL_WBS_LEVEL_KEYS } from "./datiWbsProfile";

import {
  getDatiWbsProps,
  setDatiWbsProps,
} from "./modelProperties";

/**
 * Nome del Pset ufficiale usato da Aedera per i parametri WBS e Codice Tariffa.
 */
export const DATI_WBS_PSET = "DATI_WBS";

/**
 * Legge il Pset DATI_WBS da un elemento del modello.
 * Se il Pset non esiste, restituisce un oggetto DATI_WBS vuoto.
 */
export function readDatiWbs(
  modelId: string,
  elementId: number,
): DatiWbsProps {
  const pset = getDatiWbsProps(modelId, elementId) ?? {};
  if (!pset) return {};

  const out: DatiWbsProps = {};

  for (const key of ALL_WBS_LEVEL_KEYS) {
    const raw = pset[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      out[key] = raw.trim();
    }
  }

  // TariffaCodice
  const t = pset["TariffaCodice"];
  if (typeof t === "string" && t.trim().length > 0) {
    out.TariffaCodice = t.trim();
  }

  return out;
}

/**
 * Scrive o aggiorna il Pset DATI_WBS di un elemento.
 * Non elimina i campi mancanti: se un campo è undefined, NON viene rimosso dal modello.
 * (Saranno le funzioni di mapping/validazione a gestire eventuali pulizie.)
 */
export function writeDatiWbs(
  modelId: string,
  elementId: number,
  patch: Partial<DatiWbsProps>,
): void {
  const pset = getDatiWbsProps(modelId, elementId) ?? {};

  for (const key of ALL_WBS_LEVEL_KEYS) {
    if (patch[key] !== undefined) {
      const v = patch[key];
      if (typeof v === "string") {
        pset[key] = v;
      }
    }
  }

  if (patch.TariffaCodice !== undefined) {
    const t = patch.TariffaCodice;
    if (typeof t === "string") {
      pset.TariffaCodice = t;
    }
  }

  setDatiWbsProps(modelId, elementId, patch);
}

/**
 * True se TUTTE le WBS e TariffaCodice sono completamente vuote.
 */
export function isDatiWbsEmpty(d: DatiWbsProps | undefined): boolean {
  if (!d) return true;

  for (const key of ALL_WBS_LEVEL_KEYS) {
    if (typeof d[key] === "string" && d[key]?.trim().length) return false;
  }

  const t = d.TariffaCodice;
  if (typeof t === "string" && t.trim().length > 0) return false;

  return true;
}

/**
 * Ritorna una mappa:
 * {
 *   [elementId]: DatiWbsProps
 * }
 * per l'intero modello.
 *
 * Questa funzione serve a:
 * - calcolare la heatmap,
 * - eseguire validazione in batch,
 * - fornire statistiche al pannello sinistro.
 */
export function readAllDatiWbsForModel(
  modelId: string,
  allElementIds: number[],
): Record<number, DatiWbsProps> {
  const out: Record<number, DatiWbsProps> = {};
  for (const id of allElementIds) {
    out[id] = readDatiWbs(modelId, id);
  }
  return out;
}
