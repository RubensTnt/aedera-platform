// src/core/bim/modelProperties.ts

import type { FragmentsModel } from "@thatopen/fragments";

/**
 * Mappa minimal per testare la lettura dati.
 * In un secondo step la estenderemo con WBS, codice tariffa, ecc.
 */
export interface ElementProps {
  name?: string;
  globalId?: string;
  rawAttributes?: any;
}

export interface ModelPropsMap {
  [localId: number]: ElementProps;
}

// archivio di tutti i modelli caricati (key = modelId)
const modelsProps: Map<string, ModelPropsMap> = new Map();

/**
 * Estrattore iniziale di informazioni dal FragmentsModel.
 * Pattern ispirato al tutorial "ModelInformation" ufficiale.
 *
 * Per ora:
 *  - logga le categorie presenti
 *  - prende una categoria a caso
 *  - legge Name e GlobalId degli elementi di quella categoria
 *  - salva i dati in una mappa locale (localId -> info)
 */
export async function extractPropertiesForModel(model: FragmentsModel): Promise<void> {
  const modelId = model.modelId;
  const propsMap: ModelPropsMap = {};

  // 1) Liste categorie presenti nel modello
  const categories = await model.getCategories();
  console.log("[ModelProps] ModelInformation — modelId:", modelId);
  console.log("[ModelProps] Categorie presenti nel modello:", categories);

  if (!categories || categories.length === 0) {
    modelsProps.set(modelId, propsMap);
    return;
  }

  // 2) Prendiamo una categoria qualsiasi (per ora la prima, solo per test)
  const sampleCategory = categories[0];

  // 3) Otteniamo tutti i localId di quella categoria
  const categoryIds = await model.getItemsOfCategories([
    new RegExp(`^${sampleCategory}$`),
  ]);
  const localIds = categoryIds[sampleCategory] ?? [];

  console.log(
    `[ModelProps] Categoria campione "${sampleCategory}" — elementi:`,
    localIds.length,
  );

  if (!localIds.length) {
    modelsProps.set(modelId, propsMap);
    return;
  }

  // 4) Recuperiamo Name e GlobalId di quegli elementi (pattern dal tutorial ModelInformation)
  const data = await model.getItemsData(localIds, {
    attributesDefault: false,
    attributes: ["Name", "GlobalId"],
  });

  data.forEach((itemData, index) => {
    const localId = localIds[index];

    const nameAttr = (itemData as any).Name;
    const globalIdAttr = (itemData as any).GlobalId;

    const name =
      nameAttr && !Array.isArray(nameAttr) && "value" in nameAttr
        ? (nameAttr.value as string)
        : undefined;

    const globalId =
      globalIdAttr && !Array.isArray(globalIdAttr) && "value" in globalIdAttr
        ? (globalIdAttr.value as string)
        : undefined;

    propsMap[localId] = {
      name,
      globalId,
      rawAttributes: itemData,
    };
  });

  modelsProps.set(modelId, propsMap);

  console.log("[ModelProps] Esempio di dati estratti:", {
    modelId,
    sampleCategory,
    sampleCount: localIds.length,
    firstItem: propsMap[localIds[0]],
  });
}

/**
 * Ottieni la mappa delle proprietà per un dato modello (modelId)
 */
export function getModelProps(modelId: string): ModelPropsMap | undefined {
  return modelsProps.get(modelId);
}
