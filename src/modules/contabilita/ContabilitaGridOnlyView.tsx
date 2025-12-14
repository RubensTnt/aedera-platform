import React from "react";
import { PoGrid } from "@ui/po/PoGrid";
import { poEngine } from "@core/po/poEngine";
import type { POItem } from "@core/domain/po";

function readItemsFromStorage(): POItem[] {
  const stored = sessionStorage.getItem("aedera_po_items");
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as POItem[]) : [];
  } catch {
    return [];
  }
}

export const ContabilitaGridOnlyView: React.FC = () => {
  const [items, setItems] = React.useState<POItem[]>([]);

  const reload = React.useCallback(() => {
    // 1) se poEngine è popolato (stessa tab), preferiscilo
    if (poEngine.items && poEngine.items.length > 0) {
      setItems(poEngine.items);
      return;
    }
    // 2) altrimenti prendi da sessionStorage (popup / nuova finestra)
    setItems(readItemsFromStorage());
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="h-screen w-screen bg-slate-50 p-3">
      <div className="h-full min-h-0 flex flex-col gap-2 rounded-md border border-slate-200 bg-white shadow-sm p-2 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">
            Preventivo Operativo — Griglia
            <span className="ml-2 text-xs font-normal text-slate-500">
              ({items.length} righe)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reload}
              className="text-xs rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
              title="Rilegge i dati dal PO importato (sessionStorage)"
            >
              Ricarica dati
            </button>

            <button
              type="button"
              onClick={() => window.close()}
              className="text-xs rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
              title="Chiudi finestra (funziona se aperta come popup)"
            >
              Chiudi
            </button>

            <a
              href="/contabilita"
              className="text-xs rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700"
            >
              Torna al modulo
            </a>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-sm text-slate-500 gap-2">
              <div>Nessun dato PO trovato.</div>
              <div className="text-xs">
                Importa l’Excel nel modulo “Computo & Quantità”, poi riapri questo popup
                (o premi “Ricarica dati”).
              </div>
            </div>
          ) : (
            <PoGrid items={items} />
          )}
        </div>
      </div>
    </div>
  );
};
