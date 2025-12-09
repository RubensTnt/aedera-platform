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
// COLONNE DELLA GRID
// ---------------------------------------------------------------------------

const columns: ColumnDef<POItem>[] = [
  { header: "WBS7", accessorKey: "wbs7" },
  { header: "WBS8", accessorKey: "wbs8" },
  { header: "WBS9", accessorKey: "wbs9" },
  { header: "RCM", accessorKey: "rcm" },
  { header: "Tariffa", accessorKey: "tariffCode" },
  {
    header: "Descrizione",
    accessorKey: "description",
    size: 400,
  },
  { header: "UM", accessorKey: "unit", size: 40 },
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

interface PoGridProps {
  /**
   * Lista di righe PO. Se non fornita, si usa poEngine.items come fallback.
   */
  items?: POItem[];
}

export const PoGrid: React.FC<PoGridProps> = ({ items }) => {
  const [search, setSearch] = React.useState("");

  const poItems = items ?? poEngine.items;

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
    <section
      style={{
        border: "1px solid #444",
        padding: "0.5rem",
        borderRadius: 4,
        fontSize: 12,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.25rem",
        }}
      >
        <strong>Voci PO ({poItems.length})</strong>
        <input
          type="text"
          placeholder="Filtra testo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            fontSize: 12,
            padding: "2px 4px",
            borderRadius: 4,
            border: "1px solid #555",
          }}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      borderBottom: "1px solid #555",
                      padding: "2px 4px",
                      textAlign: "left",
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#111",
                    }}
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
                style={{ cursor: "pointer" }}
                onClick={() => {
                  const tariff = row.original.tariffCode;
                  if (tariff) {
                    void highlightTariff(tariff);
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      borderBottom: "1px solid #333",
                      padding: "2px 4px",
                      fontSize: 11,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
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
