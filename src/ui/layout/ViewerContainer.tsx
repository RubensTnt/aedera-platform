import React, { useEffect, useRef } from "react";
import { initAederaViewer, destroyAederaViewer } from "@core/bim/thatopen";
import { clearModelsRegistry } from "@core/bim/modelRegistry";
import { listProjectModels, API_BASE } from "@core/api/aederaApi";
import { loadIfcFromUrl } from "@core/bim/ifcLoader";
import { useProjects } from "@core/projects/ProjectContext";
import { DatiWbsSelectionOverlay } from "@ui/overlays/DatiWbsSelectionOverlay";
import { setServerIdForModel } from "@core/bim/modelRegistry";

interface ViewerContainerProps {
  showDatiWbsOverlay?: boolean;
}

export const ViewerContainer: React.FC<ViewerContainerProps> = ({
  showDatiWbsOverlay = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { currentProjectId } = useProjects();

  useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  let cancelled = false;

  // init viewer (non toccare innerHTML: React gestisce il DOM)
  initAederaViewer(container);

  (async () => {
    if (!currentProjectId) return;

    // quando cambio progetto, prima resetto solo la parte logica
    clearModelsRegistry();

    const models = await listProjectModels(currentProjectId);
    for (const m of models) {
      if (cancelled) return;
      const modelId = await loadIfcFromUrl(`${API_BASE}${m.url}`, m.label);
      setServerIdForModel(modelId, m.id);
    }
  })().catch((err) => {
    console.error("[ViewerContainer] load project models failed", err);
  });

  // ✅ cleanup: qui è sicuro distruggere viewer e registry
  return () => {
    cancelled = true;
    try {
      clearModelsRegistry();
      destroyAederaViewer();
    } catch {}
  };
}, [currentProjectId]);

  return (
    <div key={currentProjectId ?? "no-project"} ref={containerRef} className="relative h-full w-full">
      {showDatiWbsOverlay ? <DatiWbsSelectionOverlay /> : null}
    </div>
  );
};
