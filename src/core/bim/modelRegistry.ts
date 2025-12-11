// src/core/bim/modelRegistry.ts

import { getAllElements } from "./modelProperties";

export type ModelSource = "IFC";

export interface ModelInfo {
  modelId: string;
  /** Etichetta leggibile (di solito il nome file) */
  label: string;
  source: ModelSource;
  fileName?: string;
  createdAt: number;
  /** Numero di elementi indicizzati nel Property Engine */
  elementsCount?: number;
}

const registry = new Map<string, ModelInfo>();

/**
 * Registra o aggiorna le info di un modello caricato via IFC.
 * Viene chiamato dal loader IFC dopo l'estrazione delle proprietà.
 */
export function upsertIfcModel(modelId: string, fileName?: string): ModelInfo {
  const now = Date.now();
  const existing = registry.get(modelId);

  const elements = getAllElements(modelId);
  const elementsCount = elements?.length;

  const label =
    fileName?.trim() ||
    existing?.label ||
    modelId;

  const info: ModelInfo = {
    modelId,
    label,
    source: "IFC",
    fileName: fileName ?? existing?.fileName,
    createdAt: existing?.createdAt ?? now,
    elementsCount,
  };

  registry.set(modelId, info);

  // Notifica la UI che la lista modelli è cambiata
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aedera:modelListUpdated"));
  }

  return info;
}

/** Restituisce tutti i modelli registrati, ordinati per data di creazione. */
export function listModels(): ModelInfo[] {
  return [...registry.values()].sort((a, b) => a.createdAt - b.createdAt);
}

/** Restituisce le info di un singolo modello, se presenti. */
export function getModelInfo(modelId: string): ModelInfo | undefined {
  return registry.get(modelId);
}

/** Svuota il registry (riservato ad eventuali reset futuri). */
export function clearModelsRegistry(): void {
  registry.clear();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aedera:modelListUpdated"));
  }
}
