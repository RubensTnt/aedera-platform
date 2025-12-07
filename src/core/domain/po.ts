// src/core/domain/po.ts

/**
 * Fase del ciclo di vita del PO a cui si riferisce questo set di righe.
 * Può evolvere: gara -> preventivo -> sal -> asbuilt, ecc.
 */
export type PoPhase = "gara" | "preventivo" | "sal" | "asbuilt";

/**
 * Header del preventivo operativo (informazioni di contesto).
 * Il dettaglio riga per riga è rappresentato da POItem.
 */
export interface PreventivoOperativo {
  id: string;
  projectId: string;
  name: string;
  version: string;
  phase: PoPhase;

  /**
   * Percorso del file Excel originale lato backend, se esiste.
   * Nel frontend può essere undefined: il PO può nascere direttamente in piattaforma.
   */
  sourceFilePath?: string;

  createdAt: string;
  createdByUserId: string;
}

/**
 * Una singola riga del "foglio PO digitale".
 * È pensata per essere sufficientemente generica da coprire:
 * - fasi di gara / quotazione
 * - preventivo operativo
 * - SAL
 * - analisi costi / scostamenti
 */
export interface POItem {
  /**
   * Identificatore interno univoco della riga.
   * Può essere un UUID o un id generato (es. PO-1-0001).
   */
  id: string;

  /**
   * Id logico del PO a cui appartiene questa riga.
   */
  poId: string;

  /**
   * Codice breve interno della voce (può coincidere con RCM o essere un codice aziendale).
   */
  code: string;

  /**
   * Descrizione estesa della lavorazione.
   */
  description: string;

  /**
   * Unità di misura (es. m³, m², cad, corpo, ecc.).
   */
  unit: string;

  /**
   * Costo unitario (Cu) di baseline per questa voce.
   * In molte situazioni coincide con il prezzo unitario, ma li teniamo separati per estendere in futuro.
   */
  unitCost?: number;

  /**
   * Prezzo unitario (listino / offerta) di baseline.
   */
  unitPrice?: number;

  // ---------------------------------------------------------------------------
  //  WBS – struttura gerarchica come da tuo Excel:
  //  WBS0, WBS1, WBS4, WBS6, WBS7, WBS8, WBS9, ecc.
  //  Le rendiamo esplicite per poter filtrare "come in Excel".
  // ---------------------------------------------------------------------------

  wbs0?: string; // Commessa
  wbs1?: string; // Centro di costo / costi
  wbs4?: string; // Edificio
  wbs6?: string; // Livello / Piano
  wbs7?: string; // Categoria d'opera (es. GC, STR, SCV, FON, ...)
  wbs8?: string; // Categoria di lavorazione
  wbs9?: string; // Sottocategoria di lavorazione

  /**
   * Codice WBS "principale" usato per i filtri BIM rapidi (es. FON / STR / SCV, ecc.).
   * Tipicamente coincide con wbs7 o wbs8 in base alla tua configurazione.
   */
  wbsCode?: string;

  // ---------------------------------------------------------------------------
  //  Tariffe e collegamento con il modello IFC
  // ---------------------------------------------------------------------------

  /**
   * Codice RCM originale del PO (es. "2.1", "5.4.3", ...).
   * Questa è la colonna che vedi sul foglio come "Riferimento Computo Metrico".
   */
  rcm?: string;

  /**
   * Codice tariffa combinato che deve combaciare con STM_Tariffa Combinata nel modello IFC.
   * Es: "GC.2.1", "FON.05", ecc.
   */
  tariffCode?: string;

  // ---------------------------------------------------------------------------
  //  Quantità e importi di baseline (fase p1 del tuo foglio: Q1(p1), Cu(p1), CST(p1)).
  // ---------------------------------------------------------------------------

  /**
   * Quantità di baseline del PO per questa voce (es. colonna Q1(p1)).
   */
  baselineQuantity?: number;

  /**
   * Importo totale di baseline del PO per questa voce (es. colonna CST(p1)).
   * Se non fornito può essere calcolato come baselineQuantity * unitPrice.
   */
  baselineAmount?: number;

  // ---------------------------------------------------------------------------
  //  Hook futuri per SAL / avanzamento / scostamenti
  //  (li lasciamo commentati per ora, ma il modello è pensato per estenderli qui)
  // ---------------------------------------------------------------------------

  // salQuantity?: number;       // quantità contabilizzata a SAL
  // salAmount?: number;         // importo contabilizzato a SAL
  // asBuiltQuantity?: number;   // quantità consuntivata finale
  // asBuiltAmount?: number;     // importo consuntivato finale
}
