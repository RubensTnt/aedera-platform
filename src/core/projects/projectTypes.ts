export type AederaProject = {
  id: string;
  name: string;
  code?: string;
  createdAt?: string;
};

export type ProjectRole = "project-admin" | "project-member";

export interface ProjectContextState {
  project: AederaProject;
  role: ProjectRole;
}
