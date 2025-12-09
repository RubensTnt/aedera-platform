// src/ui/po/PoFilterPanel.tsx

import React, { useEffect, useState } from "react";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

import { getAederaViewer } from "@core/bim/thatopen";
import { poEngine } from "@core/po/poEngine";
import type { PoFilterResult } from "@core/po/poEngine";
import {
  getIndexedModelIds,
  listIfcTypes,
  listAllWbsValues,
  DATI_WBS_MAPPING,
  DATI_WBS_TARIFF_MAPPING,
  DEFAULT_WBS_MAPPING,
  DEFAULT_TARIFF_MAPPING,
  getAllElements,
  getDatiWbsProps,
} from "@core/bim/modelProperties";


let highlighterReady = false;

async function ensureHighlighter() {
  const viewer = getAederaViewer();
  if (!viewer) return null;

  const { components, world } = viewer;

  const highlighter = components.get(OBF.Highlighter);

  if (!highlighterReady) {
    await highlighter.setup({
      world: world as any,
      selectMaterialDefinition: {
        color: new THREE.Color("#bcf124"),
        opacity: 1,
        transparent: false,
        renderedFaces: 0,
      },
    });
    highlighterReady = true;
  }

  return { highlighter, components, world };
}

export const PoFilterPanel: React.FC = () => {
  const [modelId, setModelId] = useState<string | null>(null);
  const [ifcTypes, setIfcTypes] = useState<string[]>([]);
  const [selectedIfcType, setSelectedIfcType] = useState<string>("");

  const [wbsCode, setWbsCode] = useState<string>("");
  const [wbsOptions, setWbsOptions] = useState<string[]>([]);

  const [tariffCode, setTariffCode] = useState<string>("");
  const [tariffOptions, setTariffOptions] = useState<string[]>([]);

  const [result, setResult] = useState<PoFilterResult | null>(null);
  const [status, setStatus] = useState<string>("Nessun filtro applicato");

  interface CoverageSummary {
    totalElements: number;
    elementsWithDatiWbs: number;
    elementsWithTariffFromDatiWbs: number;
    distinctTariffsInDatiWbs: number;
    poItemsWithTariff: number;
    distinctTariffsInPo: number;
    tariffCodesInDatiWbsNotInPo: string[];
    tariffCodesInPoNotInDatiWbs: string[];
  }

  const [coverage, setCoverage] = useState<CoverageSummary | null>(null);

  // se true, i filtri usano DATI_WBS_PSET_NAME (DATI_WBS)
  // altrimenti usano i parametri IFC storici (STM_*)
  const [useDatiWbs, setUseDatiWbs] = useState<boolean>(false);

  // contatore per rileggere le opzioni PO quando viene caricato un Excel
  const [poItemsCount, setPoItemsCount] = useState<number>(0);
  const [modelInitialized, setModelInitialized] = useState<boolean>(false);

  
  // Poll leggero: aggiorna il conteggio voci PO ogni 2s,
  // così quando carichi un nuovo Excel il pannello "vede" il cambiamento.
  useEffect(() => {
    const interval = setInterval(() => {
      const count = poEngine.items.length;
      setPoItemsCount((prev) => (prev === count ? prev : count));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Cambia la sorgente WBS/Tariffa usata dal PoEngine:
  // - IFC originale (DEFAULT_*)
  // - oppure Pset custom DATI_WBS (DATI_WBS_*)
  useEffect(() => {
    if (useDatiWbs) {
      poEngine.setWbsConfig(DATI_WBS_MAPPING);
      poEngine.setTariffConfig(DATI_WBS_TARIFF_MAPPING);
    } else {
      poEngine.setWbsConfig(DEFAULT_WBS_MAPPING);
      poEngine.setTariffConfig(DEFAULT_TARIFF_MAPPING);
    }
  }, [useDatiWbs]);

  // Poll leggero per inizializzare modelId, ifcTypes e WBS options
  useEffect(() => {
    if (modelInitialized) return;

    const interval = setInterval(() => {
      const ids = getIndexedModelIds();
      if (!ids.length) {
        // nessun modello ancora indicizzato
        return;
      }

      const id = ids[0];
      setModelId(id);
      setStatus(`Modello attivo: ${id}`);

      const types = listIfcTypes(id);
      setIfcTypes(types);

      setModelInitialized(true);
    }, 1000);

    return () => clearInterval(interval);
  }, [modelInitialized]);

  // Ricalcola le opzioni WBS ogni volta che:
  // - si inizializza un modelId
  // - oppure cambi sorgente (IFC vs DATI_WBS)
  useEffect(() => {
    if (!modelId) {
      setWbsOptions([]);
      return;
    }

    const config = useDatiWbs ? DATI_WBS_MAPPING : DEFAULT_WBS_MAPPING;
    const values = listAllWbsValues(modelId, config);
    setWbsOptions(values);
    // reset del valore selezionato quando si cambia "origine"
    setWbsCode("");
  }, [modelId, useDatiWbs]);

  // Calcolo riepilogo di copertura DATI_WBS <-> PO
  useEffect(() => {
    if (!modelId) {
      setCoverage(null);
      return;
    }

    const elements = getAllElements(modelId) ?? [];
    const totalElements = elements.length;

    let elementsWithDatiWbs = 0;
    let elementsWithTariffFromDatiWbs = 0;
    const tariffsFromDatiWbs = new Set<string>();

    for (const el of elements) {
      const dati = getDatiWbsProps(modelId, el.localId);
      if (!dati) continue;

      elementsWithDatiWbs++;
      const code = dati.TariffaCodice?.trim();
      if (code) {
        elementsWithTariffFromDatiWbs++;
        tariffsFromDatiWbs.add(code);
      }
    }

    const tariffsFromPo = new Set<string>();
    let poItemsWithTariff = 0;

    for (const item of poEngine.items) {
      const raw = item.tariffCode;
      if (!raw) continue;
      const code = String(raw).trim();
      if (!code) continue;
      poItemsWithTariff++;
      tariffsFromPo.add(code);
    }

    // differenze tra insiemi
    const onlyInDatiWbs: string[] = [];
    const onlyInPo: string[] = [];

    for (const code of tariffsFromDatiWbs) {
      if (!tariffsFromPo.has(code)) {
        onlyInDatiWbs.push(code);
      }
    }

    for (const code of tariffsFromPo) {
      if (!tariffsFromDatiWbs.has(code)) {
        onlyInPo.push(code);
      }
    }

    onlyInDatiWbs.sort();
    onlyInPo.sort();

    setCoverage({
      totalElements,
      elementsWithDatiWbs,
      elementsWithTariffFromDatiWbs,
      distinctTariffsInDatiWbs: tariffsFromDatiWbs.size,
      poItemsWithTariff,
      distinctTariffsInPo: tariffsFromPo.size,
      tariffCodesInDatiWbsNotInPo: onlyInDatiWbs,
      tariffCodesInPoNotInDatiWbs: onlyInPo,
    });
  }, [modelId, poItemsCount]);

  // Quando cambia il numero di voci PO, ricalcola i codici tariffa disponibili
  useEffect(() => {
    if (!poItemsCount) {
      setTariffOptions([]);
      return;
    }
    const codes = new Set<string>();
    for (const item of poEngine.items) {
      if (item.tariffCode) {
        codes.add(item.tariffCode);
      }
    }
    setTariffOptions([...codes].sort());
  }, [poItemsCount]);


    const unitSummary = React.useMemo(() => {
    if (!result) return "-";
    const units = new Set<string>();
    for (const item of result.matchingPoItems) {
      if (item.unit) units.add(item.unit);
    }
    if (!units.size) return "-";
    if (units.size === 1) return Array.from(units)[0];
    return Array.from(units).join(", ");
  }, [result]);

  const avgUnitCost = React.useMemo(() => {
    if (!result) return undefined;
    let sum = 0;
    let count = 0;
    for (const item of result.matchingPoItems) {
      const c = item.unitCost;
      if (typeof c === "number" && !Number.isNaN(c)) {
        sum += c;
        count++;
      }
    }
    return count ? sum / count : undefined;
  }, [result]);


  const handleApplyFilter = async () => {
    if (!modelId) {
      setStatus("Nessun modello disponibile.");
      return;
    }

    if (!poEngine.items.length) {
      setStatus("Nessun PO caricato. Carica un Excel prima di filtrare.");
      return;
    }

    try {
      setStatus("Calcolo filtro e applicazione evidenziazione...");

      const criteria: any = { modelId };

      if (selectedIfcType) {
        criteria.ifcTypes = [selectedIfcType];
      }
      if (wbsCode.trim()) {
        criteria.wbsCodes = [wbsCode.trim()];
      }
      if (tariffCode.trim()) {
        criteria.tariffCodes = [tariffCode.trim()];
      }

      const res = poEngine.filter(criteria);
      setResult(res);

      const hi = await ensureHighlighter();
      if (hi && res.modelIdMap) {
        await hi.highlighter.highlightByID("select", res.modelIdMap, true);
      }

      setStatus(
        `Filtro applicato: ${res.elements.length} elementi IFC, ` +
          `${res.matchingPoItems.length} voci PO, ` +
          `Q1(p1) totale = ${res.totalBaselineQuantity.toFixed(3)}, ` +
          `CST(p1) totale = ${res.totalBaselineAmount.toFixed(2)}`,
      );
    } catch (error) {
      console.error("[PoFilterPanel] Errore durante il filtro:", error);
      setStatus("Errore durante l'applicazione del filtro. Vedi console.");
    }
  };

  return (
    <div className="p-3 border rounded bg-white shadow-sm text-sm space-y-3">
      <div className="font-semibold">Filtri PO ⇄ BIM</div>

      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-700">
          Sorgente WBS / Tariffa:
          {" "}
          <strong>{useDatiWbs ? "DATI_WBS" : "Parametri IFC (STM_*)"} </strong>
        </span>
        <label className="inline-flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={useDatiWbs}
            onChange={(e) => setUseDatiWbs(e.target.checked)}
          />
          <span>Usa DATI_WBS</span>
        </label>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium mb-1">Tipo IFC</label>
          <select
            className="w-full border rounded px-2 py-1 text-xs"
            value={selectedIfcType}
            onChange={(e) => setSelectedIfcType(e.target.value)}
          >
            <option value="">(tutti)</option>
            {ifcTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">
            Codice WBS (da modello IFC)
          </label>
          <select
            className="w-full border rounded px-2 py-1 text-xs"
            value={wbsCode}
            onChange={(e) => setWbsCode(e.target.value)}
          >
            <option value="">(tutti)</option>
            {wbsOptions.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">
            Codice Tariffa / RCM (da PO)
          </label>
          <select
            className="w-full border rounded px-2 py-1 text-xs"
            value={tariffCode}
            onChange={(e) => setTariffCode(e.target.value)}
          >
            <option value="">(tutti)</option>
            {tariffOptions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleApplyFilter}
          className="w-full bg-emerald-600 text-white text-xs py-1.5 rounded hover:bg-emerald-700"
        >
          Applica filtro e evidenzia
        </button>
      </div>

      <div className="text-xs text-gray-700 whitespace-pre-line">
        {status}
      </div>

      {result && (
        <div className="mt-2 border-t pt-2 text-xs space-y-1">
          <div>
            <strong>Elementi IFC:</strong> {result.elements.length}
          </div>
          <div>
            <strong>Voci PO matchate:</strong> {result.matchingPoItems.length}
          </div>
          <div>
            <strong>UM:</strong> {unitSummary}
          </div>
          <div>
            <strong>Q1(p1) totale:</strong>{" "}
            {result.totalBaselineQuantity.toFixed(3)}
          </div>
          <div>
            <strong>Cu(p1) medio:</strong>{" "}
            {avgUnitCost != null ? avgUnitCost.toFixed(2) : "-"}
          </div>
          <div>
            <strong>CST(p1) totale:</strong>{" "}
            {result.totalBaselineAmount.toFixed(2)}
          </div>
        </div>
      )}

      {coverage && (
        <div className="mt-3 border-t pt-2 text-xs space-y-1">
          <div className="font-semibold">Copertura DATI_WBS ⇄ PO</div>
          <div>
            <strong>Elementi IFC totali:</strong>{" "}
            {coverage.totalElements}
          </div>
          <div>
            <strong>Elementi con Pset DATI_WBS:</strong>{" "}
            {coverage.elementsWithDatiWbs}
          </div>
          <div>
            <strong>Elementi con TariffaCodice (DATI_WBS):</strong>{" "}
            {coverage.elementsWithTariffFromDatiWbs}
          </div>
          <div>
            <strong>Voci PO con tariffa:</strong>{" "}
            {coverage.poItemsWithTariff}
          </div>
          <div>
            <strong>Codici tariffa distinti in DATI_WBS:</strong>{" "}
            {coverage.distinctTariffsInDatiWbs}
          </div>
          <div>
            <strong>Codici tariffa distinti nel PO:</strong>{" "}
            {coverage.distinctTariffsInPo}
          </div>

          {coverage.tariffCodesInDatiWbsNotInPo.length > 0 && (
            <div className="mt-1">
              <strong>Codici in DATI_WBS ma NON nel PO:</strong>{" "}
              <span className="text-amber-700">
                {coverage.tariffCodesInDatiWbsNotInPo.join(", ")}
              </span>
            </div>
          )}

          {coverage.tariffCodesInPoNotInDatiWbs.length > 0 && (
            <div className="mt-1">
              <strong>Codici nel PO ma NON in DATI_WBS:</strong>{" "}
              <span className="text-amber-700">
                {coverage.tariffCodesInPoNotInDatiWbs.join(", ")}
              </span>
            </div>
          )}

          {coverage.tariffCodesInDatiWbsNotInPo.length === 0 &&
            coverage.tariffCodesInPoNotInDatiWbs.length === 0 &&
            (coverage.distinctTariffsInDatiWbs > 0 ||
              coverage.distinctTariffsInPo > 0) && (
              <div className="mt-1 text-emerald-700">
                Tutti i codici tariffa presenti in DATI_WBS coincidono con
                quelli del PO.
              </div>
            )}
        </div>
      )}

    </div>
  );
};
