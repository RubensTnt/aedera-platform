// src/app/AppLayout.tsx

import React from "react";
import { ViewerContainer } from "@ui/layout/ViewerContainer";
import { PoUploadPanel } from "@ui/po/PoUploadPanel";
import { PoFilterPanel } from "@ui/po/PoFilterPanel";
import { Link, useLocation } from "react-router-dom";


export const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: "/progettazione", label: "Progettazione" },
    { path: "/gare", label: "Gare" },
    { path: "/contabilita", label: "Contabilità" },
    { path: "/programmazione", label: "Programmazione" },
    { path: "/direzione-tecnica", label: "Direzione tecnica" },
  ];

  return (
    <div className="app-shell" style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
      {/* Header */}
      <header
        style={{
          padding: "0.5rem 1rem",
          borderBottom: "1px solid #333",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <strong>Aedera Platform</strong>

        <nav style={{ display: "flex", gap: "0.75rem", fontSize: 14 }}>
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  color: active ? "#facc15" : "#f5f5f5",
                  textDecoration: "none",
                  borderBottom: active ? "2px solid #facc15" : "2px solid transparent",
                  paddingBottom: "2px",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
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
        <aside
          style={{
            borderRight: "1px solid #333",
            padding: "0.5rem",
            overflowY: "auto",
          }}
        >
          {children}
        </aside>

        {/* Viewer */}
        <main>
          <ViewerContainer />
        </main>

        {/* Right panel */}
        <aside
          style={{
            borderLeft: "1px solid #333",
            padding: "0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <PoUploadPanel poId="PO-Struttura-Catania" />
          <PoFilterPanel />
        </aside>
      </div>
    </div>
  );
};
