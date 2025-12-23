// src/modules/impostazioni/WbsSettingsPanel.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  bulkUpsertWbsAllowedValues,
  listWbsAllowedValues,
  requireProjectId,
  type WbsAllowedValueDto,
  promoteInvalidWbsAssignmentsV2,
} from "@core/api/aederaApi";
import { ALL_WBS_LEVEL_KEYS, type WbsLevelKey } from "@core/bim/datiWbsProfile";
import { useProjects } from "@core/projects/ProjectContext";
import { getActiveModelId } from "@core/bim/modelRegistry";
import { hydrateBimMappingForModel } from "@core/bim/selectionAdapter";

type Row = {
  id?: string;
  levelKey: WbsLevelKey;
  code: string;
  name: string;
  sortIndex: number;
  isActive: boolean;
  _dirty?: boolean;
  _error?: string | null;
};

function parseCsv(text: string): Array<Pick<Row, "code" | "name" | "sortIndex" | "isActive">> {
  // CSV semplice: code;name;sortIndex;isActive  (separatori: ; o ,)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const out: Array<Pick<Row, "code" | "name" | "sortIndex" | "isActive">> = [];

  for (const line of lines) {
    const sep = line.includes(";") ? ";" : ",";
    const parts = line.split(sep).map((p) => p.trim());

    const code = parts[0] ?? "";
    const name = parts[1] ?? "";
    const sortIndex = Number.isFinite(Number(parts[2])) ? Number(parts[2]) : 0;

    let isActive = true;
    if (parts.length >= 4) {
      const v = String(parts[3]).toLowerCase();
      isActive = v === "true" || v === "1" || v === "si" || v === "yes" || v === "y";
    }

    if (code.trim()) out.push({ code: code.trim(), name, sortIndex, isActive });
  }

  return out;
}

function toCsv(rows: Row[]) {
  const header = "code;name;sortIndex;isActive";
  const lines = rows.map((r) => {
    const code = (r.code ?? "").replaceAll(";", " ");
    const name = (r.name ?? "").replaceAll(";", " ");
    return `${code};${name};${Number(r.sortIndex ?? 0)};${r.isActive ? "true" : "false"}`;
  });
  return [header, ...lines].join("\n");
}

export const WbsSettingsPanel: React.FC = () => {
  const { currentProjectId } = useProjects();
  const projectId = currentProjectId ?? null;

  if (!projectId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-[13px] font-semibold text-slate-900">Impostazioni WBS v2</div>
        <div className="mt-1 text-[11px] text-slate-500">
          Seleziona un progetto per gestire i valori ammessi.
        </div>
      </div>
    );
  }

  const [levelKey, setLevelKey] = useState<WbsLevelKey>("WBS6");
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const [csvText, setCsvText] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

  const load = async (lvl: WbsLevelKey) => {
    setIsLoading(true);
    setStatus(null);
    try {
      const resp = await listWbsAllowedValues(projectId, { levels: [lvl] });
      const items = (resp.items ?? []) as WbsAllowedValueDto[];

      const mapped: Row[] = items.map((v) => ({
        id: v.id,
        levelKey: v.levelKey as WbsLevelKey,
        code: v.code ?? "",
        name: v.name ?? "",
        sortIndex: Number(v.sortIndex ?? 0),
        isActive: !!v.isActive,
        _dirty: false,
        _error: null,
      }));

      setRows(mapped);
    } catch (e: any) {
      setStatus(e?.message ?? "Errore caricamento");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromote = async () => {
    if (!projectId) return;

    setStatus(null);
    setIsPromoting(true);

    try {
      // 1) preview
      const preview = await promoteInvalidWbsAssignmentsV2(projectId, {
        levelKey,
        dryRun: true,
      });

      const count = preview.promoted ?? 0;

      if (count <= 0) {
        setStatus("Nessun INVALID corrisponde ai valori ammessi attivi per questo livello.");
        return;
      }

      const ok = window.confirm(
        `Trovati ${count} assignment INVALID promuovibili su ${levelKey}.\nVuoi promuoverli a VALID?`,
      );
      if (!ok) {
        setStatus("Operazione annullata.");
        return;
      }

      // 2) execute
      const done = await promoteInvalidWbsAssignmentsV2(projectId, {
        levelKey,
        dryRun: false,
      });

      setStatus(`Promossi: ${done.promoted} (scansionati: ${done.scanned}).`);

      // refresh allowed-values (non strettamente necessario) + tabella
      await load(levelKey);

      // Aggiorniamo l’overlay senza refresh pagina:
      const activeModelId = getActiveModelId();
      if (activeModelId) {
        await hydrateBimMappingForModel(activeModelId, projectId);
      }
    } catch (e: any) {
      setStatus(e?.message ?? "Errore durante la promozione.");
    } finally {
      setIsPromoting(false);
    }
  };


  useEffect(() => {
    void load(levelKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);

  const validate = (input: Row[]) => {
    const next = input.map((r) => ({ ...r, _error: null as any }));
    const seen = new Map<string, number[]>();

    next.forEach((r, idx) => {
      const code = r.code.trim();
      if (!code) {
        r._error = "code obbligatorio";
        return;
      }
      const key = code.toLowerCase();
      const arr = seen.get(key) ?? [];
      arr.push(idx);
      seen.set(key, arr);
    });

    for (const [_, idxs] of seen.entries()) {
      if (idxs.length <= 1) continue;
      for (const idx of idxs) {
        next[idx]._error = "duplicato nello stesso livello";
      }
    }

    return next;
  };

  const validatedRows = useMemo(() => validate(rows), [rows]);
  const hasErrors = validatedRows.some((r) => !!r._error);

  const handleChange = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, _dirty: true };
      return next;
    });
  };

  const handleAdd = () => {
    setRows((prev) => [
      {
        levelKey,
        code: "",
        name: "",
        sortIndex: prev.length ? Math.max(...prev.map((r) => r.sortIndex ?? 0)) + 10 : 0,
        isActive: true,
        _dirty: true,
        _error: null,
      },
      ...prev,
    ]);
  };

  const handleSave = async () => {
    setStatus(null);
    const checked = validate(rows);
    setRows(checked);

    if (checked.some((r) => !!r._error)) {
      setStatus("Correggi gli errori prima di salvare.");
      return;
    }

    const dirty = checked.filter((r) => r._dirty);
    if (!dirty.length) {
      setStatus("Nessuna modifica da salvare.");
      return;
    }

    try {
      setIsLoading(true);
      const payload = {
        items: dirty.map((r) => ({
          levelKey: r.levelKey,
          code: r.code.trim(),
          name: r.name.trim() ? r.name.trim() : null,
          sortIndex: Number(r.sortIndex ?? 0),
          isActive: !!r.isActive,
        })),
      };

      const resp = await bulkUpsertWbsAllowedValues(projectId, payload);
      setStatus(`Salvati: ${resp.upserted}`);

      await load(levelKey);
    } catch (e: any) {
      setStatus(e?.message ?? "Errore salvataggio");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = () => {
    const text = toCsv(validatedRows);
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectId}_${levelKey}_allowed-values.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = async () => {
    const parsed = parseCsv(csvText);
    if (!parsed.length) {
      setStatus("CSV vuoto o non valido.");
      return;
    }

    // merge: code -> upsert locale
    const byCode = new Map<string, Row>();
    for (const r of rows) byCode.set(r.code.trim().toLowerCase(), r);

    for (const p of parsed) {
      const k = p.code.trim().toLowerCase();
      const prev = byCode.get(k);

      if (prev) {
        byCode.set(k, {
          ...prev,
          name: p.name ?? prev.name,
          sortIndex: Number(p.sortIndex ?? prev.sortIndex ?? 0),
          isActive: p.isActive ?? prev.isActive,
          _dirty: true,
        });
      } else {
        byCode.set(k, {
          levelKey,
          code: p.code.trim(),
          name: p.name ?? "",
          sortIndex: Number(p.sortIndex ?? 0),
          isActive: !!p.isActive,
          _dirty: true,
        });
      }
    }

    const merged = Array.from(byCode.values()).sort(
      (a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0) || a.code.localeCompare(b.code),
    );

    setRows(merged);
    setStatus(`Import CSV: ${parsed.length} righe caricate (da salvare).`);
    setIsImportOpen(false);
    setCsvText("");
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-900">Impostazioni WBS v2</div>
          <div className="text-[11px] text-slate-500">
            Gestione valori ammessi per livello (dropdown overlay + validazione import IFC).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={levelKey}
            onChange={(e) => setLevelKey(e.target.value as WbsLevelKey)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px]"
          >
            {ALL_WBS_LEVEL_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px] hover:bg-slate-50"
          >
            + Riga
          </button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportOpen((v) => !v)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px] hover:bg-slate-50"
          >
            Import CSV
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px] hover:bg-slate-50"
          >
            Esporta CSV
          </button>

          <button
            type="button"
            onClick={handlePromote}
            disabled={isLoading || isPromoting}
            className={[
              "rounded-md px-2 py-1 text-[12px] border",
              isLoading || isPromoting
                ? "border-slate-200 bg-slate-100 text-slate-400"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
            ].join(" ")}
          >
            Promuovi INVALID → VALID
          </button>

        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || hasErrors}
          className={[
            "rounded-md px-3 py-1 text-[12px] font-semibold text-white",
            isLoading || hasErrors ? "bg-slate-300" : "bg-sky-600 hover:bg-sky-700",
          ].join(" ")}
        >
          Salva
        </button>
      </div>

      {isImportOpen && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-1 text-[11px] font-semibold text-slate-800">
            Import CSV (code;name;sortIndex;isActive)
          </div>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-slate-300 bg-white p-2 text-[11px] font-mono"
            placeholder="Esempio:
LFO;Lavori fuori opera;10;true
FIS;Finiture;20;true"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsImportOpen(false);
                setCsvText("");
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px] hover:bg-slate-50"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleImportCsv}
              className="rounded-md bg-amber-500 px-3 py-1 text-[12px] font-semibold text-white hover:bg-amber-600"
            >
              Carica in tabella
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
          {status}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-slate-50 text-[11px] text-slate-600">
            <tr>
              <th className="px-2 py-2 w-[120px]">code</th>
              <th className="px-2 py-2">name</th>
              <th className="px-2 py-2 w-[90px]">sort</th>
              <th className="px-2 py-2 w-[80px]">active</th>
              <th className="px-2 py-2 w-[220px]">stato</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-2 py-3 text-[11px] text-slate-500">
                  Caricamento...
                </td>
              </tr>
            )}

            {!isLoading && validatedRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-3 text-[11px] text-slate-500">
                  Nessun valore ammesso per {levelKey}. Aggiungi righe o importa CSV.
                </td>
              </tr>
            )}

            {!isLoading &&
              validatedRows.map((r, idx) => (
                <tr key={`${r.id ?? "new"}-${idx}`} className="border-t border-slate-100">
                  <td className="px-2 py-2">
                    <input
                      value={r.code}
                      onChange={(e) => handleChange(idx, { code: e.target.value })}
                      className={[
                        "w-full rounded-md border px-2 py-1 font-mono text-[12px]",
                        r._error ? "border-rose-400" : "border-slate-200",
                      ].join(" ")}
                      placeholder="code"
                    />
                  </td>

                  <td className="px-2 py-2">
                    <input
                      value={r.name}
                      onChange={(e) => handleChange(idx, { name: e.target.value })}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-[12px]"
                      placeholder="descrizione"
                    />
                  </td>

                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={r.sortIndex}
                      onChange={(e) => handleChange(idx, { sortIndex: Number(e.target.value) })}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-[12px] font-mono"
                    />
                  </td>

                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={r.isActive}
                      onChange={(e) => handleChange(idx, { isActive: e.target.checked })}
                      className="h-4 w-4"
                    />
                  </td>

                  <td className="px-2 py-2 text-[11px]">
                    {r._error ? (
                      <span className="text-rose-600">{r._error}</span>
                    ) : r._dirty ? (
                      <span className="text-amber-600">modificato</span>
                    ) : (
                      <span className="text-slate-400">ok</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[10px] text-slate-500">
        Suggerimento: quando correggi i valori ammessi, ricarica il modello o riesegui l’import per vedere diminuire gli
        <span className="font-mono"> INVALID/rawCode</span>.
      </div>
    </div>
  );
};
