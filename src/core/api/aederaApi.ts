// src/core/api/aederaApi.ts

import type { DatiWbsProps } from "../bim/modelProperties";
import { getCurrentProjectId } from "../projects/projectStore";
import type { AederaProject } from "../projects/projectTypes";

// Per ora: server locale
export const API_BASE = "http://localhost:4000";

// === DEPRECATO ===
/* export function getProjectId(): string {
  // zero-UI: projectId persistente ma semplice
  return localStorage.getItem("aedera:projectId") ?? "aedera-demo";
} */

// === NUOVO - prendiamo il Progetto dallo store ===
export function requireProjectId(): string {
  const pid = getCurrentProjectId();
  if (!pid) throw new Error("No current project selected");
  return pid;
}

function toDbPatch(patch: Partial<DatiWbsProps>): Record<string, string | null> {
  const out: Record<string, string | null> = {};

  for (let i = 0; i <= 10; i++) {
    const k = `WBS${i}` as keyof DatiWbsProps;
    if (k in patch) {
      const v = patch[k];
      // null = rimozione esplicita, string = valore
      out[`wbs${i}`] = v == null ? null : String(v);
    }
  }

  if ("TariffaCodice" in patch) {
    const v = patch.TariffaCodice;
    out.tariffaCodice = v == null ? null : String(v);
  }

  if ("PacchettoCodice" in patch) {
    const v = patch.PacchettoCodice;
    out.pacchettoCodice = v == null ? null : String(v);
  }

  return out;
}

export async function upsertElementDatiWbs(
  projectId: string,
  globalId: string,
  patch: Partial<DatiWbsProps>,
): Promise<void> {
  const body = toDbPatch(patch);

  // se patch vuota non fare chiamate inutili
  if (!Object.keys(body).length) return;

  try {
    await fetch(
      `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/elements/${encodeURIComponent(globalId)}/dati-wbs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  } catch (err) {
    // non blocchiamo la UI; log per debug
    console.warn("[DB] upsertElementDatiWbs failed", { projectId, globalId, err });
  }
}

export async function bulkGetDatiWbs(
  projectId: string,
  globalIds: string[],
): Promise<any[]> {
  if (!globalIds.length) return [];

  // ✅ chunk per evitare request troppo grandi
  const CHUNK_SIZE = 500;

  const chunks: string[][] = [];
  for (let i = 0; i < globalIds.length; i += CHUNK_SIZE) {
    chunks.push(globalIds.slice(i, i + CHUNK_SIZE));
  }

  const allRows: any[] = [];

  for (const chunk of chunks) {
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/dati-wbs/bulk-get`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ globalIds: chunk }),
        },
      );

      if (!res.ok) {
        console.warn("[DB] bulkGetDatiWbs chunk failed", {
          projectId,
          status: res.status,
          count: chunk.length,
        });
        continue;
      }

      const rows = await res.json();
      if (Array.isArray(rows)) allRows.push(...rows);
    } catch (err) {
      console.warn("[DB] bulkGetDatiWbs chunk error", { projectId, err });
    }
  }

  return allRows;
}

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




export type IfcModelDto = {
  id: string;
  projectId: string;
  label: string;
  fileName: string;
  fileKey: string;
  size?: number;
  createdAt: string;
  url: string; // dal server (/storage/...)
};

export async function listProjectModels(projectId: string): Promise<IfcModelDto[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`listProjectModels failed: ${res.status}`);
  return res.json();
}

export async function uploadProjectModel(projectId: string, file: File, label?: string) {
  const fd = new FormData();
  fd.append("file", file);
  if (label) fd.append("label", label);

  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models/upload`, {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`uploadProjectModel failed: ${res.status}`);
  return res.json() as Promise<IfcModelDto>;
}

export async function deleteProjectModel(projectId: string, modelId: string) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/models/${modelId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`deleteProjectModel failed: ${res.status}`);
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

