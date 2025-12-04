// src/app/AppLayout.tsx

import React from "react";
import { ViewerContainer } from "@ui/layout/ViewerContainer";
// I percorsi con @core / @ui saranno configurati in tsconfig + vite alias

export const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div className="app-shell" style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
      {/* Header */}
      <header style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #333" }}>
        <strong>Aedera Platform</strong>
        {/* Qui andranno: selettore progetto, modello, view, ecc. */}
      </header>

      {/* Body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr 320px",
          height: "calc(100vh - 48px)",
        }}
      >
        {/* Left panel */}
        <aside style={{ borderRight: "1px solid #333", padding: "0.5rem" }}>
          {/* Qui: filtri, liste modelli, WBS, ecc. */}
          {children /* in alcune view potremo mettere contenuto specifico */}
        </aside>

        {/* Viewer */}
        <main>
          <ViewerContainer />
        </main>

        {/* Right panel */}
        <aside style={{ borderLeft: "1px solid #333", padding: "0.5rem" }}>
          {/* Qui: pannelli info, tab proprietà / SAL / ecc. */}
          <em>Dettagli elemento / pannello della view</em>
        </aside>
      </div>
    </div>
  );
};
