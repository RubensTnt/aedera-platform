// src/core/po/poEngine.ts

import type { POItem } from "@core/domain/po";
import type { ModelIdMap } from "@thatopen/components";

import {
  type ElementRecord,
  getAllElements,
  getElementTariffCode,
  getElementWbsPath,
  type TariffMappingConfig,
  type WbsMappingConfig,
  DEFAULT_TARIFF_MAPPING,
  DEFAULT_WBS_MAPPING,
} from "@core/bim/modelProperties";

/**
 * Criteri di filtro per collegare PO <-> BIM.
 *
 * - ifcTypes: filtra per tipo IFC (es. ["IFCBEAM", "IFCWALLSTANDARDCASE"])
 * - wbsCodes: filtra per codici WBS; match se almeno un livello WBS dell’elemento
 *             è contenuto nella lista (OR).
 * - tariffCodes: filtra per codici tariffa / RCM.
 *
 * Per ora NON filtriamo ancora per storey; lo aggiungeremo quando avremo
 * lo storey nel Property Engine.
 */
export interface PoFilterCriteria {
  modelId: string;
  ifcTypes?: string[];
  wbsCodes?: string[];
  tariffCodes?: string[];
}

/**
 * Risultato del filtro con:
 * - elementi IFC coinvolti,
 * - ModelIdMap pronto per l’Highlighter,
 * - voci PO collegate (per tariffCode),
 * - totali Q1(p1) e CST(p1).
 */
export interface PoFilterResult {
  modelId: string;
  elements: ElementRecord[];
  modelIdMap: ModelIdMap;
  matchingPoItems: POItem[];
  totalBaselineQuantity: number;
  totalBaselineAmount: number;
}

/**
 * Motore centrale che collega POItems e elementi IFC
 * tramite WBS e codice tariffa.
 */
export class PoEngine {
  private _items: POItem[] = [];

  private wbsConfig: WbsMappingConfig;
  private tariffConfig: TariffMappingConfig;

  constructor(
    wbsConfig: WbsMappingConfig = DEFAULT_WBS_MAPPING,
    tariffConfig: TariffMappingConfig = DEFAULT_TARIFF_MAPPING,
  ) {
    this.wbsConfig = wbsConfig;
    this.tariffConfig = tariffConfig;
  }

  /**
   * Imposta la lista di items del PO (da backend / import Excel).
   */
  setItems(items: POItem[]): void {
    this._items = items;
  }

  get items(): POItem[] {
    return this._items;
  }

  setWbsConfig(config: WbsMappingConfig): void {
    this.wbsConfig = config;
  }

  setTariffConfig(config: TariffMappingConfig): void {
    this.tariffConfig = config;
  }

  /**
   * Applica i filtri a un modello IFC e calcola:
   * - elementi IFC coinvolti,
   * - ModelIdMap da passare al ThatOpen Highlighter,
   * - voci PO corrispondenti (per codice tariffa),
   * - totali quantità/costo di baseline (Q1(p1), CST(p1)).
   */
  filter(criteria: PoFilterCriteria): PoFilterResult {
    const { modelId } = criteria;

    const allElements = getAllElements(modelId) ?? [];
    const filteredElements: ElementRecord[] = [];

    const ifcTypeFilter =
      criteria.ifcTypes && criteria.ifcTypes.length
        ? new Set(criteria.ifcTypes.map((t) => t.toUpperCase()))
        : undefined;

    const wbsFilter =
      criteria.wbsCodes && criteria.wbsCodes.length
        ? new Set(criteria.wbsCodes.map((w) => w.toUpperCase()))
        : undefined;

    const tariffFilter =
      criteria.tariffCodes && criteria.tariffCodes.length
        ? new Set(criteria.tariffCodes.map((c) => c.toUpperCase()))
        : undefined;

    // Raccolgo anche i codici tariffa presenti negli elementi filtrati
    // per poi calcolare i totali sul PO.
    const tariffCodesInSelection = new Set<string>();

    for (const element of allElements) {
      // 1) filtro per ifcType (se richiesto)
      if (ifcTypeFilter && ifcTypeFilter.size) {
        const type = element.ifcType?.toUpperCase();
        if (!type || !ifcTypeFilter.has(type)) continue;
      }

      // 2) leggo WBS e Tariffa dall'elemento
      const wbsPath = getElementWbsPath(modelId, element.localId, this.wbsConfig);
      const tariffCode = getElementTariffCode(
        modelId,
        element.localId,
        this.tariffConfig,
      );

      // 3) filtro per WBS (se richiesto):
      //    match se almeno un livello contiene uno dei codici richiesti (substring, case-insensitive)
      if (wbsFilter && wbsFilter.size) {
        const elementWbsCodes = (wbsPath ?? []).map((v) =>
          String(v).toUpperCase(),
        );
        const filters = Array.from(wbsFilter);

        const hasWbsMatch = elementWbsCodes.some((code) =>
          filters.some((f) => code.includes(f)),
        );

        if (!hasWbsMatch) continue;
      }

      // 4) filtro per codice tariffa (se richiesto)
      if (tariffFilter && tariffFilter.size) {
        const tc = tariffCode?.toUpperCase();
        if (!tc || !tariffFilter.has(tc)) continue;
      }

      filteredElements.push(element);

      if (tariffCode) {
        tariffCodesInSelection.add(tariffCode);
      }
    }

    // 5) Calcolo dei totali sul PO, filtrando per tariffCode
    const matchingPoItems: POItem[] = [];
    let totalBaselineQuantity = 0;
    let totalBaselineAmount = 0;

    for (const item of this._items) {
      const itemTariff = item.tariffCode;
      if (!itemTariff) continue;
      if (!tariffCodesInSelection.has(itemTariff)) continue;

      matchingPoItems.push(item);

      if (typeof item.baselineQuantity === "number") {
        totalBaselineQuantity += item.baselineQuantity;
      }

      if (typeof item.baselineAmount === "number") {
        totalBaselineAmount += item.baselineAmount;
      } else if (
        typeof item.baselineQuantity === "number" &&
        typeof item.unitPrice === "number"
      ) {
        totalBaselineAmount += item.baselineQuantity * item.unitPrice;
      }
    }

    // 6) ModelIdMap da passare all'Highlighter di ThatOpen
    const modelIdMap: ModelIdMap = {};
    modelIdMap[modelId] = new Set(filteredElements.map((el) => el.localId));

    return {
      modelId,
      elements: filteredElements,
      modelIdMap,
      matchingPoItems,
      totalBaselineQuantity,
      totalBaselineAmount,
    };
  }
}

/**
 * Istanza singleton del motore PO, da riusare in tutta l'app.
 */
export const poEngine = new PoEngine();
