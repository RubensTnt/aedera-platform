// src/core/bim/datiWbsScanner.ts

import type { DatiWbsProps, ElementRecord } from "./modelProperties";
import { getAllElements, getDatiWbsProps } from "./modelProperties";
import {
  type DatiWbsProfile,
  type DatiWbsValidationResult,
  type WbsLevelKey,
  validateDatiWbsForProfile,
  getWbsPathArray,
} from "./datiWbsProfile";

/**
 * Stato sintetico di completamento DATI_WBS per un elemento.
 *
 * - "empty"   => nessun livello WBS valorizzato
 * - "partial" => almeno un livello valorizzato, ma non tutti i vincoli del profilo sono soddisfatti
 * - "complete"=> tutti i vincoli del profilo soddisfatti (isValid === true)
 */
export type DatiWbsElementStatus = "empty" | "partial" | "complete";

/**
 * Statistiche per un singolo livello WBS rispetto al profilo.
 */
export interface DatiWbsLevelStats {
  key: WbsLevelKey;
  enabled: boolean;
  required: boolean;

  /** Quanti elementi hanno questo livello valorizzato */
  filledCount: number;

  /** Quanti elementi consideriamo per questo livello (enabled nel profilo) */
  totalEnabledElements: number;
}

/**
 * Risultato della scansione per UN elemento.
 * Utile se vogliamo, in futuro, mostrare dettagli/tooltip su singolo elemento.
 */
export interface DatiWbsElementScan {
  modelId: string;
  localId: number;

  /** Pset DATI_WBS letto dal Property Engine */
  dati: DatiWbsProps | undefined;

  /** Risultato di validateDatiWbsForProfile */
  validation: DatiWbsValidationResult;

  /** Stato sintetico empty/partial/complete */
  status: DatiWbsElementStatus;

  /** Percorso WBS compatto (solo livelli valorizzati) */
  wbsPath: string[];
}

/**
 * Risultato aggregato della scansione su tutto il modello.
 * Questo è ciò che useremo per:
 * - pannello di riepilogo sinistro,
 * - heatmap (liste di localId per colore),
 * - grafici di completamento.
 */
export interface DatiWbsScanResult {
  modelId: string;
  profileId: string;

  totalElements: number;

  emptyCount: number;
  partialCount: number;
  completeCount: number;

  /** Media dei completionRatio sugli elementi (0..1) */
  completionRatioAvg: number;

  /**
   * Liste di localId per stato, pronte da usare come ModelIdMap
   * per la heatmap (ci basterà associare il modelId).
   */
  elementsByStatus: {
    empty: number[];
    partial: number[];
    complete: number[];
  };

  /**
   * Statistiche per singolo livello WBS (WBS0..WBS10).
   * Utile per capire quali livelli sono più “indietro”.
   */
  perLevel: Record<WbsLevelKey, DatiWbsLevelStats>;

  /**
   * Dettaglio opzionale per ogni elemento.
   * Per la UI potremo anche non usarlo sempre (o limitarlo con lazy-loading),
   * ma è comodo per debug e per future funzioni avanzate.
   */
  elements: DatiWbsElementScan[];
}

/**
 * Classifica un elemento in empty / partial / complete
 * partendo dal risultato di validateDatiWbsForProfile.
 */
export function classifyElementStatus(
  validation: DatiWbsValidationResult,
  dati: DatiWbsProps | undefined,
  profile: DatiWbsProfile,
): DatiWbsElementStatus {
  const hasAnyEnabledWbsValue =
    profile.levels
      .filter((lvl) => lvl.enabled)
      .some((lvl) => {
        const v = dati?.[lvl.key];
        return typeof v === "string" && v.trim().length > 0;
      }) || false;

  const hasAnyIdentifier =
    hasAnyEnabledWbsValue ||
    validation.hasTariffaCodice ||
    validation.hasPacchettoCodice;

  if (!hasAnyIdentifier) {
    return "empty";
  }

  if (validation.isValid) {
    return "complete";
  }

  return "partial";
}

/**
 * Scansiona l’intero modello per il Pset DATI_WBS
 * rispetto a un profilo dato (di default il profilo base Aedera).
 */
export function scanModelDatiWbs(
  modelId: string,
  profile: DatiWbsProfile,
): DatiWbsScanResult {
  const elements: ElementRecord[] = getAllElements(modelId) ?? [];

  const scanned: DatiWbsElementScan[] = [];

  let emptyCount = 0;
  let partialCount = 0;
  let completeCount = 0;
  let completionRatioSum = 0;

  const emptyIds: number[] = [];
  const partialIds: number[] = [];
  const completeIds: number[] = [];

  // inizializzo le statistiche per livello
  const perLevel: Record<WbsLevelKey, DatiWbsLevelStats> = {} as any;

  for (const cfg of profile.levels) {
    perLevel[cfg.key] = {
      key: cfg.key,
      enabled: cfg.enabled,
      required: cfg.required,
      filledCount: 0,
      totalEnabledElements: 0,
    };
  }

  for (const element of elements) {
    const { localId } = element;

    const dati = getDatiWbsProps(modelId, localId);
    const validation = validateDatiWbsForProfile(dati, profile);
    const status = classifyElementStatus(validation, dati, profile);
    const wbsPath = getWbsPathArray(dati);

    // aggiorno contatori globali
    switch (status) {
      case "empty":
        emptyCount += 1;
        emptyIds.push(localId);
        break;
      case "partial":
        partialCount += 1;
        partialIds.push(localId);
        break;
      case "complete":
        completeCount += 1;
        completeIds.push(localId);
        break;
    }

    completionRatioSum += validation.completionRatio;

    // aggiorno statistiche per livello
    for (const levelCfg of profile.levels) {
      const lvlStats = perLevel[levelCfg.key];

      if (levelCfg.enabled) {
        lvlStats.totalEnabledElements += 1;

        const raw = dati?.[levelCfg.key];
        const filled =
          typeof raw === "string" && raw.trim().length > 0;

        if (filled) {
          lvlStats.filledCount += 1;
        }
      }
    }

    scanned.push({
      modelId,
      localId,
      dati,
      validation,
      status,
      wbsPath,
    });
  }

  const totalElements = elements.length;
  const completionRatioAvg =
    totalElements > 0 ? completionRatioSum / totalElements : 0;

  const result: DatiWbsScanResult = {
    modelId,
    profileId: profile.id,
    totalElements,
    emptyCount,
    partialCount,
    completeCount,
    completionRatioAvg,
    elementsByStatus: {
      empty: emptyIds,
      partial: partialIds,
      complete: completeIds,
    },
    perLevel,
    elements: scanned,
  };

  // comodo per debug da console: AED.wbs.scan(modelId)
  if (typeof window !== "undefined") {
    (window as any).AED = (window as any).AED ?? {};
    (window as any).AED.wbs = {
      ...(window as any).AED.wbs,
      lastScan: result,
    };
  }

  return result;
}
