// src/ui/po/PoUploadPanel.tsx

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { poEngine } from "@core/po/poEngine";
import type { POItem } from "@core/domain/po";

interface PoUploadPanelProps {
  poId?: string;
}

export const PoUploadPanel: React.FC<PoUploadPanelProps> = ({ poId = "PO-1" }) => {
  const [status, setStatus] = useState<string>("Nessun file caricato");
  const [itemsCount, setItemsCount] = useState<number>(0);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus(`Lettura file "${file.name}"...`);

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Converte il foglio in array di oggetti: { Colonna1: ..., Colonna2: ... }
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      console.log("[PO Upload] righe totali nel foglio:", rows.length);
      if (!rows.length) {
        setStatus(
          `Foglio "${sheetName}" vuoto o non leggibile (0 righe dopo sheet_to_json).`,
        );
        poEngine.setItems([]);
        setItemsCount(0);
        return;
      }

      // Logghiamo la prima riga per capire i nomi delle colonne
      console.log("[PO Upload] Prima riga grezza:", rows[0]);
      console.log(
        "[PO Upload] Chiavi prima riga:",
        Object.keys(rows[0]),
      );

      // 🔴 QUI È DOVE MAPPiamo LE COLONNE DEL TUO EXCEL
      const poItems: POItem[] = rows.map((row, index) => {
        const wbs0 = row["WBS0"];
        const wbs1 = row["WBS1"];
        const wbs4 = row["WBS4"];
        const wbs7Raw = row["WBS7"];
        const wbs8 = row["WBS8"];
        const wbs9 = row["WBS9"];

        // Colonna RCM (Riferimento Computo Metrico)
        const rcmRaw = row["RCM"];

        // Normalizziamo i codici
        const wbs7Full = wbs7Raw != null ? String(wbs7Raw).trim() : "";
        // se WBS7 fosse "GC - Opere strutturali", prendiamo solo il codice "GC"
        const wbs7Code = wbs7Full.split(/[ \-]/)[0] || "";

        const rcmCode = rcmRaw != null ? String(rcmRaw).trim() : "";

        // STM_Tariffa Combinata = WBS7Code + "." + RCM  (es. "GC.2.1")
        const combinedTariff =
          wbs7Code && rcmCode ? `${wbs7Code}.${rcmCode}` : rcmCode || undefined;

        // Descrizione e U.M. (adatta i nomi alle tue intestazioni reali)
        const descrizione = row["Descrizione"] ?? row["DESCRIZIONE"];
        const um = row["UM"] ?? row["U.M."];

        // Quantità e costi di baseline: Q1(p1), Cu(p1), CST(p1)
        const q1p1 = row["Q1(p1)"];
        const cup1 = row["Cu(p1)"];
        const cstp1 = row["CST(p1)"];

        const id = `${poId}-${index + 1}`;

        const item: POItem = {
          id,
          poId,

          // "code" può restare l'RCM "puro", utile se vuoi filtrare solo per RCM
          code: rcmCode || id,

          description: descrizione ? String(descrizione) : "",
          unit: um ? String(um) : "",
          unitCost:
            typeof cup1 === "number"
              ? cup1
              : cup1 != null
                ? Number(cup1)
                : 0,
          unitPrice:
            typeof cup1 === "number"
              ? cup1
              : cup1 != null
                ? Number(cup1)
                : 0,

          // WBS principale = categoria d'opera
          wbsCode: wbs7Code || undefined,

          // 🔗 Codice tariffa usato per il join con STM_Tariffa Combinata
          tariffCode: combinedTariff,

          baselineQuantity:
            typeof q1p1 === "number"
              ? q1p1
              : q1p1 != null
                ? Number(q1p1)
                : undefined,
          baselineAmount:
            typeof cstp1 === "number"
              ? cstp1
              : cstp1 != null
                ? Number(cstp1)
                : undefined,
        };

        return item;
      });

      console.log("[PO Upload] POItem[1]:", poItems[1]);

      // facoltativo: tieni solo le righe con RCM + descrizione
      const filteredItems = poItems.filter(
        (item) => item.tariffCode && item.description,
      );

      console.log(
        "[PO Upload] Items importati (prime 10):",
        filteredItems.slice(0, 10),
      );

      poEngine.setItems(filteredItems);

      setItemsCount(filteredItems.length);
      setStatus(
        `PO caricato: ${filteredItems.length} voci (foglio "${sheetName}").`,
      );
    } catch (error) {
      console.error("[PO Upload] Errore durante la lettura del file:", error);
      setStatus("Errore durante la lettura del file. Vedi console.");
      poEngine.setItems([]);
      setItemsCount(0);
    }
  };

  return (
    <div className="p-3 border rounded bg-white shadow-sm text-sm space-y-2">
      <div className="font-semibold">Carica Preventivo Operativo (Excel)</div>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
      />
      <div className="text-xs text-gray-600">
        {status}
        {itemsCount > 0 && (
          <span className="ml-2">
            | voci PO attive: <strong>{itemsCount}</strong>
          </span>
        )}
      </div>
    </div>
  );
};
