import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createProject, listProjects, getMe } from "../api/aederaApi";
import type { AederaProject } from "./projectTypes";
import {
  initProjectStore,
  getCurrentProjectId,
  setCurrentProjectId,
  subscribeProjectId,
} from "./projectStore";
import { archiveProject, restoreProject, updateProject } from "../api/aederaApi";


type ProjectCtx = {
  projects: AederaProject[];
  currentProjectId: string | null;
  currentProject: AederaProject | null;
  setProjectById: (id: string) => void;
  createNewProject: (payload: { name: string; code?: string }) => Promise<AederaProject>;
  reloadProjects: () => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  archiveProjectById: (id: string) => Promise<void>;
  restoreProjectById: (id: string) => Promise<void>;
  loadArchivedProjects: () => Promise<AederaProject[]>;
};

const Ctx = createContext<ProjectCtx | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<AederaProject[]>([]);
  const [currentProjectIdState, setCurrentProjectIdState] = useState<string | null>(null);

  useEffect(() => {
    initProjectStore(null);
    setCurrentProjectIdState(getCurrentProjectId());

    const unsub = subscribeProjectId((pid) => setCurrentProjectIdState(pid));
    return () => unsub();
  }, []);

  async function reloadProjects() {
    try {
      // 1) check session
      const me = await getMe();
      if (!me) {
        setProjects([]);
        initProjectStore(null);        // pulisce lo store persistente
        setCurrentProjectIdState(null); // pulisce lo state React
        return;
      }

      const items = await listProjects();
      setProjects(items);

      const storeId = getCurrentProjectId();
      const storeValid = storeId && items.some((p) => p.id === storeId);

      if (!storeValid) {
        // fallback: primo progetto se esiste
        if (items[0]) setCurrentProjectId(items[0].id);
        else {
          initProjectStore(null);
          setCurrentProjectIdState(null);
        }
      }
    } catch (err) {
      console.error("[ProjectProvider] reloadProjects failed", err);
      setProjects([]);
      initProjectStore(null);
      setCurrentProjectIdState(null);
    }
  }

  useEffect(() => {
    void reloadProjects();
  }, []);

  const currentProject = useMemo(() => {
    if (!currentProjectIdState) return null;
    return projects.find((p) => p.id === currentProjectIdState) ?? null;
  }, [projects, currentProjectIdState]);

  function setProjectById(id: string) {
    setCurrentProjectId(id);
  }

  async function createNewProjectFn(payload: { name: string; code?: string }) {
    const p = await createProject(payload);
    await reloadProjects();
    setCurrentProjectId(p.id);
    return p;
  }

  async function renameProjectFn(id: string, name: string) {
    await updateProject(id, { name });
    await reloadProjects();
  }

  async function archiveProjectById(id: string) {
    await archiveProject(id);
    await reloadProjects();

    // se ho archiviato quello corrente, sposta su un altro
    if (getCurrentProjectId() === id) {
      const items = await listProjects(); // attivi
      if (items[0]) setCurrentProjectId(items[0].id);
    }
  }

  async function restoreProjectById(id: string) {
    await restoreProject(id);
    await reloadProjects();
  }

  async function loadArchivedProjects() {
    return listProjects("true");
  }

  const value: ProjectCtx = {
    projects,
    currentProjectId: currentProjectIdState,
    currentProject,
    setProjectById,
    createNewProject: createNewProjectFn,
    reloadProjects,
    renameProject: renameProjectFn,
    archiveProjectById,
    restoreProjectById,
    loadArchivedProjects,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjects() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProjects must be used within ProjectProvider");
  return v;
}

// compat con il tuo codice attuale: useCurrentProject() già usato da useDatiWbsProfile
export function useCurrentProject() {
  const { currentProject } = useProjects();
  return currentProject;
}

export function useRequiredProject() {
  const project = useCurrentProject();
  if (!project) throw new Error("Project not ready yet");
  return project;
}

// ✅ Backward-compat temporaneo: per ora nessun RBAC vero.
// Consideriamo tutti "admin" per sbloccare UI (Step 1).
export function useProjectPermissions() {
  return {
    isProjectAdmin: true,
    canCreateProject: true,
    canEditProject: true,
    canDeleteProject: true,
    canEditWbs: true,
  };
}


