// src/core/domain/sal.ts

export interface SALRecord {
  id: string;
  projectId: string;
  name: string;            // es. "SAL n.3 - Marzo 2026"
  periodFrom: string;      // ISO
  periodTo: string;        // ISO
  createdAt: string;
  createdByUserId: string;
}

export interface SALItem {
  id: string;
  salRecordId: string;
  aggregationKey: "TARIFF" | "WBS" | "PO_ITEM";
  keyValue: string;        // es. tariffCode, wbsCode, poItemId
  quantityPlanned: number;
  quantityExecuted: number;
  amountPlanned: number;
  amountExecuted: number;
}
