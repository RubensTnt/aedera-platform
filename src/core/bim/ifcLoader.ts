// src/core/bim/ifcLoader.ts

import * as OBC from "@thatopen/components";
import { getAederaViewer } from "@core/bim/thatopen";
import {
  extractPropertiesForModel,
  listIfcTypes,
  listPsetNames,
  listPsetPropertyNames,
  getAllElements,
  setDatiWbsProps,
  type DatiWbsProps,
} from "@core/bim/modelProperties";
import { bulkGetDatiWbs, requireProjectId } from "@core/api/aederaApi";
import { upsertIfcModel } from "./modelRegistry";

/**
 * Carica un file IFC selezionato dall'utente e lo converte in Fragments.
 * Il modello Fragments verrà aggiunto alla scena dal FragmentsManager
 * (configurato in thatopen.ts) e le sue proprietà verranno analizzate.
 */
export async function loadIfcFromFile(file: File): Promise<void> {
  const ctx = getAederaViewer();
  if (!ctx) {
    console.error("[IFC Loader] Viewer non inizializzato");
    return;
  }

  const { components } = ctx;

  const ifcLoader = components.get(OBC.IfcLoader);

  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
      path: "https://unpkg.com/web-ifc@0.0.72/",
      absolute: true,
    },
  });

  const buffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(buffer);

  console.time("[IFC Loader] load");
  const model = await ifcLoader.load(typedArray, true, file.name, {
    processData: {
      progressCallback: (progress) => {
        console.log("[IFC Loader] progress:", progress);
      },
    },
  });
  console.timeEnd("[IFC Loader] load");

  // 🔹 Estrazione proprietà e indicizzazione
  try {
    await extractPropertiesForModel(model);
  } catch (error) {
    console.warn(
      "[IFC Loader] Errore durante extractPropertiesForModel:",
      error,
    );
  }

  // 🔁 Ripristino DATI_WBS persistiti su DB (per projectId)
  try {
    const modelId = model.modelId;
    const elements = getAllElements(modelId) ?? [];

    const globalToLocal = new Map<string, number>();
    for (const el of elements) {
      if (el.globalId) globalToLocal.set(el.globalId, el.localId);
    }

    const projectId = requireProjectId();

    const elementIds = elements
      .map((e) => e.globalId)
      .filter((v): v is string => !!v);

    const rows = await bulkGetDatiWbs(projectId, elementIds);

    // rows: [{ ifcGlobalId, wbs0..wbs10, tariffaCodice, pacchettoCodice, ...}]
    for (const row of rows) {
      const gid = row.ifcGlobalId as string | undefined;
      if (!gid) continue;
      const localId = globalToLocal.get(gid);
      if (localId == null) continue;

      const patch: Partial<DatiWbsProps> = {};

      for (let i = 0; i <= 10; i++) {
        const k = `wbs${i}`;
        if (k in row) {
          const v = row[k];
          (patch as any)[`WBS${i}`] = v == null ? null : String(v);
        }
      }

      if ("tariffaCodice" in row) {
        const v = row.tariffaCodice;
        patch.TariffaCodice = v == null ? null : String(v);
      }

      if ("pacchettoCodice" in row) {
        const v = row.pacchettoCodice;
        patch.PacchettoCodice = v == null ? null : String(v);
      }

      // Applica nel PropertyEngine (non rilanciamo writeDatiWbs per evitare loop di persistenza)
      setDatiWbsProps(modelId, localId, patch);
    }

    console.log("[IFC Loader] Ripristino DATI_WBS da DB completato", {
      modelId,
      restored: rows.length,
    });
  } catch (error) {
    console.warn("[IFC Loader] Ripristino DATI_WBS da DB fallito:", error);
  }

  // 🔎 Debug + registrazione nel Model Registry
  try {
    const modelId = model.modelId;
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
      console.log("[PropertyEngine] Pset dettaglio:", {
        modelId,
        psetName,
        properties: propNames,
      });
    }

    // ✅ registra/aggiorna il modello nel registry (nome file + numero elementi)
    upsertIfcModel(modelId, file.name);
  } catch (error) {
    console.warn(
      "[IFC Loader] Errore durante il riepilogo PropertyEngine / ModelRegistry:",
      error,
    );
  }
}



export async function loadIfcFromUrl(url: string, label?: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch IFC: ${res.status}`);
  const buf = await res.arrayBuffer();
  const fileName = label ?? url.split("/").pop() ?? "model.ifc";
  const file = new File([buf], fileName, { type: "application/octet-stream" });
  return loadIfcFromFile(file);
}
