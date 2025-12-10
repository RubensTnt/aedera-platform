import React, { useEffect, useState } from "react";
import {
  getSelectedElementsWithDatiWbs,
  applyDatiWbsToSelection,
  type SelectedElementWithDatiWbs,
} from "@core/bim/selectionAdapter";
import {
  DEFAULT_DATI_WBS_PROFILE,
  ALL_WBS_LEVEL_KEYS,
} from "@core/bim/datiWbsProfile";
import type { DatiWbsProps } from "@core/bim/modelProperties";

type DatiEditKey = keyof DatiWbsProps;

const ALL_DATI_KEYS: DatiEditKey[] = [
  ...ALL_WBS_LEVEL_KEYS,
  "TariffaCodice",
];

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
function getKeyLabel(key: DatiEditKey): string {
  if (key === "TariffaCodice") return "Codice tariffa";
  const cfg = DEFAULT_DATI_WBS_PROFILE.levels.find((lvl) => lvl.key === key);
  return cfg?.label ?? key;
}

// Flag di obbligatorietà da profilo
function isKeyRequired(key: DatiEditKey): boolean {
  if (key === "TariffaCodice") {
    return DEFAULT_DATI_WBS_PROFILE.requireTariffaCodice;
  }
  const cfg = DEFAULT_DATI_WBS_PROFILE.levels.find((lvl) => lvl.key === key);
  return cfg?.required ?? false;
}

export const DatiWbsSelectionOverlay: React.FC = () => {
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

      if (!selected.length) {
        const emptyLevels: OverlayLevelInfo[] = ALL_DATI_KEYS.map((key) => ({
          key,
          label: getKeyLabel(key),
          valueLabel: "",
        }));
        setLevels(emptyLevels);
        return;
      }

      const infos: OverlayLevelInfo[] = ALL_DATI_KEYS.map((key) => {
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
          label: getKeyLabel(key),
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
  }, [isEditing]);

  if (!levels.length && selectionCount === 0) {
    return null;
  }

  const hasSelection = selectionCount > 0;

  const handleStartEdit = () => {
    if (!selectionCount) return;

    const nextEditLevels: LevelEditState[] = levels.map((lvl) => {
      const isMixed = lvl.valueLabel === "varie";
      const initialValue = isMixed ? "" : (lvl.valueLabel || "");
      const required = isKeyRequired(lvl.key);

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

  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        top: 8,
        zIndex: 20,
        backgroundColor: "rgba(15,15,15,0.92)",
        border: "1px solid #444",
        borderRadius: 4,
        padding: "6px 8px 8px",
        maxWidth: 280,
        fontSize: 11,
        color: "#f5f5f5",
        pointerEvents: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: 6,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontWeight: 600 }}>DATI_WBS selezione</span>
          <span style={{ fontSize: 10, color: "#a3a3a3" }}>
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
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 3,
              border: "1px solid #555",
              backgroundColor: hasSelection ? "#27272a" : "#18181b",
              color: hasSelection ? "#e5e5e5" : "#52525b",
              cursor: hasSelection ? "pointer" : "default",
            }}
          >
            Modifica
          </button>
        )}
      </div>

      {/* Read-only */}
      {!isEditing && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            columnGap: 6,
            rowGap: 2,
          }}
        >
          {levels.map((lvl) => (
            <React.Fragment key={lvl.key}>
              <div style={{ color: "#a3a3a3" }}>
                {lvl.label}
                {isKeyRequired(lvl.key) ? " *" : ""}
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: lvl.valueLabel === "varie" ? "#fbbf24" : "#e5e5e5",
                }}
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              columnGap: 6,
              rowGap: 4,
            }}
          >
            {editLevels.map((lvl) => {
              const isEmpty = !lvl.value.trim();
              const showError = lvl.required && isEmpty;

              return (
                <React.Fragment key={lvl.key}>
                  <label
                    style={{
                      color: "#a3a3a3",
                      paddingTop: 2,
                    }}
                    htmlFor={`wbs-${lvl.key}`}
                  >
                    {lvl.label}
                    {lvl.required ? " *" : ""}
                  </label>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <input
                      id={`wbs-${lvl.key}`}
                      type="text"
                      value={lvl.value}
                      onChange={(e) =>
                        handleChangeLevel(lvl.key, e.target.value)
                      }
                      style={{
                        width: "100%",
                        fontSize: 11,
                        padding: "2px 4px",
                        borderRadius: 3,
                        border: `1px solid ${
                          showError ? "#dc2626" : "#52525b"
                        }`,
                        backgroundColor: "#18181b",
                        color: "#f5f5f5",
                        fontFamily: "monospace",
                        outline: "none",
                      }}
                      placeholder={
                        lvl.isMixed
                          ? "varie (lascia vuoto per non cambiare)"
                          : ""
                      }
                    />
                    {lvl.isMixed && (
                      <span
                        style={{
                          fontSize: 9,
                          color: "#fbbf24",
                        }}
                      >
                        nella selezione ci sono valori diversi
                      </span>
                    )}
                    {showError && (
                      <span
                        style={{
                          fontSize: 9,
                          color: "#fca5a5",
                        }}
                      >
                        campo obbligatorio
                      </span>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Footer azioni */}
          <div
            style={{
              marginTop: 8,
              display: "flex",
              justifyContent: "flex-end",
              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isApplying}
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 3,
                border: "1px solid #52525b",
                backgroundColor: "#18181b",
                color: "#e5e5e5",
                cursor: "pointer",
              }}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying}
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 3,
                border: "1px solid #facc15",
                backgroundColor: isApplying ? "#854d0e" : "#eab308",
                color: "#111827",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isApplying ? "Aggiornamento..." : "Aggiorna selezione"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
