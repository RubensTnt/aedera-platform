// src/ui/layout/ViewerContainer.tsx

import React, { useEffect, useRef } from "react";
import { initAederaViewer } from "@core/bim/thatopen";

export const ViewerContainer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // inizializza il viewer ThatOpen una sola volta
    initAederaViewer(container);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#151515",
      }}
    />
  );
};
