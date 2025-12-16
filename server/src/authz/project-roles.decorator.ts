import { SetMetadata } from "@nestjs/common";
import type { ProjectRole } from "@prisma/client";

export const PROJECT_ROLES_KEY = "aedera_project_roles";

export function ProjectRoles(...roles: ProjectRole[]) {
  return SetMetadata(PROJECT_ROLES_KEY, roles);
}
