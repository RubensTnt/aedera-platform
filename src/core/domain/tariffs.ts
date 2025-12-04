// src/core/domain/tariffs.ts

export interface Tariff {
  id: string;
  projectId: string;
  tariffCode: string;      // "codice tariffa" usato nel modello
  poItemId?: string;       // opzionale: collegamento diretto alla voce P.O.
  description: string;
  createdAt: string;
  updatedAt: string;
}
