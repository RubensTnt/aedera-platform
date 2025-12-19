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
  if (!res.ok) throw new Error("login failed");
  return res.json();
}

export async function logout() {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
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
export async function listProjects(archived?: "true" | "all"): Promise<AederaProject[]> {
  const qs = archived ? `?archived=${archived}` : "";
  const res = await fetch(`${API_BASE}/api/projects${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error(`listProjects failed: ${res.status}`);
  return res.json();
}

export async function createProject(payload: { name: string; code?: string }) {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`createProject failed: ${res.status}`);
  return res.json();
}

export async function updateProject(
  id: string,
  payload: { name?: string; code?: string },
): Promise<AederaProject> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`updateProject failed: ${res.status}`);
  return res.json();
}

export async function archiveProject(id: string) {
  const res = await fetch(`${API_BASE}/api/projects/${id}/archive`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`archiveProject failed: ${res.status}`);
  return res.json();
}

export async function restoreProject(id: string) {
  const res = await fetch(`${API_BASE}/api/projects/${id}/restore`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`restoreProject failed: ${res.status}`);
  return res.json();
}

// ----------------------
// Models
// ----------------------
export type ProjectModelDto = {
  id: string;
  label: string;
  url: string;
};

export async function listProjectModels(projectId: string): Promise<ProjectModelDto[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`listProjectModels failed: ${res.status}`);
  return res.json();
}

export async function uploadProjectModel(projectId: string, file: File, label: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("label", label);

  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!res.ok) throw new Error(`uploadProjectModel failed: ${res.status}`);
  return res.json() as Promise<{ id: string; label: string; url: string }>;
}

export async function deleteProjectModel(projectId: string, modelId: string) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models/${modelId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) throw new Error(`deleteProjectModel failed: ${res.status}`);
  return res.json();
}


export type IndexElementsPayload = {
  elements: Array<{
    guid: string;
    ifcType: string;
    name?: string | null;
    typeName?: string | null;
    category?: string | null;
  }>;
};

export async function indexElementsForModel(projectId: string, ifcModelId: string, payload: IndexElementsPayload) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models/${ifcModelId}/index-elements`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`indexElementsForModel failed: ${res.status} ${txt}`);
  }
  return res.json();
}


// ----------------------
// Suppliers
// ----------------------
export type SupplierDto = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

export async function listSuppliers(projectId: string) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`listSuppliers failed: ${res.status}`);
  return res.json() as Promise<SupplierDto[]>;
}

export async function createSupplier(projectId: string, payload: { name: string; code?: string }) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createSupplier failed: ${res.status}`);
  return res.json() as Promise<SupplierDto>;
}

export async function updateSupplier(
  projectId: string,
  supplierId: string,
  payload: { name?: string; code?: string | null; isActive?: boolean },
) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/suppliers/${supplierId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateSupplier failed: ${res.status}`);
  return res.json() as Promise<SupplierDto>;
}

// ----------------------
// Element Params
// ----------------------
export type ElementParamDefinitionDto = {
  id: string;
  key: string;
  label: string;
  type: string;
  isMulti: boolean;
  isRequired: boolean;
  isReadOnly: boolean;
};

export type BulkGetElementParamsResponse = {
  definitions: ElementParamDefinitionDto[];
  values: Record<string, Record<string, any>>; // values[globalId][key] = valueJson
};

export async function bulkGetElementParams(
  projectId: string,
  payload: { modelId: string; guids: string[]; keys?: string[] },
) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/params/values/bulk-get`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`bulkGetElementParams failed: ${res.status} ${txt}`);
  }
  return res.json() as Promise<BulkGetElementParamsResponse>;
}

export async function setElementParamValue(
  projectId: string,
  modelId: string,
  guid: string,
  key: string,
  value: any,
) {
  const res = await fetch(
    `${API_BASE}/api/projects/${projectId}/params/elements/${modelId}/${guid}/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    },
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`setElementParamValue failed: ${res.status} ${txt}`);
  }

  return res.json();
}

export async function getElementParamHistory(projectId: string, modelId: string, guid: string) {
  const res = await fetch(
    `${API_BASE}/api/projects/${projectId}/params/elements/${modelId}/${guid}/history`,
    { credentials: "include" },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`getElementParamHistory failed: ${res.status} ${txt}`);
  }
  return res.json();
}


// ----------------------
// WBS (NEW)
// ----------------------
export type WbsNodeDto = {
  id: string;
  projectId: string;
  code: string;        // es. "01", "010", ...
  label: string | null;
  parentId: string | null;
  level: number;       // 0..n
  path: string[];      // ["01","010",...]
};

export async function getWbsTree(projectId: string) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/wbs/tree`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`getWbsTree failed: ${res.status}`);
  return res.json() as Promise<WbsNodeDto[]>;
}

/**
 * Crea (se mancano) tutti i nodi necessari per i path.
 * path = ["01","010","A"] ecc.
 * Ritorna una mappa key->nodeId dove key è path joinato con "/".
 */
// aederaApi.ts

type EnsureWbsPathsResponse =
  | { nodeIdByPathKey: Record<string, string> }
  | { leaves: { key: string; wbsNodeId: string }[] };

export async function ensureWbsPaths(
  projectId: string,
  payload: { paths: string[][] },
): Promise<{ nodeIdByPathKey: Record<string, string> }> {

  // ✅ Adatta il payload al contratto del server: [{ segments: [{code,name?}]}]
  const body = {
    paths: (payload.paths ?? [])
      .filter((p) => Array.isArray(p) && p.length > 0)
      .map((p) => ({
        segments: p
          .map((code) => String(code ?? "").trim())
          .filter((code) => code.length > 0)
          .map((code) => ({ code, name: code })), // name opzionale: per ora uguale a code
      }))
      .filter((p) => p.segments.length > 0),
  };

  const res = await fetch(`${API_BASE}/api/projects/${projectId}/wbs/ensure-paths`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`ensureWbsPaths failed: ${res.status}`);

  const data = (await res.json()) as EnsureWbsPathsResponse;

  // ✅ Normalizza la response in nodeIdByPathKey per i chiamanti UI
  if ("nodeIdByPathKey" in data && data.nodeIdByPathKey) {
    return { nodeIdByPathKey: data.nodeIdByPathKey };
  }

  if ("leaves" in data && Array.isArray(data.leaves)) {
    const nodeIdByPathKey: Record<string, string> = {};
    for (const leaf of data.leaves) {
      if (leaf?.key && leaf?.wbsNodeId) nodeIdByPathKey[leaf.key] = leaf.wbsNodeId;
    }
    return { nodeIdByPathKey };
  }

  throw new Error("ensureWbsPaths: unexpected response shape");
}


export async function bulkGetWbsAssignments(
  projectId: string,
  payload: { modelId: string; guids: string[] },
) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/wbs/assignments/bulk-get`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`bulkGetWbsAssignments failed: ${res.status} ${txt}`);
  }

  const raw = await res.json();

  // se il server già ritorna array [{guid,wbsNodeId,...}]
  if (Array.isArray(raw)) {
    const map: Record<string, string | null> = {};
    for (const it of raw) {
      if (typeof it?.guid === "string") map[it.guid] = it?.wbsNodeId ?? null;
    }
    return { assignmentByGuid: map };
  }

  // eventuale shape alternativa { items: [...] }
  if (Array.isArray(raw?.items)) {
    const map: Record<string, string | null> = {};
    for (const it of raw.items) {
      if (typeof it?.guid === "string") map[it.guid] = it?.wbsNodeId ?? null;
    }
    return { assignmentByGuid: map };
  }

  // eventuale shape { assignmentByGuid: {...} }
  if (raw?.assignmentByGuid && typeof raw.assignmentByGuid === "object") {
    return { assignmentByGuid: raw.assignmentByGuid };
  }

  throw new Error("bulkGetWbsAssignments: unexpected response shape");
}


export async function bulkSetWbsAssignments(projectId: string, payload: { modelId: string; items: Array<{ guid: string; wbsNodeId: string | null }> }) {
  const items = payload.items ?? [];
  if (!items.length) return { updated: 0 };

  const CHUNK = 500; // 200..1000 ok, 500 è un buon equilibrio
  let updated = 0;

  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);

    const res = await fetch(
      `${API_BASE}/api/projects/${projectId}/wbs/assignments/bulk-set`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: payload.modelId, items: chunk, source: "IFC_IMPORT" }),
      },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`bulkSetWbsAssignments failed: ${res.status} ${txt}`);
    }

    // se il server non ritorna contatori, ignora e continua
    updated += chunk.length;
  }

  return { updated };
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
