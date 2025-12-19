// src/core/bim/wbsTariffaScan.ts

import { getAllElements } from "./modelProperties";
import { bulkGetElementParams, bulkGetWbsAssignments } from "@core/api/aederaApi";

export type WbsTariffaElementStatus = "empty" | "partial" | "complete";

export interface WbsTariffaScanResult {
  modelId: string;
  totalElements: number;
  emptyCount: number;
  partialCount: number;
  completeCount: number;
  elementsByStatus: {
    empty: number[];
    partial: number[];
    complete: number[];
  };
}

/**
 * “Completo” = ha WBS assegnata + (tariffaCodice) + (pacchettoCodice)
 * Se vuoi regole diverse, le cambiamo qui in un punto solo.
 */
export async function scanModelWbsTariffa(
  projectId: string,
  modelId: string,
  requireTariffa: boolean,
  requirePacchetto: boolean,
): Promise<WbsTariffaScanResult> {
  const elements = getAllElements(modelId) ?? [];
  const pairs = elements
    .map((e) => ({ localId: e.localId, globalId: e.globalId }))
    .filter((x): x is { localId: number; globalId: string } => !!x.globalId);

  const globalIds = pairs.map((p) => p.globalId);

  const [assignResp, paramsResp] = await Promise.all([
    bulkGetWbsAssignments(projectId, { globalIds }),
    bulkGetElementParams(projectId, { globalIds, keys: ["tariffaCodice", "pacchettoCodice"] }),
  ]);

  const empty: number[] = [];
  const partial: number[] = [];
  const complete: number[] = [];

  for (const { localId, globalId } of pairs) {
    const wbsNodeId = assignResp.assignmentByGlobalId?.[globalId] ?? null;
    const tariffa = paramsResp.values?.[globalId]?.["tariffaCodice"];
    const pacchetto = paramsResp.values?.[globalId]?.["pacchettoCodice"];

    const hasWbs = !!wbsNodeId;
    const hasTariffa = typeof tariffa === "string" ? tariffa.trim().length > 0 : !!tariffa;
    const hasPacchetto = typeof pacchetto === "string" ? pacchetto.trim().length > 0 : !!pacchetto;

    const any = hasWbs || hasTariffa || hasPacchetto;
    if (!any) {
      empty.push(localId);
      continue;
    }

    const okTariffa = requireTariffa ? hasTariffa : true;
    const okPacchetto = requirePacchetto ? hasPacchetto : true;

    if (hasWbs && okTariffa && okPacchetto) complete.push(localId);
    else partial.push(localId);
  }

  return {
    modelId,
    totalElements: elements.length,
    emptyCount: empty.length,
    partialCount: partial.length,
    completeCount: complete.length,
    elementsByStatus: { empty, partial, complete },
  };
}
