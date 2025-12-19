import React, { useEffect, useMemo, useState } from "react";
import {
  getSelectedElementsWithBimMapping,
  applyBimMappingToSelection,
  type SelectedElementWithBimMapping,
} from "@core/bim/selectionAdapter";
import { listSuppliers, type SupplierDto } from "@core/api/aederaApi";
import { useProjects } from "@core/projects/ProjectContext";

type FieldKey =
  | "wbsNodeId"
  | "tariffaCodice"
  | "pacchettoCodice"
  | "codiceMateriale"
  | "fornitoreId";

type OverlayInfo = {
  key: FieldKey;
  label: string;
  valueLabel: string; // "", "varie" o valore unico
};

type LevelEditState = {
  key: FieldKey;
  label: string;
  required: boolean;
  initialValue: string; // se mixed => ""
  isMixed: boolean;
  value: string;
};

const FIELDS: Array<{ key: FieldKey; label: string; required?: boolean }> = [
  { key: "wbsNodeId", label: "WBS (nodeId)" },
  { key: "tariffaCodice", label: "Codice tariffa", required: true },
  { key: "pacchettoCodice", label: "Codice pacchetto" },
  { key: "codiceMateriale", label: "Codice materiale" },
  { key: "fornitoreId", label: "Fornitore" },
];

function computeValueLabel(values: string[]): { label: string; uniqueValue: string | null } {
  const nonEmpty = values.map((v) => v.trim()).filter((v) => v !== "");
  if (!nonEmpty.length) return { label: "", uniqueValue: null };

  const uniq = new Set(nonEmpty);
  if (uniq.size === 1) {
    const v = [...uniq][0];
    return { label: v, uniqueValue: v };
  }
  return { label: "varie", uniqueValue: null };
}

export const BimMappingSelectionOverlay: React.FC = () => {
  const { currentProjectId } = useProjects();
  const projectId = currentProjectId ?? null;

  const [selectionCount, setSelectionCount] = useState(0);
  const [levels, setLevels] = useState<OverlayInfo[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editLevels, setEditLevels] = useState<LevelEditState[] | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const supplierById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers],
  );

  // Ricarica suppliers (solo per mostrare label leggibile nel read-only)
  useEffect(() => {
    let disposed = false;
    async function load() {
      if (!projectId) return;
      try {
        const rows = await listSuppliers(projectId);
        if (!disposed) setSuppliers(rows);
      } catch {
        if (!disposed) setSuppliers([]);
      }
    }
    void load();
    return () => {
      disposed = true;
    };
  }, [projectId]);

  // Aggiorna read-only snapshot della selezione.
  // Nota: usiamo un poll leggero come nel vecchio overlay per rimanere sincronizzati col viewer.
  useEffect(() => {
    let disposed = false;

    if (isEditing) {
      return () => {
        disposed = true;
      };
    }

    const tick = async () => {
      const selected: SelectedElementWithBimMapping[] = await getSelectedElementsWithBimMapping();
      if (disposed) return;

      setSelectionCount(selected.length);

      const infos: OverlayInfo[] = FIELDS.map((f) => {
        const rawValues = selected.map((it) => {
          const raw = (it as any)[f.key];
          if (raw == null) return "";
          if (f.key === "fornitoreId") {
            const id = String(raw).trim();
            if (!id) return "";
            const name = supplierById.get(id)?.name;
            return name ? name : id;
          }
          return String(raw).trim();
        });

        const { label } = computeValueLabel(rawValues);
        return { key: f.key, label: f.label, valueLabel: label };
      });

      setLevels(infos);
    };

    void tick();
    const id = window.setInterval(tick, 400);

    return () => {
      disposed = true;
      window.clearInterval(id);
    };
  }, [isEditing, supplierById]);

  // Se non c'è selezione e non abbiamo livelli da mostrare: non renderizzare nulla
  if (!levels.length && selectionCount === 0) return null;

  const hasSelection = selectionCount > 0;

  const handleStartEdit = () => {
    if (!hasSelection) return;

    const nextEdit: LevelEditState[] = levels.map((lvl) => {
      const isMixed = lvl.valueLabel === "varie";
      const required = !!FIELDS.find((f) => f.key === lvl.key)?.required;
      const initialValue = isMixed ? "" : (lvl.valueLabel || "");

      return {
        key: lvl.key,
        label: lvl.label,
        required,
        isMixed,
        initialValue,
        value: initialValue,
      };
    });

    setEditLevels(nextEdit);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditLevels(null);
  };

  const handleChangeLevel = (key: FieldKey, value: string) => {
    if (!editLevels) return;
    setEditLevels(editLevels.map((lvl) => (lvl.key === key ? { ...lvl, value } : lvl)));
  };

  const handleApply = async () => {
    if (!editLevels || !editLevels.length) {
      setIsEditing(false);
      setEditLevels(null);
      return;
    }

    // costruisci patch solo sui campi cambiati
    const patch: {
      wbsNodeId?: string | null;
      tariffaCodice?: string | null;
      pacchettoCodice?: string | null;
      codiceMateriale?: string | null;
      fornitoreId?: string | null;
    } = {};

    for (const lvl of editLevels) {
      const next = lvl.value.trim();
      const initial = lvl.initialValue.trim();

      if (next === initial) continue;

      // Se era mixed e lasci vuoto => non cambiare nulla
      if (lvl.isMixed && next === "") continue;

      // Vuoto => cancella
      (patch as any)[lvl.key] = next ? next : null;
    }

    if (!Object.keys(patch).length) {
      setIsEditing(false);
      setEditLevels(null);
      return;
    }

    try {
      setIsApplying(true);
      await applyBimMappingToSelection(patch);
    } catch (error) {
      console.error("[BimMappingSelectionOverlay] apply failed", { patch, error });
    } finally {
      setIsApplying(false);
      setIsEditing(false);
      setEditLevels(null);
    }
  };

  const hasErrors =
    isEditing &&
    editLevels?.some((lvl) => lvl.required && !lvl.value.trim() && !lvl.isMixed);

  return (
    <div className="absolute left-3 top-3 z-20 w-[320px] text-[11px] text-slate-800 pointer-events-auto">
      <div className="rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm px-3 py-2.5">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-semibold text-slate-900">BIM Mapping selezione</span>
            <span className="text-[10px] text-slate-500">
              {hasSelection
                ? `${selectionCount} elemento${selectionCount === 1 ? "" : "i"} selezionato${
                    selectionCount === 1 ? "" : "i"
                  }`
                : "Nessuna selezione"}
            </span>
          </div>

          {!isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              disabled={!hasSelection}
              className={[
                "inline-flex items-center rounded-md border px-2 py-[3px] text-[10px] font-medium",
                hasSelection
                  ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  : "border-slate-200 bg-slate-50 text-slate-400 cursor-default",
              ].join(" ")}
            >
              Modifica
            </button>
          )}
        </div>

        {/* Read-only */}
        {!isEditing && (
          <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1">
            {levels.map((lvl) => (
              <React.Fragment key={lvl.key}>
                <div className="truncate text-[10px] text-slate-500">
                  {lvl.label}
                  {FIELDS.find((f) => f.key === lvl.key)?.required ? " *" : ""}
                </div>
                <div
                  className={[
                    "truncate font-mono",
                    lvl.valueLabel === "varie" ? "text-amber-500" : "text-slate-800",
                  ].join(" ")}
                  title={
                    lvl.valueLabel === "varie"
                      ? "Valori diversi nella selezione"
                      : lvl.valueLabel || ""
                  }
                >
                  {lvl.valueLabel === "varie" ? "varie" : lvl.valueLabel || "—"}
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Editing */}
        {isEditing && editLevels && (
          <>
            <div className="max-h-72 overflow-y-auto pr-1">
              <div className="mt-1 grid grid-cols-[auto,1fr] gap-x-2 gap-y-2">
                {editLevels.map((lvl) => {
                  const isEmpty = !lvl.value.trim();
                  const showError = lvl.required && isEmpty && !lvl.isMixed;

                  return (
                    <React.Fragment key={lvl.key}>
                      <label className="pt-[3px] text-[10px] text-slate-500" htmlFor={`bm-${lvl.key}`}>
                        {lvl.label}
                        {lvl.required ? " *" : ""}
                      </label>
                      <div className="flex flex-col gap-1">
                        {lvl.key === "fornitoreId" ? (
                        <select
                          id={`bm-${lvl.key}`}
                          value={lvl.value}
                          onChange={(e) => handleChangeLevel(lvl.key, e.target.value)}
                          className={[
                            "w-full rounded-md border px-2 py-[2px] text-[11px] bg-white",
                            "focus:outline-none focus:ring-1",
                            showError
                              ? "border-rose-400 focus:ring-rose-400"
                              : "border-slate-300 focus:ring-sky-500 focus:border-sky-500",
                          ].join(" ")}
                        >
                          {/* Vuoto = cancella */}
                          <option value="">—</option>

                          {/* Se mixed e non hai scelto niente, lascialo vuoto (non cambiare) */}
                          {lvl.isMixed && <option value="">varie (lascia vuoto per non cambiare)</option>}

                          {suppliers
                            .filter((s) => s.isActive)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <input
                          id={`bm-${lvl.key}`}
                          type="text"
                          value={lvl.value}
                          onChange={(e) => handleChangeLevel(lvl.key, e.target.value)}
                          className={[
                            "w-full rounded-md border px-2 py-[2px] text-[11px] font-mono bg-white",
                            "focus:outline-none focus:ring-1",
                            showError
                              ? "border-rose-400 focus:ring-rose-400"
                              : "border-slate-300 focus:ring-sky-500 focus:border-sky-500",
                          ].join(" ")}
                          placeholder={lvl.isMixed ? "varie (lascia vuoto per non cambiare)" : ""}
                        />
                      )}

                        {lvl.isMixed && (
                          <span className="text-[9px] text-amber-500">
                            nella selezione ci sono valori diversi
                          </span>
                        )}
                        {showError && (
                          <span className="text-[9px] text-rose-500">campo obbligatorio</span>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="mt-2 text-[9px] text-slate-500">
                Nota: per <span className="font-mono">fornitoreId</span> inserisci l&apos;ID (per ora).
                Se vuoi il picker multi-select come prima, lo rimettiamo dopo, ma prima consolidiamo il modello dati.
              </div>
            </div>

            {/* Footer azioni */}
            <div className="mt-2 flex items-center justify-between gap-2">
              {hasErrors && (
                <div className="text-[9px] text-rose-500">
                  Compila tutti i campi obbligatori contrassegnati con *.
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isApplying}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-[3px] text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isApplying}
                  className={[
                    "inline-flex items-center rounded-md px-3 py-[3px] text-[10px] font-semibold text-white shadow-sm",
                    isApplying ? "bg-amber-500" : "bg-amber-400 hover:bg-amber-500",
                  ].join(" ")}
                >
                  {isApplying ? "Aggiornamento..." : "Aggiorna selezione"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
