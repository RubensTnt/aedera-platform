// src/core/domain/progress.ts

export type TaskStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";

export interface Task {
  id: string;
  projectId: string;
  name: string;
  wbsCode?: string;
  tariffCode?: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  progressPercent: number; // 0-100
  status: TaskStatus;
}

export interface TaskElementLink {
  taskId: string;
  modelVersionId: string;
  ifcGuid: string;
}

export type OrderStatus = "CREATED" | "SENT" | "DELIVERED" | "DELAYED" | "CANCELLED";

export interface Order {
  id: string;
  projectId: string;
  supplier: string;
  orderCode: string;
  status: OrderStatus;
  relatedWbsCode?: string;
  relatedTariffCode?: string;
  createdAt: string;
  expectedDelivery?: string;
  actualDelivery?: string;
}
