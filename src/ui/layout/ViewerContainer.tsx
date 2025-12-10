// src/ui/layout/ViewerContainer.tsx

import React, { useEffect, useRef, useState } from "react";
import { initAederaViewer } from "@core/bim/thatopen";
import {
  getSelectedElementsWithDatiWbs,
  type SelectedElementWithDatiWbs,
} from "@core/bim/selectionAdapter";
import {
  DEFAULT_DATI_WBS_PROFILE,
  type WbsLevelKey,
} from "@core/bim/datiWbsProfile";


interface ViewerContainerProps {
  showDatiWbsOverlay?: boolean;
}

interface OverlayLevelInfo {
  key: WbsLevelKey;
  label: string;
  valueLabel: string; // "", "varie" o valore unico
}


const DatiWbsSelectionOverlay: React.FC = () => {
  const [selectionCount, setSelectionCount] = useState(0);
  const [levels, setLevels] = useState<OverlayLevelInfo[]>([]);

  useEffect(() => {
    let disposed = false;

    const requiredLevels = DEFAULT_DATI_WBS_PROFILE.levels.filter(
      (lvl) => lvl.enabled && lvl.required,
    );

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
  }, []);

  if (!levels.length && selectionCount === 0) {
    // niente da mostrare (es. modello non caricato)
    return null;
  }

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
        padding: "6px 8px",
        maxWidth: 260,
        fontSize: 11,
        color: "#f5f5f5",
        pointerEvents: "none", // importante: non blocca l'interazione con il viewer
      }}
    >
      <div
        style={{
          marginBottom: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600 }}>DATI_WBS selezione</span>
        <span style={{ fontSize: 10, color: "#a3a3a3" }}>
          {selectionCount ? `${selectionCount} elem.` : "Nessuna selezione"}
        </span>
      </div>

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
            >
              {lvl.valueLabel || "—"}
            </div>
          </React.Fragment>
        ))}
      </div>
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

