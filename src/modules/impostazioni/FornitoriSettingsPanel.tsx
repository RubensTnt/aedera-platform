import React, { useEffect, useMemo, useState } from "react";
import { useCurrentProject, useProjectPermissions } from "@core/projects/ProjectContext";
import { createSupplier, listSuppliers, updateSupplier, type SupplierDto } from "@core/api/aederaApi";

export const FornitoriSettingsPanel: React.FC = () => {
  const project = useCurrentProject();
  const { isProjectAdmin } = useProjectPermissions(); // per ora è stub true, backend fa enforcement
  const [items, setItems] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");

  const projectId = project?.id ?? null;

  const reload = async () => {
    if (!projectId) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await listSuppliers(projectId);
      setItems(data);
    } catch (e: any) {
      setErr(e?.message ?? "Errore nel caricamento fornitori");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const canEdit = !!projectId && isProjectAdmin;

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Fornitori</div>
          <div className="text-xs text-slate-500">Anagrafica per il parametro BIM “Fornitore” (multi-selezione).</div>
        </div>

        <button
          className="px-3 py-1.5 rounded-md text-xs border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
          onClick={reload}
          disabled={!projectId || loading}
        >
          Aggiorna
        </button>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {err}
        </div>
      )}

      {/* Create */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
        <div className="text-xs font-semibold text-slate-700 mb-2">Aggiungi fornitore</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            className="px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
            placeholder="Nome (obbligatorio)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={!canEdit}
          />
          <input
            className="px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
            placeholder="Codice (opzionale)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            disabled={!canEdit}
          />
          <button
            className="px-3 py-2 rounded-md text-sm bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
            disabled={!canEdit || loading || newName.trim().length === 0}
            onClick={async () => {
              if (!projectId) return;
              setLoading(true);
              setErr(null);
              try {
                await createSupplier(projectId, { name: newName.trim(), code: newCode.trim() || undefined });
                setNewName("");
                setNewCode("");
                await reload();
              } catch (e: any) {
                setErr(e?.message ?? "Errore creazione fornitore");
              } finally {
                setLoading(false);
              }
            }}
          >
            Aggiungi
          </button>
        </div>

        {!isProjectAdmin && (
          <div className="mt-2 text-xs text-slate-500">
            Solo ADMIN/OWNER possono creare o modificare fornitori.
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-700">
            Elenco ({items.length})
          </div>
        </div>

        <div className="h-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-slate-200">
              <tr className="text-xs text-slate-500">
                <th className="text-left font-semibold px-3 py-2">Nome</th>
                <th className="text-left font-semibold px-3 py-2 w-48">Codice</th>
                <th className="text-right font-semibold px-3 py-2 w-40">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 text-slate-600">{s.code ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="px-2 py-1 rounded-md text-xs border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                      disabled={!canEdit || loading}
                      onClick={async () => {
                        if (!projectId) return;
                        setLoading(true);
                        setErr(null);
                        try {
                          await updateSupplier(projectId, s.id, { isActive: false });
                          await reload();
                        } catch (e: any) {
                          setErr(e?.message ?? "Errore disattivazione fornitore");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      title="Disattiva (soft delete)"
                    >
                      Disattiva
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-xs text-slate-500" colSpan={3}>
                    Nessun fornitore presente. Aggiungine uno per poterlo selezionare nei parametri BIM.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {loading && (
            <div className="px-3 py-3 text-xs text-slate-500">Caricamento…</div>
          )}
        </div>
      </div>
    </div>
  );
};
