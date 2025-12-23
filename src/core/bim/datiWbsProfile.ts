// src/core/bim/datiWbsProfile.ts

import type { DatiWbsProps } from "@core/bim/modelProperties";

/**
 * Chiavi valide per i livelli WBS nel Pset DATI_WBS.
 */
export type WbsLevelKey =
  | "WBS0"
  | "WBS1"
  | "WBS2"
  | "WBS3"
  | "WBS4"
  | "WBS5"
  | "WBS6"
  | "WBS7"
  | "WBS8"
  | "WBS9"
  | "WBS10";

/**
 * Tutte le chiavi WBS in ordine.
 */
export const ALL_WBS_LEVEL_KEYS: WbsLevelKey[] = [
  "WBS0",
  "WBS1",
  "WBS2",
  "WBS3",
  "WBS4",
  "WBS5",
  "WBS6",
  "WBS7",
  "WBS8",
  "WBS9",
  "WBS10",
];

/**
 * Configurazione di un singolo livello WBS all'interno di un profilo.
 *
 * - enabled: se il livello è disponibile per il progetto
 * - required: se il livello è obbligatorio (se enabled = false, required deve essere false)
 * - label / description: puro metadata UI (non influisce sulla logica)
 */
export interface WbsLevelConfig {
  key: WbsLevelKey;
  enabled: boolean;
  required: boolean;
  label?: string;
  description?: string;
}

/**
 * Profilo WBS per un progetto.
 *
 * L’idea è che ogni progetto (o commessa) possa avere il proprio profilo:
 * - quali livelli sono usati (enabled)
 * - quali livelli sono obbligatori (required)
 * - se TariffaCodice è obbligatoria
 */
export interface DatiWbsProfile {
  id: string;
  name: string;
  levels: WbsLevelConfig[];

  /** Se true, TariffaCodice è obbligatoria per considerare l'elemento "valido" */
  requireTariffaCodice: boolean;

  /** Se true, PacchettoCodice è obbligatorio (per ora lo terremo false nel profilo default) */
  requirePacchettoCodice?: boolean;
}

/**
 * Default aziendale: WBS0–WBS3 attivi e obbligatori,
 * WBS4–WBS10 disabilitati (per ora).
 *
 * TariffaCodice NON obbligatoria a livello di “Parametri BIM”,
 * così possiamo usarla liberamente in Contabilità senza vincolare la mappatura WBS.
 */
export const DEFAULT_DATI_WBS_PROFILE: DatiWbsProfile = {
  id: "default",
  name: "Profilo base Aedera (tutti i livelli attivi; obbligatori: WBS0,1,4,6,7,8,9)",
  requireTariffaCodice: true,
  requirePacchettoCodice: true,
  levels: ALL_WBS_LEVEL_KEYS.map((key) => {
    const enabled = true;

    const requiredKeys = new Set<WbsLevelKey>([
      "WBS0",
      "WBS1",
      "WBS4",
      "WBS6",
      "WBS7",
      "WBS8",
      "WBS9",
    ]);

    const required = requiredKeys.has(key);

    return {
      key,
      enabled,
      required,
      label: key,
      description: required
        ? `${key} (obbligatorio nel profilo base)`
        : `${key} (facoltativo nel profilo base)`,
    };
  }),
};

/**
 * Stato di validazione per un singolo elemento rispetto a un profilo.
 */
export interface DatiWbsValidationResult {
  /** true se tutti i vincoli del profilo sono soddisfatti */
  isValid: boolean;

  /** livelli richiesti ma vuoti o solo whitespace */
  missingRequiredLevels: WbsLevelKey[];

  /** livelli compilati ma disabilitati nel profilo (di solito segnala incoerenza) */
  filledButDisabledLevels: WbsLevelKey[];

  /** true se TariffaCodice è valorizzata (non solo whitespace) */
  hasTariffaCodice: boolean;

  /** true se il profilo richiede TariffaCodice ma il campo è vuoto */
  tariffaCodiceMissingButRequired: boolean;

  /** true se PacchettoCodice è valorizzata (non solo whitespace) */
  hasPacchettoCodice: boolean;

  /** true se il profilo richiede PacchettoCodice ma il campo è vuoto */
  pacchettoCodiceMissingButRequired: boolean;

  /**
   * Percentuale di completamento sui livelli WBS “enabled”.
   * (quanti livelli enabled hanno un valore non vuoto).
   * Range 0..1
   */
  completionRatio: number;
}

/**
 * Helper: restituisce true se una stringa è valorizzata (non null/undefined e non solo whitespace).
 */
function isNonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Valida un set di DATI_WBS rispetto a un profilo.
 *
 * ATTENZIONE: questa funzione guarda SOLO il Pset DATI_WBS.
 * Non tiene conto di eventuali parametri originali IFC o di override manuali.
 */
export function validateDatiWbsForProfile(
  dati: DatiWbsProps | undefined,
  profile: DatiWbsProfile = DEFAULT_DATI_WBS_PROFILE,
): DatiWbsValidationResult {
  const missingRequiredLevels: WbsLevelKey[] = [];
  const filledButDisabledLevels: WbsLevelKey[] = [];

  let enabledCount = 0;
  let filledEnabledCount = 0;

  for (const levelConfig of profile.levels) {
    const key = levelConfig.key;
    const rawValue = dati?.[key] ?? null;
    const filled = isNonEmpty(rawValue);

    if (levelConfig.enabled) {
      enabledCount += 1;
      if (filled) filledEnabledCount += 1;

      if (levelConfig.required && !filled) {
        missingRequiredLevels.push(key);
      }
    } else {
      // livello non abilitato nel profilo, ma valorizzato nel Pset
      if (filled) {
        filledButDisabledLevels.push(key);
      }
    }
  }

  const hasTariffaCodice = isNonEmpty(dati?.TariffaCodice ?? null);
  const tariffaCodiceMissingButRequired =
    profile.requireTariffaCodice && !hasTariffaCodice;

  const hasPacchettoCodice = isNonEmpty(dati?.PacchettoCodice ?? null);
  const pacchettoCodiceMissingButRequired =
    !!profile.requirePacchettoCodice && !hasPacchettoCodice;

  const completionRatio =
    enabledCount > 0 ? filledEnabledCount / enabledCount : 1;

  const isValid =
    missingRequiredLevels.length === 0 &&
    !tariffaCodiceMissingButRequired &&
    !pacchettoCodiceMissingButRequired;

  return {
    isValid,
    missingRequiredLevels,
    filledButDisabledLevels,
    hasTariffaCodice,
    tariffaCodiceMissingButRequired,
    hasPacchettoCodice,
    pacchettoCodiceMissingButRequired,
    completionRatio,
  };
}

/**
 * Estrae il "percorso" WBS come array di stringhe, in ordine WBS0..WBS10,
 * filtrando i livelli vuoti.
 *
 * Utile, ad esempio, per:
 * - mostrare la WBS in forma compatta nell’UI
 * - fare filtri di ricerca
 * - costruire il path per l’heatmap
 */
export function getWbsPathArray(dati: DatiWbsProps | undefined): string[] {
  if (!dati) return [];
  const out: string[] = [];
  for (const key of ALL_WBS_LEVEL_KEYS) {
    const value = dati[key];
    if (!isNonEmpty(value ?? null)) continue;
    out.push((value as string).trim());
  }
  return out;
}

/**
 * Comodo helper per verificare se un singolo livello è compilato.
 */
export function isWbsLevelFilled(
  dati: DatiWbsProps | undefined,
  key: WbsLevelKey,
): boolean {
  return isNonEmpty(dati?.[key] ?? null);
}
