// src/ui/layout/ViewerContainer.tsx

import React, { useEffect, useRef } from "react";
import { initAederaViewer } from "@core/bim/thatopen";

export const ViewerContainer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    void initAederaViewer(containerRef.current);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#151515" }}
    />
  );
};

