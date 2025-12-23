// src/core/api/aederaApi.ts

import { getCurrentProjectId } from "../projects/projectStore";
import type { AederaProject } from "../projects/projectTypes";

export const API_BASE = "http://localhost:4000";

// ----------------------
// Auth
// ----------------------
export async function login(email: string, password: string, remember: boolean) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, remember }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function logout() {
  const res = await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  return res.ok;
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}

export function requireProjectId(): string {
  const pid = getCurrentProjectId();
  if (!pid) throw new Error("No current project selected");
  return pid;
}

// ----------------------
// Projects
// ----------------------
export async function listProjects(archived?: boolean | "true" | "false"): Promise<AederaProject[]> {
  const archivedStr =
    archived === undefined ? "" : (archived === true || archived === "true" ? "true" : "false");

  const qs = archivedStr ? `?archived=${encodeURIComponent(archivedStr)}` : "";

  const res = await fetch(`${API_BASE}/api/projects${qs}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`listProjects failed: ${res.status}`);
  return res.json();
}

export async function getProject(projectId: string): Promise<AederaProject> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`getProject failed: ${res.status}`);
  return res.json();
}

export async function createProject(payload: {
  name: string;
  description?: string;
}): Promise<AederaProject> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createProject failed: ${res.status}`);
  return res.json();
}

export async function updateProject(
  projectId: string,
  payload: { name?: string; description?: string },
): Promise<AederaProject> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateProject failed: ${res.status}`);
  return res.json();
}

// ----------------------
// Project Models (upload/list/delete)
// ----------------------
export type ProjectModelDto = {
  id: string;
  projectId: string;

  // UI legacy usa label/url: li teniamo
  label: string;
  url: string;

  // campi reali che hai già
  name?: string;
  originalFileName?: string | null;
  createdAt?: string;
};

export async function listProjectModels(projectId: string): Promise<ProjectModelDto[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`listProjectModels failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  const arr = Array.isArray(data) ? data : [];

  // Normalizzazione: se server non manda label/url, li deduciamo
  return arr.map((m: any) => {
    const id = String(m.id);
    const name = String(m.name ?? m.label ?? m.originalFileName ?? "Modello");
    const label = String(m.label ?? name);

    // url “best effort”: se UI lo usa per download o open, punta a un endpoint standard.
    // Se nel tuo server l’endpoint è diverso, qui lo adeguiamo.
    const url = String(m.url ?? `${API_BASE}/api/projects/${projectId}/models/${id}/file`);

    return {
      id,
      projectId: String(m.projectId ?? projectId),
      label,
      url,
      name,
      originalFileName: m.originalFileName ?? null,
      createdAt: m.createdAt,
    } as ProjectModelDto;
  });
}

/**
 * Upload IFC file and create server model.
 * Nota: questa funzione dipende dalla tua API server: se già avevi un endpoint /upload o simile,
 * allinea la URL qui al tuo server reale.
 */
export async function uploadProjectModel(
  projectId: string,
  file: File,
  label?: string,
): Promise<ProjectModelDto> {
  const form = new FormData();
  form.append("file", file);
  if (label) form.append("label", label);

  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`uploadProjectModel failed: ${res.status} ${txt}`);
  }

  return res.json();
}

export async function deleteProjectModel(
  projectId: string,
  modelId: string,
): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models/${modelId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`deleteProjectModel failed: ${res.status} ${txt}`);
  }
  return res.json();
}

// ----------------------
// Projects - extra (archive/restore + list models)
// ----------------------
export async function archiveProject(projectId: string): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/archive`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`archiveProject failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function restoreProject(projectId: string): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/restore`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`restoreProject failed: ${res.status} ${txt}`);
  }
  return res.json();
}

// ----------------------
// IFC Models
// ----------------------
export type IfcModelDto = {
  id: string;
  projectId: string;
  name: string;
  originalFileName: string | null;
  createdAt: string;
};

export async function listModels(projectId: string): Promise<IfcModelDto[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`listModels failed: ${res.status}`);
  return res.json();
}

export async function createModel(
  projectId: string,
  payload: { name: string; originalFileName?: string | null },
): Promise<IfcModelDto> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`createModel failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function deleteModel(projectId: string, modelId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models/${modelId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`deleteModel failed: ${res.status} ${txt}`);
  }
}

export async function indexElementsForModel(
  projectId: string,
  modelId: string,
  payload: {
    elements: Array<{
      guid: string;
      ifcType: string;
      name?: string | null;
      typeName?: string | null;
      category?: string | null;
    }>;
  },
): Promise<{ ok: true; elements: number }> {
  const res = await fetch(
    `${API_BASE}/api/projects/${projectId}/models/${modelId}/index-elements`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`indexElementsForModel failed: ${res.status} ${txt}`);
  }

  return res.json();
}

// ----------------------
// Element Params
// ----------------------
export type ElementParamValueDto = {
  guid: string;
  key: string;
  value: any;
};

export async function bulkGetElementParams(
  projectId: string,
  payload: { modelId: string; guids: string[]; keys: string[] },
): Promise<{ values: Record<string, Record<string, any>> }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/params/values/bulk-get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`bulkGetElementParams failed: ${res.status} ${txt}`);
  }

  // atteso: { values: { [guid]: { [key]: value } } }
  return res.json();
}

export async function bulkSetElementParams(
  projectId: string,
  payload: {
    modelId: string;
    source?: "UI" | "IFC_IMPORT" | "RULE";
    items: Array<{ guid: string; key: string; value: any }>;
  },
): Promise<{ updated: number }> {
  const items = payload.items ?? [];
  if (!items.length) return { updated: 0 };

  // Chunk per evitare payload troppo grandi
  const CHUNK = 500;
  let updated = 0;

  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);

    const res = await fetch(`${API_BASE}/api/projects/${projectId}/params/values/bulk-set`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: payload.modelId,
        source: payload.source ?? "UI",
        items: chunk,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`bulkSetElementParams failed: ${res.status} ${txt}`);
    }

    const data = await res.json().catch(() => null);
    updated += (data?.updated ?? 0);
  }

  return { updated };
}

// ----------------------
// WBS v2 (levels indipendenti + valori ammessi)
// ----------------------

export type WbsLevelSettingDto = {
  id: string;
  projectId: string;
  levelKey: string;
  enabled: boolean;
  required: boolean;
  sortIndex: number;
  ifcParamKey: string | null;
};

export async function listWbsLevels(
  projectId: string,
): Promise<{ items: WbsLevelSettingDto[] }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/wbs/levels`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`listWbsLevels failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return { items: Array.isArray(data) ? data : (data?.items ?? []) };
}

export async function bulkUpsertWbsLevels(
  projectId: string,
  payload: {
    items: Array<{
      levelKey: string;
      enabled?: boolean;
      required?: boolean;
      sortIndex?: number;
      ifcParamKey?: string | null;
    }>;
  },
): Promise<{ upserted: number }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/wbs/levels/bulk-upsert`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`bulkUpsertWbsLevels failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export type WbsAllowedValueDto = {
  id: string;
  projectId: string;
  levelKey: string;
  code: string;
  name: string | null;
  sortIndex: number;
  isActive: boolean;
};

export async function listWbsAllowedValues(
  projectId: string,
  payload?: { levels?: string[] },
): Promise<{ items: WbsAllowedValueDto[] }> {
  const levels =
    payload?.levels?.length ? `?levels=${encodeURIComponent(payload.levels.join(","))}` : "";
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/wbs/allowed-values${levels}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`listWbsAllowedValues failed: ${res.status} ${txt}`);
  }

  // server: findMany -> array
  const data = await res.json();
  return { items: Array.isArray(data) ? data : (data?.items ?? []) };
}

export async function bulkUpsertWbsAllowedValues(
  projectId: string,
  payload: {
    items: Array<{
      levelKey: string;
      code: string;
      name?: string | null;
      sortIndex?: number;
      isActive?: boolean;
    }>;
  },
): Promise<{ upserted: number }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/wbs/allowed-values/bulk-upsert`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`bulkUpsertWbsAllowedValues failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export type WbsAssignmentV2Dto = {
  status: "VALID" | "INVALID";
  code: string | null;
  name: string | null;
  rawCode: string | null;
};

type BulkGetAssignmentsV2ServerItem = {
  guid: string;
  levelKey: string;
  status: "VALID" | "INVALID";
  allowedValueId?: string | null;
  code: string | null;
  name: string | null;
  rawCode: string | null;
};

export async function bulkGetWbsAssignmentsV2(
  projectId: string,
  payload: { modelId: string; guids: string[]; levels?: string[] },
): Promise<{ values: Record<string, Record<string, WbsAssignmentV2Dto>> }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/wbs/assignments-v2/bulk-get`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`bulkGetWbsAssignmentsV2 failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  const items: BulkGetAssignmentsV2ServerItem[] = Array.isArray(data?.items) ? data.items : [];

  const values: Record<string, Record<string, WbsAssignmentV2Dto>> = {};
  for (const it of items) {
    if (!it?.guid || !it?.levelKey) continue;
    (values[it.guid] ??= {})[it.levelKey] = {
      status: it.status,
      code: it.code ?? null,
      name: it.name ?? null,
      rawCode: it.rawCode ?? null,
    };
  }

  return { values };
}

export async function bulkSetWbsAssignmentsV2(
  projectId: string,
  payload: {
    modelId: string;
    source?: "UI" | "IFC_IMPORT" | "RULE";
    overwrite?: boolean;
    items: Array<{ guid: string; levelKey: string; code: string | null }>;
  },
): Promise<{ updated: number; skipped?: number }> {
  const items = payload.items ?? [];
  if (!items.length) return { updated: 0 };

  // Chunk per evitare payload troppo grandi
  const CHUNK = 500;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);

    const res = await fetch(`${API_BASE}/api/projects/${projectId}/wbs/assignments-v2/bulk-set`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: payload.modelId,
        source: payload.source ?? "UI",
        overwrite: payload.overwrite,
        items: chunk,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`bulkSetWbsAssignmentsV2 failed: ${res.status} ${txt}`);
    }

    const data = await res.json().catch(() => null);
    updated += (data?.updated ?? 0);
    skipped += (data?.skipped ?? 0);
  }

  return { updated, skipped };
}

// ----------------------
// Suppliers
// ----------------------
export type SupplierDto = {
  id: string;
  projectId: string;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: string;
};

export async function listSuppliers(projectId: string): Promise<SupplierDto[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`listSuppliers failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function createSupplier(
  projectId: string,
  payload: { name: string; code?: string | null; isActive?: boolean },
): Promise<SupplierDto> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`createSupplier failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function updateSupplier(
  projectId: string,
  supplierId: string,
  payload: { name?: string; code?: string | null; isActive?: boolean },
): Promise<SupplierDto> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers/${supplierId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`updateSupplier failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function deleteSupplierDto(
  projectId: string,
  supplierId: string,
): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers/${supplierId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`deleteSupplierDto failed: ${res.status} ${txt}`);
  }
  return res.json();
}

// ----------------------
// Scenarios (NEW, MIN)
// ----------------------
export type EconomicScenarioDto = {
  id: string;
  projectId: string;
  type: "GARA" | "OPERATIVO" | "COSTI" | "FORECAST";
  name: string;
  version: number;
  createdAt: string;
};

export async function listScenarios(projectId: string) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/scenarios`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`listScenarios failed: ${res.status}`);
  return res.json() as Promise<EconomicScenarioDto[]>;
}
