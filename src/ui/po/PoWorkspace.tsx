// src/ui/po/PoWorkspace.tsx

import React from "react";
import type { POItem } from "@core/domain/po";
import { poEngine } from "@core/po/poEngine";
import { PoUploadPanel } from "@ui/po/PoUploadPanel";
import { PoFilterPanel } from "@ui/po/PoFilterPanel";
import { PoGrid } from "@ui/po/PoGrid";

/**
 * Workspace PO nel pannello destro:
 * - gestisce lo stato locale delle righe PO
 * - tiene sincronizzato poEngine
 * - mostra Upload, Filtri e Grid in uno stack verticale
 */
export const PoWorkspace: React.FC = () => {
  const [items, setItems] = React.useState<POItem[]>(poEngine.items);

  const handleItemsLoaded = React.useCallback((nextItems: POItem[]) => {
    // 1) aggiorniamo il motore centrale (usato da filtri / PropertyEngine)
    poEngine.setItems(nextItems);
    // 2) aggiorniamo la UI (PoGrid)
    setItems(nextItems);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        height: "100%",
        minHeight: 0,
      }}
    >
      <PoUploadPanel
        poId="PO-Struttura-Catania"
        onItemsLoaded={handleItemsLoaded}
      />

      <PoFilterPanel />

      {/* Grid che occupa lo spazio rimanente con scroll verticale */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <PoGrid items={items} />
      </div>
    </div>
  );
};
