import React, { useEffect, useMemo, useState } from "react";
import { DatiWbsProfileSettingsPanel } from "./DatiWbsProfileSettingsPanel";
import { useProjects } from "@core/projects/ProjectContext";
import type { AederaProject } from "@core/projects/projectTypes";
import { FornitoriSettingsPanel } from "./FornitoriSettingsPanel";

type SettingsTab = "wbs" | "suppliers" | "archived";

export const ImpostazioniView: React.FC = () => {
  const [tab, setTab] = useState<SettingsTab>("wbs");

  return (
    <div className="h-full w-full flex flex-col gap-4 text-sm text-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Impostazioni</h2>
        <span className="text-xs text-slate-500">
          Progetti, WBS, preferenze UI
        </span>
      </div>

      <div className="flex-1 grid grid-cols-[260px_1fr] gap-4">
        {/* Sidebar */}
        <aside className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="text-[11px] font-semibold text-slate-500 px-2 py-2">
            SEZIONI
          </div>

          <button
            className={[
              "w-full text-left px-3 py-2 rounded-md text-xs",
              tab === "wbs"
                ? "bg-sky-50 text-sky-700 border border-sky-200"
                : "hover:bg-slate-50",
            ].join(" ")}
            onClick={() => setTab("wbs")}
          >
            WBS · Parametri BIM
          </button>

          <button
            className={[
              "mt-1 w-full text-left px-3 py-2 rounded-md text-xs",
              tab === "suppliers"
                ? "bg-sky-50 text-sky-700 border border-sky-200"
                : "hover:bg-slate-50",
            ].join(" ")}
            onClick={() => setTab("suppliers")}
          >
            Fornitori
          </button>

          <button
            className={[
              "mt-1 w-full text-left px-3 py-2 rounded-md text-xs",
              tab === "archived"
                ? "bg-sky-50 text-sky-700 border border-sky-200"
                : "hover:bg-slate-50",
            ].join(" ")}
            onClick={() => setTab("archived")}
          >
            Progetti archiviati
          </button>
        </aside>

        {/* Content */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 overflow-auto">
          {tab === "wbs" ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                WBS · Parametri BIM
              </h3>
              <p className="text-xs text-slate-500">
                Configura il profilo DATI_WBS e le preferenze di mapping.
              </p>
              <DatiWbsProfileSettingsPanel />
            </div>
          ) : null}

          {tab === "suppliers" && (
            <div className="h-full min-h-0">
              <FornitoriSettingsPanel />
            </div>
          )}

          {tab === "archived" ? <ArchivedProjectsPanel /> : null}
        </section>
      </div>
    </div>
  );
};

function ArchivedProjectsPanel() {
  const { loadArchivedProjects, restoreProjectById, reloadProjects } = useProjects();
  const [items, setItems] = useState<AederaProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const rows = await loadArchivedProjects();
      setItems(rows);
    } catch (e) {
      console.error(e);
      setErr("Impossibile caricare i progetti archiviati.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Progetti archiviati</h3>
          <p className="text-xs text-slate-500">
            Ripristina un progetto archiviato per renderlo di nuovo disponibile.
          </p>
        </div>

        <button
          type="button"
          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs"
          onClick={() => void refresh()}
          disabled={loading}
        >
          Aggiorna
        </button>
      </div>

      {err ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="text-xs text-slate-500">Caricamento…</div>
      ) : null}

      {empty ? (
        <div className="text-xs text-slate-500">Nessun progetto archiviato.</div>
      ) : null}

      <div className="flex flex-col gap-2">
        {items.map((p) => (
          <div
            key={p.id}
            className="rounded-md border border-slate-200 px-3 py-2 flex items-center justify-between"
          >
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-900">{p.name}</span>
              <span className="text-[11px] text-slate-500">ID: {p.id}</span>
            </div>

            <button
              type="button"
              className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs"
              onClick={async () => {
                const ok = window.confirm(`Ripristinare "${p.name}"?`);
                if (!ok) return;
                setLoading(true);
                try {
                  await restoreProjectById(p.id);
                  await reloadProjects(); // torna nel dropdown
                  await refresh();
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              Ripristina
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
