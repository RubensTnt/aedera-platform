// src/core/bim/modelRegistry.ts

import * as OBC from "@thatopen/components";
import { getAllElements } from "./modelProperties";
import { getAederaViewer } from "./thatopen";

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
  /** Visibilità corrente nel viewer 3D */
  visible: boolean;
}

const registry = new Map<string, ModelInfo>();

let activeModelId: string | null = null;

/**
 * Notifica globale alla UI che è cambiato qualcosa sui modelli.
 */
function emitModelListUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aedera:modelListUpdated"));
  }
}

/**
 * Notifica globale che è cambiato il modello attivo.
 */
function emitActiveModelChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("aedera:activeModelChanged", {
        detail: { modelId: activeModelId },
      }),
    );
  }
}

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
    visible: existing?.visible ?? true,
  };

  registry.set(modelId, info);

  // se non c'è ancora un modello attivo, questo diventa l'attivo
  if (!activeModelId) {
    activeModelId = modelId;
    emitActiveModelChanged();
  }

  emitModelListUpdated();
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

/** Restituisce il modelId attivo, se presente. */
export function getActiveModelId(): string | null {
  if (activeModelId) return activeModelId;
  const first = listModels()[0];
  return first ? first.modelId : null;
}

/** Imposta il modello attivo (o null). */
export function setActiveModel(modelId: string | null): void {
  if (modelId && !registry.has(modelId)) return;
  activeModelId = modelId;
  emitActiveModelChanged();
  emitModelListUpdated();
}

/** Setta la visibilità di un modello sia nel registry che nel viewer. */
export function setModelVisibility(modelId: string, visible: boolean): void {
  const info = registry.get(modelId);
  if (!info) return;

  info.visible = visible;
  registry.set(modelId, info);

  const ctx = getAederaViewer();
  if (ctx) {
    try {
      const fragments = ctx.components.get(OBC.FragmentsManager);
      // FragmentsManager.list è una collection keyed; usiamo values()
      const list = (fragments.list as any).values
        ? (fragments.list as any).values()
        : (fragments.list as any)[Symbol.iterator]();

      for (const model of list) {
        if (!model) continue;
        if (model.modelId === modelId) {
          // toggle visibilità 3D
          model.object.visible = visible;
          fragments.core.update(true);
          break;
        }
      }
    } catch (error) {
      console.warn("[ModelRegistry] Impossibile applicare visibilità modello", {
        modelId,
        visible,
        error,
      });
    }
  }

  emitModelListUpdated();
}

/** Svuota il registry (riservato ad eventuali reset futuri). */
export function clearModelsRegistry(): void {
  registry.clear();
  activeModelId = null;
  emitModelListUpdated();
  emitActiveModelChanged();
}
