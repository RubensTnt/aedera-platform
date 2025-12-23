// src/ui/overlays/BimMappingSelectionOverlay.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  getSelectedElementsWithBimMapping,
  applyBimMappingToSelection,
  type SelectedElementWithBimMapping,
} from "@core/bim/selectionAdapter";
import { API_BASE, listWbsAllowedValues, type WbsAllowedValueDto } from "@core/api/aederaApi";
import { useProjects } from "@core/projects/ProjectContext";
import { applyViewerFilterByGlobalIds, type ViewerFilterMode } from "@core/bim/thatopen";
import { getBimMappingModelIds, getBimMappingRows, listDistinctBimValues } from "@core/bim/bimMappingStore";
import { useDatiWbsProfile } from "../../hooks/useDatiWbsProfile";
import type { WbsLevelKey } from "@core/bim/datiWbsProfile";

type SupplierDto = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

type OverlayInfo = {
  key: string; // es. "WBS6" oppure "tariffaCodice"
  label: string;
  valueLabel: string; // "", "varie" o valore unico
  rawValue?: string | null; // codice unico (oppure null)
  meta?: {
    status?: "VALID" | "INVALID";
    rawCode?: string | null;
  };
};

type EditFieldState = {
  key: string;
  label: string;
  required: boolean;

  initialValue: string; // "" se mixed o empty o INVALID
  initialIsMixed: boolean;

  // solo per WBS: quando in read-only era INVALID unico
  initialInvalidRawCode?: string | null;

  value: string; // "" | "__CLEAR__" | codice
};

function computeValueLabel(values: string[]): { label: string; uniqueValue: string | null } {
  const nonEmpty = values.map((v) => v.trim()).filter((v) => v !== "");
  if (!nonEmpty.length) return { label: "", uniqueValue: null };

  const uniq = new Set(nonEmpty);
  if (uniq.size === 1) {
    const v = [...uniq][0];
    return { label: v, uniqueValue: v };
  }
  return { label: "varie", uniqueValue: null };
}

function getWbsDisplayFromSelection(
  selected: SelectedElementWithBimMapping[],
  levelKey: string,
): { valueLabel: string; rawValue: string | null; meta?: OverlayInfo["meta"] } {
  // trasforma ogni elemento in una stringa confrontabile:
  // VALID -> code
  // INVALID -> rawCode
  // EMPTY -> ""
  const entries = selected.map((it) => {
    const a: any = (it as any).wbsByLevel?.[levelKey] ?? null;
    if (!a) return { s: "", status: undefined as any, rawCode: null as any };
    if (a.status === "VALID") return { s: String(a.code ?? "").trim(), status: "VALID" as const, rawCode: null };
    return { s: String(a.rawCode ?? "").trim(), status: "INVALID" as const, rawCode: String(a.rawCode ?? "").trim() };
  });

  const values = entries.map((e) => e.s);
  const { label, uniqueValue } = computeValueLabel(values);

  if (!uniqueValue) {
    // mixed o empty
    return { valueLabel: label, rawValue: null };
  }

  // unico: capire se INVALID o VALID
  const firstNonEmpty = entries.find((e) => e.s.trim() !== "") ?? null;
  if (!firstNonEmpty) return { valueLabel: "", rawValue: null };

  if (firstNonEmpty.status === "INVALID") {
    const raw = firstNonEmpty.rawCode ?? uniqueValue;
    return { valueLabel: `⚠ ${raw}`, rawValue: null, meta: { status: "INVALID", rawCode: raw } };
  }

  return { valueLabel: uniqueValue, rawValue: uniqueValue, meta: { status: "VALID", rawCode: null } };
}

export const BimMappingSelectionOverlay: React.FC = () => {
  const { currentProjectId } = useProjects();
  const projectId = currentProjectId ?? null;

  const [wbsProfile] = useDatiWbsProfile();

  const enabledWbsLevels = useMemo(() => {
    const levels = (wbsProfile?.levels ?? [])
      .filter((l) => l.enabled)
      .map((l) => {
        const idx = Number(String(l.key).replace("WBS", ""));
        return {
          key: l.key as WbsLevelKey,
          label: l.label ?? l.key,
          required: !!l.required,
          levelIndex: idx,
        };
      })
      .filter((x) => Number.isFinite(x.levelIndex))
      .sort((a, b) => a.levelIndex - b.levelIndex);

    return levels;
  }, [wbsProfile]);

  const [selectionCount, setSelectionCount] = useState(0);
  const [levels, setLevels] = useState<OverlayInfo[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<EditFieldState[] | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  // allowed-values by levelKey
  const [allowedValues, setAllowedValues] = useState<WbsAllowedValueDto[]>([]);
  const allowedByLevel = useMemo(() => {
    const map = new Map<string, WbsAllowedValueDto[]>();
    for (const v of allowedValues) {
      const arr = map.get(v.levelKey) ?? [];
      arr.push(v);
      map.set(v.levelKey, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0) || (a.code || "").localeCompare(b.code || ""));
      map.set(k, arr);
    }
    return map;
  }, [allowedValues]);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<ViewerFilterMode>("ISOLATE");
  const [filter, setFilter] = useState({
    tariffaCodice: "",
    pacchettoCodice: "",
    codiceMateriale: "",
    fornitoreId: "",
    wbsLevelKey: "" as string,
    wbsCode: "" as string,
  });

  // tick mapping store
  const [mappingTick, setMappingTick] = useState(0);
  useEffect(() => {
    const onUpd = () => setMappingTick((x) => x + 1);
    window.addEventListener("aedera:bimMappingUpdated", onUpd as any);
    return () => window.removeEventListener("aedera:bimMappingUpdated", onUpd as any);
  }, []);

  // load suppliers (local fetch, così non dipendi da exports in aederaApi.ts)
  useEffect(() => {
    let disposed = false;
    async function load() {
      if (!projectId) return;
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers`, {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) throw new Error("suppliers fetch failed");
        const data = (await res.json()) as SupplierDto[];
        if (!disposed) setSuppliers(Array.isArray(data) ? data : []);
      } catch {
        if (!disposed) setSuppliers([]);
      }
    }
    void load();
    return () => {
      disposed = true;
    };
  }, [projectId]);

  // load allowed-values for enabled levels
  useEffect(() => {
    let disposed = false;
    async function load() {
      if (!projectId) return;
      const levelKeys = enabledWbsLevels.map((l) => l.key);
      try {
        const resp = await listWbsAllowedValues(projectId, { levels: levelKeys });
        if (!disposed) setAllowedValues(resp.items ?? []);
      } catch {
        if (!disposed) setAllowedValues([]);
      }
    }
    void load();
    return () => {
      disposed = true;
    };
  }, [projectId, enabledWbsLevels]);

  // filter options (solo parametri “semplici”; WBS filtro è text-based)
  const filterOptions = useMemo(() => {
    if (!projectId) return { tariffa: [], pacchetto: [], materiale: [] as string[] };
    const modelIds = getBimMappingModelIds(projectId);

    const collect = (field: any) => {
      const uniq = new Set<string>();
      for (const mid of modelIds) {
        for (const v of listDistinctBimValues(mid, field, 200)) uniq.add(v);
        if (uniq.size >= 200) break;
      }
      return Array.from(uniq).sort();
    };

    return {
      tariffa: collect("tariffaCodice"),
      pacchetto: collect("pacchettoCodice"),
      materiale: collect("codiceMateriale"),
    };
  }, [projectId, mappingTick]);

  const computeMatches = () => {
    if (!projectId) return { modelIdToGuids: {} as Record<string, string[]>, total: 0 };

    const modelIds = getBimMappingModelIds(projectId);
    const modelIdToGuids: Record<string, string[]> = {};
    let total = 0;

    const f = {
      tariffaCodice: filter.tariffaCodice.trim(),
      pacchettoCodice: filter.pacchettoCodice.trim(),
      codiceMateriale: filter.codiceMateriale.trim(),
      fornitoreId: filter.fornitoreId.trim(),
      wbsLevelKey: filter.wbsLevelKey.trim(),
      wbsCode: filter.wbsCode.trim(),
    };

    const hasAny =
      !!f.tariffaCodice ||
      !!f.pacchettoCodice ||
      !!f.codiceMateriale ||
      !!f.fornitoreId ||
      (!!f.wbsLevelKey && !!f.wbsCode);

    if (!hasAny) return { modelIdToGuids, total: 0 };

    for (const mid of modelIds) {
      const rows = getBimMappingRows(mid);
      const hits: string[] = [];

      for (const r of rows as any[]) {
        if (f.tariffaCodice && (r.tariffaCodice ?? "") !== f.tariffaCodice) continue;
        if (f.pacchettoCodice && (r.pacchettoCodice ?? "") !== f.pacchettoCodice) continue;
        if (f.codiceMateriale && (r.codiceMateriale ?? "") !== f.codiceMateriale) continue;

        if (f.fornitoreId) {
          const ids = (r as any).fornitoreIds as string[] | null | undefined;
          if (!ids?.includes(f.fornitoreId)) continue;
        }

        if (f.wbsLevelKey && f.wbsCode) {
          const a = (r as any).wbsByLevel?.[f.wbsLevelKey] ?? null;
          const val =
            a?.status === "VALID" ? String(a?.code ?? "") : String(a?.rawCode ?? "");
          if ((val ?? "") !== f.wbsCode) continue;
        }

        hits.push(r.globalId);
      }

      if (hits.length) {
        modelIdToGuids[mid] = hits;
        total += hits.length;
      }
    }

    return { modelIdToGuids, total };
  };

  const preview = useMemo(() => computeMatches(), [projectId, mappingTick, filter]);

  const handleApplyFilter = async () => {
    const { modelIdToGuids, total } = computeMatches();
    if (!total) return;
    await applyViewerFilterByGlobalIds(modelIdToGuids, filterMode);
  };

  const handleResetFilter = async () => {
    await applyViewerFilterByGlobalIds({}, "RESET");
  };

  // Poll selezione -> snapshot read-only
  useEffect(() => {
    let disposed = false;

    if (isEditing) {
      return () => {
        disposed = true;
      };
    }

    const tick = async () => {
      const selected: SelectedElementWithBimMapping[] = await getSelectedElementsWithBimMapping();
      if (disposed) return;

      setSelectionCount(selected.length);

      const infos: OverlayInfo[] = [];

      // WBS livelli (dinamici)
      for (const L of enabledWbsLevels) {
        const { valueLabel, rawValue, meta } = getWbsDisplayFromSelection(selected, L.key);
        infos.push({
          key: L.key,
          label: L.label,
          valueLabel: valueLabel === "varie" ? "varie" : valueLabel,
          rawValue,
          meta,
        });
      }

      // Altri campi (fissi)
      const fixed: Array<{ key: string; label: string; required?: boolean }> = [
        { key: "tariffaCodice", label: "Codice tariffa", required: true },
        { key: "pacchettoCodice", label: "Codice pacchetto" },
        { key: "codiceMateriale", label: "Codice materiale" },
        { key: "fornitoreIds", label: "Fornitori" },
      ];

      for (const f of fixed) {
        const rawValues = selected.map((it) => {
          const raw = (it as any)[f.key];
          if (raw == null) return "";
          if (Array.isArray(raw)) {
            return raw
              .map((x) => String(x ?? "").trim())
              .filter(Boolean)
              .sort()
              .join(",");
          }
          return String(raw).trim();
        });

        const { label: baseLabel, uniqueValue } = computeValueLabel(rawValues);

        let valueLabel = baseLabel;
        let rawValue: string | null = uniqueValue;

        if (f.key === "fornitoreIds") {
          if (!rawValue) {
            valueLabel = baseLabel;
          } else {
            const ids = rawValue.split(",").map((s) => s.trim()).filter(Boolean);
            const names = ids.map((id) => supplierById.get(id)?.name ?? id);
            valueLabel = names.join(", ");
          }
        }

        infos.push({ key: f.key, label: f.label, valueLabel, rawValue });
      }

      setLevels(infos);
    };

    void tick();
    const id = window.setInterval(tick, 400);

    return () => {
      disposed = true;
      window.clearInterval(id);
    };
  }, [isEditing, supplierById, enabledWbsLevels]);

  if (!levels.length && selectionCount === 0) return null;

  const hasSelection = selectionCount > 0;

  const handleStartEdit = async () => {
    if (!hasSelection) return;

    const selected: SelectedElementWithBimMapping[] = await getSelectedElementsWithBimMapping();

    const next: EditFieldState[] = [];

    // WBS livelli
    for (const L of enabledWbsLevels) {
      const aList = selected.map((it) => {
        const a: any = (it as any).wbsByLevel?.[L.key] ?? null;
        if (!a) return { val: "", status: "EMPTY" as const, rawCode: null as any };
        if (a.status === "VALID") return { val: String(a.code ?? "").trim(), status: "VALID" as const, rawCode: null };
        return { val: String(a.rawCode ?? "").trim(), status: "INVALID" as const, rawCode: String(a.rawCode ?? "").trim() };
      });

      const vals = aList.map((x) => x.val);
      const { label, uniqueValue } = computeValueLabel(vals);
      const isMixed = label === "varie";

      let initialValue = "";
      let initialInvalidRawCode: string | null = null;

      if (!isMixed && uniqueValue) {
        // unico, capire se INVALID o VALID
        const firstNonEmpty = aList.find((x) => x.val.trim() !== "") ?? null;
        if (firstNonEmpty?.status === "VALID") {
          initialValue = uniqueValue;
        } else if (firstNonEmpty?.status === "INVALID") {
          initialValue = ""; // dropdown vuoto: costringe a scegliere un valore ammesso se vuoi correggere
          initialInvalidRawCode = firstNonEmpty.rawCode ?? uniqueValue;
        }
      }

      next.push({
        key: L.key,
        label: L.label,
        required: !!L.required,
        initialValue,
        initialIsMixed: isMixed,
        initialInvalidRawCode,
        value: initialValue,
      });
    }

    // Altri campi
    const fixed: Array<{ key: string; label: string; required?: boolean }> = [
      { key: "tariffaCodice", label: "Codice tariffa", required: true },
      { key: "pacchettoCodice", label: "Codice pacchetto" },
      { key: "codiceMateriale", label: "Codice materiale" },
      { key: "fornitoreIds", label: "Fornitori" },
    ];

    for (const f of fixed) {
      const rawValues = selected.map((it) => {
        const raw = (it as any)[f.key];
        if (raw == null) return "";
        if (Array.isArray(raw)) {
          return raw
            .map((x) => String(x ?? "").trim())
            .filter(Boolean)
            .sort()
            .join(",");
        }
        return String(raw).trim();
      });

      const { label, uniqueValue } = computeValueLabel(rawValues);
      const isMixed = label === "varie";

      const initialValue = isMixed ? "" : String(uniqueValue ?? "");

      next.push({
        key: f.key,
        label: f.label,
        required: !!f.required,
        initialValue,
        initialIsMixed: isMixed,
        value: initialValue,
      });
    }

    setEditFields(next);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFields(null);
  };

  const handleChangeField = (key: string, value: string) => {
    if (!editFields) return;
    setEditFields(editFields.map((f) => (f.key === key ? { ...f, value } : f)));
  };

  const handleApply = async () => {
    if (!editFields || !editFields.length) {
      setIsEditing(false);
      setEditFields(null);
      return;
    }

    // build patch
    const patch: {
      wbsByLevel?: Partial<Record<WbsLevelKey, string | null>>;
      tariffaCodice?: string | null;
      pacchettoCodice?: string | null;
      codiceMateriale?: string | null;
      fornitoreIds?: string[] | null;
    } = {};

    for (const f of editFields) {
      const next = (f.value ?? "").trim();
      const initial = (f.initialValue ?? "").trim();

      // se non è cambiato -> skip
      if (next === initial) continue;

      // se era mixed e lasci vuoto -> non cambiare
      if (f.initialIsMixed && next === "") continue;

      // fornitoreIds: csv
      if (f.key === "fornitoreIds") {
        if (next === "__CLEAR__" || next === "") {
          patch.fornitoreIds = null;
          continue;
        }
        const ids = next.split(",").map((s) => s.trim()).filter(Boolean);
        patch.fornitoreIds = ids.length ? ids : null;
        continue;
      }

      // campi WBS: keys "WBS0..WBS10"
      if (f.key.startsWith("WBS")) {
        (patch.wbsByLevel ??= {} as any)[f.key as WbsLevelKey] =
          next === "__CLEAR__" || next === "" ? null : next;
        continue;
      }

      // altri string
      if (f.key === "tariffaCodice") patch.tariffaCodice = next ? next : null;
      if (f.key === "pacchettoCodice") patch.pacchettoCodice = next ? next : null;
      if (f.key === "codiceMateriale") patch.codiceMateriale = next ? next : null;
    }

    if (!Object.keys(patch).length) {
      setIsEditing(false);
      setEditFields(null);
      return;
    }

    try {
      setIsApplying(true);
      await applyBimMappingToSelection(patch as any);
    } catch (error) {
      console.error("[BimMappingSelectionOverlay] apply failed", { patch, error });
    } finally {
      setIsApplying(false);
      setIsEditing(false);
      setEditFields(null);
    }
  };

  // Validazione (soft): blocca apply solo per required “non-mixed”
  const hasErrors =
    isEditing &&
    !!editFields?.some((f) => {
      if (!f.required) return false;

      // required WBS: serve un valore ammesso selezionato (non "__CLEAR__", non empty)
      if (f.key.startsWith("WBS")) {
        if (f.initialIsMixed && !f.value.trim()) return false; // mixed e lasci vuoto -> non bloccare
        const v = (f.value ?? "").trim();
        // se era INVALID unico e non lo correggi, resta vuoto -> blocca (se required)
        return v === "" || v === "__CLEAR__";
      }

      // required altri campi
      if (f.initialIsMixed && !f.value.trim()) return false;
      return !f.value.trim();
    });

  return (
    <div className="absolute left-3 top-3 z-20 w-[340px] text-[11px] text-slate-800 pointer-events-auto">
      <div className="rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm px-3 py-2.5">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-semibold text-slate-900">BIM Mapping selezione</span>
            <span className="text-[10px] text-slate-500">
              {hasSelection
                ? `${selectionCount} elemento${selectionCount === 1 ? "" : "i"} selezionato${selectionCount === 1 ? "" : "i"}`
                : "Nessuna selezione"}
            </span>
          </div>

          {!isEditing && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFilterOpen((v) => !v)}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-[3px] text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                title="Filtra nel viewer"
              >
                ⌯
              </button>
              <button
                type="button"
                onClick={handleStartEdit}
                disabled={!hasSelection}
                className={[
                  "inline-flex items-center rounded-md border px-2 py-[3px] text-[10px] font-medium",
                  hasSelection
                    ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    : "border-slate-200 bg-slate-50 text-slate-400 cursor-default",
                ].join(" ")}
              >
                Modifica
              </button>
            </div>
          )}
        </div>

        {/* Read-only */}
        {!isEditing && (
          <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1">
            {levels.map((lvl) => (
              <React.Fragment key={lvl.key}>
                <div className="truncate text-[10px] text-slate-500">
                  {lvl.label}
                  {/* Nota: required visivo solo per tariffa e livelli WBS dal profilo */}
                  {lvl.key === "tariffaCodice" ? " *" : ""}
                  {lvl.key.startsWith("WBS") &&
                    enabledWbsLevels.find((x) => x.key === lvl.key)?.required
                    ? " *"
                    : ""}
                </div>

                <div
                  className={[
                    "truncate font-mono",
                    lvl.valueLabel === "varie" ? "text-amber-500" : "",
                    lvl.meta?.status === "INVALID" ? "text-rose-600" : "text-slate-800",
                  ].join(" ")}
                  title={
                    lvl.valueLabel === "varie"
                      ? "Valori diversi nella selezione"
                      : lvl.meta?.status === "INVALID"
                        ? `Valore non ammesso: ${lvl.meta.rawCode ?? ""}`
                        : lvl.valueLabel || ""
                  }
                >
                  {lvl.valueLabel === "varie" ? "varie" : lvl.valueLabel || "—"}
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Filter panel */}
        {!isEditing && isFilterOpen && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-semibold text-slate-700">Filtro viewer</div>
              <div className="text-[9px] text-slate-500">
                match: <span className="font-mono">{preview.total}</span>
              </div>
            </div>

            <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-2">
              <label className="pt-[3px] text-[10px] text-slate-500">Tariffa</label>
              <select
                value={filter.tariffaCodice}
                onChange={(e) => setFilter((f) => ({ ...f, tariffaCodice: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-[2px] text-[11px]"
              >
                <option value="">—</option>
                {filterOptions.tariffa.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>

              <label className="pt-[3px] text-[10px] text-slate-500">Pacchetto</label>
              <select
                value={filter.pacchettoCodice}
                onChange={(e) => setFilter((f) => ({ ...f, pacchettoCodice: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-[2px] text-[11px]"
              >
                <option value="">—</option>
                {filterOptions.pacchetto.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>

              <label className="pt-[3px] text-[10px] text-slate-500">Materiale</label>
              <select
                value={filter.codiceMateriale}
                onChange={(e) => setFilter((f) => ({ ...f, codiceMateriale: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-[2px] text-[11px]"
              >
                <option value="">—</option>
                {filterOptions.materiale.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>

              <label className="pt-[3px] text-[10px] text-slate-500">Fornitore</label>
              <select
                value={filter.fornitoreId}
                onChange={(e) => setFilter((f) => ({ ...f, fornitoreId: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-[2px] text-[11px]"
              >
                <option value="">—</option>
                {suppliers.filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <label className="pt-[3px] text-[10px] text-slate-500">WBS</label>
              <div className="flex gap-2">
                <select
                  value={filter.wbsLevelKey}
                  onChange={(e) => setFilter((f) => ({ ...f, wbsLevelKey: e.target.value }))}
                  className="w-[88px] rounded-md border border-slate-300 bg-white px-2 py-[2px] text-[11px]"
                >
                  <option value="">—</option>
                  {enabledWbsLevels.map((L) => (
                    <option key={L.key} value={L.key}>
                      {L.key}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={filter.wbsCode}
                  onChange={(e) => setFilter((f) => ({ ...f, wbsCode: e.target.value }))}
                  placeholder="codice (o raw)"
                  className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-[2px] text-[11px] font-mono"
                />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as any)}
                className="rounded-md border border-slate-300 bg-white px-2 py-[2px] text-[10px]"
              >
                <option value="ISOLATE">Isola</option>
                <option value="HIDE">Nascondi</option>
              </select>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetFilter}
                  className="rounded-md border border-slate-300 bg-white px-2 py-[3px] text-[10px] text-slate-600 hover:bg-slate-100"
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={preview.total === 0}
                  onClick={handleApplyFilter}
                  className={[
                    "rounded-md px-2 py-[3px] text-[10px] font-semibold text-white",
                    preview.total === 0 ? "bg-slate-300" : "bg-sky-500 hover:bg-sky-600",
                  ].join(" ")}
                >
                  Applica
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editing */}
        {isEditing && editFields && (
          <>
            <div className="max-h-72 overflow-y-auto pr-1">
              <div className="mt-1 grid grid-cols-[auto,1fr] gap-x-2 gap-y-2">
                {editFields.map((f) => {
                  const isWbs = f.key.startsWith("WBS");
                  const isEmpty = !f.value.trim() || f.value === "__CLEAR__";
                  const showError =
                    f.required &&
                    !f.initialIsMixed &&
                    (isEmpty || (isWbs && !f.value.trim()));

                  return (
                    <React.Fragment key={f.key}>
                      <label className="pt-[3px] text-[10px] text-slate-500" htmlFor={`bm-${f.key}`}>
                        {f.label}
                        {f.required ? " *" : ""}
                      </label>

                      <div className="flex flex-col gap-1">
                        {/* FORNITORI (multi) */}
                        {f.key === "fornitoreIds" ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const ids = suppliers.filter((s) => s.isActive).map((s) => s.id);
                                  handleChangeField(f.key, ids.join(","));
                                }}
                                className="text-[9px] text-slate-600 underline"
                              >
                                Seleziona tutti
                              </button>

                              <button
                                type="button"
                                onClick={() => handleChangeField(f.key, "__CLEAR__")}
                                className="text-[9px] text-slate-600 underline"
                              >
                                Rimuovi tutti
                              </button>
                            </div>

                            <div
                              className={[
                                "max-h-36 overflow-y-auto rounded-md border bg-white px-2 py-1",
                                "focus-within:ring-1",
                                showError
                                  ? "border-rose-400 focus-within:ring-rose-400"
                                  : "border-slate-300 focus-within:ring-sky-500",
                              ].join(" ")}
                            >
                              {(() => {
                                const selectedIds =
                                  f.value && f.value !== "__CLEAR__"
                                    ? f.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean)
                                    : [];

                                const selected = new Set(selectedIds);

                                const toggle = (id: string) => {
                                  const next = new Set(selected);
                                  if (next.has(id)) next.delete(id);
                                  else next.add(id);
                                  handleChangeField(f.key, Array.from(next).join(","));
                                };

                                const active = suppliers.filter((s) => s.isActive);
                                if (!active.length) {
                                  return <div className="py-1 text-[10px] text-slate-500">Nessun fornitore attivo</div>;
                                }

                                return (
                                  <div className="flex flex-col gap-1 py-1">
                                    {active.map((s) => {
                                      const checked = selected.has(s.id);
                                      return (
                                        <label key={s.id} className="flex items-center gap-2 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggle(s.id)}
                                            className="h-3 w-3 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                          />
                                          <span className="text-[11px] text-slate-800">{s.name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>

                            {f.initialIsMixed && (
                              <span className="text-[9px] text-amber-500">
                                valori diversi nella selezione (lascia vuoto per non cambiare)
                              </span>
                            )}

                            {showError && <span className="text-[9px] text-rose-500">campo obbligatorio</span>}
                          </div>
                        ) : isWbs ? (
                          // WBS LEVEL (dropdown allowed-values)
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => handleChangeField(f.key, "__CLEAR__")}
                                className="text-[9px] text-slate-600 underline"
                              >
                                Rimuovi
                              </button>

                              {f.initialInvalidRawCode ? (
                                <span className="text-[9px] text-rose-600">
                                  non ammesso: <span className="font-mono">{f.initialInvalidRawCode}</span>
                                </span>
                              ) : null}
                            </div>

                            <select
                              id={`bm-${f.key}`}
                              value={f.value}
                              onChange={(e) => handleChangeField(f.key, e.target.value)}
                              className={[
                                "w-full rounded-md border px-2 py-[2px] text-[11px] bg-white",
                                "focus:outline-none focus:ring-1",
                                showError
                                  ? "border-rose-400 focus:ring-rose-400"
                                  : "border-slate-300 focus:ring-sky-500 focus:border-sky-500",
                              ].join(" ")}
                            >
                              <option value="">
                                {f.initialIsMixed ? "varie (lascia vuoto per non cambiare)" : "—"}
                              </option>

                              {(allowedByLevel.get(f.key) ?? []).map((v) => (
                                <option key={v.id} value={v.code}>
                                  {v.code}{v.name ? ` — ${v.name}` : ""}
                                </option>
                              ))}
                            </select>

                            {f.initialIsMixed && (
                              <span className="text-[9px] text-amber-500">
                                valori diversi nella selezione (se non scegli, non cambia)
                              </span>
                            )}
                            {showError && <span className="text-[9px] text-rose-500">campo obbligatorio</span>}
                          </div>
                        ) : (
                          // INPUT text
                          <input
                            id={`bm-${f.key}`}
                            type="text"
                            value={f.value}
                            onChange={(e) => handleChangeField(f.key, e.target.value)}
                            className={[
                              "w-full rounded-md border px-2 py-[2px] text-[11px] font-mono bg-white",
                              "focus:outline-none focus:ring-1",
                              showError
                                ? "border-rose-400 focus:ring-rose-400"
                                : "border-slate-300 focus:ring-sky-500 focus:border-sky-500",
                            ].join(" ")}
                            placeholder={f.initialIsMixed ? "varie (lascia vuoto per non cambiare)" : ""}
                          />
                        )}

                        {f.initialIsMixed && f.key !== "fornitoreIds" && !f.key.startsWith("WBS") && (
                          <span className="text-[9px] text-amber-500">nella selezione ci sono valori diversi</span>
                        )}
                        {showError && f.key !== "fornitoreIds" && <span className="text-[9px] text-rose-500">campo obbligatorio</span>}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="mt-2 text-[9px] text-slate-500">
                Nota: i dropdown WBS mostrano solo valori ammessi. Se trovi <span className="font-mono">⚠</span> significa
                che l’import IFC ha letto un valore non ammesso (rawCode) e va corretto.
              </div>
            </div>

            {/* Footer */}
            <div className="mt-2 flex items-center justify-between gap-2">
              {hasErrors && (
                <div className="text-[9px] text-rose-500">Compila tutti i campi obbligatori contrassegnati con *.</div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isApplying}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-[3px] text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isApplying}
                  className={[
                    "inline-flex items-center rounded-md px-3 py-[3px] text-[10px] font-semibold text-white shadow-sm",
                    isApplying ? "bg-amber-500" : "bg-amber-400 hover:bg-amber-500",
                  ].join(" ")}
                >
                  {isApplying ? "Aggiornamento..." : "Aggiorna selezione"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
