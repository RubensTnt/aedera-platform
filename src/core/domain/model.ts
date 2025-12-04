// src/core/domain/model.ts

export type IfcSchema = "IFC2X3" | "IFC4" | "IFC_UNKNOWN";

export type ModelDiscipline = "ARCH" | "STR" | "MEP" | "GENERIC";

export interface Model {
  id: string;
  projectId: string;
  name: string;
  discipline: ModelDiscipline;
  createdAt: string;
  updatedAt: string;
}

export interface ModelVersion {
  id: string;
  modelId: string;
  versionNumber: number;
  schema: IfcSchema;
  ifcFilePath: string; // path lato backend / storage
  uploadedAt: string;
  uploadedByUserId: string;
  notes?: string;
}
