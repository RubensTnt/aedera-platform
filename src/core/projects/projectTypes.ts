export interface AederaProject {
  id: string;
  name: string;
  code?: string;
  // per ora basta questo, più avanti: ownerId, settings, ecc.
}

export type ProjectRole = "project-admin" | "project-member";

export interface ProjectContextState {
  project: AederaProject;
  role: ProjectRole;
}
