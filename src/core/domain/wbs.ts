// src/core/domain/wbs.ts

export interface WBSNode {
  id: string;
  projectId: string;
  level: number;         // 0, 1, 2...
  code: string;
  description: string;
  parentId?: string;
}
