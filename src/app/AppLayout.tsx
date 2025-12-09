// src/app/AppLayout.tsx

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { ViewerContainer } from "@ui/layout/ViewerContainer";
import { Link, useLocation } from "react-router-dom";
import { PoWorkspace } from "@ui/po/PoWorkspace";

export const AppLayout: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();

  const navItems = [
    { path: "/progettazione", label: "Progettazione" },
    { path: "/parametri-bim", label: "Parametri BIM" },
    { path: "/gare", label: "Gare" },
    { path: "/contabilita", label: "Contabilità" },
    { path: "/programmazione", label: "Programmazione" },
    { path: "/direzione-tecnica", label: "Direzione Tecnica" },
  ];

  // larghezza pannello destro (in px), regolabile da UI
  const [rightWidth, setRightWidth] = useState<number>(320);
  const isResizingRef = useRef(false);
  const lastXRef = useRef<number | null>(null);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      isResizingRef.current = true;
      lastXRef.current = event.clientX;
      event.preventDefault();
    },
    [],
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingRef.current || lastXRef.current == null) return;

      const dx = event.clientX - lastXRef.current;
      lastXRef.current = event.clientX;

      setRightWidth((prev) => {
        const next = prev - dx; // se trascini verso destra, pannello più largo
        const min = 220;
        const max = 600;
        return Math.min(Math.max(next, min), max);
      });
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      lastXRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div
      className="app-shell"
      style={{ display: "grid", gridTemplateRows: "auto 1fr" }}
    >
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
                  borderBottom: active
                    ? "2px solid #facc15"
                    : "2px solid transparent",
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
          gridTemplateColumns: "280px 1fr",
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

        {/* Center: viewer + resizer + right panel */}
        <div
          style={{
            display: "flex",
            minWidth: 0,
            minHeight: 0,
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* Viewer */}
          <main
            style={{
              flex: "1 1 auto",
              minWidth: 0,
            }}
          >
            <ViewerContainer />
          </main>

          {/* Resizer handle */}
          <div
            style={{
              width: "4px",
              cursor: "col-resize",
              backgroundColor: "#333",
            }}
            onMouseDown={handleResizeStart}
          />

          {/* Right panel: workspace PO completo */}
          <aside
            style={{
              width: rightWidth,
              borderLeft: "1px solid #333",
              padding: "0.5rem",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              minHeight: 0,
            }}
          >
            <PoWorkspace />
          </aside>
        </div>
      </div>
    </div>
  );
};