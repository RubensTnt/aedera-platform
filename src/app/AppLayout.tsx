// src/app/AppLayout.tsx

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ViewerContainer } from "@ui/layout/ViewerContainer";
import { useProjects } from "../core/projects/ProjectContext";
import { useEffect, useState } from "react";
import { getMe, logout } from "../core/api/aederaApi";


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
  
  const [me, setMe] = useState<any | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getMe();
      setMe(u);
    })();
  }, []);

  const initials = me?.email
    ? me.email[0].toUpperCase()
    : "U";
    
  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== "/" && location.pathname.startsWith(path));

  const showDatiWbsOverlay = location.pathname.startsWith("/parametri-bim");

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900">
      {/* TOP BAR */}
      <header className="h-12 flex items-center px-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-sky-600 flex items-center justify-center text-xs font-semibold text-white">
            A
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Aedera Platform</span>
            <span className="text-[11px] text-slate-500">Digital Twin · BIM · WBS</span>
          </div>
        </div>

        {/* Centro: selezione progetto */}
        <div className="flex-1 flex justify-center">
          <ProjectSwitcher me={me} />
        </div>

        {/* Destra: azioni */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <ProjectActionsMenu />
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="h-7 w-7 rounded-full bg-sky-600 flex items-center justify-center text-[11px] font-semibold text-white hover:bg-sky-700"
              title={me?.email ?? "Utente"}
            >
              {initials}
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-[110%] z-50 w-48 rounded-md border border-slate-200 bg-white shadow-sm p-2">
                <div className="px-2 py-1 text-[11px] text-slate-500">
                  {me?.email}
                </div>

                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">
                  {me?.platformRole}
                </div>

                <hr className="my-2 border-slate-200" />

                <button
                  onClick={async () => {
                    await logout();
                    window.location.href = "/login";
                  }}
                  className="w-full text-left px-2 py-1.5 text-[12px] rounded hover:bg-slate-50 text-rose-600"
                >
                  Logout
                </button>
              </div>
            )}
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
          <section className="h-72 min-h-[220px] bg-slate-100 px-4 py-3 overflow-hidden">
            <div className="h-full min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm p-3 overflow-y-auto">
              {children}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};


function ProjectSwitcher({ me }: { me: any | null }) {
  const {
    projects,
    currentProject,
    currentProjectId,
    setProjectById,
    createNewProject,
  } = useProjects();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)}>
        {currentProject?.name ?? (currentProjectId ?? "Seleziona progetto")}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: "110%", background: "#fff", border: "1px solid #ddd", padding: 8, minWidth: 260, zIndex: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Progetti</div>

          <div style={{ maxHeight: 240, overflow: "auto" }}>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProjectById(p.id);
                  setOpen(false);
                }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", background: p.id === currentProjectId ? "#f2f2f2" : "transparent" }}
              >
                <div>{p.name}</div>
                {p.code ? <div style={{ fontSize: 12, opacity: 0.7 }}>{p.code}</div> : null}
              </button>
            ))}
          </div>


          {me?.platformRole === "PLATFORM_MANAGER" && (
            <>
              <hr style={{ margin: "10px 0" }} />
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                Nuovo progetto
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" style={{ width: "100%", marginBottom: 6 }} />
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Codice (opz.)" style={{ width: "100%", marginBottom: 6 }} />

              <button
                disabled={!name.trim()}
                onClick={async () => {
                  await createNewProject({ name: name.trim(), code: code.trim() || undefined });
                  setName("");
                  setCode("");
                  setOpen(false);
                }}
                style={{ width: "100%" }}
              >
                Crea
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}


function ProjectActionsMenu() {
  const { currentProject, renameProject, archiveProjectById } = useProjects();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 rounded border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600"
        title="Azioni progetto"
        disabled={!currentProject}
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-[110%] z-50 w-56 rounded-md border border-slate-200 bg-white shadow-sm p-1">
          <button
            className="w-full text-left px-2 py-2 text-xs rounded hover:bg-slate-50"
            onClick={async () => {
              if (!currentProject) return;
              const next = window.prompt("Nuovo nome progetto:", currentProject.name);
              if (!next || !next.trim()) return;
              await renameProject(currentProject.id, next.trim());
              setOpen(false);
            }}
          >
            ✏️ Rinomina progetto
          </button>

          <button
            className="w-full text-left px-2 py-2 text-xs rounded hover:bg-slate-50 text-rose-700"
            onClick={async () => {
              if (!currentProject) return;
              const ok = window.confirm(
                `Archiviare il progetto "${currentProject.name}"?\n\nI dati non verranno cancellati.`,
              );
              if (!ok) return;
              await archiveProjectById(currentProject.id);
              setOpen(false);
            }}
          >
            📦 Archivia progetto
          </button>
        </div>
      )}
    </div>
  );
}

async function onLogout() {
  await logout();
  window.location.href = "/login";
}
