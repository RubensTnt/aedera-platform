import React, { useEffect, useState } from "react";
import {
  getSelectedElementsWithDatiWbs,
  applyDatiWbsToSelection,
  type SelectedElementWithDatiWbs,
} from "@core/bim/selectionAdapter";
import { ALL_WBS_LEVEL_KEYS } from "@core/bim/datiWbsProfile";
import type { DatiWbsProps } from "@core/bim/modelProperties";
import { useDatiWbsProfile } from "../../hooks/useDatiWbsProfile";
import type { DatiWbsProfile } from "../../core/bim/datiWbsProfile";


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

export const DatiWbsSelectionOverlay: React.FC = () => {
  const [profile] = useDatiWbsProfile();
  const [selectionCount, setSelectionCount] = useState(0);
  const [levels, setLevels] = useState<OverlayLevelInfo[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editLevels, setEditLevels] = useState<LevelEditState[] | null>(null);
  const [isApplying, setIsApplying] = useState(false);

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
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditLevels(null);
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

    if (!Object.keys(patch).length) {
      setIsEditing(false);
      setEditLevels(null);
      return;
    }

    try {
      setIsApplying(true);
      await applyDatiWbsToSelection(patch);
    } catch (error) {
      console.error(
        "[DATI_WBS] Errore durante l'applicazione alla selezione",
        { patch, error },
      );
    } finally {
      setIsApplying(false);
      setIsEditing(false);
      setEditLevels(null);
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
