// src/core/bim/ifcLoader.ts

import * as OBC from "@thatopen/components";
import { getAederaViewer } from "@core/bim/thatopen";
import { upsertIfcModel } from "./modelRegistry";
import { setBimMappingForModel, type BimMappingRow } from "@core/bim/bimMappingStore";
import { getAllElements } from "@core/bim/modelProperties";
import { ALL_WBS_LEVEL_KEYS } from "@core/bim/datiWbsProfile";
import {
  extractPropertiesForModel,
  listIfcTypes,
  listPsetNames,
  listPsetPropertyNames,
} from "@core/bim/modelProperties";
import {
  bulkGetElementParams,
  bulkGetWbsAssignmentsV2,
  requireProjectId,
  indexElementsForModel,
} from "@core/api/aederaApi";



function buildIndexElementsPayload(modelId: string) {
  const els = getAllElements(modelId) ?? [];

  const elements = [];

  for (const el of els) {
    const guid = el.globalId;
    if (!guid) continue;

    elements.push({
      guid,
      ifcType: el.ifcType ?? "UNKNOWN",
      name: el.name ?? null,
      typeName: el.typeName ?? null,
      category: el.category ?? null,
    });
  }

  return { elements };
}


export async function loadIfcFromFile(
  file: File,
  opts?: { projectId?: string; ifcModelId?: string; indexElements?: boolean }
): Promise<string> {
  const ctx = getAederaViewer();
  if (!ctx) throw new Error("[IFC Loader] Viewer non inizializzato");

  const { components } = ctx;
  const ifcLoader = components.get(OBC.IfcLoader);

  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: { path: "https://unpkg.com/web-ifc@0.0.72/", absolute: true },
  });

  const buffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(buffer);

  console.time("[IFC Loader] load");
  const model = await ifcLoader.load(typedArray, true, file.name, {
    processData: {
      progressCallback: (progress) => console.log("[IFC Loader] progress:", progress),
    },
  });
  console.timeEnd("[IFC Loader] load");

  // Indicizza proprietà
  try {
    await extractPropertiesForModel(model);
  } catch (error) {
    console.warn("[IFC Loader] Errore durante extractPropertiesForModel:", error);
  }

  const modelId = model.modelId;

  // STEP 1: indicizzazione ELEMENTI (minima) su server
  try {
    const projectId = opts?.projectId ?? requireProjectId();
    const ifcModelId = opts?.ifcModelId;

    if (opts?.indexElements !== false && ifcModelId) {
      const payload = buildIndexElementsPayload(modelId);
      await indexElementsForModel(projectId, ifcModelId, payload);

      console.log("[IFC Loader] Elements indicizzati su server:", {
        projectId,
        ifcModelId,
        elements: payload.elements.length,
      });
    }
  } catch (err) {
    console.warn("[IFC Loader] index-elements fallito:", err);
  }

  // Debug + registry
  try {
    const ifcTypes = listIfcTypes(modelId);
    const psetNames = listPsetNames(modelId);

    console.log("[PropertyEngine] IFC types nel modello:", {
      modelId,
      count: ifcTypes.length,
      types: ifcTypes,
    });

    console.log("[PropertyEngine] Pset nel modello:", {
      modelId,
      count: psetNames.length,
      psets: psetNames,
    });

    for (const psetName of psetNames.slice(0, 3)) {
      const propNames = listPsetPropertyNames(modelId, psetName);
      console.log("[PropertyEngine] Pset dettaglio:", { modelId, psetName, properties: propNames });
    }

    upsertIfcModel(modelId, file.name);

    // 🔁 Restore mapping server-based (WBS + ElementParams)
    try {
      const projectId = opts?.projectId ?? requireProjectId();
      const ifcModelId = opts?.ifcModelId;

      if (!ifcModelId) throw new Error("Missing ifcModelId (server model id) for restore mapping");

      const elements = getAllElements(modelId) ?? [];
      const guids = elements.map((e) => e.globalId).filter((v): v is string => !!v);

      const [wbsV2Resp, paramsResp] = await Promise.all([
        bulkGetWbsAssignmentsV2(projectId, { modelId: ifcModelId, guids, levels: ALL_WBS_LEVEL_KEYS }),
        bulkGetElementParams(projectId, {
          modelId: ifcModelId,
          guids,
          keys: ["tariffaCodice", "pacchettoCodice", "codiceMateriale", "fornitoreIds"],
        } as any),
      ]);

      const rows: BimMappingRow[] = guids.map((gid) => {
        const v = (paramsResp as any).values?.[gid] ?? {};
        return {
          globalId: gid,
          wbsByLevel: (wbsV2Resp as any).values?.[gid] ?? undefined,
          tariffaCodice: v["tariffaCodice"] ?? null,
          pacchettoCodice: v["pacchettoCodice"] ?? null,
          codiceMateriale: v["codiceMateriale"] ?? null,
          fornitoreIds: v["fornitoreIds"] ?? null,
        };
      });

      setBimMappingForModel(modelId, projectId, rows);
    } catch (err) {
      console.warn("[IFC Loader] Restore BIM mapping fallito:", err);
    }
  } catch (error) {
    console.warn("[IFC Loader] Errore riepilogo PropertyEngine / ModelRegistry:", error);
  }

  return modelId;
}


export async function loadIfcFromUrl(
  url: string,
  label?: string,
  opts?: { projectId?: string; ifcModelId?: string; indexElements?: boolean },
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch IFC: ${res.status}`);
  const buf = await res.arrayBuffer();
  const fileName = label ?? url.split("/").pop() ?? "model.ifc";
  const file = new File([buf], fileName, { type: "application/octet-stream" });
  return loadIfcFromFile(file, opts);
}
