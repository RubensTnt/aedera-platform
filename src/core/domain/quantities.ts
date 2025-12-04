// src/core/domain/quantities.ts

export type QuantityType = "LENGTH" | "AREA" | "VOLUME" | "COUNT";

export type QuantitySnapshotType = "BASELINE" | "UPDATE" | "PROGRESS";

export interface QuantitySnapshot {
  id: string;
  projectId: string;
  modelVersionId: string;
  type: QuantitySnapshotType;
  takenAt: string; // ISO
  createdByUserId: string;
}

export interface ElementQuantity {
  id: string;
  quantitySnapshotId: string;
  ifcGuid: string;
  quantityType: QuantityType;
  value: number;
}

export interface AggregatedQuantity {
  id: string;
  quantitySnapshotId: string;
  aggregationKey: "TARIFF" | "WBS" | "IFC_TYPE";
  keyValue: string;       // es. tariffCode, wbsCode, IfcWallStandardCase
  quantityType: QuantityType;
  value: number;
}
