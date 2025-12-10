import React, { useEffect, useRef, useState } from "react";
import { initAederaViewer } from "@core/bim/thatopen";
import {
  getSelectedElementsWithDatiWbs,
  applyDatiWbsToSelection,
  type SelectedElementWithDatiWbs,
} from "@core/bim/selectionAdapter";
import {
  DEFAULT_DATI_WBS_PROFILE,
  type WbsLevelKey,
} from "@core/bim/datiWbsProfile";
import type { DatiWbsProps } from "@core/bim/modelProperties";

interface ViewerContainerProps {
  showDatiWbsOverlay?: boolean;
}

interface OverlayLevelInfo {
  key: WbsLevelKey;
  label: string;
  valueLabel: string; // "", "varie" o valore unico
}

interface LevelEditState {
  key: WbsLevelKey;
  label: string;
  initialValue: string; // valore aggregato all'inizio dell'editing (unico o "")
  isMixed: boolean; // true se in selezione c'erano più valori diversi ("varie")
  value: string; // valore attuale dell'input
}

const DatiWbsSelectionOverlay: React.FC = () => {
  const [selectionCount, setSelectionCount] = useState(0);
  const [levels, setLevels] = useState<OverlayLevelInfo[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editLevels, setEditLevels] = useState<LevelEditState[] | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    let disposed = false;

    const requiredLevels = DEFAULT_DATI_WBS_PROFILE.levels.filter(
      (lvl) => lvl.enabled && lvl.required,
    );

    // In modalità editing NON facciamo polling, altrimenti
    // rischieremmo di sovrascrivere quello che l'utente sta scrivendo.
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
        // Nessuna selezione: prepariamo comunque la struttura vuota
        const emptyLevels: OverlayLevelInfo[] = requiredLevels.map((lvl) => ({
          key: lvl.key,
          label: lvl.label ?? lvl.key,
          valueLabel: "",
        }));
        setLevels(emptyLevels);
        return;
      }

      const infos: OverlayLevelInfo[] = requiredLevels.map((lvl) => {
        const values: string[] = [];

        for (const item of selected) {
          const raw = item.datiWbs?.[lvl.key];
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
          key: lvl.key,
          label: lvl.label ?? lvl.key,
          valueLabel,
        };
      });

      setLevels(infos);
    };

    void tick();
    const id = window.setInterval(tick, 400); // polling leggero

    return () => {
      disposed = true;
      window.clearInterval(id);
    };
  }, [isEditing]);

  if (!levels.length && selectionCount === 0) {
    // niente da mostrare (es. modello non caricato)
    return null;
  }

  // Entra in modalità editing usando come base i livelli aggregati attuali
  const handleStartEdit = () => {
    if (!selectionCount) return;

    const nextEditLevels: LevelEditState[] = levels.map((lvl) => {
      const isMixed = lvl.valueLabel === "varie";
      const initialValue = isMixed ? "" : (lvl.valueLabel || "");
      return {
        key: lvl.key,
        label: lvl.label,
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

  const handleChangeLevel = (key: WbsLevelKey, value: string) => {
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

      // Nessun cambiamento effettivo
      if (next === initial) {
        continue;
      }

      // Campo svuotato
      if (!next) {
        // Se prima c'era un valore unico, interpretiamo come "clear"
        if (initial) {
          patch[lvl.key] = null;
        } else {
          // Caso iniziale vuoto:
          // - se era mixed ("varie") e resta vuoto, per ora NON lo tocchiamo
          //   (evitiamo di cancellare valori eterogenei a sorpresa)
          // - se era già vuoto e resta vuoto, non c'è nulla da fare
          continue;
        }
      } else {
        // Campo valorizzato esplicitamente -> scriviamo su tutti gli elementi selezionati
        patch[lvl.key] = next;
      }
    }

    // Se non ci sono cambiamenti, usciamo semplicemente dall'editing
    if (!Object.keys(patch).length) {
      setIsEditing(false);
      setEditLevels(null);
      return;
    }

    try {
      setIsApplying(true);
      await applyDatiWbsToSelection(patch);
    } catch (error) {
      console.error("[DATI_WBS] Errore durante l'applicazione alla selezione", {
        patch,
        error,
      });
    } finally {
      setIsApplying(false);
      setIsEditing(false);
      setEditLevels(null);
    }
  };

  const hasSelection = selectionCount > 0;

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
        maxWidth: 260,
        fontSize: 11,
        color: "#f5f5f5",
        // ora il pannello è interattivo, quindi deve poter ricevere eventi
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

      {/* Contenuto */}
      {!isEditing && (
        <>
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
                <div style={{ color: "#a3a3a3" }}>{lvl.label}</div>
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
        </>
      )}

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
            {editLevels.map((lvl) => (
              <React.Fragment key={lvl.key}>
                <label
                  style={{
                    color: "#a3a3a3",
                    paddingTop: 2,
                  }}
                  htmlFor={`wbs-${lvl.key}`}
                >
                  {lvl.label}
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
                      border: "1px solid #52525b",
                      backgroundColor: "#18181b",
                      color: "#f5f5f5",
                      fontFamily: "monospace",
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
                </div>
              </React.Fragment>
            ))}
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

export const ViewerContainer: React.FC<ViewerContainerProps> = ({
  showDatiWbsOverlay = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // inizializza il viewer ThatOpen una sola volta
    initAederaViewer(container);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#151515",
      }}
    >
      {showDatiWbsOverlay && <DatiWbsSelectionOverlay />}
    </div>
  );
};
