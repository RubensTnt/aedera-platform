// src/modules/parametriBim/WbsTariffaView.tsx

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";

import { poEngine } from "@core/po/poEngine";
import type { POItem } from "@core/domain/po";

import {
  getIndexedModelIds,
  type DatiWbsProps,
} from "@core/bim/modelProperties";

import {
  applyDatiWbsToSelection,
  getSelectedElementsWithDatiWbs,
  type SelectedElementWithDatiWbs,
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


type DatiWbsFormState = Partial<DatiWbsProps>;

interface TariffSuggestion {
  tariffCode: string;
  description?: string | null;
  unit?: string | null;
  exampleQuantity?: number;
}

export const WbsTariffaView: React.FC = () => {
  const [selection, setSelection] = useState<SelectedElementWithDatiWbs[]>([]);
  const [form, setForm] = useState<DatiWbsFormState>({});
  const [status, setStatus] = useState<string | null>(null);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [scan, setScan] = useState<DatiWbsScanResult | null>(null);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

  // Configurazione di default per l'import da IFC:
  // usiamo i parametri STM_WBS_* che hai già nei modelli.
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

  const handleImportFromIfc = () => {
    if (!activeModelId) {
      setStatus(
        "Nessun modello attivo. Importa un IFC prima di eseguire il mapping da IFC.",
      );
      return;
    }

    // Applichiamo solo ai livelli per cui l'utente ha scritto qualcosa
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

    // Dopo l'import, aggiorniamo le statistiche globali e la heatmap (se attiva)
    refreshScan();

    const lines: string[] = [];
    lines.push(
      `Import WBS da IFC completato. Elementi aggiornati: ${result.updatedElements}.`,
    );

    for (const lvl of result.levels) {
      if (!cleaned[lvl.level]) continue; // mostriamo solo i livelli usati
      lines.push(
        `${lvl.level} ← "${lvl.sourceParam}": ` +
          `da IFC=${lvl.filledFromIfc}, già compilati=${lvl.skippedAlreadyFilled}, assenti IFC=${lvl.notFoundInIfc}`,
      );
    }

    setStatus(lines.join(" "));
  };

  
  // ---------------------------------------------------------------------------
  // 1) Gestione selezione
  // ---------------------------------------------------------------------------

  const refreshSelection = useCallback(async () => {
    const items = await getSelectedElementsWithDatiWbs();
    setSelection(items);
  }, []);

  const refreshScan = useCallback(() => {
    const modelIds = getIndexedModelIds();
    if (!modelIds.length) {
      setActiveModelId(null);
      setScan(null);
      return;
    }

    // Per ora usiamo il primo modello indicizzato.
    // In futuro potremo permettere all'utente di sceglierlo.
    const modelId = modelIds[0];
    setActiveModelId(modelId);

    const result = scanModelDatiWbs(modelId);
    setScan(result);
  }, []);

  const handleSelectByStatus = useCallback(
    async (status: "complete" | "partial" | "empty") => {
      if (!activeModelId || !scan) return;

      const ids = scan.elementsByStatus[status];
      if (!ids.length) {
        let msg: string;
        switch (status) {
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
      const items = await getSelectedElementsWithDatiWbs();
      setSelection(items);

      const statoLabel =
        status === "complete"
          ? "completi"
          : status === "partial"
            ? "parziali"
            : "non mappati";

      setStatus(
        `Selezionati ${ids.length} elemento/i marcati come ${statoLabel}.`,
      );
    },
    [activeModelId, scan],
  );

  // All'inizio proviamo a leggere la selezione corrente
  useEffect(() => {
    void refreshSelection();
    refreshScan();
  }, [refreshSelection, refreshScan]);

  // Quando cambiano modello / scan / toggle heatmap, aggiorniamo la visuale
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

  const selectionCount = selection.length;
  const single = selectionCount === 1 ? selection[0] : null;

  // Quando cambia l'elemento selezionato singolo, precompiliamo il form
  useEffect(() => {
    if (single?.datiWbs) {
      setForm(single.datiWbs);
    }
  }, [single?.modelId, single?.localId, single?.datiWbs]);

  // ---------------------------------------------------------------------------
  // 2) Gestione form DATI_WBS
  // ---------------------------------------------------------------------------

  const handleInputChange = (key: keyof DatiWbsProps, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value === "" ? "" : value,
    }));
  };

  const hasFormValues = useMemo(
    () =>
      Object.values(form).some(
        (v) => v !== undefined && v !== null && v !== "",
      ),
    [form],
  );

  const handleApplyToSelection = async () => {
    setStatus(null);

    if (!hasFormValues) {
      setStatus("Nessun valore da applicare. Compila almeno un campo.");
      return;
    }

    // Applichiamo sempre alla selezione CORRENTE del viewer,
    // indipendentemente da cosa c'è nello stato React.
    const updated = await applyDatiWbsToSelection(form);

    if (!updated.length) {
      // Nessun elemento selezionato nel viewer
      setStatus(
        "Nessun elemento selezionato nel viewer. Seleziona almeno un elemento e riprova.",
      );
      const items = await getSelectedElementsWithDatiWbs();
      setSelection(items);
      return;
    }

    setSelection(updated);
    setStatus(
      `Parametri DATI_WBS applicati a ${updated.length} elemento/i selezionato/i.`,
    );

    // Dopo aver scritto i DATI_WBS, rieseguiamo la scansione del modello
    // per aggiornare le statistiche globali.
    await refreshScan();
  };

  const handleResetForm = () => {
    setForm({});
    setStatus(null);
  };

  // ---------------------------------------------------------------------------
  // 3) Suggerimenti da PO per TariffaCodice
  // ---------------------------------------------------------------------------

  const poItems: POItem[] = poEngine.items;
  const hasPo = poItems.length > 0;
  const tariffInput = (form.TariffaCodice ?? "").trim();

  const tariffSuggestions: TariffSuggestion[] = useMemo(() => {
    if (!hasPo) return [];

    const normalizedQuery = tariffInput.toLowerCase();
    const seen = new Set<string>();
    const out: TariffSuggestion[] = [];

    for (const item of poItems) {
      const code = item.tariffCode;
      if (!code) continue;

      const codeUpper = code.toUpperCase();
      if (seen.has(codeUpper)) continue;

      if (
        normalizedQuery &&
        !code.toLowerCase().includes(normalizedQuery)
      ) {
        continue;
      }

      seen.add(codeUpper);
      out.push({
        tariffCode: code,
        description: item.description,
        unit: item.unit,
        exampleQuantity:
          typeof item.baselineQuantity === "number"
            ? item.baselineQuantity
            : undefined,
      });

      if (out.length >= 10) break;
    }

    return out;
  }, [hasPo, poItems, tariffInput]);

  const selectedTariff = single?.datiWbs?.TariffaCodice?.trim() || "";

  const poMatchesForSelected: POItem[] = useMemo(() => {
    if (!selectedTariff || !hasPo) return [];
    const target = selectedTariff.toUpperCase();
    return poItems.filter(
      (it) => it.tariffCode && it.tariffCode.toUpperCase() === target,
    );
  }, [hasPo, poItems, selectedTariff]);

  const exactPoMatchesForSelected = poMatchesForSelected.length;


  const handlePickTariffSuggestion = (s: TariffSuggestion) => {
    handleInputChange("TariffaCodice", s.tariffCode);
  };

  // ---------------------------------------------------------------------------
  // 4) Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full w-full flex flex-col gap-4">
      {/* HEADER */}
      <div>
        <h2 className="text-lg font-semibold">
          Parametri BIM – WBS &amp; Codice Tariffa (DATI_WBS)
        </h2>
        <p className="text-sm text-gray-400">
          Seleziona uno o più elementi nel viewer IFC, poi usa questo pannello
          per impostare o aggiornare i parametri custom nel Pset{" "}
          <code>DATI_WBS</code>.
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
                {heatmapEnabled ? "Disattiva heatmap DATI_WBS" : "Attiva heatmap DATI_WBS"}
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
            ),
          )}
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

      {/* STATO SELEZIONE */}
      <div className="rounded-md border border-gray-700 bg-gray-900/40 p-3 text-sm">
        {selectionCount === 0 && (
          <p className="text-gray-400">
            Nessun elemento selezionato. Seleziona uno o più elementi nel
            viewer per compilare i parametri DATI_WBS.
          </p>
        )}

        {selectionCount === 1 && single && (
          <div className="space-y-1">
            <p>
              <span className="font-medium">1 elemento selezionato</span>{" "}
              (modelId: <code>{single.modelId}</code>, localId:{" "}
              <code>{single.localId}</code>).
            </p>
            {single.datiWbs ? (
              <p className="text-gray-400">
                DATI_WBS correnti – WBS0–WBS10 / TariffaCodice verranno
                mostrati nel form qui sotto e possono essere modificati.
              </p>
            ) : (
              <p className="text-gray-400">
                L&apos;elemento non ha ancora un Pset <code>DATI_WBS</code>.
                Verrà creato automaticamente quando applichi i parametri.
              </p>
            )}
          </div>
        )}

        {selectionCount > 1 && (
          <p>
            <span className="font-medium">
              {selectionCount} elementi selezionati
            </span>
            . I valori del form verranno applicati in blocco a tutti gli
            elementi selezionati.
          </p>
        )}
      </div>

      {/* EDITOR DATI_WBS */}
      <div className="flex-1 rounded-md border border-gray-700 bg-gray-900/40 p-3 overflow-auto">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {Array.from({ length: 11 }).map((_, idx) => {
            const key = `WBS${idx}` as keyof DatiWbsProps;
            return (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-300">
                  {key}
                </label>
                <input
                  className="rounded border border-gray-700 bg-gray-950 px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={form[key] ?? ""}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder={`Valore ${key}`}
                />
              </div>
            );
          })}
        </div>

        {/* CAMPO CODICE TARIFFA + SUGGERIMENTI DA PO */}
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-300">
              TariffaCodice
            </label>
            <input
              className="rounded border border-gray-700 bg-gray-950 px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={form.TariffaCodice ?? ""}
              onChange={(e) =>
                handleInputChange("TariffaCodice", e.target.value)
              }
              placeholder="Codice tariffa (es. A.01.01.001)"
            />
          </div>

          {/* BOX SUGGERIMENTI PO */}
          <div className="rounded-md border border-gray-800 bg-gray-950/60 p-2 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-200">
                Suggerimenti da PO
              </span>
              {!hasPo && (
                <span className="text-[11px] text-gray-500">
                  Nessun PO caricato
                </span>
              )}
            </div>

            {!hasPo && (
              <p className="text-gray-500">
                Carica o crea un PO nella sezione dedicata per ottenere
                suggerimenti automatici sui codici tariffa.
              </p>
            )}

            {hasPo && tariffSuggestions.length === 0 && (
              <p className="text-gray-500">
                Nessuna voce PO che combaci con il filtro &quot;
                {tariffInput || "«vuoto»"}
                &quot;.
              </p>
            )}

            {hasPo && tariffSuggestions.length > 0 && (
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {tariffSuggestions.map((s) => (
                  <button
                    key={s.tariffCode}
                    type="button"
                    onClick={() => handlePickTariffSuggestion(s)}
                    className="w-full text-left rounded border border-gray-800 bg-gray-900/60 px-2 py-1 hover:border-emerald-500 hover:bg-gray-900 transition"
                  >
                    <div className="text-[11px] font-semibold text-gray-100">
                      {s.tariffCode}
                    </div>
                    {(s.description || s.unit) && (
                      <div className="text-[11px] text-gray-400">
                        {s.description && <span>{s.description}</span>}
                        {s.description && s.unit && <span> · </span>}
                        {s.unit && <span>UM: {s.unit}</span>}
                        {typeof s.exampleQuantity === "number" && (
                          <span> · Q1: {s.exampleQuantity}</span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {selectedTariff && (
              <div className="pt-1 border-t border-gray-800 mt-1 text-[11px] text-gray-400">
                <span className="font-medium">Elemento selezionato:</span>{" "}
                TariffaCodice = <code>{selectedTariff}</code>.{" "}
                {exactPoMatchesForSelected > 0 ? (
                  <span>
                    Voci PO con lo stesso codice:{" "}
                    <span className="text-emerald-400">
                      {exactPoMatchesForSelected}
                    </span>
                    .
                  </span>
                ) : (
                  <span className="text-amber-400">
                    Nessuna voce PO con questo codice.
                  </span>
                )}
              </div>
            )}
                        {selectedTariff && poMatchesForSelected.length > 0 && (
              <div className="mt-2 text-[11px] text-gray-200 space-y-1">
                <div className="font-semibold">
                  Dettaglio voci PO per TariffaCodice ={" "}
                  <code>{selectedTariff}</code>
                </div>
                <div className="max-h-32 overflow-y-auto border border-gray-800 rounded">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-900">
                        <th className="px-2 py-1 text-left font-semibold">
                          Codice
                        </th>
                        <th className="px-2 py-1 text-left font-semibold">
                          Descrizione
                        </th>
                        <th className="px-2 py-1 text-left font-semibold">
                          UM
                        </th>
                        <th className="px-2 py-1 text-right font-semibold">
                          Q1(p1)
                        </th>
                        <th className="px-2 py-1 text-right font-semibold">
                          CST(p1)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {poMatchesForSelected.map((item) => (
                        <tr key={item.id} className="border-t border-gray-800">
                          <td className="px-2 py-1 align-top">
                            {item.tariffCode ?? "-"}
                          </td>
                          <td className="px-2 py-1 align-top">
                            {item.description ?? "-"}
                          </td>
                          <td className="px-2 py-1 align-top">
                            {item.unit ?? "-"}
                          </td>
                          <td className="px-2 py-1 align-top text-right">
                            {typeof item.baselineQuantity === "number"
                              ? item.baselineQuantity.toFixed(3)
                              : "-"}
                          </td>
                          <td className="px-2 py-1 align-top text-right">
                            {typeof item.baselineAmount === "number"
                              ? item.baselineAmount.toFixed(2)
                              : typeof item.baselineQuantity === "number" &&
                                  typeof item.unitPrice === "number"
                                ? (item.baselineQuantity * item.unitPrice).toFixed(
                                    2,
                                  )
                                : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AZIONI / STATUS */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApplyToSelection}
            disabled={!hasFormValues}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${
              hasFormValues
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-gray-700 text-gray-400 cursor-not-allowed"
            }`}
          >
            Applica a selezione
          </button>
          <button
            type="button"
            onClick={handleResetForm}
            className="rounded px-3 py-1.5 text-sm font-medium border border-gray-600 text-gray-200 hover:bg-gray-800"
          >
            Svuota campi DATI_WBS
          </button>
        </div>

        {status && (
          <div className="text-xs text-gray-300 bg-gray-900/60 border border-gray-700 rounded px-2 py-1">
            {status}
          </div>
        )}
      </div>
    </div>
  );
};
