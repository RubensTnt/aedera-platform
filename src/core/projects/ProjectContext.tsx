import React, { createContext, useContext, useMemo } from "react";
import type { AederaProject, ProjectContextState, ProjectRole } from "./projectTypes";

const ProjectContext = createContext<ProjectContextState | null>(null);

interface ProjectProviderProps {
  children: React.ReactNode;
}

/**
 * TODO: in futuro questo arriverà dal backend / routing (es. /projects/:projectId)
 */
const DEFAULT_PROJECT: AederaProject = {
  id: "project-default",
  name: "Progetto demo Aedera",
  code: "AED-DEMO",
};

const DEFAULT_ROLE: ProjectRole = "project-admin"; // per ora sei sempre admin :)

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const value = useMemo<ProjectContextState>(
    () => ({
      project: DEFAULT_PROJECT,
      role: DEFAULT_ROLE,
    }),
    [],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

export function useProjectContext(): ProjectContextState {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProjectContext must be used within a ProjectProvider");
  }
  return ctx;
}

export function useCurrentProject(): AederaProject {
  return useProjectContext().project;
}

export function useProjectPermissions() {
  const { role } = useProjectContext();
  const isProjectAdmin = role === "project-admin";
  return { isProjectAdmin };
}
