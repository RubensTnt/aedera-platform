// modules/parametriBim/BimMappingImportView.tsx

import React, { useEffect, useState, useCallback } from "react";

import {
  applyBimMappingHeatmap,
  clearBimMappingHeatmap,
  selectElementsByLocalIds,
  hydrateBimMappingForModel,
} from "@core/bim/selectionAdapter";

import type { WbsLevelKey } from "@core/bim/datiWbsProfile";
import { getActiveModelId } from "@core/bim/modelRegistry";
import { useDatiWbsProfile } from "../../hooks/useDatiWbsProfile";

import { getAllElements } from "@core/bim/modelProperties";
import { requireProjectId, ensureWbsPaths, bulkSetWbsAssignments, setElementParamValue } from "@core/api/aederaApi";
import { scanModelWbsTariffa, type WbsTariffaScanResult } from "@core/bim/wbsTariffaScan";
import { bulkGetElementParams } from "@core/api/aederaApi";


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
    const raw = pset[trimmedName];
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
  const [scan, setScan] = useState<WbsTariffaScanResult | null>(null);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

  const [importSources, setImportSources] = useState<ImportSourceMap>({
    WBS0: "STM_WBS_00_Commessa",
    WBS1: "STM_WBS_01_Costi",
    WBS2: "STM_WBS_04_Edificio",
    WBS3: "STM_WBS_06_Livello / Piano",
  });

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
      projectId,
      modelId,
      profile.requireTariffaCodice,
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

    // 1) pulizia mapping livelli attivi
    const activeLevelKeys = new Set(profile.levels.filter((lvl) => lvl.enabled).map((lvl) => lvl.key));
    const cleaned: ImportSourceMap = {};
    for (const [k, v] of Object.entries(importSources)) {
      const key = k as WbsLevelKey;
      if (!activeLevelKeys.has(key)) continue;
      const trimmed = (v ?? "").trim();
      if (!trimmed) continue;
      cleaned[key] = trimmed;
    }

    const tariffaParam = tariffaSource.trim();
    const pacchettoParam = pacchettoSource.trim();

    if (!Object.keys(cleaned).length && !tariffaParam && !pacchettoParam) {
      setStatus("Nessun parametro IFC di origine configurato.");
      return;
    }

    // 2) prepara paths WBS per ogni elemento
    const elements = getAllElements(modelId) ?? [];
    const toAssign: Array<{ globalId: string; path: string[] }> = [];

    // stats minime
    let updatedWbs = 0;
    let updatedTariffa = 0;
    let updatedPacchetto = 0;
    let debugPrinted = 0;

    for (const el of elements) {
      if (!el.globalId) continue;

      if (debugPrinted < 2 && el.psets && Object.keys(el.psets).length) {
        debugPrinted++;
        const psetNames = Object.keys(el.psets);
        const props = psetNames.flatMap((ps) => Object.keys(el.psets[ps] ?? {}));
        console.log("[IMPORT][DEBUG] psets", psetNames);
        console.log("[IMPORT][DEBUG] props sample", props.slice(0, 60));
      }
      
      // path = livelli in ordine (solo quelli configurati e trovati)
      const path: string[] = [];
      for (const lvl of profile.levels) {
        if (!lvl.enabled) continue;
        const src = cleaned[lvl.key];
        if (!src) continue;
        const value = getIfcParamValueFromElement(el.psets as any, src);
        if (value) path.push(value);
      }

      if (path.length) {
        toAssign.push({ globalId: el.globalId, path });
      }

      // Tariffa/Pacchetto: MVP = se trovi valore in IFC lo setti come ElementParam
      if (tariffaParam) {
        const v = getIfcParamValueFromElement(el.psets as any, tariffaParam);
        if (v) {
          await setElementParamValue(projectId, el.globalId, "tariffaCodice", v);
          updatedTariffa++;
        }
      }
      if (pacchettoParam) {
        const v = getIfcParamValueFromElement(el.psets as any, pacchettoParam);
        if (v) {
          await setElementParamValue(projectId, el.globalId, "pacchettoCodice", v);
          updatedPacchetto++;
        }
      }
    }

    const sample = elements.filter(e => !!e.globalId).slice(0, 3).map(e => e.globalId!) ;
    const check = await bulkGetElementParams(projectId, {
      globalIds: sample,
      keys: ["tariffaCodice", "pacchettoCodice"],
    });
    console.log("[IMPORT] bulk-get sample", check);
    console.log("[IMPORT] elements", elements.length);
    console.log("[IMPORT] toAssign", toAssign.length);
    console.log("[IMPORT] uniquePaths preview", toAssign[0]?.path);
    console.log("[IMPORT] updatedTariffa", updatedTariffa, "updatedPacchetto", updatedPacchetto);

    // 3) ensure-paths e bulk assign
    if (toAssign.length) {
      const uniquePaths: string[][] = [];
      const seen = new Set<string>();
      for (const it of toAssign) {
        const key = it.path.join("/");
        if (seen.has(key)) continue;
        seen.add(key);
        uniquePaths.push(it.path);
      }

      const ensured = await ensureWbsPaths(projectId, { paths: uniquePaths });
      
      if (!ensured?.nodeIdByPathKey) {
        console.error("ensureWbsPaths returned:", ensured);
        throw new Error("ensureWbsPaths: missing nodeIdByPathKey");
      }

      const items = toAssign
        .map((it) => {
          const key = it.path.join("/");
          const wbsNodeId = ensured.nodeIdByPathKey[key] ?? null;
          return { globalId: it.globalId, wbsNodeId };
        })
        .filter((x) => !!x.wbsNodeId); // <-- evita "clear" involontari

      const assigned = new Set(items.map(x => x.globalId));
      console.log("[IMPORT] assigned gids sample", Array.from(assigned).slice(0, 5));

      console.log("[IMPORT] ensured keys", Object.keys(ensured.nodeIdByPathKey).length);
      console.log("[IMPORT] items to bulk-set", items.length);
      console.log("[IMPORT] sample item", items[0]);

      await bulkSetWbsAssignments(projectId, { items });

      updatedWbs = items.filter((x) => !!x.wbsNodeId).length;
    }

    await hydrateBimMappingForModel(modelId, projectId);

    await refreshScan();

    setStatus(
      `Import completato. WBS assegnate: ${updatedWbs}. ` +
      `tariffaCodice aggiornati: ${updatedTariffa}. ` +
      `pacchettoCodice aggiornati: ${updatedPacchetto}.`,
    );
  }, [activeModelId, profile, importSources, tariffaSource, pacchettoSource, refreshScan]);

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

  // Heatmap: riuso l’API esistente (oggi si aspetta “scan” stile DATI_WBS).
  // Qui le passiamo un oggetto compatibile (elementsByStatus + counts).
  useEffect(() => {
    if (!heatmapEnabled || !activeModelId || !scan) {
      void clearBimMappingHeatmap();
      return () => void clearBimMappingHeatmap();
    }

    // Adattatore: usa la stessa struttura minima che applyBimMappingHeatmap già usa.
    void applyBimMappingHeatmap(activeModelId, scan as any);

    return () => void clearBimMappingHeatmap();
  }, [heatmapEnabled, activeModelId, scan]);

  return (
    <div className="h-full w-full flex flex-col gap-4 text-sm text-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Parametri BIM – WBS + Tariffa/Pacchetto (server-based)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Import da IFC → assegna WBS (tree) e salva tariffa/pacchetto come ElementParams.
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

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-semibold text-slate-800">
            Stato mappatura
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
            {heatmapEnabled ? "Controllo attivo" : "Attiva controllo"}
          </button>
        </div>

        {scan && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
              <div className="text-[11px] text-slate-500">Completi</div>
              <div className="text-sm font-semibold text-emerald-600">{scan.completeCount}</div>
              <button className="mt-1 text-[11px] underline" onClick={() => void handleSelectByStatus("complete")}>
                seleziona
              </button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
              <div className="text-[11px] text-slate-500">Parziali</div>
              <div className="text-sm font-semibold text-amber-500">{scan.partialCount}</div>
              <button className="mt-1 text-[11px] underline" onClick={() => void handleSelectByStatus("partial")}>
                seleziona
              </button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
              <div className="text-[11px] text-slate-500">Vuoti</div>
              <div className="text-sm font-semibold text-slate-600">{scan.emptyCount}</div>
              <button className="mt-1 text-[11px] underline" onClick={() => void handleSelectByStatus("empty")}>
                seleziona
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mapping import */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs space-y-3">
        <div className="text-[12px] font-semibold text-slate-800">
          Import automatico da IFC
        </div>

        <div className="grid grid-cols-2 gap-3">
          {profile.levels
            .filter((lvl) => lvl.enabled)
            .slice(0, 4)
            .map((lvl) => (
              <label key={lvl.key} className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-500">{lvl.label ?? lvl.key}</span>
                <input
                  className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"
                  value={importSources[lvl.key] ?? ""}
                  onChange={(e) => handleChangeImportSource(lvl.key, e.target.value)}
                  placeholder='Nome parametro IFC (es. "STM_WBS_00_Commessa")'
                />
              </label>
            ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
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

        <button
          type="button"
          onClick={() => void handleImportFromIfc()}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-[12px] font-medium hover:bg-slate-100"
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
