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
import { getActiveModelId } from "@core/bim/modelRegistry";


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
    const modelId = getActiveModelId();

    if (!modelId) {
      setActiveModelId(null);
      setScan(null);
      return;
    }

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
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: Event) => {
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
    <div className="h-full w-full flex flex-col gap-4 text-sm text-slate-700">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Parametri BIM – WBS &amp; Codice Tariffa (DATI_WBS)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Panoramica sullo stato di mappatura dei DATI_WBS del modello,
            heatmap e import automatico dei livelli WBS da IFC.
            <br />
            Per modificare i parametri della selezione usa il pannellino{" "}
            <span className="font-semibold">“DATI_WBS selezione”</span> sopra il
            viewport 3D.
          </p>
        </div>
        {activeModelId && (
          <div className="text-[11px] text-slate-400">
            Modello attivo:{" "}
            <code className="text-slate-600 bg-slate-100 rounded px-1 py-[1px]">
              {activeModelId}
            </code>
          </div>
        )}
      </div>

      {/* STATO MODELLO / COPERTURA DATI_WBS */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="text-[12px] font-semibold text-slate-800">
              Stato mappatura DATI_WBS
            </div>
            {!activeModelId && (
              <div className="text-[11px] text-amber-600">
                Nessun modello indicizzato. Importa un IFC per analizzare la
                mappatura DATI_WBS.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setHeatmapEnabled((v) => !v)}
            className={[
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition",
              heatmapEnabled
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
            ].join(" ")}
          >
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                heatmapEnabled ? "bg-emerald-500" : "bg-slate-300",
              ].join(" ")}
            />
            {heatmapEnabled
              ? "Heatmap DATI_WBS attiva"
              : "Attiva heatmap DATI_WBS"}
          </button>
        </div>

        {scan && activeModelId && (
          <>
            <div className="grid grid-cols-3 gap-3 text-center mt-1">
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                <div className="text-[11px] text-slate-500">Completi</div>
                <div className="text-sm font-semibold text-emerald-600">
                  {scan.completeCount}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                <div className="text-[11px] text-slate-500">Parziali</div>
                <div className="text-sm font-semibold text-amber-500">
                  {scan.partialCount}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                <div className="text-[11px] text-slate-500">Non mappati</div>
                <div className="text-sm font-semibold text-rose-500">
                  {scan.emptyCount}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
              <div>
                Elementi totali indicizzati:{" "}
                <span className="font-medium text-slate-800">
                  {scan.totalElements}
                </span>
              </div>
              <div>
                Completamento medio:{" "}
                <span className="font-semibold text-emerald-600">
                  {(scan.completionRatioAvg * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-emerald-400" />
                  <span>Completi</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-amber-300" />
                  <span>Parziali</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-rose-400" />
                  <span>Non mappati</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => handleSelectByStatus("complete")}
                className="flex-1 min-w-[120px] rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 transition"
              >
                Seleziona completi
              </button>
              <button
                type="button"
                onClick={() => handleSelectByStatus("partial")}
                className="flex-1 min-w-[120px] rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition"
              >
                Seleziona parziali
              </button>
              <button
                type="button"
                onClick={() => handleSelectByStatus("empty")}
                className="flex-1 min-w-[120px] rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 transition"
              >
                Seleziona non mappati
              </button>
            </div>
          </>
        )}
      </div>

      {/* IMPORT AUTOMATICO DA IFC → DATI_WBS */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] font-semibold text-slate-800">
              Import automatico WBS da IFC
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Copia i parametri <code className="text-[11px]">STM_WBS_*</code>{" "}
              nel Pset <code className="text-[11px]">DATI_WBS</code> senza
              sovrascrivere i valori già compilati.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(["WBS0", "WBS1", "WBS2", "WBS3"] as WbsLevelKey[]).map((level) => (
            <div key={level} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-700">
                {level} · parametro IFC origine
              </label>
              <input
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
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
            className="inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
          >
            Importa da IFC nei DATI_WBS
          </button>
        </div>
      </div>

      {/* STATUS MESSAGGI */}
      {status && (
        <div className="text-xs rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
          {status}
        </div>
      )}
    </div>
  );
};
