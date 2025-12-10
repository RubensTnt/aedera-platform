import React, {
  useEffect,
  useState,
  useCallback,
} from "react";

import {
  getIndexedModelIds,
} from "@core/bim/modelProperties";

import {
  selectElementsByLocalIds,
  applyDatiWbsHeatmap,
  clearDatiWbsHeatmap,
} from "@core/bim/selectionAdapter";

import {
  scanModelDatiWbs,
  type DatiWbsScanResult,
} from "@core/bim/datiWbsScanner";

import {
  importDatiWbsFromIfc,
  type DatiWbsImportSourceMap,
} from "@core/bim/datiWbsImport";

import type { WbsLevelKey } from "@core/bim/datiWbsProfile";

export const WbsTariffaView: React.FC = () => {
  const [status, setStatus] = useState<string | null>(null);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [scan, setScan] = useState<DatiWbsScanResult | null>(null);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

  // Config di default per l'import da IFC
  const [importSources, setImportSources] = useState<DatiWbsImportSourceMap>({
    WBS0: "STM_WBS_00_Commessa",
    WBS1: "STM_WBS_01_Costi",
    WBS2: "STM_WBS_04_Edificio",
    WBS3: "STM_WBS_06_Livello / Piano",
  });

  const handleChangeImportSource = (level: WbsLevelKey, value: string) => {
    setImportSources((prev) => ({
      ...prev,
      [level]: value,
    }));
  };

  const refreshScan = useCallback(() => {
    const modelIds = getIndexedModelIds();
    if (!modelIds.length) {
      setActiveModelId(null);
      setScan(null);
      return;
    }

    const modelId = modelIds[0];
    setActiveModelId(modelId);

    const result = scanModelDatiWbs(modelId);
    setScan(result);
  }, []);

  const handleImportFromIfc = () => {
    if (!activeModelId) {
      setStatus(
        "Nessun modello attivo. Importa un IFC prima di eseguire il mapping da IFC.",
      );
      return;
    }

    const cleaned: DatiWbsImportSourceMap = {};
    for (const [key, value] of Object.entries(importSources)) {
      if (!value) continue;
      if (!value.trim()) continue;
      cleaned[key as keyof DatiWbsImportSourceMap] = value;
    }

    if (!Object.keys(cleaned).length) {
      setStatus(
        "Nessun parametro IFC di origine configurato. Compila almeno un campo di mapping (es. STM_WBS_00_Commessa).",
      );
      return;
    }

    const result = importDatiWbsFromIfc(activeModelId, {
      sourceByLevel: cleaned,
    });

    refreshScan();

    const lines: string[] = [];
    lines.push(
      `Import WBS da IFC completato. Elementi aggiornati: ${result.updatedElements}.`,
    );

    for (const lvl of result.levels) {
      if (!cleaned[lvl.level]) continue;
      lines.push(
        `${lvl.level} ← "${lvl.sourceParam}": ` +
          `da IFC=${lvl.filledFromIfc}, già compilati=${lvl.skippedAlreadyFilled}, assenti IFC=${lvl.notFoundInIfc}`,
      );
    }

    setStatus(lines.join(" "));
  };

  const handleSelectByStatus = useCallback(
    async (stato: "complete" | "partial" | "empty") => {
      if (!activeModelId || !scan) return;

      const ids = scan.elementsByStatus[stato];
      if (!ids.length) {
        let msg: string;
        switch (stato) {
          case "complete":
            msg = "Nessun elemento completo da selezionare.";
            break;
          case "partial":
            msg = "Nessun elemento parziale da selezionare.";
            break;
          default:
            msg = "Nessun elemento non mappato da selezionare.";
            break;
        }
        setStatus(msg);
        return;
      }

      await selectElementsByLocalIds(activeModelId, ids);

      const statoLabel =
        stato === "complete"
          ? "completi"
          : stato === "partial"
            ? "parziali"
            : "non mappati";

      setStatus(
        `Selezionati ${ids.length} elemento/i marcati come ${statoLabel}.`,
      );
    },
    [activeModelId, scan],
  );

  useEffect(() => {
    refreshScan();
  }, [refreshScan]);

  // Ricalcola automaticamente scan (e quindi heatmap, se attiva)
  // quando qualche altro componente aggiorna DATI_WBS
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: Event) => {
      // Se volessimo filtrare per modelId:
      // const detail = (event as CustomEvent<{ modelIds?: string[] }>).detail;
      // if (detail?.modelIds && activeModelId && !detail.modelIds.includes(activeModelId)) {
      //   return;
      // }
      refreshScan();
    };

    window.addEventListener("aedera:datiWbsUpdated", handler as EventListener);
    return () => {
      window.removeEventListener(
        "aedera:datiWbsUpdated",
        handler as EventListener,
      );
    };
  }, [refreshScan]);

  // Heatmap
  useEffect(() => {
    if (!heatmapEnabled) {
      void clearDatiWbsHeatmap();
      return;
    }

    if (!activeModelId || !scan) {
      void clearDatiWbsHeatmap();
      return;
    }

    void applyDatiWbsHeatmap(activeModelId, scan);
  }, [heatmapEnabled, activeModelId, scan]);

  return (
    <div className="h-full w-full flex flex-col gap-4">
      {/* HEADER */}
      <div>
        <h2 className="text-lg font-semibold">
          Parametri BIM – WBS &amp; Codice Tariffa (DATI_WBS)
        </h2>
        <p className="text-sm text-gray-400">
          Questo pannello fornisce una panoramica sullo stato di
          mappatura dei DATI_WBS del modello, sulla heatmap e
          sull&apos;import automatico dei livelli WBS da IFC.
          <br />
          Per modificare i parametri di singoli elementi usa il
          pannellino <span className="font-semibold">“DATI_WBS selezione”</span>
          sopra il viewport 3D.
        </p>
      </div>

      {/* STATO MODELLO / COPERTURA DATI_WBS */}
      <div className="rounded-md border border-gray-700 bg-gray-900/60 p-3 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-200">
              Stato mappatura DATI_WBS
            </div>
            {activeModelId ? (
              <div className="text-[11px] text-gray-400">
                Modello attivo: <code>{activeModelId}</code>
              </div>
            ) : (
              <div className="text-[11px] text-amber-400">
                Nessun modello indicizzato. Importa un IFC per analizzare la
                mappatura DATI_WBS.
              </div>
            )}
          </div>
        </div>

        {scan && activeModelId && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center mt-2">
              <div className="rounded bg-gray-950/70 border border-gray-800 p-2">
                <div className="text-[11px] text-gray-400">Completi</div>
                <div className="text-sm font-semibold text-emerald-400">
                  {scan.completeCount}
                </div>
              </div>
              <div className="rounded bg-gray-950/70 border border-gray-800 p-2">
                <div className="text-[11px] text-gray-400">Parziali</div>
                <div className="text-sm font-semibold text-amber-400">
                  {scan.partialCount}
                </div>
              </div>
              <div className="rounded bg-gray-950/70 border border-gray-800 p-2">
                <div className="text-[11px] text-gray-400">Non mappati</div>
                <div className="text-sm font-semibold text-red-400">
                  {scan.emptyCount}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="text-[11px] text-gray-400">
                Elementi totali indicizzati:{" "}
                <span className="text-gray-200 font-medium">
                  {scan.totalElements}
                </span>
              </div>
              <div className="text-[11px] text-gray-400">
                Completamento medio:{" "}
                <span className="text-emerald-400 font-semibold">
                  {(scan.completionRatioAvg * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() => setHeatmapEnabled((v) => !v)}
                className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
                  heatmapEnabled
                    ? "border-emerald-500 bg-emerald-900/40 text-emerald-100"
                    : "border-gray-600 bg-gray-900/60 text-gray-200 hover:bg-gray-800"
                }`}
              >
                {heatmapEnabled
                  ? "Disattiva heatmap DATI_WBS"
                  : "Attiva heatmap DATI_WBS"}
              </button>

              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-emerald-400" />
                  <span>Completi</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-amber-300" />
                  <span>Parziali</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
                  <span>Non mappati</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleSelectByStatus("complete")}
                className="flex-1 min-w-[120px] rounded border border-emerald-600/70 bg-emerald-900/30 px-2 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-900/60 transition"
              >
                Seleziona completi
              </button>
              <button
                type="button"
                onClick={() => handleSelectByStatus("partial")}
                className="flex-1 min-w-[120px] rounded border border-amber-600/70 bg-amber-900/20 px-2 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-900/40 transition"
              >
                Seleziona parziali
              </button>
              <button
                type="button"
                onClick={() => handleSelectByStatus("empty")}
                className="flex-1 min-w-[120px] rounded border border-red-600/70 bg-red-900/20 px-2 py-1 text-[11px] font-medium text-red-200 hover:bg-red-900/40 transition"
              >
                Seleziona non mappati
              </button>
            </div>
          </>
        )}
      </div>

      {/* IMPORT AUTOMATICO DA IFC → DATI_WBS */}
      <div className="rounded-md border border-gray-700 bg-gray-900/50 p-3 text-xs space-y-2">
        <div className="flex items-center justify-between mb-1">
          <div className="font-semibold text-gray-200">
            Import automatico WBS da IFC
          </div>
          <div className="text-[11px] text-gray-400">
            Copia i parametri STM_WBS_* nel Pset <code>DATI_WBS</code> senza
            sovrascrivere i valori già compilati.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["WBS0", "WBS1", "WBS2", "WBS3"] as WbsLevelKey[]).map((level) => (
            <div key={level} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-300">
                {level} · parametro IFC origine
              </label>
              <input
                className="rounded border border-gray-700 bg-gray-950 px-2 py-1 text-[11px] text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={importSources[level] ?? ""}
                onChange={(e) =>
                  handleChangeImportSource(level, e.target.value)
                }
                placeholder='Es. "STM_WBS_00_Commessa"'
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={handleImportFromIfc}
            className="rounded px-3 py-1.5 text-[11px] font-medium bg-sky-600 hover:bg-sky-500 text-white"
          >
            Importa da IFC nei DATI_WBS
          </button>
        </div>
      </div>

      {/* STATUS MESSAGGI */}
      {status && (
        <div className="text-xs text-gray-300 bg-gray-900/60 border border-gray-700 rounded px-2 py-1">
          {status}
        </div>
      )}
    </div>
  );
};
