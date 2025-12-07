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
      } as any, // evitiamo problemi di typing troppo rigidi
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

  // Costruiamo la ModelIdMap usando il Property Engine,
  // esattamente come fa il PoEngine.
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
// COLONNE DELLA GRID
// ---------------------------------------------------------------------------

const columns: ColumnDef<POItem>[] = [
  {
    header: "WBS7",
    accessorKey: "wbs7",
  },
  {
    header: "WBS8",
    accessorKey: "wbs8",
  },
  {
    header: "WBS9",
    accessorKey: "wbs9",
  },
  {
    header: "RCM",
    accessorKey: "rcm",
  },
  {
    header: "Tariffa",
    accessorKey: "tariffCode",
  },
  {
    header: "Descrizione",
    accessorKey: "description",
    size: 400,
  },
  {
    header: "UM",
    accessorKey: "unit",
    size: 40,
  },
  {
    header: "Q1(p1)",
    accessorKey: "baselineQuantity",
    cell: (info) => {
      const v = info.getValue() as number | undefined;
      return v != null ? v.toString() : "";
    },
  },
  {
    header: "Cu(p1)",
    accessorKey: "unitPrice",
    cell: (info) => {
      const v = info.getValue() as number | undefined;
      return v != null ? v.toFixed(2) : "";
    },
  },
  {
    header: "CST(p1)",
    accessorKey: "baselineAmount",
    cell: (info) => {
      const v = info.getValue() as number | undefined;
      return v != null ? v.toFixed(2) : "";
    },
  },
];

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPALE: PoGrid
// ---------------------------------------------------------------------------

export const PoGrid: React.FC = () => {
  const [search, setSearch] = React.useState("");

  // Le righe PO arrivano dal motore centrale, popolato dal PoUploadPanel
  const poItems = poEngine.items; 

  const table = useReactTable({
    data: poItems,
    columns,
    state: {
      globalFilter: search,
    },
    globalFilterFn: (row, columnId, filterValue) => {
      const raw = row.getValue(columnId);
      if (raw == null) return false;
      return String(raw).toLowerCase().includes(filterValue.toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="w-full h-full flex flex-col">
      {/* BARRA DI RICERCA */}
      <div className="mb-2">
        <input
          className="w-full border px-2 py-1 text-sm rounded"
          placeholder="Cerca nel foglio PO…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* TABELLA */}
      <div
        className="flex-1 overflow-auto border rounded bg-white"
        style={{ fontSize: "12px" }}
      >
        <table className="w-full border-collapse">
          <thead className="bg-gray-200 sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="border px-2 py-1 text-left">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-yellow-100 cursor-pointer"
                onClick={() => {
                  const tariff = row.original.tariffCode;
                  if (tariff) {
                    void highlightTariff(tariff);
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const cellDef = cell.column.columnDef.cell;

                  return (
                    <td key={cell.id} className="border px-2 py-1">
                      {cellDef
                        ? flexRender(cellDef, cell.getContext())
                        : String(cell.getValue() ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
