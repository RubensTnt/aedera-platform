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
    poEngine.setItems(nextItems);
    setItems(nextItems);
  }, []);

  const handleAddItem = React.useCallback(() => {
    poEngine.addItem();
    setItems([...poEngine.items]);
  }, []);

  const handleChangeItem = React.useCallback(
    (id: string, patch: Partial<POItem>) => {
      poEngine.updateItem(id, patch);
      setItems([...poEngine.items]);
    },
    [],
  );

  const handleDeleteItem = React.useCallback((id: string) => {
    poEngine.removeItem(id);
    setItems([...poEngine.items]);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        height: "100%",
        minHeight: 0,
        overflow: "hidden", // 🟢 IMPORTANTISSIMO
      }}
    >

      {/* SEZIONE SUPERIORE SCROLLABILE (Upload + Filtri) */}
      <div style={{
        flexShrink: 0,
        overflowY: "auto",
        maxHeight: "45%",   // puoi regolarlo (40-50%)
        paddingRight: "2px"
      }}>
        <PoUploadPanel
          poId="PO-Struttura-Catania"
          onItemsLoaded={handleItemsLoaded}
        />
        <div style={{ marginTop: "0.5rem" }}>
          <PoFilterPanel />
        </div>
      </div>

      {/* TABELLA (scorre nel suo spazio) */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <PoGrid
          items={items}
          onAddItem={handleAddItem}
          onChangeItem={handleChangeItem}
          onDeleteItem={handleDeleteItem}
        />
      </div>
    </div>
  );
};
