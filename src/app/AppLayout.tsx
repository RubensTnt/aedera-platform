// src/app/AppLayout.tsx

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ViewerContainer } from "@ui/layout/ViewerContainer";

type NavItem = {
  label: string;
  path: string;
};

const PRIMARY_NAV: NavItem[] = [
  { label: "Modelli", path: "/modelli" },
  { label: "Progettazione", path: "/progettazione" },
  { label: "Parametri BIM", path: "/parametri-bim" },
  { label: "Computo & Quantità", path: "/contabilita" },
  { label: "Programmazione", path: "/programmazione" },
];

const SECONDARY_NAV: NavItem[] = [
  { label: "Esportazioni / Report", path: "/report" },
  { label: "Impostazioni", path: "/impostazioni" },
];

export const AppLayout: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== "/" && location.pathname.startsWith(path));

  const showDatiWbsOverlay = location.pathname.startsWith("/parametri-bim");

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900">
      {/* TOP BAR */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-sky-600 flex items-center justify-center text-xs font-semibold text-white">
            A
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Aedera Platform</span>
            <span className="text-[11px] text-slate-500">
              Digital Twin · BIM · WBS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <button
            type="button"
            className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50"
          >
            Salva
          </button>
          <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-semibold">
            U
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 min-h-0">
        {/* SIDEBAR */}
        <aside className="w-64 border-r border-slate-200 bg-white flex flex-col">
          <div className="px-3 py-3 border-b border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Moduli
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-6 text-[13px]">
            <div className="space-y-1">
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={[
                    "flex items-center gap-2 px-2 py-1.5 rounded-md border text-[13px]",
                    isActive(item.path)
                      ? "border-sky-500 bg-sky-50 text-sky-700"
                      : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  ].join(" ")}
                >
                  <span className="h-5 w-5 rounded bg-slate-100 flex items-center justify-center text-[11px] text-slate-500">
                    {item.label[0]}
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="space-y-1">
              <div className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
                Amministrazione
              </div>
              {SECONDARY_NAV.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={[
                    "flex items-center gap-2 px-2 py-1.5 rounded-md border text-[13px]",
                    isActive(item.path)
                      ? "border-sky-500 bg-sky-50 text-sky-700"
                      : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  ].join(" ")}
                >
                  <span className="h-5 w-5 rounded bg-slate-100 flex items-center justify-center text-[11px] text-slate-500">
                    {item.label[0]}
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </nav>

          <div className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-400">
            Aedera · v0.1 · UI layout demo
          </div>
        </aside>

        {/* MAIN AREA */}
        <main className="flex-1 flex flex-col min-h-0">
          {/* VIEWPORT 3D */}
          <section className="flex-1 min-h-[260px] border-b border-slate-200 bg-slate-200 relative">
            <ViewerContainer showDatiWbsOverlay={showDatiWbsOverlay} />
          </section>

          {/* PANNELLO INFERIORE (MODULO CORRENTE) */}
          <section className="h-72 min-h-[220px] bg-slate-100 px-4 py-3 overflow-y-auto">
            <div className="h-full rounded-xl border border-slate-200 bg-white shadow-sm p-3">
              {children}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
