// src/core/bim/datiWbsImport.ts

import {
  getAllElements,
  getDatiWbsProps,
  setDatiWbsProps,
  type DatiWbsProps,
} from "./modelProperties";
import {
  ALL_WBS_LEVEL_KEYS,
  DEFAULT_DATI_WBS_PROFILE,
  type DatiWbsProfile,
  type WbsLevelKey,
} from "./datiWbsProfile";

/**
 * Configurazione di import:
 * per ogni livello WBS possiamo specificare il nome del parametro IFC di origine.
 *
 * Esempi:
 *  WBS0 -> "STM_WBS_00_Commessa"
 *  WBS1 -> "STM_WBS_01_Costi"
 */
export type DatiWbsImportSourceMap = Partial<Record<WbsLevelKey, string>>;

export interface DatiWbsImportConfig {
  sourceByLevel: DatiWbsImportSourceMap;
  profile?: DatiWbsProfile;
}

export interface DatiWbsImportLevelStats {
  level: WbsLevelKey;
  sourceParam?: string;
  enabledInProfile: boolean;

  /** quante volte abbiamo riempito il livello dal parametro IFC */
  filledFromIfc: number;

  /** quante volte abbiamo trovato il valore IFC ma il campo era già compilato */
  skippedAlreadyFilled: number;

  /** quante volte il parametro IFC non era presente / vuoto sull'elemento */
  notFoundInIfc: number;
}

export interface DatiWbsImportResult {
  modelId: string;
  updatedElements: number;
  levels: DatiWbsImportLevelStats[];
}

/**
 * True se nel Pset DATI_WBS il livello è già compilato (non vuoto).
 */
function isLevelFilled(
  dati: DatiWbsProps | undefined,
  level: WbsLevelKey,
): boolean {
  if (!dati) return false;
  const v = dati[level];
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Cerca un valore per il parametro IFC dato (propName) in QUALSIASI Pset
 * dell'elemento (element.psets).
 */
function getIfcParamValueFromElement(
  elementPsets: Record<string, Record<string, unknown>>,
  propName: string,
): string | undefined {
  const trimmedName = propName.trim();
  if (!trimmedName) return undefined;

  for (const pset of Object.values(elementPsets)) {
    if (!pset) continue;
    const raw = pset[trimmedName];
    if (raw == null) continue;
    const value = String(raw).trim();
    if (value) return value;
  }

  return undefined;
}

/**
 * Importa i valori WBS dai parametri IFC di origine dentro il Pset DATI_WBS.
 *
 * Regole:
 * - lavora solo sugli elementi del modelId indicato
 * - per ogni livello WBS per cui è configurato un parametro di origine:
 *   - se quel livello è disabilitato nel profilo, viene ignorato
 *   - se DATI_WBS[level] è già compilato, NON viene sovrascritto
 *   - altrimenti prova a leggere il parametro IFC dell'elemento e, se trovato,
 *     lo copia in DATI_WBS[level]
 */
export function importDatiWbsFromIfc(
  modelId: string,
  config: DatiWbsImportConfig,
): DatiWbsImportResult {
  const profile = config.profile ?? DEFAULT_DATI_WBS_PROFILE;
  const elements = getAllElements(modelId) ?? [];

  const profileLevelsMap = new Map<WbsLevelKey, { enabled: boolean }>();
  for (const lvl of profile.levels) {
    profileLevelsMap.set(lvl.key, { enabled: lvl.enabled });
  }

  const levelStatsMap = new Map<WbsLevelKey, DatiWbsImportLevelStats>();

  for (const level of ALL_WBS_LEVEL_KEYS) {
    const profileInfo = profileLevelsMap.get(level);
    const enabledInProfile = profileInfo?.enabled ?? false;
    levelStatsMap.set(level, {
      level,
      sourceParam: config.sourceByLevel[level],
      enabledInProfile,
      filledFromIfc: 0,
      skippedAlreadyFilled: 0,
      notFoundInIfc: 0,
    });
  }

  let updatedElements = 0;

  for (const element of elements) {
    const localId = element.localId;
    const current = getDatiWbsProps(modelId, localId);
    const psets = element.psets;

    const patch: Partial<DatiWbsProps> = {};
    let elementChanged = false;

    for (const level of ALL_WBS_LEVEL_KEYS) {
      const sourceParam = config.sourceByLevel[level];
      const stats = levelStatsMap.get(level);
      if (!stats) continue;

      // se non c'è un parametro di origine configurato, saltiamo
      if (!sourceParam || !sourceParam.trim()) {
        continue;
      }

      // se il livello non è abilitato dal profilo, lo ignoriamo
      if (!stats.enabledInProfile) {
        continue;
      }

      // se il livello è già compilato, non sovrascriviamo
      if (isLevelFilled(current, level)) {
        stats.skippedAlreadyFilled += 1;
        continue;
      }

      const ifcValue = getIfcParamValueFromElement(psets as any, sourceParam);

      if (!ifcValue) {
        stats.notFoundInIfc += 1;
        continue;
      }

      // ok, possiamo importare
      patch[level] = ifcValue;
      elementChanged = true;
      stats.filledFromIfc += 1;
    }

    if (elementChanged) {
      setDatiWbsProps(modelId, localId, patch);
      updatedElements += 1;
    }
  }

  return {
    modelId,
    updatedElements,
    levels: Array.from(levelStatsMap.values()),
  };
}
