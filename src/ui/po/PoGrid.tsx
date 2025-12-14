// src/ui/po/PoGrid.tsx

import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { poEngine } from "@core/po/poEngine";
import type { POItem } from "@core/domain/po";

import * as THREE from "three";
import * as OBF from "@thatopen/components-front";
import { getAederaViewer } from "@core/bim/thatopen";
import {
  getIndexedModelIds,
  getAllElements,
  getElementTariffCode,
  DEFAULT_TARIFF_MAPPING,
} from "@core/bim/modelProperties";

// ---------------------------------------------------------------------------
// HIGHIGHTER: evidenzia elementi nel BIM quando clicchi una riga PO
// ---------------------------------------------------------------------------

let highlighterReady = false;

async function getHighlighterInstance() {
  const viewer = getAederaViewer();
  if (!viewer) return null;

  const { components, world } = viewer;
  const highlighter = components.get(OBF.Highlighter);

  if (!highlighterReady) {
    await highlighter.setup({
      world: world as any,
      selectMaterialDefinition: {
        color: new THREE.Color("#bcf124"),
        opacity: 0.9,
        transparent: true,
      } as any,
    });
    highlighterReady = true;
  }

  return highlighter;
}

async function highlightTariff(tariffCode: string) {
  const viewer = getAederaViewer();
  if (!viewer) return;

  const highlighter = await getHighlighterInstance();
  if (!highlighter) return;

  const modelIdMap: Record<string, Set<number>> = {};
  const modelIds = getIndexedModelIds();

  for (const modelId of modelIds) {
    const elements = getAllElements(modelId) ?? [];
    for (const el of elements) {
      const code = getElementTariffCode(
        modelId,
        el.localId,
        DEFAULT_TARIFF_MAPPING,
      );
      if (!code) continue;
      if (code !== tariffCode) continue;

      if (!modelIdMap[modelId]) modelIdMap[modelId] = new Set();
      modelIdMap[modelId].add(el.localId);
    }
  }

  await highlighter.highlightByID("select", modelIdMap, true);
}


// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPALE: PoGrid
// ---------------------------------------------------------------------------

interface PoGridProps {
  /**
   * Lista di righe PO. Se non fornita, si usa poEngine.items come fallback.
   */
  items?: POItem[];

  /**
   * Callbacks per creare / modificare / cancellare righe.
   * Se non fornite, la grid resta read-only.
   */
  onAddItem?: () => void;
  onChangeItem?: (id: string, patch: Partial<POItem>) => void;
  onDeleteItem?: (id: string) => void;
}


export const PoGrid: React.FC<PoGridProps> = ({
  items,
  onAddItem,
  onChangeItem,
  onDeleteItem,
}) => {
  const [search, setSearch] = React.useState("");

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const poItems = items ?? poEngine.items;
  const handleTextChange = React.useCallback(
    (rowId: string, field: keyof POItem, value: string) => {
      if (!onChangeItem) return;
      onChangeItem(rowId, { [field]: value } as Partial<POItem>);
    },
    [onChangeItem],
  );

  const handleNumberChange = React.useCallback(
    (rowId: string, field: keyof POItem, value: string) => {
      if (!onChangeItem) return;
      const trimmed = value.trim();
      const num =
        trimmed === "" ? undefined : Number(trimmed.replace(",", "."));
      onChangeItem(rowId, {
        [field]: Number.isNaN(num) ? undefined : num,
      } as Partial<POItem>);
    },
    [onChangeItem],
  );

  const columns = React.useMemo<ColumnDef<POItem>[]>(() => {
    return [
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            className="text-rose-500 hover:text-rose-600 px-1"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteItem?.(row.original.id);
            }}
            title="Elimina riga"
          >
            ✕
          </button>
        ),
        size: 24,
      },
      {
        header: "Codice",
        accessorKey: "code",
        cell: (info) => {
          const rowId = info.row.original.id;
          const value = (info.getValue() as string | undefined) ?? "";
          return (
            <input
              className="w-full bg-transparent outline-none rounded px-1 focus:ring-2 focus:ring-sky-200"
              value={value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                handleTextChange(rowId, "code", e.target.value)
              }
            />
          );
        },
      },
      {
        header: "WBS7",
        accessorKey: "wbs7",
        cell: (info) => {
          const rowId = info.row.original.id;
          const value = (info.getValue() as string | undefined) ?? "";
          return (
            <input
              className="w-full bg-transparent outline-none rounded px-1 focus:ring-2 focus:ring-sky-200"
              value={value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                handleTextChange(rowId, "wbs7", e.target.value)
              }
            />
          );
        },
      },
      {
        header: "WBS8",
        accessorKey: "wbs8",
        cell: (info) => {
          const rowId = info.row.original.id;
          const value = (info.getValue() as string | undefined) ?? "";
          return (
            <input
              className="w-full bg-transparent outline-none rounded px-1 focus:ring-2 focus:ring-sky-200"
              value={value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                handleTextChange(rowId, "wbs8", e.target.value)
              }
            />
          );
        },
      },
      {
        header: "WBS9",
        accessorKey: "wbs9",
        cell: (info) => {
          const rowId = info.row.original.id;
          const value = (info.getValue() as string | undefined) ?? "";
          return (
            <input
              className="w-full bg-transparent outline-none rounded px-1 focus:ring-2 focus:ring-sky-200"
              value={value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                handleTextChange(rowId, "wbs9", e.target.value)
              }
            />
          );
        },
      },
      {
        header: "RCM",
        accessorKey: "rcm",
        cell: (info) => {
          const rowId = info.row.original.id;
          const value = (info.getValue() as string | undefined) ?? "";
          return (
            <input
              className="w-full bg-transparent outline-none rounded px-1 focus:ring-2 focus:ring-sky-200"
              value={value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                handleTextChange(rowId, "rcm", e.target.value)
              }
            />
          );
        },
      },
      {
        header: "Tariffa",
        accessorKey: "tariffCode",
        cell: (info) => {
          const rowId = info.row.original.id;
          const value = (info.getValue() as string | undefined) ?? "";
          return (
            <input
              className="w-full bg-transparent outline-none rounded px-1 focus:ring-2 focus:ring-sky-200"
              value={value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                handleTextChange(rowId, "tariffCode", e.target.value)
              }
            />
          );
        },
      },
      {
        header: "Descrizione",
        accessorKey: "description",
        cell: (info) => {
          const rowId = info.row.original.id;
          const value = (info.getValue() as string | undefined) ?? "";
          return (
            <input
              className="w-full bg-transparent outline-none rounded px-1 focus:ring-2 focus:ring-sky-200"
              value={value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                handleTextChange(rowId, "description", e.target.value)
              }
            />
          );
        },
        size: 400,
      },
      {
        header: "UM",
        accessorKey: "unit",
        cell: (info) => {
          const rowId = info.row.original.id;
          const value = (info.getValue() as string | undefined) ?? "";
          return (
            <input
              className="w-full bg-transparent outline-none rounded px-1 focus:ring-2 focus:ring-sky-200"
              value={value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                handleTextChange(rowId, "unit", e.target.value)
              }
            />
          );
        },
        size: 40,
      },
      {
        header: "Q1(p1)",
        accessorKey: "baselineQuantity",
        cell: (info) => {
          const rowId = info.row.original.id;
          const v = info.getValue() as number | undefined;
          const value = v != null ? String(v) : "";
          return (
            <input
              className="w-full bg-transparent outline-none rounded px-1 focus:ring-2 focus:ring-sky-200"
              value={value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                handleNumberChange(rowId, "baselineQuantity", e.target.value)
              }
            />
          );
        },
      },
      {
        header: "Cu(p1)",
        accessorKey: "unitPrice",
        cell: (info) => {
          const rowId = info.row.original.id;
          const v = info.getValue() as number | undefined;
          const value = v != null ? v.toString() : "";
          return (
            <input
              className="w-full bg-transparent outline-none rounded px-1 focus:ring-2 focus:ring-sky-200"
              value={value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                handleNumberChange(rowId, "unitPrice", e.target.value)
              }
            />
          );
        },
      },
      {
        header: "CST(p1)",
        accessorKey: "baselineAmount",
        cell: (info) => {
          const rowId = info.row.original.id;
          const v = info.getValue() as number | undefined;
          const value = v != null ? v.toString() : "";
          return (
            <input
              className="w-full bg-transparent outline-none rounded px-1 focus:ring-2 focus:ring-sky-200"
              value={value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                handleNumberChange(rowId, "baselineAmount", e.target.value)
              }
            />
          );
        },
      },
    ];
  }, [handleTextChange, handleNumberChange, onDeleteItem]);

  const table = useReactTable({
    data: poItems,
    columns,
    state: { globalFilter: search },
    globalFilterFn: (row, columnId, filterValue) => {
      const raw = row.getValue(columnId);
      if (raw == null) return false;
      return String(raw).toLowerCase().includes(filterValue.toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <section className="h-full min-h-0 flex flex-col p-2 text-xs">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-slate-800">
            Voci PO <span className="text-slate-500">({poItems.length})</span>
          </div>

          {onAddItem && (
            <button
              type="button"
              onClick={() => onAddItem()}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-white text-xs hover:bg-emerald-800"
            >
              + Nuova riga
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder="Filtra testo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 max-w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-200"
        />
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 px-2 py-1 text-left font-semibold text-slate-700"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={[
                  "cursor-pointer hover:bg-slate-50",
                  row.original.id === selectedId ? "bg-emerald-50" : "",
                ].join(" ")}
                onClick={() => {
                  setSelectedId(row.original.id);

                  const tariff = row.original.tariffCode;
                  if (tariff) void highlightTariff(tariff);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="border-b border-slate-100 px-2 py-1 align-top text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis max-w-[420px]"
                    title={String(cell.getValue() ?? "")}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

};
