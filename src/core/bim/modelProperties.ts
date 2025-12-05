// src/core/bim/modelProperties.ts

import type { FragmentsModel } from "@thatopen/fragments";

/**
 * Mappa di proprietà per un singolo PropertySet (Pset).
 * Esempio: { "WBS0": "01", "WBS1": "010", "CodiceTariffa": "123.05.A" }
 */
export interface PsetPropertiesMap {
  [propName: string]: unknown;
}

/**
 * Mappa di tutti i PropertySet di un elemento.
 * Esempio:
 * {
 *   "Pset_AED_WBS": { WBS0: "...", WBS1: "..." },
 *   "Pset_AED_Tariffa": { CodiceTariffa: "123.05.A" }
 * }
 */
export interface PsetsMap {
  [psetName: string]: PsetPropertiesMap;
}

/**
 * Record di proprietà normalizzate per un singolo elemento IFC.
 */
export interface ElementRecord {
  /** localId interno del FragmentsModel */
  localId: number;
  /** GUID IFC, se disponibile */
  globalId?: string;
  /** Tipo IFC (es. IFCWALLSTANDARDCASE) se riusciamo a leggerlo */
  ifcType?: string;
  /** Nome logico dell’elemento (Name IFC) */
  name?: string;
  /** Tutti i Pset estratti via IsDefinedBy */
  psets: PsetsMap;
  /** Raw data completo di ThatOpen, per debug / future elaborazioni */
  raw: any;
}

/**
 * Indice di tutte le proprietà per un singolo modello Fragments.
 */
interface ModelPropertiesIndex {
  modelId: string;
  elements: Map<number, ElementRecord>; // localId -> ElementRecord
}

/**
 * Registro globale: modelId -> indice delle proprietà.
 * Questo È il nostro mini "Property Engine" in memoria.
 */
const modelsIndex = new Map<string, ModelPropertiesIndex>();

/**
 * Estrae e indicizza tutte le proprietà per un dato FragmentsModel.
 * Da chiamare subito dopo il caricamento del modello IFC.
 */
export async function extractPropertiesForModel(
  model: FragmentsModel,
): Promise<void> {
  const modelId = model.modelId;

  console.time(`[PropertyEngine] extractPropertiesForModel ${modelId}`);

  // 1. Tutti i localId del modello
  const localIds = await model.getItemsIds();
  if (!localIds.length) {
    console.warn(
      "[PropertyEngine] Nessun item trovato nel modello durante l'estrazione proprietà",
      { modelId },
    );
    modelsIndex.set(modelId, {
      modelId,
      elements: new Map(),
    });
    console.timeEnd(`[PropertyEngine] extractPropertiesForModel ${modelId}`);
    return;
  }

  // 2. In parallelo:
  //    - GUID IFC
  //    - ItemData (attributes + relazioni IsDefinedBy)
  //    - RawItemData (per category / SchemaName / ecc.)
  const [guids, itemsData, rawItemsMap] = await Promise.all([
    model.getGuidsByLocalIds(localIds),
    (model as any).getItemsData(localIds, {
      attributesDefault: true,
      relations: {
        IsDefinedBy: {
          attributes: true,
          relations: true,
        },
      },
    }),
    model.getItems(localIds),
  ]);

  const elements = new Map<number, ElementRecord>();

  // Helper per leggere un attributo che può essere sia valore diretto
  // sia ItemAttribute { value, type }
  const getAttrValue = (source: any, key: string): unknown => {
    if (!source) return undefined;
    const raw = source[key];
    if (raw == null) return undefined;
    if (typeof raw === "object" && "value" in raw) {
      return (raw as any).value;
    }
    return raw;
  };

  for (let i = 0; i < localIds.length; i++) {
    const localId = localIds[i];
    const guid = guids[i] ?? undefined;
    const item: any = itemsData[i];
    const rawItem: any = (rawItemsMap as any).get(localId);

    // In alcune versioni i dati sono in item.attributes, in altre in item.data
    const attributes = item?.attributes ?? item?.data ?? {};
    const relations = item?.relations ?? {};

    // --- NAME -------------------------------------------------------
    // In questo modello gli attributi non sono in item.attributes (attrKeys: [])
    // ma in rawItem.data (ItemAttribute { value, type })
    const dataAttrs: Record<string, any> | undefined = rawItem?.data ?? item?.data;

    const name =
      // 1) Prova a leggere direttamente da item (caso tutorial ModelInformation)
      (getAttrValue(item, "Name") as string | undefined) ??
      (getAttrValue(item, "LongName") as string | undefined) ??
      // 2) Poi da attributes (se esistono in qualche modello futuro)
      (getAttrValue(attributes, "Name") as string | undefined) ??
      (getAttrValue(attributes, "LongName") as string | undefined) ??
      // 3) Infine dai dati grezzi (RawItemData.data)
      (dataAttrs
        ? ((getAttrValue(dataAttrs, "Name") ??
            getAttrValue(dataAttrs, "LongName")) as string | undefined)
        : undefined);

    // --- TIPO / CATEGORIA IFC ---------------------------------------
    // 1) SchemaName (es. IFCWALLSTANDARDCASE)
    const schemaName =
      (getAttrValue(attributes, "SchemaName") as string | undefined) ??
      (getAttrValue(rawItem?.data, "SchemaName") as string | undefined);

    // 2) Tipo esplicito (ifcType / Type)
    const explicitType =
      (getAttrValue(attributes, "ifcType") as string | undefined) ??
      (getAttrValue(attributes, "IFCType") as string | undefined) ??
      (getAttrValue(attributes, "Type") as string | undefined) ??
      (getAttrValue(rawItem?.data, "ifcType") as string | undefined) ??
      (getAttrValue(rawItem?.data, "Type") as string | undefined);

    // 3) Category
    let categoryString: string | undefined;

    // category come stringa nel RawItemData
    if (typeof rawItem?.category === "string" && rawItem.category.length) {
      categoryString = rawItem.category;
    }

    // category come numero negli Attributes (Attributes.category)
    if (!categoryString) {
      const catAttr =
        getAttrValue(attributes, "category") ??
        (rawItem?.category as number | undefined);
      if (catAttr != null) {
        categoryString = String(catAttr);
      }
    }

    // Ordine di priorità:
    //   1) tipo esplicito
    //   2) SchemaName
    //   3) category (stringa o numero)
    const ifcType =
      explicitType ??
      schemaName ??
      categoryString ??
      undefined;

    // --- PSETS via IsDefinedBy (stile tutorial ThatOpen) ------------
    const psets: PsetsMap = {};

    // 1) Path principale: item.IsDefinedBy (come in ModelInformation)
    // 2) Fallback: relations.IsDefinedBy se mai venisse usato in futuro
    const isDefinedByRaw =
      (item as any).IsDefinedBy ??
      (item as any).isDefinedBy ??
      relations.IsDefinedBy ??
      relations.isDefinedBy;

    const isDefinedByArray = Array.isArray(isDefinedByRaw)
      ? isDefinedByRaw
      : isDefinedByRaw
        ? [isDefinedByRaw]
        : [];

    for (const pset of isDefinedByArray) {
      if (!pset) continue;

      // Nome del Pset: pset.Name (ItemAttribute) o fallback
      const psetNameAttr = (pset as any).Name;
      const psetNameValue =
        psetNameAttr && typeof psetNameAttr === "object" && "value" in psetNameAttr
          ? (psetNameAttr as any).value
          : psetNameAttr;

      const psetName =
        (psetNameValue as string | undefined) ??
        (pset as any).psetName ??
        (pset as any).name ??
        undefined;

      if (!psetName) continue;

      const props: PsetPropertiesMap = {};

      // Come da tutorial: pset.HasProperties è un array di proprietà
      const hasProps = (pset as any).HasProperties as any[] | undefined;

      if (Array.isArray(hasProps)) {
        for (const prop of hasProps) {
          if (!prop) continue;

          const propNameAttr = (prop as any).Name;
          const propNameValue =
            propNameAttr &&
            typeof propNameAttr === "object" &&
            "value" in propNameAttr
              ? (propNameAttr as any).value
              : propNameAttr;

          const nominalValueAttr = (prop as any).NominalValue;
          const nominalValue =
            nominalValueAttr &&
            typeof nominalValueAttr === "object" &&
            "value" in nominalValueAttr
              ? (nominalValueAttr as any).value
              : nominalValueAttr;

          const propName = propNameValue as string | undefined;

          if (!propName || nominalValue === undefined) continue;
          props[propName] = nominalValue;
        }
      }

      // Fallback extra: se non troviamo HasProperties, proviamo eventuali
      // strutture alternative (Properties, PropertiesList, ecc.)
      if (!Object.keys(props).length) {
        const relAttrs: any = (pset as any).attributes ?? {};
        const propsContainer: any =
          (pset as any).properties ??
          relAttrs.Properties ??
          relAttrs.PropertiesList ??
          null;

        if (propsContainer && typeof propsContainer === "object") {
          for (const [propName, propValue] of Object.entries<any>(
            propsContainer,
          )) {
            const value =
              propValue &&
              typeof propValue === "object" &&
              "value" in (propValue as any)
                ? (propValue as any).value
                : propValue;
            props[propName] = value;
          }
        }
      }

      if (!Object.keys(props).length) continue;
      psets[String(psetName)] = props;
    }

    const record: ElementRecord = {
      localId,
      globalId: guid ?? undefined,
      ifcType,
      name,
      psets,
      raw: item,
    };

    elements.set(localId, record);

    // DEBUG: per i primi 3 elementi logghiamo un po' di info grezze
    if (i < 3) {
      console.log("[PropertyEngine][DEBUG] item base data", {
        modelId,
        localId,
        attrKeys: Object.keys(attributes ?? {}),
        rawCategory: rawItem?.category,
        rawDataKeys: rawItem?.data ? Object.keys(rawItem.data) : undefined,
        ifcType,
        name,
      });
    }
  }

  modelsIndex.set(modelId, { modelId, elements });

  console.timeEnd(`[PropertyEngine] extractPropertiesForModel ${modelId}`);
  console.log("[PropertyEngine] indicizzazione completata:", {
    modelId,
    itemsCount: elements.size,
  });

  // Esempio di record per debug
  const anyElement = elements.values().next().value as ElementRecord | undefined;
  if (anyElement) {
    console.log("[PropertyEngine] Esempio ElementRecord:", {
      modelId,
      localId: anyElement.localId,
      name: anyElement.name,
      ifcType: anyElement.ifcType,
      numPsets: Object.keys(anyElement.psets).length,
      psetNames: Object.keys(anyElement.psets),
    });
  }

  // Statistiche di base (come nel log che vedevi con withType)
  const allPsetNames = new Set<string>();
  let withType = 0;
  let withPsets = 0;
  for (const el of elements.values()) {
    if (el.ifcType) withType++;
    const names = Object.keys(el.psets);
    if (names.length) {
      withPsets++;
      for (const n of names) allPsetNames.add(n);
    }
  }

  console.log("[PropertyEngine] stats modello:", {
    modelId,
    itemsCount: elements.size,
    withType,
    withPsets,
    psetNamesCount: allPsetNames.size,
  });
  console.log(
    "[PropertyEngine] elenco Pset (max 50):",
    Array.from(allPsetNames).slice(0, 50),
  );
}


// ---------------------------------------------------------------------------
// Helper di interrogazione generici (categorie / Pset)
// ---------------------------------------------------------------------------

/**
 * Restituisce l'indice di proprietà per un dato modello.
 */
export function getModelPropertiesIndex(
  modelId: string,
): ModelPropertiesIndex | undefined {
  return modelsIndex.get(modelId);
}

/**
 * Restituisce tutte le ElementRecord di un modello, come array.
 */
export function getAllElements(
  modelId: string,
): ElementRecord[] | undefined {
  const index = modelsIndex.get(modelId);
  if (!index) return undefined;
  return [...index.elements.values()];
}

/**
 * Restituisce le proprietà di un singolo elemento dato modelId + localId.
 */
export function getElementRecord(
  modelId: string,
  localId: number,
): ElementRecord | undefined {
  const index = modelsIndex.get(modelId);
  if (!index) return undefined;
  return index.elements.get(localId);
}

/**
 * Elenca tutti i nomi di Pset presenti in uno specifico modello.
 */
export function listPsetNames(modelId: string): string[] {
  const index = modelsIndex.get(modelId);
  if (!index) return [];
  const names = new Set<string>();
  for (const element of index.elements.values()) {
    for (const psetName of Object.keys(element.psets)) {
      names.add(psetName);
    }
  }
  return [...names].sort();
}

/**
 * Elenca tutti i nomi di proprietà di un certo Pset (aggregati su tutti gli elementi).
 */
export function listPsetPropertyNames(
  modelId: string,
  psetName: string,
): string[] {
  const index = modelsIndex.get(modelId);
  if (!index) return [];
  const names = new Set<string>();
  for (const element of index.elements.values()) {
    const pset = element.psets[psetName];
    if (!pset) continue;
    for (const propName of Object.keys(pset)) {
      names.add(propName);
    }
  }
  return [...names].sort();
}

/**
 * Elenca tutti i valori distinti di una certa proprietà di Pset.
 * Utile per popolare dropdown (es. tutti i codici WBS1, tutte le tariffe, ecc.)
 */
export function listPsetPropertyValues(
  modelId: string,
  psetName: string,
  propName: string,
): unknown[] {
  const index = modelsIndex.get(modelId);
  if (!index) return [];
  const values = new Set<unknown>();
  for (const element of index.elements.values()) {
    const pset = element.psets[psetName];
    if (!pset) continue;
    if (!(propName in pset)) continue;
    values.add(pset[propName]);
  }
  return [...values];
}

/**
 * Ritorna tutti gli elementi che hanno una certa proprietà di Pset, opzionalmente filtrata per valore.
 */
export function findElementsByPsetProperty(
  modelId: string,
  psetName: string,
  propName: string,
  value?: unknown,
): ElementRecord[] {
  const index = modelsIndex.get(modelId);
  if (!index) return [];
  const result: ElementRecord[] = [];
  for (const element of index.elements.values()) {
    const pset = element.psets[psetName];
    if (!pset) continue;
    if (!(propName in pset)) continue;
    if (value === undefined || pset[propName] === value) {
      result.push(element);
    }
  }
  return result;
}


/**
 * Ritorna la lista di tutti i modelId indicizzati.
 */
export function getIndexedModelIds(): string[] {
  return [...modelsIndex.keys()];
}

/**
 * Elenca tutti gli ifcType distinti presenti in un modello.
 * Esempi: ["IFCBEAM", "IFCFURNISHINGELEMENT", ...]
 */
export function listIfcTypes(modelId: string): string[] {
  const index = modelsIndex.get(modelId);
  if (!index) return [];
  const types = new Set<string>();
  for (const element of index.elements.values()) {
    if (!element.ifcType) continue;
    types.add(element.ifcType);
  }
  return [...types].sort();
}

/**
 * Restituisce tutti gli elementi di un certo ifcType.
 */
export function getElementsOfIfcType(
  modelId: string,
  ifcType: string,
): ElementRecord[] {
  const index = modelsIndex.get(modelId);
  if (!index) return [];
  const result: ElementRecord[] = [];
  const typeUpper = ifcType.toUpperCase();
  for (const element of index.elements.values()) {
    if (!element.ifcType) continue;
    if (element.ifcType.toUpperCase() === typeUpper) {
      result.push(element);
    }
  }
  return result;
}

/**
 * Restituisce tutti gli elementi che appartengono a una lista di ifcType.
 */
export function getElementsOfIfcTypes(
  modelId: string,
  ifcTypes: string[],
): ElementRecord[] {
  const index = modelsIndex.get(modelId);
  if (!index) return [];
  const wanted = new Set(ifcTypes.map((t) => t.toUpperCase()));
  const result: ElementRecord[] = [];
  for (const element of index.elements.values()) {
    if (!element.ifcType) continue;
    if (wanted.has(element.ifcType.toUpperCase())) {
      result.push(element);
    }
  }
  return result;
}


// ---------------------------------------------------------------------------
// Strato "di dominio" minimale: WBS e Tariffe basate su Pset
// ---------------------------------------------------------------------------

/**
 * Config di mapping per WBS: quale Pset e quali proprietà usare.
 * Esempio atteso (da adattare ai tuoi Pset reali):
 *  psetName: "Pset_AED_WBS"
 *  levelProps: ["WBS0", "WBS1", "WBS2", "WBS3"]
 */
export interface WbsMappingConfig {
  psetName: string;
  levelProps: string[];
}

/**
 * Config di mapping per Tariffa: quale Pset e quali proprietà usare.
 * Esempio atteso:
 *  psetName: "Pset_AED_Tariffa"
 *  codeProp: "CodiceTariffa"
 *  descriptionProp: "DescrizioneTariffa"
 */
export interface TariffMappingConfig {
  psetName: string;
  codeProp: string;
  descriptionProp?: string;
}

/**
 * Path WBS di un elemento, come lista di livelli ("01", "010", "010.1", ...).
 */
export function getElementWbsPath(
  modelId: string,
  localId: number,
  config: WbsMappingConfig,
): string[] | undefined {
  const element = getElementRecord(modelId, localId);
  if (!element) return undefined;
  const pset = element.psets[config.psetName];
  if (!pset) return undefined;

  const levels: string[] = [];
  for (const propName of config.levelProps) {
    const v = pset[propName];
    if (v == null) break;
    const s = String(v).trim();
    if (!s) break;
    levels.push(s);
  }
  return levels.length ? levels : undefined;
}

/**
 * Info tariffaria minimale per un elemento.
 */
export interface TariffInfo {
  code: string;
  description?: string;
}

export function getElementTariff(
  modelId: string,
  localId: number,
  config: TariffMappingConfig,
): TariffInfo | undefined {
  const element = getElementRecord(modelId, localId);
  if (!element) return undefined;
  const pset = element.psets[config.psetName];
  if (!pset) return undefined;

  const codeRaw = pset[config.codeProp];
  if (codeRaw == null || String(codeRaw).trim() === "") return undefined;

  const code = String(codeRaw).trim();
  const description =
    config.descriptionProp && pset[config.descriptionProp] != null
      ? String(pset[config.descriptionProp]).trim()
      : undefined;

  return { code, description };
}


