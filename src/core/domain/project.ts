// src/core/domain/project.ts

export interface Company {
  id: string;
  name: string;
}

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "CLOSED";

export interface Project {
  id: string;
  companyId: string;
  code: string;
  name: string;
  status: ProjectStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
