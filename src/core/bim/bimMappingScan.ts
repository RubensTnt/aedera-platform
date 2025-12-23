// src/core/bim/bimMappingScan.ts
//
// Nota: il nome storico contiene "Tariffa", ma ormai questa funzione serve a valutare
// la completezza del mapping (WBS v2 + tariffa/pacchetto).
// Quando vuoi, lo rinominiamo (vedi note in fondo).

import { getAllElements } from "./modelProperties";
import {
  bulkGetElementParams,
  bulkGetWbsAssignmentsV2,
  requireProjectId,
  type WbsAssignmentV2Dto,
} from "@core/api/aederaApi";
import { getModelInfo } from "./modelRegistry";
import {
  ALL_WBS_LEVEL_KEYS,
  DEFAULT_DATI_WBS_PROFILE,
  type WbsLevelKey,
} from "./datiWbsProfile";

export type bimMappingElementStatus = "empty" | "partial" | "complete";

export interface bimMappingScanResult {
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

function isNonEmpty(v: any): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function getDefaultRequiredWbsLevels(): WbsLevelKey[] {
  return (DEFAULT_DATI_WBS_PROFILE.levels ?? [])
    .filter((l) => l.enabled && l.required)
    .map((l) => l.key);
}

function isValidAssignment(a: WbsAssignmentV2Dto | null | undefined): boolean {
  if (!a) return false;
  if (a.status !== "VALID") return false;
  return typeof a.code === "string" ? a.code.trim().length > 0 : !!a.code;
}

function hasAnyAssignment(a: WbsAssignmentV2Dto | null | undefined): boolean {
  if (!a) return false;
  // per "any" contano anche INVALID/rawCode: serve per distinguere empty vs partial
  const code = typeof a.code === "string" ? a.code.trim() : a.code;
  const raw = typeof a.rawCode === "string" ? a.rawCode.trim() : a.rawCode;
  return !!code || !!raw;
}

export async function scanModelWbsTariffa(
  modelId: string,
  projectId?: string,
  requireTariffa = true,
  requirePacchetto = true,
  requiredWbsLevels?: WbsLevelKey[],
): Promise<bimMappingScanResult> {
  const pid = projectId ?? requireProjectId();
  const serverModelId = getModelInfo(modelId)?.serverId;

  const els = getAllElements(modelId) ?? [];
  const pairs = els
    .filter((e) => !!e.globalId)
    .map((e) => ({ localId: e.localId, globalId: e.globalId! }));

  if (!serverModelId || pairs.length === 0) {
    return {
      modelId,
      totalElements: pairs.length,
      emptyCount: pairs.length,
      partialCount: 0,
      completeCount: 0,
      elementsByStatus: {
        empty: pairs.map((p) => p.localId),
        partial: [],
        complete: [],
      },
    };
  }

  const guids = pairs.map((p) => p.globalId);

  // quali livelli devono essere obbligatori per considerare "WBS OK"
  const requiredLevels: WbsLevelKey[] =
    requiredWbsLevels && requiredWbsLevels.length ? requiredWbsLevels : getDefaultRequiredWbsLevels();

  const [assignV2Resp, paramsResp] = await Promise.all([
    // fetch su tutti i livelli per non perdere info (anche INVALID)
    bulkGetWbsAssignmentsV2(pid, {
      modelId: serverModelId,
      guids,
      levels: ALL_WBS_LEVEL_KEYS,
    }),
    bulkGetElementParams(pid, {
      modelId: serverModelId,
      guids,
      keys: ["tariffaCodice", "pacchettoCodice"],
    }),
  ]);

  const empty: number[] = [];
  const partial: number[] = [];
  const complete: number[] = [];

  for (const { localId, globalId } of pairs) {
    const wbsByLevel: Record<string, WbsAssignmentV2Dto | null> =
      (assignV2Resp as any).values?.[globalId] ?? {};

    const tariffa = paramsResp.values?.[globalId]?.tariffaCodice ?? null;
    const pacchetto = paramsResp.values?.[globalId]?.pacchettoCodice ?? null;

    const hasTariffa = isNonEmpty(tariffa);
    const hasPacchetto = isNonEmpty(pacchetto);

    const okTariffa = !requireTariffa || hasTariffa;
    const okPacchetto = !requirePacchetto || hasPacchetto;

    // “ha WBS” se almeno un livello ha una qualunque assegnazione (VALID o INVALID)
    const hasAnyWbs = ALL_WBS_LEVEL_KEYS.some((k) => hasAnyAssignment(wbsByLevel[k]));

    // “WBS OK” = tutti i livelli required devono essere VALID
    const requiredOk =
      requiredLevels.length > 0
        ? requiredLevels.every((k) => isValidAssignment(wbsByLevel[k]))
        : false;

    // manteniamo la logica storica: per essere COMPLETE serve *anche* che esista almeno
    // un WBS valido (non vogliamo “complete” con solo tariffa/pacchetto).
    const hasSomeValidWbs = ALL_WBS_LEVEL_KEYS.some((k) => isValidAssignment(wbsByLevel[k]));

    const any = hasAnyWbs || hasTariffa || hasPacchetto;

    if (!any) {
      empty.push(localId);
    } else if (hasSomeValidWbs && requiredOk && okTariffa && okPacchetto) {
      complete.push(localId);
    } else {
      partial.push(localId);
    }
  }

  return {
    modelId,
    totalElements: pairs.length,
    emptyCount: empty.length,
    partialCount: partial.length,
    completeCount: complete.length,
    elementsByStatus: { empty, partial, complete },
  };
}
