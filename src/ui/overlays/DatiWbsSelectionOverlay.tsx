import React, { useEffect, useState, useMemo } from "react";
import {
  getSelectedElementsWithDatiWbs,
  applyDatiWbsToSelection,
  type SelectedElementWithDatiWbs,
} from "@core/bim/selectionAdapter";
import type { DatiWbsProps } from "@core/bim/modelProperties";
import { useDatiWbsProfile } from "../../hooks/useDatiWbsProfile";
import type { DatiWbsProfile } from "../../core/bim/datiWbsProfile";
import { useCurrentProject } from "@core/projects/ProjectContext";
import { bulkGetElementParams, setElementParamValue, listSuppliers, type SupplierDto } from "@core/api/aederaApi";


type DatiEditKey = keyof DatiWbsProps;

function getActiveDatiKeys(profile: DatiWbsProfile): DatiEditKey[] {
  const activeWbsKeys = profile.levels
    .filter((lvl) => lvl.enabled)
    .map((lvl) => lvl.key) as DatiEditKey[];

  return [...activeWbsKeys, "TariffaCodice", "PacchettoCodice"];
}

interface OverlayLevelInfo {
  key: DatiEditKey;
  label: string;
  valueLabel: string; // "", "varie" o valore unico
}

interface LevelEditState {
  key: DatiEditKey;
  label: string;
  required: boolean;
  initialValue: string;
  isMixed: boolean;
  value: string;
}

// Label UI per ciascun campo
function getKeyLabel(profile: DatiWbsProfile, key: DatiEditKey): string {
  if (key === "TariffaCodice") return "Codice tariffa";
  if (key === "PacchettoCodice") return "Codice pacchetto";

  const cfg = profile.levels.find((lvl) => lvl.key === key);
  return cfg?.label ?? key;
}

// Flag di obbligatorietà da profilo
function isKeyRequired(profile: DatiWbsProfile, key: DatiEditKey): boolean {
  if (key === "TariffaCodice") {
    return profile.requireTariffaCodice;
  }
  if (key === "PacchettoCodice") {
    return !!profile.requirePacchettoCodice; // per ora probabilmente false
  }

  const cfg = profile.levels.find((lvl) => lvl.key === key);
  return cfg?.required ?? false;
}


function getGlobalId(item: any): string | null {
  return item?.ifcGlobalId ?? null;
}


export const DatiWbsSelectionOverlay: React.FC = () => {
  const [profile] = useDatiWbsProfile();
  const [selectionCount, setSelectionCount] = useState(0);
  const [levels, setLevels] = useState<OverlayLevelInfo[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editLevels, setEditLevels] = useState<LevelEditState[] | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const project = useCurrentProject();
  const projectId = project?.id ?? null;

  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const supplierById = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  const [extraValueLabel, setExtraValueLabel] = useState<{ fornitore: string; codiceMateriale: string }>({
    fornitore: "",
    codiceMateriale: "",
  });

  const [extraRawValues, setExtraRawValues] = useState<{
    fornitore: string[] | null;
    codiceMateriale: string | null;
  }>({
    fornitore: null,
    codiceMateriale: null,
  });

  const [extraEdit, setExtraEdit] = useState<{
    fornitore: { isMixed: boolean; initial: string[]; value: string[] };
    codiceMateriale: { isMixed: boolean; initial: string; value: string };
  } | null>(null);

  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);


  useEffect(() => {
    let disposed = false;

    if (isEditing) {
      return () => {
        disposed = true;
      };
    }

    const tick = async () => {
      const selected: SelectedElementWithDatiWbs[] =
        await getSelectedElementsWithDatiWbs();
      if (disposed) return;

      setSelectionCount(selected.length);

      const globalIds = selected
        .map((it) => getGlobalId(it))
        .filter((x): x is string => !!x);

      if (projectId && globalIds.length) {
        try {
          const resp = await bulkGetElementParams(projectId, {
            globalIds,
            keys: ["fornitore", "codiceMateriale"],
          });

          // fornitore: array di supplierId[]
          const supplierSets = globalIds.map((gid) => {
            const raw = resp.values?.[gid]?.["fornitore"];
            const ids = Array.isArray(raw) ? raw.filter((v) => typeof v === "string") : [];
            // normalizza e ordina per confronto stabile
            return ids.slice().sort();
          });

          const codiceVals = globalIds.map((gid) => {
            const raw = resp.values?.[gid]?.["codiceMateriale"];
            return typeof raw === "string" ? raw.trim() : "";
          });


          // label fornitore
          const nonEmptySets = supplierSets.filter((arr) => arr.length > 0);
          let fornitoreLabel = "";
          if (!nonEmptySets.length) {
            fornitoreLabel = "";
          } else {
            const key0 = JSON.stringify(nonEmptySets[0]);
            const allSame = nonEmptySets.every((s) => JSON.stringify(s) === key0);
            if (!allSame) {
              fornitoreLabel = "varie";
            } else {
              const names = nonEmptySets[0]
                .map((id) => supplierById.get(id)?.name ?? id)
                .join(", ");
              fornitoreLabel = names || "";
            }
          }

          // label codiceMateriale
          const nonEmptyCod = codiceVals.filter((v) => v !== "");
          let codiceLabel = "";
          if (!nonEmptyCod.length) codiceLabel = "";
          else {
            const uniq = new Set(nonEmptyCod);
            codiceLabel = uniq.size === 1 ? [...uniq][0] : "varie";
          }

          // raw values (per edit prefill)
          let rawFornitore: string[] | null = null;
          if (nonEmptySets.length) {
            const key0 = JSON.stringify(nonEmptySets[0]);
            const allSame = nonEmptySets.every((s) => JSON.stringify(s) === key0);
            if (allSame) {
              rawFornitore = nonEmptySets[0];
            }
          }

          let rawCodice: string | null = null;
          if (nonEmptyCod.length) {
            const uniq = new Set(nonEmptyCod);
            if (uniq.size === 1) rawCodice = [...uniq][0];
          }

          setExtraRawValues({
            fornitore: rawFornitore,
            codiceMateriale: rawCodice,
          });

          setExtraValueLabel({ fornitore: fornitoreLabel, codiceMateriale: codiceLabel });
        } catch {
          setExtraValueLabel({ fornitore: "", codiceMateriale: "" });
        }
      } else {
        setExtraValueLabel({ fornitore: "", codiceMateriale: "" });
      }

      const activeKeys = getActiveDatiKeys(profile);

      if (!selected.length) {
        const emptyLevels: OverlayLevelInfo[] = activeKeys.map((key) => ({
          key,
          label: getKeyLabel(profile, key),
          valueLabel: "",
        }));
        setLevels(emptyLevels);
        return;
      }

      const infos: OverlayLevelInfo[] = activeKeys.map((key) => {
        const values: string[] = [];

        for (const item of selected) {
          const raw = item.datiWbs?.[key];
          const v = raw == null ? "" : String(raw).trim();
          values.push(v);
        }

        const nonEmpty = values.filter((v) => v !== "");
        let valueLabel: string;

        if (!nonEmpty.length) {
          valueLabel = "";
        } else {
          const uniq = new Set(nonEmpty);
          valueLabel = uniq.size === 1 ? [...uniq][0] : "varie";
        }

        return {
          key,
          label: getKeyLabel(profile, key),
          valueLabel,
        };
      });

      setLevels(infos);
    };

    void tick();
    const id = window.setInterval(tick, 400);

    return () => {
      disposed = true;
      window.clearInterval(id);
    };
  }, [isEditing, profile]);


  useEffect(() => {
    let disposed = false;
    async function load() {
      if (!projectId) return;
      try {
        const rows = await listSuppliers(projectId);
        if (!disposed) setSuppliers(rows);
      } catch {
        // silenzioso: se fallisce vedrai comunque errori quando provi a salvare
        if (!disposed) setSuppliers([]);
      }
    }
    void load();
    return () => { disposed = true; };
  }, [projectId]);


  if (!levels.length && selectionCount === 0) {
    return null;
  }

  const hasSelection = selectionCount > 0;

  const handleStartEdit = () => {
    if (!selectionCount) return;

    const nextEditLevels: LevelEditState[] = levels.map((lvl) => {
      const isMixed = lvl.valueLabel === "varie";
      const initialValue = isMixed ? "" : (lvl.valueLabel || "");
      const required = isKeyRequired(profile, lvl.key);

      return {
        key: lvl.key,
        label: lvl.label,
        required,
        isMixed,
        initialValue,
        value: initialValue,
      };
    });

    setEditLevels(nextEditLevels);

    const fornitoreIsMixed = extraValueLabel.fornitore === "varie";
    const fornitoreInitial =
      !fornitoreIsMixed && extraRawValues.fornitore
        ? [...extraRawValues.fornitore]
        : [];


    const codiceIsMixed = extraValueLabel.codiceMateriale === "varie";
    const codiceInitial = codiceIsMixed ? "" : (extraValueLabel.codiceMateriale || "");

    setExtraEdit({
      fornitore: {
        isMixed: fornitoreIsMixed,
        initial: fornitoreInitial,
        value: fornitoreInitial,
      },
      codiceMateriale: {
        isMixed: codiceIsMixed,
        initial: codiceInitial,
        value: codiceInitial,
      },
    });

    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditLevels(null);
    setSupplierPickerOpen(false);
    setExtraEdit(null);
  };

  const handleChangeLevel = (key: DatiEditKey, value: string) => {
    if (!editLevels) return;
    setEditLevels(
      editLevels.map((lvl) =>
        lvl.key === key ? { ...lvl, value } : lvl,
      ),
    );
  };

  const handleApply = async () => {
    if (!editLevels || !editLevels.length) {
      setIsEditing(false);
      return;
    }

    const patch: Partial<DatiWbsProps> = {};

    for (const lvl of editLevels) {
      const next = lvl.value.trim();
      const initial = lvl.initialValue.trim();

      if (next === initial) continue;

      if (!next) {
        if (initial) {
          patch[lvl.key] = null;
        } else {
          if (lvl.isMixed) continue;
        }
      } else {
        patch[lvl.key] = next;
      }
    }

    const hasWbsPatch = Object.keys(patch).length > 0;

    const hasExtraPatch =
      !!extraEdit &&
      (
        // Codice materiale: scrivi se diverso dall’iniziale (anche per cancellare)
        extraEdit.codiceMateriale.value.trim() !== extraEdit.codiceMateriale.initial.trim() ||
        // Fornitore: scrivi se diverso dall’iniziale (anche per cancellare)
        JSON.stringify([...extraEdit.fornitore.value].sort()) !== JSON.stringify([...extraEdit.fornitore.initial].sort())
      );

    if (!hasWbsPatch && !hasExtraPatch) {
      setIsEditing(false);
      setEditLevels(null);
      setSupplierPickerOpen(false);
      setExtraEdit(null);
      return;
    }


    try {
      setIsApplying(true);
      if (hasWbsPatch) {
        await applyDatiWbsToSelection(patch);
      }

      // Applica parametri extra (codiceMateriale + fornitore) ai selezionati
      if (projectId) {
        const selected = await getSelectedElementsWithDatiWbs();
        const globalIds = selected.map(getGlobalId).filter((x): x is string => !!x);
        if (selected.length > 0 && globalIds.length === 0) {
          console.warn("[Overlay] Nessun ifcGlobalId trovato nella selezione. Probabile: proprietà non ancora indicizzate o modello non estratto.");
        }

        const tasks: Promise<any>[] = [];

        if (extraEdit) {
          const nextCod = extraEdit.codiceMateriale.value.trim();
          const shouldWriteCod =
            (!extraEdit.codiceMateriale.isMixed && nextCod !== extraEdit.codiceMateriale.initial.trim()) ||
            (extraEdit.codiceMateriale.isMixed && nextCod !== "");

          const nextSup = extraEdit.fornitore.value;
          const shouldWriteSup =
            JSON.stringify([...nextSup].sort()) !== JSON.stringify([...extraEdit.fornitore.initial].sort());

          for (const gid of globalIds) {
            if (shouldWriteCod) {
              tasks.push(setElementParamValue(projectId, gid, "codiceMateriale", nextCod || null));
            }
            if (shouldWriteSup) {
              tasks.push(setElementParamValue(projectId, gid, "fornitore", nextSup));
            }
          }
        }

        if (tasks.length) {
          await Promise.all(tasks);
        }
      }
    } catch (error) {
      console.error(
        "[DATI_WBS] Errore durante l'applicazione alla selezione",
        { patch, error },
      );
    } finally {
      setIsApplying(false);
      setIsEditing(false);
      setEditLevels(null);
      setSupplierPickerOpen(false);
      setExtraEdit(null);
    }
  };

  const hasErrors =
    isEditing &&
    editLevels?.some((lvl) => lvl.required && !lvl.value.trim());

  return (
    <div className="absolute left-3 top-3 z-20 w-[320px] text-[11px] text-slate-800 pointer-events-auto">
      <div className="rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm px-3 py-2.5">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-semibold text-slate-900">
              DATI_WBS selezione
            </span>
            <span className="text-[10px] text-slate-500">
              {hasSelection
                ? `${selectionCount} elemento${
                    selectionCount === 1 ? "" : "i"
                  } selezionato${
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
                  {isKeyRequired(profile, lvl.key) ? " *" : ""}
                </div>
                <div
                  className={[
                    "truncate font-mono",
                    lvl.valueLabel === "varie"
                      ? "text-amber-500"
                      : "text-slate-800",
                  ].join(" ")}
                  title={
                    lvl.valueLabel === "varie"
                      ? "Valori diversi nella selezione"
                      : lvl.valueLabel || ""
                  }
                >
                  {lvl.valueLabel === "varie"
                    ? "varie"
                    : lvl.valueLabel || "—"}
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        {!isEditing && (
          <>
            <div className="mt-2 pt-2 border-t border-slate-200">
              <div className="text-[10px] font-semibold text-slate-600 mb-1">Parametri extra</div>

              <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1">
                <div className="truncate text-[10px] text-slate-500">Codice materiale</div>
                <div className={["truncate font-mono", extraValueLabel.codiceMateriale === "varie" ? "text-amber-500" : "text-slate-800"].join(" ")}>
                  {extraValueLabel.codiceMateriale === "varie" ? "varie" : (extraValueLabel.codiceMateriale || "—")}
                </div>

                <div className="truncate text-[10px] text-slate-500">Fornitore</div>
                <div className={["truncate", extraValueLabel.fornitore === "varie" ? "text-amber-500" : "text-slate-800"].join(" ")}>
                  {extraValueLabel.fornitore === "varie" ? "varie" : (extraValueLabel.fornitore || "—")}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Editing */}
        {isEditing && editLevels && (
          <>
            <div className="max-h-72 overflow-y-auto pr-1">
              <div className="mt-1 grid grid-cols-[auto,1fr] gap-x-2 gap-y-2">
                {editLevels.map((lvl) => {
                  const isEmpty = !lvl.value.trim();
                  const showError = lvl.required && isEmpty;

                  return (
                    <React.Fragment key={lvl.key}>
                      <label
                        className="pt-[3px] text-[10px] text-slate-500"
                        htmlFor={`wbs-${lvl.key}`}
                      >
                        {lvl.label}
                        {lvl.required ? " *" : ""}
                      </label>
                      <div className="flex flex-col gap-1">
                        <input
                          id={`wbs-${lvl.key}`}
                          type="text"
                          value={lvl.value}
                          onChange={(e) =>
                            handleChangeLevel(lvl.key, e.target.value)
                          }
                          className={[
                            "w-full rounded-md border px-2 py-[2px] text-[11px] font-mono bg-white",
                            "focus:outline-none focus:ring-1",
                            showError
                              ? "border-rose-400 focus:ring-rose-400"
                              : "border-slate-300 focus:ring-sky-500 focus:border-sky-500",
                          ].join(" ")}
                          placeholder={
                            lvl.isMixed
                              ? "varie (lascia vuoto per non cambiare)"
                              : ""
                          }
                        />
                        {lvl.isMixed && (
                          <span className="text-[9px] text-amber-500">
                            nella selezione ci sono valori diversi
                          </span>
                        )}
                        {showError && (
                          <span className="text-[9px] text-rose-500">
                            campo obbligatorio
                          </span>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {extraEdit && (
              <div className="mt-3 pt-2 border-t border-slate-200">
                <div className="text-[10px] font-semibold text-slate-600 mb-2">Parametri extra</div>

                {/* Codice materiale */}
                <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-2">
                  <label className="pt-[3px] text-[10px] text-slate-500">Codice materiale</label>
                  <input
                    type="text"
                    value={extraEdit.codiceMateriale.value}
                    onChange={(e) =>
                      setExtraEdit((prev) =>
                        prev
                          ? { ...prev, codiceMateriale: { ...prev.codiceMateriale, value: e.target.value } }
                          : prev
                      )
                    }
                    className="w-full rounded-md border border-slate-300 px-2 py-[2px] text-[11px] font-mono bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                    placeholder={extraEdit.codiceMateriale.isMixed ? "varie (lascia vuoto per non cambiare)" : ""}
                  />

                  {/* Fornitore multi-select (solo anagrafica) */}
                  <label className="pt-[3px] text-[10px] text-slate-500">Fornitore</label>

                  <div className="relative">
                    <button
                      type="button"
                      className="w-full text-left rounded-md border border-slate-300 bg-white px-2 py-[3px] text-[11px] hover:bg-slate-50"
                      onClick={() => setSupplierPickerOpen((v) => !v)}
                    >
                      {extraEdit.fornitore.value.length
                        ? `${extraEdit.fornitore.value.length} selezionati`
                        : extraEdit.fornitore.isMixed
                          ? "varie (seleziona per sovrascrivere)"
                          : "Seleziona fornitori"}
                    </button>

                    {supplierPickerOpen && (
                      <div className="absolute z-30 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-48 overflow-auto">
                        {suppliers.length === 0 ? (
                          <div className="px-3 py-2 text-[10px] text-slate-500">
                            Nessun fornitore in anagrafica. Aggiungine uno in Impostazioni → Fornitori.
                          </div>
                        ) : (
                          <div className="p-2 flex flex-col gap-1">
                            {suppliers.map((s) => {
                              const checked = extraEdit.fornitore.value.includes(s.id);
                              return (
                                <label
                                  key={s.id}
                                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...extraEdit.fornitore.value, s.id]
                                        : extraEdit.fornitore.value.filter((id) => id !== s.id);

                                      setExtraEdit((prev) =>
                                        prev ? { ...prev, fornitore: { ...prev.fornitore, value: next } } : prev,
                                      );
                                    }}
                                  />
                                  <span className="text-[11px] text-slate-800">{s.name}</span>
                                  {s.code ? (
                                    <span className="ml-auto text-[10px] text-slate-400 font-mono">{s.code}</span>
                                  ) : null}
                                </label>
                              );
                            })}
                          </div>
                        )}

                        <div className="border-t border-slate-200 p-2 flex items-center justify-between">
                          <button
                            type="button"
                            className="text-[10px] text-slate-500 hover:text-slate-700"
                            onClick={() =>
                              setExtraEdit((prev) =>
                                prev ? { ...prev, fornitore: { ...prev.fornitore, value: [] } } : prev
                              )
                            }
                          >
                            Svuota
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1 rounded-md text-[10px] border border-slate-200 bg-white hover:bg-slate-50"
                            onClick={() => setSupplierPickerOpen(false)}
                          >
                            Chiudi
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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
                    isApplying
                      ? "bg-amber-500"
                      : "bg-amber-400 hover:bg-amber-500",
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
