// src/core/bim/ifcLoader.ts

import * as OBC from "@thatopen/components";
import { getAederaViewer } from "@core/bim/thatopen";
import {
  extractPropertiesForModel,
  listIfcTypes,
  listPsetNames,
  listPsetPropertyNames,
} from "@core/bim/modelProperties";
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
