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

// src/core/domain/po.ts

export interface POItem {
  id: string;
  poId: string;

  code: string;          // codice voce P.O. (ID interno riga)
  description: string;
  unit: string;          // es. "mq", "mc", "nr"
  unitCost: number;      // costo unitario
  unitPrice: number;     // prezzo unitario (ricavo)
  wbsCode?: string;      // eventuale macro WBS associata

  /**
   * Codice tariffa / RCM associato alla voce (usato per il matching con il modello IFC).
   * Può coincidere con "code" oppure essere un codice distinto.
   */
  tariffCode?: string;

  /**
   * Quantità di baseline del PO per questa voce (es. colonna Q1(p1)).
   */
  baselineQuantity?: number;

  /**
   * Importo totale di baseline del PO per questa voce (es. colonna CST(p1)).
   * Se non fornito può essere calcolato come baselineQuantity * unitPrice.
   */
  baselineAmount?: number;
}

