// src/ui/po/PoUploadPanel.tsx

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { poEngine } from "@core/po/poEngine";
import type { POItem } from "@core/domain/po";

interface PoUploadPanelProps {
  poId?: string;
  /**
   * Callback opzionale per notificare il chiamante
   * (es. PoWorkspace) quando la lista di POItem è pronta.
   */
  onItemsLoaded?: (items: POItem[]) => void;
}

export const PoUploadPanel: React.FC<PoUploadPanelProps> = ({
  poId = "PO-1",
  onItemsLoaded,
}) => {
  const [status, setStatus] = useState<string>("Nessun file caricato");
  const [itemsCount, setItemsCount] = useState<number>(0);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus(`Lettura file "${file.name}".`);

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      console.log("[PO Upload] righe totali nel foglio:", rows.length);
      if (!rows.length) {
        setStatus(
          `Foglio "${sheetName}" vuoto o non leggibile (0 righe dopo sheet_to_json).`,
        );
        const empty: POItem[] = [];
        if (onItemsLoaded) {
          onItemsLoaded(empty);
        } else {
          poEngine.setItems(empty);
        }
        setItemsCount(0);
        return;
      }

      console.log("[PO Upload] Prima riga grezza:", rows[0]);
      console.log("[PO Upload] Chiavi prima riga:", Object.keys(rows[0]));

      const poItems: POItem[] = rows.map((row, index) => {
        const wbs0 = row["WBS0"];
        const wbs1 = row["WBS1"];
        const wbs4 = row["WBS4"];
        const wbs7Raw = row["WBS7"];
        const wbs8 = row["WBS8"];
        const wbs9 = row["WBS9"];

        const rcmRaw = row["RCM"];

        const wbs7Full = wbs7Raw != null ? String(wbs7Raw).trim() : "";
        const wbs7Code = wbs7Full.split(/[ \-]/)[0] || "";

        const rcmCode = rcmRaw != null ? String(rcmRaw).trim() : "";

        const combinedTariff =
          wbs7Code && rcmCode ? `${wbs7Code}.${rcmCode}` : rcmCode || undefined;

        const description = row["DESCRIZIONE"] ?? row["Descrizione"] ?? null;
        const unit = row["UM"] ?? row["U.M."] ?? null;

        const baselineQuantityRaw = row["Q1(p1)"];
        const unitPriceRaw = row["Cu(p1)"];
        const baselineAmountRaw = row["CST(p1)"];

        const baselineQuantity =
          baselineQuantityRaw != null
            ? Number(baselineQuantityRaw) || undefined
            : undefined;
        const unitPrice =
          unitPriceRaw != null ? Number(unitPriceRaw) || undefined : undefined;
        const baselineAmount =
          baselineAmountRaw != null
            ? Number(baselineAmountRaw) || undefined
            : undefined;

        const id = `${poId}-${index + 1}`;

        return {
          id,
          poId,
          wbs0: wbs0 != null ? String(wbs0) : undefined,
          wbs1: wbs1 != null ? String(wbs1) : undefined,
          wbs4: wbs4 != null ? String(wbs4) : undefined,
          wbs7: wbs7Full || undefined,
          wbs8: wbs8 != null ? String(wbs8) : undefined,
          wbs9: wbs9 != null ? String(wbs9) : undefined,
          rcm: rcmCode || undefined,
          tariffCode: combinedTariff,
          description: description != null ? String(description) : undefined,
          unit: unit != null ? String(unit) : undefined,
          baselineQuantity,
          unitPrice,
          baselineAmount,
        } as POItem;
      });

      // filtriamo eventuali righe completamente vuote
      const validItems = poItems.filter((item) => !!item.tariffCode);

      // Se il caller gestisce lo stato, lo notifichiamo.
      // Altrimenti aggiorniamo direttamente il PoEngine.
      if (onItemsLoaded) {
        onItemsLoaded(validItems);
      } else {
        poEngine.setItems(validItems);
      }

      setItemsCount(validItems.length);
      setStatus(
        `Import completato: ${validItems.length} righe valide dal foglio "${sheetName}".`,
      );
    } catch (error) {
      console.error("[PO Upload] Errore durante la lettura dell'Excel", error);
      setStatus("Errore durante la lettura del file.");
    }
  };

  return (
    <section
      style={{
        border: "1px solid #444",
        padding: "0.5rem",
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: "0.25rem", fontWeight: 600 }}>
        Carica Preventivo Operativo (Excel)
      </div>

      <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />

      <div style={{ marginTop: "0.25rem" }}>
        <div>{status}</div>
        <div>Voci PO caricate: {itemsCount}</div>
      </div>
    </section>
  );
};
