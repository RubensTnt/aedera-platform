// src/core/projects/projectStore.ts

const LS_KEY = "aedera:currentProjectId";

type Listener = (projectId: string | null) => void;

let currentProjectId: string | null = null;
const listeners = new Set<Listener>();

export function initProjectStore(initialProjectId?: string | null) {
  if (currentProjectId) return;

  const fromLs = localStorage.getItem(LS_KEY);
  currentProjectId = initialProjectId ?? fromLs ?? null;

  if (currentProjectId) localStorage.setItem(LS_KEY, currentProjectId);
}

export function getCurrentProjectId(): string | null {
  if (!currentProjectId) {
    // init lazy (per moduli non-React caricati presto)
    initProjectStore(null);
  }
  return currentProjectId;
}

export function setCurrentProjectId(projectId: string) {
  currentProjectId = projectId;
  localStorage.setItem(LS_KEY, projectId);
  for (const l of listeners) l(projectId);
}

export function subscribeProjectId(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener); // <-- non ritornare boolean
  };
}

