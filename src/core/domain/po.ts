// src/core/domain/po.ts

export interface PreventivoOperativo {
  id: string;
  projectId: string;
  name: string;
  version: string;
  sourceFilePath?: string; // path file Excel originale lato backend
  createdAt: string;
  createdByUserId: string;
}

export interface POItem {
  id: string;
  poId: string;
  code: string;          // codice voce P.O.
  description: string;
  unit: string;          // es. "mq", "mc", "nr"
  unitCost: number;      // costo unitario
  unitPrice: number;     // prezzo unitario (ricavo)
  wbsCode?: string;      // eventuale macro WBS associata
}
