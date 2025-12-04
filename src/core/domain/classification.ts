// src/core/domain/classification.ts

export type ClassificationSource = "IFC" | "USER" | "RULE";

export interface ElementClassification {
  id: string;
  projectId: string;
  modelVersionId: string;
  ifcGuid: string;

  // WBS multi-livello
  wbs0?: string;
  wbs1?: string;
  wbs2?: string;
  wbs3?: string;

  // Codice tariffa collegato a Tariff
  tariffCode?: string;

  source: ClassificationSource;
  createdAt: string;
  updatedAt: string;
}
