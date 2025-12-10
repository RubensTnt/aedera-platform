import React, { useEffect, useRef } from "react";
import { initAederaViewer } from "@core/bim/thatopen";
import { DatiWbsSelectionOverlay } from "@ui/overlays/DatiWbsSelectionOverlay";

interface ViewerContainerProps {
  showDatiWbsOverlay?: boolean;
}

export const ViewerContainer: React.FC<ViewerContainerProps> = ({
  showDatiWbsOverlay = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    initAederaViewer(container);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#151515",
      }}
    >
      {showDatiWbsOverlay && <DatiWbsSelectionOverlay />}
    </div>
  );
};
