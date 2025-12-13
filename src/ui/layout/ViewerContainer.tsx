import React, { useEffect, useRef } from "react";
import { initAederaViewer, destroyAederaViewer } from "@core/bim/thatopen";
import { clearModelsRegistry } from "@core/bim/modelRegistry";
import { listProjectModels, API_BASE } from "@core/api/aederaApi";
import { loadIfcFromUrl } from "@core/bim/ifcLoader";
import { useProjects } from "@core/projects/ProjectContext";
import { DatiWbsSelectionOverlay } from "@ui/overlays/DatiWbsSelectionOverlay";

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

    // 🔁 Reset totale viewer + registry a ogni cambio progetto
    clearModelsRegistry();
    destroyAederaViewer();
    container.innerHTML = "";

    // init viewer
    initAederaViewer(container);

    // carica tutti i modelli del progetto
    let cancelled = false;
    (async () => {
      if (!currentProjectId) return;

      const models = await listProjectModels(currentProjectId);
      for (const m of models) {
        if (cancelled) return;
        await loadIfcFromUrl(`${API_BASE}${m.url}`, m.label);
      }
    })().catch((err) => {
      console.error("[ViewerContainer] load project models failed", err);
    });

    return () => {
      cancelled = true;
    };
  }, [currentProjectId]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {showDatiWbsOverlay ? <DatiWbsSelectionOverlay /> : null}
    </div>
  );
};
