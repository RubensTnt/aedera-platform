// src/core/bim/propertyIO.ts

/**
 * Layer di I/O per i parametri DATI_WBS.
 *
 * In questa prima fase NON scriviamo ancora nel modello IFC tramite
 * PropertiesProcessor di ThatOpen; ci appoggiamo al Property Engine
 * interno (modelProperties.ts), che già mantiene un indice dei Pset
 * per ciascun elemento.
 *
 * In futuro, questo modulo sarà il punto unico in cui:
 *  - leggere / scrivere DATI_WBS dal modello IFC (Fragments / PropertiesProcessor)
 *  - sincronizzare l'indice interno del Property Engine
 */

import {
  type DatiWbsProps,
  getDatiWbsProps,
  setDatiWbsProps,
  getElementRecord,
} from "./modelProperties";
import { getProjectId, upsertElementDatiWbs } from "../api/aederaApi";


/**
 * Restituisce i DATI_WBS correnti di un elemento, se presenti
 * nell'indice del Property Engine.
 */
export function readDatiWbs(
  modelId: string,
  localId: number,
): DatiWbsProps | undefined {
  return getDatiWbsProps(modelId, localId);
}

/**
 * Applica un patch DATI_WBS a un elemento (nell'indice interno).
 *
 * In questa fase NON persistiamo nel file IFC; lo scopo è fornire
 * un entrypoint unico per eventuali future logiche di sincronizzazione.
 */
export function writeDatiWbs(
  modelId: string,
  localId: number,
  patch: Partial<DatiWbsProps>,
) {
  const updated = setDatiWbsProps(modelId, localId, patch);

  const record = getElementRecord(modelId, localId);
  const globalId = record?.globalId;
  if (globalId) {
    void upsertElementDatiWbs(getProjectId(), globalId, patch);
  }

  return updated;
}

// Riesportiamo il tipo così la UI può importarlo direttamente da qui, se serve.
export type { DatiWbsProps };
