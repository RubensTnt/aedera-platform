// modules/parametriBim/BimMappingImportView.tsx

import React, { useEffect, useState, useCallback, useMemo } from "react";

import {
  applyBimMappingHeatmap,
  clearBimMappingHeatmap,
  selectElementsByLocalIds,
  hydrateBimMappingForModel,
} from "@core/bim/selectionAdapter";

import type { WbsLevelKey } from "@core/bim/datiWbsProfile";
import { getActiveModelId, getModelInfo } from "@core/bim/modelRegistry";
import { useDatiWbsProfile } from "../../hooks/useDatiWbsProfile";

import { getAllElements } from "@core/bim/modelProperties";
import { scanModelWbsTariffa, type bimMappingScanResult } from "@core/bim/bimMappingScan";

import {
  requireProjectId,
  bulkSetWbsAssignmentsV2,
  bulkSetElementParams,
} from "@core/api/aederaApi";

// riuso del “picker” mapping già presente

type ImportSourceMap = Partial<Record<WbsLevelKey, string>>;

function getIfcParamValueFromElement(
  elementPsets: Record<string, Record<string, unknown>>,
  propName: string,
): string | undefined {
  const trimmedName = propName.trim();
  if (!trimmedName) return undefined;

  for (const pset of Object.values(elementPsets)) {
    if (!pset) continue;
    const raw = (pset as any)[trimmedName];
    if (raw == null) continue;
    const value = String(raw).trim();
    if (value) return value;
  }
  return undefined;
}

export const BimMappingImportView: React.FC = () => {
  const [profile] = useDatiWbsProfile();
  const [status, setStatus] = useState<string | null>(null);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [scan, setScan] = useState<bimMappingScanResult | null>(null);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

  const [importSources, setImportSources] = useState<ImportSourceMap>({
    WBS0: "STM_WBS_00_Commessa",
    WBS1: "STM_WBS_01_Costi",
    WBS4: "STM_WBS_04_Edificio",
    WBS6: "STM_WBS_06_Livello / Piano",
  });

  const enabledLevels = useMemo(
    () => (profile.levels ?? []).filter((l) => !!l.enabled),
    [profile],
  );

  const enabledLevelKeys = useMemo(
    () => enabledLevels.map((l) => l.key as WbsLevelKey),
    [enabledLevels],
  );

  const [importLevel, setImportLevel] = useState<WbsLevelKey>("WBS6" as WbsLevelKey);
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  useEffect(() => {
    if (!enabledLevelKeys.length) return;
    if (enabledLevelKeys.includes(importLevel)) return;
    setImportLevel(enabledLevelKeys[0]);
  }, [enabledLevelKeys, importLevel]);

  const [tariffaSource, setTariffaSource] = useState<string>("STM_TAR_Code");
  const [pacchettoSource, setPacchettoSource] = useState<string>("STM_PCK_Code");

  const handleChangeImportSource = (level: WbsLevelKey, value: string) => {
    setImportSources((prev) => ({ ...prev, [level]: value }));
  };

  const refreshScan = useCallback(async () => {
    const modelId = getActiveModelId();
    if (!modelId) {
      setActiveModelId(null);
      setScan(null);
      return;
    }

    setActiveModelId(modelId);

    const projectId = requireProjectId();
    const result = await scanModelWbsTariffa(
      modelId,
      projectId,
      !!profile.requireTariffaCodice,
      !!profile.requirePacchettoCodice,
    );

    setScan(result);
  }, [profile]);

  const handleImportFromIfc = useCallback(async () => {
    const modelId = activeModelId;
    if (!modelId) {
      setStatus("Nessun modello attivo. Importa un IFC prima di eseguire il mapping da IFC.");
      return;
    }

    const projectId = requireProjectId();
    const serverModelId = getModelInfo(modelId)?.serverId;
    if (!serverModelId) {
      setStatus("Model serverId mancante. Ricarica il progetto o reimporta il modello.");
      return;
    }

    // Importa SOLO il livello selezionato
    const levelKey = importLevel;
    const srcParam = (importSources[levelKey] ?? "").trim();
    if (!srcParam) {
      setStatus(`Configura il parametro IFC per ${levelKey} prima di importare.`);
      return;
    }

    const elements = getAllElements(modelId) ?? [];
    const wbsItems: Array<{ guid: string; levelKey: string; code: string | null }> = [];
    const paramItems: Array<{ guid: string; key: string; value: any }> = [];

    let updatedTariffa = 0;
    let updatedPacchetto = 0;

    for (const el of elements) {
      if (!el.globalId) continue;

      const psets = (el.psets ?? {}) as any;

      // WBS v2 livello selezionato
      const w = getIfcParamValueFromElement(psets, srcParam);
      if (w) {
        wbsItems.push({ guid: el.globalId, levelKey, code: w });
      }

      // tariffa/pacchetto (opzionali)
      if (tariffaSource?.trim()) {
        const t = getIfcParamValueFromElement(psets, tariffaSource);
        if (t) {
          paramItems.push({ guid: el.globalId, key: "tariffaCodice", value: t });
          updatedTariffa++;
        }
      }

      if (pacchettoSource?.trim()) {
        const p = getIfcParamValueFromElement(psets, pacchettoSource);
        if (p) {
          paramItems.push({ guid: el.globalId, key: "pacchettoCodice", value: p });
          updatedPacchetto++;
        }
      }
    }

    // salva params
    if (paramItems.length) {
      await bulkSetElementParams(projectId, {
        modelId: serverModelId,
        items: paramItems,
        source: "IFC_IMPORT",
      });
    }

    // salva WBS v2
    let updatedWbs = 0;
    let skippedWbs = 0;

    if (wbsItems.length) {
      const resp = await bulkSetWbsAssignmentsV2(projectId, {
        modelId: serverModelId,
        source: "IFC_IMPORT",
        overwrite: overwriteExisting,
        items: wbsItems,
      });
      updatedWbs = resp.updated ?? 0;
      skippedWbs = resp.skipped ?? 0;
    }

    // refresh mapping + scan
    await hydrateBimMappingForModel(modelId, projectId);
    await refreshScan();

    setStatus(
      `Import completato (${levelKey}). ` +
        `WBS aggiornate: ${updatedWbs} (skipped: ${skippedWbs}). ` +
        `tariffaCodice: ${updatedTariffa}. ` +
        `pacchettoCodice: ${updatedPacchetto}.`,
    );
  }, [
    activeModelId,
    importLevel,
    overwriteExisting,
    importSources,
    tariffaSource,
    pacchettoSource,
    refreshScan,
  ]);

  const handleSelectByStatus = useCallback(
    async (stato: "complete" | "partial" | "empty") => {
      if (!activeModelId || !scan) return;
      const ids = scan.elementsByStatus[stato];
      if (!ids.length) {
        setStatus("Nessun elemento per questo stato.");
        return;
      }
      await selectElementsByLocalIds(activeModelId, ids);
      setStatus(`Selezionati ${ids.length} elemento/i.`);
    },
    [activeModelId, scan],
  );

  useEffect(() => {
    void refreshScan();
  }, [refreshScan]);

  // Heatmap on/off
  useEffect(() => {
    if (!activeModelId) return;

    if (!heatmapEnabled) {
      clearBimMappingHeatmap(activeModelId);
      return;
    }

    // uso scan già calcolato (se manca, non faccio nulla)
    if (!scan) return;

    applyBimMappingHeatmap(activeModelId, scan);
  }, [activeModelId, scan, heatmapEnabled]);

  return (
    <div className="space-y-3 p-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs space-y-2">
        <div className="text-[12px] font-semibold text-slate-800">Parametri BIM</div>
        <div className="text-[11px] text-slate-500">
          Import e controllo mappatura (WBS + tariffa/pacchetto).
        </div>
      </div>

      {/* Scan status */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-semibold text-slate-800">Stato mappatura</div>

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
            {heatmapEnabled ? "Controllo attivo" : "Attiva controllo"}
          </button>
        </div>

        {!scan && (
          <div className="text-[11px] text-slate-500">
            Nessun modello attivo o scan non disponibile.
          </div>
        )}

        {scan && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] text-slate-500">Completi</div>
              <div className="text-[16px] font-semibold text-slate-900 font-mono">
                {scan.completeCount}
              </div>
              <button
                type="button"
                className="mt-1 text-[11px] underline"
                onClick={() => void handleSelectByStatus("complete")}
              >
                seleziona
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] text-slate-500">Parziali</div>
              <div className="text-[16px] font-semibold text-slate-900 font-mono">
                {scan.partialCount}
              </div>
              <button
                type="button"
                className="mt-1 text-[11px] underline"
                onClick={() => void handleSelectByStatus("partial")}
              >
                seleziona
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] text-slate-500">Vuoti</div>
              <div className="text-[16px] font-semibold text-slate-900 font-mono">
                {scan.emptyCount}
              </div>
              <button
                type="button"
                className="mt-1 text-[11px] underline"
                onClick={() => void handleSelectByStatus("empty")}
              >
                seleziona
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mapping import */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs space-y-3">
        <div className="text-[12px] font-semibold text-slate-800">
          Import automatico da IFC (WBS v2)
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500">Livello WBS da importare</span>
            <select
              className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"
              value={importLevel}
              onChange={(e) => setImportLevel(e.target.value as WbsLevelKey)}
            >
              {enabledLevels.map((lvl) => (
                <option key={lvl.key} value={lvl.key}>
                  {lvl.label ?? lvl.key}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500">Parametro IFC per {importLevel}</span>
            <input
              className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"
              value={importSources[importLevel] ?? ""}
              onChange={(e) => handleChangeImportSource(importLevel, e.target.value)}
              placeholder="Nome proprietà IFC (in Pset)"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500">Tariffa (IFC param)</span>
            <input
              className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"
              value={tariffaSource}
              onChange={(e) => setTariffaSource(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500">Pacchetto (IFC param)</span>
            <input
              className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"
              value={pacchettoSource}
              onChange={(e) => setPacchettoSource(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
            <input
              type="checkbox"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
            />
            <span className="text-[12px] text-slate-700">Sovrascrivi esistenti</span>
          </label>

          <details className="rounded-md border border-slate-200 bg-white px-2 py-1">
            <summary className="cursor-pointer select-none text-[11px] text-slate-600">
              Parametri WBS (altri livelli)
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-3 pb-2">
              {enabledLevels.map((lvl) => (
                <label key={lvl.key} className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-500">{lvl.label ?? lvl.key}</span>
                  <input
                    className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"
                    value={importSources[lvl.key as WbsLevelKey] ?? ""}
                    onChange={(e) =>
                      handleChangeImportSource(lvl.key as WbsLevelKey, e.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className="text-[10px] text-slate-500">
          Nota: l&apos;import WBS scrive solo il livello selezionato. Se un valore non è ammesso, verrà salvato come{" "}
          <span className="font-mono">INVALID/rawCode</span> (da correggere poi in overlay).
        </div>

        <button
          type="button"
          onClick={() => void handleImportFromIfc()}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-medium hover:bg-slate-100"
        >
          Esegui import da IFC
        </button>

        {status && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
            {status}
          </div>
        )}
      </div>
    </div>
  );
};
