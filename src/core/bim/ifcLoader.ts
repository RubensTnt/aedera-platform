// src/core/bim/ifcLoader.ts

import * as OBC from "@thatopen/components";
import { getAederaViewer } from "@core/bim/thatopen";
import { extractPropertiesForModel } from "@core/bim/modelProperties";

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

  // 🔹 Ora abbiamo il FragmentsModel restituito dal loader
  // FragmentsManager lo aggancerà alla scena (grazie alla config in thatopen.ts)
  // Qui inneschiamo l'estrazione info modello
  try {
    await extractPropertiesForModel(model);
  } catch (error) {
    console.warn("[IFC Loader] Errore durante extractPropertiesForModel:", error);
  }
}
