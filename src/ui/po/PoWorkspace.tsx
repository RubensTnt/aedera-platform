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
    <div className="h-full min-h-0 flex flex-col gap-3">
      {/* Top: upload + filtri */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 max-h-52 overflow-auto">
        <div className="xl:col-span-1">
          <PoUploadPanel
            onItemsLoaded={(loaded) => {
              poEngine.setItems(loaded);
              setItems([...poEngine.items]);
            }}
          />
        </div>

        <div className="xl:col-span-2">
          <PoFilterPanel />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white">
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
