import React, { useEffect, useMemo, useState } from "react";
import { useProjects } from "@core/projects/ProjectContext";
import {
  bulkUpsertScenarioLines,
  cloneScenarioVersion,
  createScenarioVersion,
  freezeScenarioVersion,
  listScenarioLines,
  listScenarioVersions,
  listWbsLevels,
  setActiveScenarioVersion,
  deleteScenarioLine,
  type BoqLineDto,
  type ScenarioVersionDto,
  type ScenarioVersionStatus,
} from "@core/api/aederaApi";

type WbsLevelSettingDto = {
  levelKey: string;
  enabled: boolean;
  required: boolean;
  sortIndex: number;
  ifcParamKey?: string | null;
};

type EditableLine = BoqLineDto & {
  _dirty?: boolean;
  _isNew?: boolean;
};

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const GareView: React.FC = () => {
  const { currentProjectId } = useProjects();
  const projectId = currentProjectId ?? null;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [requiredWbsKeys, setRequiredWbsKeys] = useState<string[]>([]);
  const [versions, setVersions] = useState<ScenarioVersionDto[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedVersionStatus, setSelectedVersionStatus] = useState<ScenarioVersionStatus | null>(null);

  const [lines, setLines] = useState<EditableLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [settingActive, setSettingActive] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? null,
    [versions, selectedVersionId],
  );

  const isLocked = selectedVersionStatus === "LOCKED";

  const dirtyCount = useMemo(() => lines.filter((l) => l._dirty || l._isNew).length, [lines]);

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, l) => sum + toNumber(l.amount), 0);
  }, [lines]);

  type FlatRow = { line: EditableLine; depth: number };

  const groups = useMemo(() => lines.filter((l) => l.rowType === "GROUP"), [lines]);

  const groupOptions = useMemo(
    () =>
      groups
        .slice()
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
        .map((g) => ({
          id: g.id,
          label: `${(g.tariffaCodice ?? "").trim() || "—"} · ${(g.description ?? "").trim() || "Gruppo"}`,
        })),
    [groups],
  );

  const childrenByParentId = useMemo(() => {
    const m: Record<string, EditableLine[]> = {};
    for (const l of lines) {
      const pid = l.parentLineId ?? "__root__";
      (m[pid] ??= []).push(l);
    }
    // ordina i children
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
    }
    return m;
  }, [lines]);

  const groupTotalCache = useMemo(() => {
    const cache = new Map<string, number>();

    const sumGroup = (groupId: string): number => {
      if (cache.has(groupId)) return cache.get(groupId)!;
      const children = childrenByParentId[groupId] ?? [];
      let sum = 0;
      for (const c of children) {
        if (c.rowType === "GROUP") sum += sumGroup(c.id);
        else sum += toNumber(c.amount);
      }
      cache.set(groupId, sum);
      return sum;
    };

    for (const g of groups) sumGroup(g.id);
    return cache;
  }, [childrenByParentId, groups]);

  const toggleGroup = (groupId: string) => {
    setExpanded((prev) => ({ ...prev, [groupId]: !(prev[groupId] ?? true) }));
  };

  const flattenedRows = useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = [];
    const visited = new Set<string>();

    const walk = (parentId: string | null, depth: number) => {
      const key = parentId ?? "__root__";
      const children = childrenByParentId[key] ?? [];

      for (const child of children) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);

        out.push({ line: child, depth });

        if (child.rowType === "GROUP") {
          const isOpen = expanded[child.id] ?? true;
          if (isOpen) walk(child.id, depth + 1);
        }
      }
    };

    // root: includiamo anche gruppi e righe senza parentLineId
    walk(null, 0);

    // safety: appendiamo SOLO righe davvero "orfane" (parent non esistente),
    // non i figli che sono semplicemente nascosti perché il gruppo è collassato.
    if (visited.size !== lines.length) {
      const allIds = new Set(lines.map((x) => x.id));

      const leftovers = lines
        .filter((l) => {
          if (visited.has(l.id)) return false;
          const pid = l.parentLineId;
          // se non ha parent -> ok append
          if (!pid) return true;
          // se ha parent ma il parent non esiste -> ok append
          return !allIds.has(pid);
        })
        .slice()
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

      for (const l of leftovers) out.push({ line: l, depth: 0 });
    }

    return out;
  }, [childrenByParentId, expanded, lines]);

  async function loadAll(pid: string) {
    setLoading(true);
    setErr(null);
    try {
      // 1) required WBS keys
      const lvlRes = await listWbsLevels(pid);
      const lvl = (lvlRes as { items: WbsLevelSettingDto[] }).items ?? [];
      const required = (lvl ?? [])
        .filter((x) => x.enabled && x.required)
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
        .map((x) => x.levelKey);
      setRequiredWbsKeys(required);

      // 2) versions
      const vres = await listScenarioVersions(pid, "GARA") as {
        activeVersionId: string | null;
        versions: ScenarioVersionDto[];
      };
      setVersions(vres.versions ?? []);
      setActiveVersionId(vres.activeVersionId ?? null);

      // 3) pick selected version
      const pick =
        (vres.activeVersionId && vres.versions.find((v) => v.id === vres.activeVersionId)?.id) ||
        vres.versions[0]?.id ||
        null;

      setSelectedVersionId(pick);

      // 4) lines
      if (pick) {
        const lres = await listScenarioLines(pid, pick);
        setSelectedVersionStatus(lres.versionStatus);
        setLines((lres.items ?? []).map((x) => ({ ...x, _dirty: false, _isNew: false })));
      } else {
        setSelectedVersionStatus(null);
        setLines([]);
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Errore nel caricamento del modulo Gara.");
    } finally {
      setLoading(false);
    }
  }

  async function loadLines(pid: string, versionId: string) {
    setLoading(true);
    setErr(null);
    try {
      const lres = await listScenarioLines(pid, versionId);
      setSelectedVersionStatus(lres.versionStatus);
      setLines((lres.items ?? []).map((x) => ({ ...x, _dirty: false, _isNew: false })));
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Errore nel caricamento righe.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!projectId) return;
    void loadAll(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="h-full w-full p-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">Gara</div>
          <div className="mt-1 text-xs text-slate-500">
            Seleziona un progetto per gestire lo scenario di Gara.
          </div>
        </div>
      </div>
    );
  }

  const canEdit = !isLocked;

  const onCreateV1 = async () => {
    setErr(null);
    setLoading(true);
    try {
      const created = await createScenarioVersion(projectId, { scenario: "GARA", name: "Gara v1" });
      // ricarica versions e seleziona
      const vres = await listScenarioVersions(projectId, "GARA");
      setVersions(vres.versions ?? []);
      setActiveVersionId(vres.activeVersionId ?? null);
      setSelectedVersionId(created.id);
      await loadLines(projectId, created.id);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Errore nella creazione della versione.");
    } finally {
      setLoading(false);
    }
  };

  const onSelectVersion = async (vid: string) => {
    if (!vid) return;
    setSelectedVersionId(vid);
    await loadLines(projectId, vid);
  };

  const nextSortIndex = () => {
    const max = lines.reduce((m, l) => Math.max(m, Number(l.sortIndex ?? 0)), 0);
    return max + 1;
  };

  const addGroup = () => {
    if (!selectedVersionId) return;
    if (!canEdit) return;

    const blankWbs: Record<string, string> = {};
    for (const k of requiredWbsKeys) blankWbs[k] = "";

    const tmp: EditableLine = {
      id: `new_${Math.random().toString(36).slice(2)}`,
      projectId,
      versionId: selectedVersionId,

      wbsKey: "",
      wbs: blankWbs,

      tariffaCodice: "",
      description: "",
      uom: "",

      qty: 0,
      unitPrice: 0,
      amount: 0,

      rowType: "GROUP",
      sortIndex: nextSortIndex(),
      parentLineId: null,

      qtyModelSuggested: null,
      qtySource: "MANUAL",
      marginPct: null,

      pacchettoCodice: null,
      materialeCodice: null,
      fornitoreId: null,

      _dirty: true,
      _isNew: true,
    };

    setLines((prev) => [tmp, ...prev]);
  };

  const addRow = () => {
    if (!selectedVersionId) return;
    if (!canEdit) return;

    const blankWbs: Record<string, string> = {};
    for (const k of requiredWbsKeys) blankWbs[k] = "";

    const tmp: EditableLine = {
      id: `new_${Math.random().toString(36).slice(2)}`,
      projectId,
      versionId: selectedVersionId,
      wbsKey: "",
      wbs: blankWbs,
      tariffaCodice: "",
      description: "",
      uom: "",
      qty: 0,
      unitPrice: 0,
      amount: 0,
      rowType: "LINE",
      sortIndex: nextSortIndex(),
      parentLineId: null,
      qtyModelSuggested: null,
      qtySource: "MANUAL",
      marginPct: null,
      pacchettoCodice: null,
      materialeCodice: null,
      fornitoreId: null,
      _dirty: true,
      _isNew: true,
    };

    setLines((prev) => [tmp, ...prev]);
  };

  const updateLine = (id: string, patch: Partial<EditableLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;

        const next: EditableLine = { ...l, ...patch, _dirty: true };
        // keep amount coherent
        const qty = toNumber(next.qty);
        const unitPrice = toNumber(next.unitPrice);
        const isGroup = next.rowType === "GROUP";
        next.amount = isGroup ? 0 : qty * unitPrice;
        return next;
      }),
    );
  };

  const updateWbsField = (id: string, key: string, value: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const wbs = { ...(l.wbs ?? {}) };
        wbs[key] = value;
        const next: EditableLine = { ...l, wbs, _dirty: true };
        return next;
      }),
    );
  };

  const onDeleteLine = async (lineId: string) => {
    if (!selectedVersionId) return;
    if (!canEdit) return;

    const line = lines.find((x) => x.id === lineId);
    if (!line) return;

    const label = (line.description ?? line.tariffaCodice ?? "riga").toString();
    const ok = window.confirm(`Eliminare questa riga?\n\n${label}`);
    if (!ok) return;

    // Caso 1: riga non salvata (new_) => rimuovi localmente
    if (lineId.startsWith("new_")) {
      setLines((prev) => {
        // 1) rimuovi la riga
        const removed = prev.filter((x) => x.id !== lineId);
        // 2) se era un gruppo, stacca i figli che puntavano a lui
        return removed.map((x) => {
          if (x.parentLineId === lineId) {
            return { ...x, parentLineId: null, _dirty: true };
          }
          return x;
        });
      });
      return;
    }

    // Caso 2: riga salvata => server + reload
    try {
      await deleteScenarioLine(projectId, lineId);
      await loadLines(projectId, selectedVersionId);
    } catch (e) {
      console.error(e);
      setErr("Errore durante l'eliminazione della riga.");
    }
  };

  const discardChanges = async () => {
    if (!selectedVersionId) return;
    if (dirtyCount === 0) return;

    const ok = window.confirm("Scartare tutte le modifiche non salvate?");
    if (!ok) return;

    await loadLines(projectId, selectedVersionId);
  };

  const save = async () => {
    if (!selectedVersionId) return;
    if (!canEdit) return;
    if (saving) return;

    const dirty = lines.filter((l) => l._dirty || l._isNew);
    if (dirty.length === 0) return;

    setSaving(true);
    setErr(null);
    try {
      const items = dirty.map((l) => ({
        // IMPORTANTISSIMO: manda sempre l'id (anche se è "new_xxx")
        id: l.id,

        wbs: l.wbs ?? {},
        tariffaCodice: String(l.tariffaCodice ?? "").trim(),
        description: l.description ?? null,
        uom: l.uom ?? null,

        qty: toNumber(l.qty),
        unitPrice: toNumber(l.unitPrice),

        rowType: l.rowType,
        sortIndex: typeof l.sortIndex === "number" ? l.sortIndex : 0,
        parentLineId: l.parentLineId ?? null,

        qtyModelSuggested: l.qtyModelSuggested ?? null,
        qtySource: l.qtySource,
        marginPct: l.marginPct ?? null,

        pacchettoCodice: l.pacchettoCodice ?? null,
        materialeCodice: l.materialeCodice ?? null,
        fornitoreId: l.fornitoreId ?? null,
      }));

      await bulkUpsertScenarioLines(projectId, { versionId: selectedVersionId, items });
      await loadLines(projectId, selectedVersionId);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const freeze = async () => {
    if (!selectedVersionId) return;
    if (freezing) return;
    if (isLocked) return;

    const ok = window.confirm(
      "Congelare questa versione?\nDopo il freeze non sarà più modificabile (puoi creare una revisione v2).",
    );
    if (!ok) return;

    setFreezing(true);
    setErr(null);
    try {
      await freezeScenarioVersion(projectId, selectedVersionId);
      await loadLines(projectId, selectedVersionId);
      // aggiorna anche lista versioni
      const vres = await listScenarioVersions(projectId, "GARA");
      setVersions(vres.versions ?? []);
      setActiveVersionId(vres.activeVersionId ?? null);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Errore durante il freeze.");
    } finally {
      setFreezing(false);
    }
  };

  const clone = async () => {
    if (!selectedVersionId) return;
    if (cloning) return;

    const ok = window.confirm("Creare una nuova revisione (v2) copiando le righe della versione selezionata?");
    if (!ok) return;

    setCloning(true);
    setErr(null);
    try {
      const created = await cloneScenarioVersion(projectId, selectedVersionId, {});
      // refresh versions + seleziona la nuova
      const vres = await listScenarioVersions(projectId, "GARA");
      setVersions(vres.versions ?? []);
      setActiveVersionId(vres.activeVersionId ?? null);
      setSelectedVersionId(created.id);
      await loadLines(projectId, created.id);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Errore durante la clonazione.");
    } finally {
      setCloning(false);
    }
  };

  const setActive = async () => {
    if (!selectedVersionId) return;
    if (settingActive) return;

    setSettingActive(true);
    setErr(null);
    try {
      await setActiveScenarioVersion(projectId, selectedVersionId);
      const vres = await listScenarioVersions(projectId, "GARA");
      setVersions(vres.versions ?? []);
      setActiveVersionId(vres.activeVersionId ?? null);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Errore durante set active.");
    } finally {
      setSettingActive(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col gap-3 p-4 text-sm text-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Gara</h2>
          <div className="text-xs text-slate-500">
            Scenario: <span className="font-semibold">GARA</span> · Versioni con freeze e revisione
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs"
            onClick={() => void loadAll(projectId)}
            disabled={loading || saving || freezing || cloning}
          >
            Aggiorna
          </button>

          {!selectedVersionId ? (
            <button
              type="button"
              className="px-2 py-1 rounded border border-sky-200 bg-sky-50 hover:bg-sky-100 text-xs text-sky-700"
              onClick={onCreateV1}
              disabled={loading}
            >
              Crea Gara v1
            </button>
          ) : null}
        </div>
      </div>

      {err ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {err}
        </div>
      ) : null}

      {/* Toolbar versione */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs font-semibold text-slate-700">Versione</div>

          <select
            className="text-xs rounded border border-slate-200 px-2 py-1 bg-white"
            value={selectedVersionId ?? ""}
            onChange={(e) => void onSelectVersion(e.target.value)}
            disabled={loading || versions.length === 0}
          >
            <option value="" disabled>
              Seleziona…
            </option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                GARA v{v.versionNo} · {v.status}
                {v.id === activeVersionId ? " · ACTIVE" : ""}
                {v.archivedAt ? " · ARCH" : ""}
              </option>
            ))}
          </select>

          {selectedVersion ? (
            <>
              <span
                className={[
                  "text-[11px] px-2 py-0.5 rounded border",
                  selectedVersionStatus === "LOCKED"
                    ? "border-slate-200 bg-slate-50 text-slate-600"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                ].join(" ")}
              >
                {selectedVersionStatus ?? selectedVersion.status}
              </span>

              {selectedVersionId === activeVersionId ? (
                <span className="text-[11px] px-2 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-700">
                  ACTIVE
                </span>
              ) : null}
            </>
          ) : null}

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => void setActive()}
            disabled={!selectedVersionId || settingActive}
            className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs"
            title="Imposta come versione attiva per dashboard e confronto"
          >
            Set Active
          </button>

          <button
            type="button"
            onClick={() => void clone()}
            disabled={!selectedVersionId || cloning}
            className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs"
            title="Crea una nuova revisione (v2) copiando le righe"
          >
            Crea revisione
          </button>

          <button
            type="button"
            onClick={() => void freeze()}
            disabled={!selectedVersionId || isLocked || freezing}
            className={[
              "px-2 py-1 rounded border text-xs",
              isLocked
                ? "border-slate-200 bg-slate-100 text-slate-400"
                : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
            ].join(" ")}
            title="Blocca la versione (immutabile)"
          >
            Freeze
          </button>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span>Righe: {lines.length}</span>
          <span>Modifiche non salvate: {dirtyCount}</span>
          <span className="font-semibold text-slate-700">Totale: {fmtMoney(totalAmount)}</span>

          <div className="flex-1" />

          <button
            type="button"
            onClick={addGroup}
            disabled={!selectedVersionId || !canEdit}
            className={[
              "px-2 py-1 rounded border text-xs",
              canEdit
                ? "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                : "border-slate-200 bg-slate-100 text-slate-400",
            ].join(" ")}
          >
            + Gruppo
          </button>

          <button
            type="button"
            onClick={addRow}
            disabled={!selectedVersionId || !canEdit}
            className={[
              "px-2 py-1 rounded border text-xs",
              canEdit ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100" : "border-slate-200 bg-slate-100 text-slate-400",
            ].join(" ")}
          >
            + Riga
          </button>

          <button
            type="button"
            onClick={() => void discardChanges()}
            disabled={!selectedVersionId || !canEdit || dirtyCount === 0}
            className={[
              "px-2 py-1 rounded border text-xs",
              dirtyCount === 0
                ? "border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700",
            ].join(" ")}
          >
            Annulla modifiche
          </button>

          <button
            type="button"
            onClick={() => void save()}
            disabled={!selectedVersionId || !canEdit || saving || dirtyCount === 0}
            className={[
              "px-2 py-1 rounded border text-xs",
              !canEdit || dirtyCount === 0
                ? "border-slate-200 bg-slate-100 text-slate-400"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
            ].join(" ")}
          >
            Salva
          </button>
        </div>
      </div>

      {/* Tabella righe */}
      <div className="flex-1 min-h-0 rounded-xl border border-slate-200 bg-white overflow-auto">
        {!selectedVersionId ? (
          <div className="p-4 text-xs text-slate-500">
            Nessuna versione Gara ancora creata. Premi <span className="font-semibold">Crea Gara v1</span>.
          </div>
        ) : loading ? (
          <div className="p-4 text-xs text-slate-500">Caricamento…</div>
        ) : (
          <table className="min-w-[1100px] w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                {requiredWbsKeys.map((k) => (
                  <th key={k} className="text-left font-semibold text-slate-600 px-2 py-2 whitespace-nowrap">
                    {k}
                  </th>
                ))}
                <th className="text-left font-semibold text-slate-600 px-2 py-2 whitespace-nowrap">Tariffa</th>
                <th className="text-left font-semibold text-slate-600 px-2 py-2">Descrizione</th>
                <th className="text-left font-semibold text-slate-600 px-2 py-2 whitespace-nowrap">Gruppo</th>
                <th className="text-left font-semibold text-slate-600 px-2 py-2 whitespace-nowrap">UoM</th>
                <th className="text-right font-semibold text-slate-600 px-2 py-2 whitespace-nowrap">Qty</th>
                <th className="text-right font-semibold text-slate-600 px-2 py-2 whitespace-nowrap">Prezzo</th>
                <th className="text-right font-semibold text-slate-600 px-2 py-2 whitespace-nowrap">Importo</th>
                <th className="text-center font-semibold text-slate-600 px-2 py-2 whitespace-nowrap">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {flattenedRows.map(({ line: l, depth }) => {
                const isGroup = l.rowType === "GROUP";
                const isOpen = isGroup ? (expanded[l.id] ?? true) : false;
                const hasChildren = isGroup ? ((childrenByParentId[l.id]?.length ?? 0) > 0) : false;
                const indentPx = 12 * depth;
                const rowMuted = isLocked ? "opacity-80" : "";
                return (
                  <tr
                    key={l.id}
                    className={[
                      "border-b border-slate-100",
                      rowMuted,
                      isGroup ? "bg-slate-50" : "",
                    ].join(" ")}
                  >
                    {requiredWbsKeys.map((k) => (
                      <td key={k} className="px-2 py-1 align-top">
                        <input
                          className="w-[130px] rounded border border-slate-200 px-2 py-1"
                          value={(l.wbs?.[k] ?? "") as string}
                          onChange={(e) => updateWbsField(l.id, k, e.target.value)}
                          disabled={!canEdit}
                          placeholder={k}
                        />
                      </td>
                    ))}

                    <td className="px-2 py-1 align-top">
                      <div className="flex items-center gap-1" style={{ paddingLeft: indentPx }}>
                        {isGroup ? (
                          <button
                            type="button"
                            className={[
                              "w-6 h-6 flex items-center justify-center rounded border",
                              hasChildren ? "border-slate-200 bg-white hover:bg-slate-50" : "border-transparent bg-transparent cursor-default",
                            ].join(" ")}
                            onClick={() => hasChildren && toggleGroup(l.id)}
                            title={hasChildren ? (isOpen ? "Collassa" : "Espandi") : "Nessun figlio"}
                            disabled={!hasChildren}
                          >
                            {hasChildren ? (isOpen ? "▾" : "▸") : ""}
                          </button>
                        ) : (
                          <span className="w-6" />
                        )}

                        <input
                          className={[
                            "rounded border px-2 py-1",
                            isGroup ? "w-[120px] font-semibold" : "w-[120px]",
                            isGroup ? "border-slate-300 bg-slate-50" : "border-slate-200",
                          ].join(" ")}
                          value={l.tariffaCodice ?? ""}
                          onChange={(e) => updateLine(l.id, { tariffaCodice: e.target.value })}
                          disabled={!canEdit}
                          placeholder="es. GC.5"
                        />
                      </div>
                    </td>

                    <td className="px-2 py-1 align-top">
                      <input
                        className="w-[420px] rounded border border-slate-200 px-2 py-1"
                        value={l.description ?? ""}
                        onChange={(e) => updateLine(l.id, { description: e.target.value })}
                        disabled={!canEdit}
                        placeholder="Descrizione"
                      />
                    </td>

                    <td className="px-2 py-1 align-top">
                      {isGroup ? (
                        <span className="text-[11px] text-slate-400">—</span>
                      ) : (
                        <select
                          className="w-[220px] rounded border border-slate-200 px-2 py-1 bg-white"
                          value={l.parentLineId ?? ""}
                          onChange={(e) => updateLine(l.id, { parentLineId: e.target.value || null })}
                          disabled={!canEdit}
                        >
                          <option value="">(Nessun gruppo)</option>
                          {groupOptions
                            // evita che una riga possa essere figlia di se stessa (non dovrebbe succedere per LINE, ma safe)
                            .filter((g) => g.id !== l.id)
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.label}
                              </option>
                            ))}
                        </select>
                      )}
                    </td>

                    <td className="px-2 py-1 align-top">
                      <input
                        className="w-[70px] rounded border border-slate-200 px-2 py-1"
                        value={l.uom ?? ""}
                        onChange={(e) => updateLine(l.id, { uom: e.target.value })}
                        disabled={!canEdit}
                        placeholder="m²"
                      />
                    </td>

                    <td className="px-2 py-1 align-top text-right">
                      <input
                        className="w-[90px] rounded border border-slate-200 px-2 py-1 text-right"
                        value={String(l.qty ?? 0)}
                        onChange={(e) => updateLine(l.id, { qty: toNumber(e.target.value) })}
                        disabled={!canEdit || isGroup}
                      />
                    </td>

                    <td className="px-2 py-1 align-top text-right">
                      <input
                        className="w-[100px] rounded border border-slate-200 px-2 py-1 text-right"
                        value={String(l.unitPrice ?? 0)}
                        onChange={(e) => updateLine(l.id, { unitPrice: toNumber(e.target.value) })}
                        disabled={!canEdit || isGroup}
                      />
                    </td>

                    <td className="px-2 py-1 align-top text-right font-semibold text-slate-800 whitespace-nowrap">
                      {isGroup ? fmtMoney(groupTotalCache.get(l.id) ?? 0) : fmtMoney(toNumber(l.amount))}
                    </td>

                    <td className="px-2 py-1 align-top text-center">
                      <button
                        type="button"
                        className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs"
                        onClick={() => void onDeleteLine(l.id)}
                        disabled={!canEdit}
                        title="Elimina riga"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer hint */}
      <div className="text-[11px] text-slate-500">
        Suggerimento: dopo <span className="font-semibold">Freeze</span> crea una revisione (v2) per correggere errori senza
        perdere lo storico. La versione <span className="font-semibold">ACTIVE</span> sarà quella usata come baseline per KPI.
      </div>
    </div>
  );
};
