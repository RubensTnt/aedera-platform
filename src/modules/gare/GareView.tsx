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



// ------------------
// ----- TYPES ------
// ------------------
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
  _deleted?: boolean;

  // per undo “intelligente” quando cancelli un gruppo e stacchi i figli
  _prevParentLineId?: string | null;
};



// ------------------
// ---- HELPERS -----
// ------------------
function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function csvEscape(v: any) {
  let s = (v ?? "").toString();

  // IMPORTANT: evita righe multiple dentro una cella (Excel/LibreOffice spesso rompono)
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/\n/g, " "); // oppure "⏎" se vuoi vederlo

  // CSV standard: se contiene ; " o tab, racchiudi tra doppi apici e raddoppia i doppi apici
  if (/[;"\t]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function stripBom(s: string) {
  return s?.replace(/^\uFEFF/, "") ?? "";
}

function detectDelimiterFromLine(line: string) {
  const candidates: Array<{ d: string; score: number }> = [
    { d: ";", score: (line.match(/;/g) ?? []).length },
    { d: ",", score: (line.match(/,/g) ?? []).length },
    { d: "\t", score: (line.match(/\t/g) ?? []).length },
  ];
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].score > 0 ? candidates[0].d : ";";
}

function parseCsvFlexible(text: string): { headers: string[]; rows: Array<Record<string, string>> } {
  // normalizza EOL
  let s = stripBom(String(text ?? "")).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // skippa righe vuote iniziali
  while (s.startsWith("\n")) s = s.slice(1);

  if (!s.trim()) return { headers: [], rows: [] };

  // gestisci sep=;
  let delimiter: string | null = null;
  {
    const firstLineEnd = s.indexOf("\n");
    const firstLineRaw = firstLineEnd >= 0 ? s.slice(0, firstLineEnd) : s;
    const firstLine = stripBom(firstLineRaw).trim();

    // accetta anche: "sep=;", sep=;;;;, sep=;,,,, ecc.
    const m = firstLine.match(/^\s*"?\s*sep\s*=\s*(.)/i);

    if (m) {
      delimiter = m[1];
      s = firstLineEnd >= 0 ? s.slice(firstLineEnd + 1) : "";
      while (s.startsWith("\n")) s = s.slice(1);
    }
  }

  // se non c'è sep=, detect sul primo header line "grezzo"
  if (!delimiter) {
    const firstLineEnd = s.indexOf("\n");
    const firstLine = firstLineEnd >= 0 ? s.slice(0, firstLineEnd) : s;
    delimiter = detectDelimiterFromLine(firstLine);
  }

  // parse char-by-char (supporta newline in quotes)
  const grid: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };
  const pushRow = () => {
    // evita righe completamente vuote
    if (row.length === 1 && !row[0].trim()) {
      row = [];
      return;
    }
    // se la riga ha qualcosa
    if (row.some((c) => String(c ?? "").length > 0)) grid.push(row);
    row = [];
  };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inQ) {
      if (ch === '"') {
        const next = s[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch; // include anche \n dentro quotes
      }
      continue;
    }

    if (ch === '"') {
      inQ = true;
      continue;
    }

    if (ch === delimiter) {
      pushCell();
      continue;
    }

    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }

    cur += ch;
  }

  // flush finale
  if (cur.length || row.length) {
    pushCell();
    pushRow();
  }

  // drop righe vuote iniziali (safety)
  while (grid.length && grid[0].every((c) => !String(c ?? "").trim())) grid.shift();

  if (grid.length < 2) return { headers: [], rows: [] };

  const headers = grid[0].map((h) => stripBom(String(h ?? "")).trim());
  const rowsArr = grid.slice(1);

  const rows: Array<Record<string, string>> = rowsArr.map((cols) => {
    const rec: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) rec[headers[c]] = String(cols[c] ?? "");
    return rec;
  });

  return { headers, rows };
}


// ------------------
// --- COMPONENT ----
// ------------------
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

  const [sortMode, setSortMode] = useState<"SORTINDEX" | "TARIFFA">("TARIFFA");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<null | {
    headers: string[];
    rows: Array<Record<string, string>>;
    stats: { total: number; groups: number; lines: number; errors: number };
    errors: string[];
  }>(null);

  const cmpTariffa = (a: EditableLine, b: EditableLine) => {
    const ca = (a.tariffaCodice ?? "").trim();
    const cb = (b.tariffaCodice ?? "").trim();

    // vuoti in fondo
    if (!ca && cb) return 1;
    if (ca && !cb) return -1;

    // compare "naturale" (GC.2 < GC.10)
    const byCode = ca.localeCompare(cb, "it", { numeric: true, sensitivity: "base" });
    if (byCode !== 0) return byCode;

    // tie-break: descrizione
    const da = (a.description ?? "").trim();
    const db = (b.description ?? "").trim();
    const byDesc = da.localeCompare(db, "it", { numeric: true, sensitivity: "base" });
    if (byDesc !== 0) return byDesc;

    // ultimo tie-break stabile
    return (a.id ?? "").localeCompare(b.id ?? "");
  };

  const cmpSortIndex = (a: EditableLine, b: EditableLine) =>
    (Number(a.sortIndex ?? 0) - Number(b.sortIndex ?? 0)) ||
    (a.id ?? "").localeCompare(b.id ?? "");

  const cmpLine = (a: EditableLine, b: EditableLine) =>
    sortMode === "TARIFFA" ? cmpTariffa(a, b) : cmpSortIndex(a, b);


  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? null,
    [versions, selectedVersionId],
  );

  const isLocked = selectedVersionStatus === "LOCKED";

  const onPickCsv = async (file: File) => {
    if (!selectedVersionId) return;

    const text = await file.text();
    const parsed = parseCsvFlexible(text);

    if (parsed.headers.length < 1 || parsed.rows.length < 1) {
      setImportPreview({
        headers: [],
        rows: [],
        stats: { total: 0, groups: 0, lines: 0, errors: 1 },
        errors: ["CSV vuoto o senza righe dati."],
      });
      return;
    }

    const headers = parsed.headers.map((h: string) => String(h ?? "").trim());
    const normalizedHeaders = headers.map((h: string) => h.trim());

    const errors: string[] = [];

    // minimo
    if (!normalizedHeaders.includes("tariffaCodice")) errors.push(`Header mancante: "tariffaCodice"`);

    // WBS richieste
    for (const k of requiredWbsKeys) {
      if (!normalizedHeaders.includes(k)) errors.push(`Colonna WBS richiesta mancante: "${k}"`);
    }

    let groups = 0;
    let linesCount = 0;

    for (let i = 0; i < parsed.rows.length; i++) {
      const rec = parsed.rows[i];

      const rt = String(rec["rowType"] ?? "").trim().toUpperCase();
      const tariffa = String(rec["tariffaCodice"] ?? "").trim();
      const desc = String(rec["description"] ?? "").trim();

      if (rt === "LINE" && !tariffa) errors.push(`Riga ${i + 2}: tariffaCodice mancante (LINE)`);
      if (rt === "GROUP" && !tariffa && !desc) errors.push(`Riga ${i + 2}: GROUP richiede tariffaCodice o description`);

      if (rt === "GROUP") groups++;
      else if (rt === "LINE") linesCount++;
      else errors.push(`Riga ${i + 2}: rowType non valido (${rec["rowType"]})`);
    }

    setImportPreview({
      headers,
      rows: parsed.rows,
      stats: { total: parsed.rows.length, groups, lines: linesCount, errors: errors.length },
      errors,
    });
  };

  const dirtyCount = useMemo(
    () => lines.filter((l) => l._dirty || l._isNew || l._deleted).length,
    [lines],
  );

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, l) => sum + (l._deleted ? 0 : toNumber(l.amount)), 0);
  }, [lines]);

  type FlatRow = { line: EditableLine; depth: number };

  const visibleLines = useMemo(() => lines.filter((l) => !l._deleted), [lines]);
  const groups = useMemo(() => visibleLines.filter((l) => l.rowType === "GROUP"), [visibleLines]);

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
    for (const l of visibleLines) {
      const pid = l.parentLineId ?? "__root__";
      (m[pid] ??= []).push(l);
    }
    // ordina i children
    for (const k of Object.keys(m)) {
      m[k].sort(cmpLine);
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
        if (c._deleted) continue;
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

  const descendantsOf = useMemo(() => {
    const memo = new Map<string, Set<string>>();

    const walk = (id: string): Set<string> => {
      if (memo.has(id)) return memo.get(id)!;
      const out = new Set<string>();
      const children = childrenByParentId[id] ?? [];
      for (const c of children) {
        out.add(c.id);
        for (const d of walk(c.id)) out.add(d);
      }
      memo.set(id, out);
      return out;
    };

    for (const g of groups) walk(g.id);
    return memo;
  }, [childrenByParentId, groups]);
  

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

  function looksLikeCuid(id: string) {
    // Prisma cuid() tipicamente inizia con "c" ed è abbastanza lungo
    const s = id.trim();
    return s.length >= 10 && s.startsWith("c");
  }

  function normalizeImportedId(idRaw: string) {
    const id = (idRaw ?? "").trim();
    if (!id) return null;
    // accettiamo solo id “credibili” (esportati da Aedera); altrimenti li ignoriamo
    return looksLikeCuid(id) ? id : null;
  }

  function buildLineFromCsvRow(r: Record<string, string>, fallbackSort: number): EditableLine {
    const rowType = String(r["rowType"] ?? "LINE").trim().toUpperCase() === "GROUP" ? "GROUP" : "LINE";
    const isGroup = rowType === "GROUP";

    // sortIndex: se manca usa fallbackSort
    const sortIndexRaw = String(r["sortIndex"] ?? "").trim();
    const sortIndex = sortIndexRaw ? toNumber(sortIndexRaw) : fallbackSort;

    const parentLineId = String(r["parentLineId"] ?? "").trim() || null;

    const wbs: Record<string, string> = {};
    for (const k of requiredWbsKeys) wbs[k] = String(r[k] ?? "").trim();

    const qty = isGroup ? 0 : toNumber(r["qty"]);
    const unitPrice = isGroup ? 0 : toNumber(r["unitPrice"]);
    const amount = isGroup ? 0 : qty * unitPrice;

    return {
      id: "new_tmp", // verrà sostituito dopo
      projectId: projectId!,
      versionId: selectedVersionId!,

      wbsKey: "", // lo calcola il server quando salvi
      wbs,

      tariffaCodice: String(r["tariffaCodice"] ?? "").trim(),
      description: (String(r["description"] ?? "").trim() || null),
      uom: (String(r["uom"] ?? "").trim() || null),

      qty,
      unitPrice,
      amount,

      rowType,
      sortIndex,
      parentLineId,

      qtyModelSuggested: r["qtyModelSuggested"] ? toNumber(r["qtyModelSuggested"]) : null,
      qtySource: (String(r["qtySource"] ?? "MANUAL").trim().toUpperCase() as any) || "MANUAL",
      marginPct: r["marginPct"] ? toNumber(r["marginPct"]) : null,

      pacchettoCodice: (String(r["pacchettoCodice"] ?? "").trim() || null),
      materialeCodice: (String(r["materialeCodice"] ?? "").trim() || null),
      fornitoreId: (String(r["fornitoreId"] ?? "").trim() || null),

      _dirty: true,
      _isNew: true,
    };
  }

  const applyImport = async () => {
    if (!projectId || !selectedVersionId || !importPreview) return;
    if (!canEdit) return;

    const ok = window.confirm(
      "Applicare l'import in bozza?\nLe modifiche verranno applicate in tabella, ma non saranno salvate finché non premi 'Salva'.",
    );
    if (!ok) return;

    setImporting(true);
    setErr(null);

    try {
      // indicizziamo le righe esistenti per id
      const existingById = new Map(lines.map((l) => [l.id, l] as const));

      // per dare sortIndex prevedibile quando mancante
      let fallbackSort = Math.max(0, ...lines.map((l) => Number(l.sortIndex ?? 0))) + 1;

      const nextLines = [...lines];

      for (const r of importPreview.rows) {
        const normalizedId = normalizeImportedId(String(r["id"] ?? ""));
        const imported = buildLineFromCsvRow(r, fallbackSort++);
        const parentLineId = String(r["parentLineId"] ?? "").trim() || null;

        // assegna id: se arriva id credibile lo usiamo, altrimenti new_
        const finalId = normalizedId ?? `new_${Math.random().toString(36).slice(2)}`;
        imported.id = finalId;

        // parentLineId: accettiamo anche se è un id esistente
        imported.parentLineId = parentLineId;

        const existing = normalizedId ? existingById.get(normalizedId) : undefined;

        if (existing) {
          // UPDATE in bozza: patch della riga esistente
          const patched: EditableLine = {
            ...existing,
            ...imported,
            id: existing.id,
            projectId: existing.projectId,
            versionId: existing.versionId,
            _isNew: existing._isNew,
            _dirty: true,
          };

          // amount coerente
          const isGroup = patched.rowType === "GROUP";
          patched.amount = isGroup ? 0 : toNumber(patched.qty) * toNumber(patched.unitPrice);

          const idx = nextLines.findIndex((x) => x.id === existing.id);
          if (idx >= 0) nextLines[idx] = patched;
        } else {
          // CREATE in bozza (anche restore di una riga cancellata che aveva un id Aedera)
          nextLines.push(imported);
        }
      }

      setLines(nextLines);
      setImportPreview(null);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Errore durante l'applicazione import (bozza).");
    } finally {
      setImporting(false);
    }
  };


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
    if (!selectedVersionId || !canEdit) return;

    const line = lines.find((x) => x.id === lineId);
    if (!line) return;

    const label = (line.description ?? line.tariffaCodice ?? "riga").toString();
    const ok = window.confirm(`Eliminare questa riga (in bozza)?\n\n${label}`);
    if (!ok) return;

    const isGroup = line.rowType === "GROUP";

    // new_ => rimuovila localmente (non ha senso tenerla “deleted”)
    if (lineId.startsWith("new_")) {
      setLines((prev) => {
        const removed = prev.filter((x) => x.id !== lineId);
        return isGroup
          ? removed.map((x) => (x.parentLineId === lineId ? { ...x, parentLineId: null, _dirty: true } : x))
          : removed;
      });
      return;
    }

    // id reale => marca deleted, e se è un gruppo stacca i figli ma ricordati il parent precedente
    setLines((prev) =>
      prev.map((x) => {
        if (x.id === lineId) return { ...x, _deleted: true, _dirty: true };

        if (isGroup && x.parentLineId === lineId) {
          return { ...x, _prevParentLineId: lineId, parentLineId: null, _dirty: true };
        }

        return x;
      }),
    );
  };

  const onRestoreLine = (lineId: string) => {
    setLines((prev) => {
      const isGroup = prev.find((x) => x.id === lineId)?.rowType === "GROUP";

      return prev.map((x) => {
        // ripristina la riga
        if (x.id === lineId) return { ...x, _deleted: false, _dirty: true };

        // se ripristino un gruppo, riattacco i figli che avevamo staccato
        if (isGroup && x._prevParentLineId === lineId) {
          return { ...x, parentLineId: lineId, _prevParentLineId: null, _dirty: true };
        }

        return x;
      });
    });
  };


  const exportCsv = () => {
    if (!selectedVersionId) return;

    // esportiamo TUTTE le righe (anche collassate): quindi usiamo `lines`, non `flattenedRows`
    // ordina in modo stabile come listLines
    const sorted = lines
      .slice()
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

    const wbsCols = requiredWbsKeys.slice(); // es: ["WBS0","WBS4","WBS6"]
    const headers = [
      "id",
      "rowType",
      "sortIndex",
      "parentLineId",
      "groupLabel",
      ...wbsCols,
      "tariffaCodice",
      "description",
      "uom",
      "qty",
      "unitPrice",
      "amount",
      "qtySource",
      "marginPct",
      "pacchettoCodice",
      "materialeCodice",
      "fornitoreId",
    ];

    const byId = new Map(sorted.map((l) => [l.id, l] as const));

    const groupLabelOf = (parentId: string | null | undefined) => {
      if (!parentId) return "";
      const g = byId.get(parentId);
      if (!g) return "";
      const t = (g.tariffaCodice ?? "").trim();
      const d = (g.description ?? "").trim();
      return `${t || "—"} · ${d || "Gruppo"}`;
    };

    const rows = sorted.map((l) => {
      const wbs = (l.wbs ?? {}) as Record<string, string>;
      return [
        l.id,
        l.rowType,
        String(l.sortIndex ?? 0),
        l.parentLineId ?? "",
        groupLabelOf(l.parentLineId),
        ...wbsCols.map((k) => wbs[k] ?? ""),
        l.tariffaCodice ?? "",
        l.description ?? "",
        l.uom ?? "",
        String(l.qty ?? 0),
        String(l.unitPrice ?? 0),
        String(l.amount ?? 0),
        l.qtySource ?? "",
        l.marginPct == null ? "" : String(l.marginPct),
        l.pacchettoCodice ?? "",
        l.materialeCodice ?? "",
        l.fornitoreId ?? "",
      ].map(csvEscape).join(";");
    });

    const csv = "\uFEFF" + [headers.map(csvEscape).join(";"), ...rows].join("\r\n");

    const verNo = selectedVersion?.versionNo ?? "x";
    const file = `aedera_${projectId}_GARA_v${verNo}.csv`;
    downloadTextFile(file, csv);
  };

  const discardChanges = async () => {
    if (!selectedVersionId) return;
    if (dirtyCount === 0) return;

    const ok = window.confirm("Scartare tutte le modifiche non salvate?");
    if (!ok) return;

    await loadLines(projectId, selectedVersionId);
  };

  const save = async () => {
    if (!selectedVersionId || !canEdit || saving) return;

    const toDelete = lines.filter((l) => l._deleted && !l.id.startsWith("new_"));
    const dirty = lines.filter((l) => (l._dirty || l._isNew) && !l._deleted);

    if (toDelete.length === 0 && dirty.length === 0) return;

    setSaving(true);
    setErr(null);
    try {
      // 1) delete reali
      for (const d of toDelete) {
        await deleteScenarioLine(projectId, d.id);
      }

      // 2) upsert (solo non-deleted)
      if (dirty.length) {
        const items = dirty.map((l) => ({
          id: l.id, // sempre
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
      }

      // 3) reload pulito
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
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
          >
            <option value="TARIFFA">Ordina per tariffa</option>
            <option value="SORTINDEX">Ordine manuale</option>
          </select>

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

          <label className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs cursor-pointer">
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickCsv(f);
                e.currentTarget.value = "";
              }}
              disabled={!selectedVersionId || !canEdit || loading}
            />
          </label>

          {importPreview ? (
            <>
              <button
                type="button"
                className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs text-emerald-700"
                onClick={() => void applyImport()}
                disabled={importing || !canEdit}
              >
                Applica import
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs"
                onClick={() => setImportPreview(null)}
                disabled={importing}
              >
                Chiudi preview
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={exportCsv}
            disabled={!selectedVersionId || loading}
            className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs"
            title="Esporta tutte le righe in CSV"
          >
            Export CSV
          </button>

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

      {importPreview ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-700">
              Preview import · righe: <b>{importPreview.stats.total}</b> · gruppi: <b>{importPreview.stats.groups}</b> · linee:{" "}
              <b>{importPreview.stats.lines}</b>
              {importPreview.stats.errors ? (
                <span className="ml-2 text-rose-700">· errori: <b>{importPreview.stats.errors}</b></span>
              ) : null}
            </div>
          </div>

          {importPreview.errors.length ? (
            <div className="mt-2 rounded border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
              {importPreview.errors.slice(0, 8).map((x, i) => (
                <div key={i}>• {x}</div>
              ))}
              {importPreview.errors.length > 8 ? <div>…</div> : null}
            </div>
          ) : null}

          <div className="mt-2 max-h-[240px] overflow-auto border border-slate-200 rounded">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200">
                  {importPreview.headers.slice(0, 10).map((h) => (
                    <th key={h} className="text-left px-2 py-1 font-semibold text-slate-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importPreview.rows.slice(0, 30).map((r, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    {importPreview.headers.slice(0, 10).map((h) => (
                      <td key={h} className="px-2 py-1 whitespace-nowrap">
                        {String(r[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-[11px] text-slate-500">
            Mostro solo le prime 10 colonne e le prime 30 righe.
          </div>
        </div>
      ) : null}

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
                const isDeleted = !!l._deleted;
                return (
                  <tr
                    key={l.id}
                    className={[
                      "border-b border-slate-100",
                      rowMuted,
                      isGroup ? "bg-slate-50" : "",
                      isDeleted ? "bg-rose-50 opacity-90" : "",
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

                        {isDeleted ? (
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded border border-rose-200 bg-rose-100 text-rose-700">
                            ELIMINATA (bozza)
                          </span>
                        ) : null}

                        <input
                          className={[
                            "rounded border px-2 py-1",
                            isGroup ? "w-[120px] font-semibold" : "w-[120px]",
                            isGroup ? "border-slate-300 bg-slate-50" : "border-slate-200",
                            isDeleted ? "line-through text-rose-700" : "",
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
                        className={[
                          "w-[420px] rounded border border-slate-200 px-2 py-1",
                          isDeleted ? "line-through text-rose-700" : "",
                        ].join(" ")}
                        value={l.description ?? ""}
                        onChange={(e) => updateLine(l.id, { description: e.target.value })}
                        disabled={!canEdit || isDeleted}
                        placeholder="Descrizione"
                      />
                    </td>

                    <td className="px-2 py-1 align-top">
                      <select
                        className="w-[220px] rounded border border-slate-200 px-2 py-1 bg-white"
                        value={l.parentLineId ?? ""}
                        onChange={(e) => updateLine(l.id, { parentLineId: e.target.value || null })}
                        disabled={!canEdit || isDeleted}
                      >
                        <option value="">{isGroup ? "(Root)" : "(Nessun gruppo)"}</option>

                        {groupOptions
                          .filter((g) => g.id !== l.id) // no self
                          .filter((g) => {
                            // se sto scegliendo parent per un GROUP, evita scegliere un discendente
                            if (!isGroup) return true;
                            const desc = descendantsOf.get(l.id);
                            return !desc?.has(g.id);
                          })
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.label}
                            </option>
                          ))}
                      </select>
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
                      {l._deleted ? (
                        <button
                          type="button"
                          className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs text-emerald-700"
                          onClick={() => onRestoreLine(l.id)}
                          disabled={!canEdit}
                          title="Ripristina (bozza)"
                        >
                          ↩︎
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs"
                          onClick={() => void onDeleteLine(l.id)}
                          disabled={!canEdit}
                          title="Elimina (bozza)"
                        >
                          🗑️
                        </button>
                      )}
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
