import { randomUUID } from "node:crypto";

import type { CreateTaskInput } from "../schemas/task.schema.js";

export interface TaskRecord {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  createdAt: string;
}

export class TaskRepository {
  async create(
    projectId: string,
    input: CreateTaskInput,
  ): Promise<TaskRecord> {
    // PostgreSQL persistence will replace this placeholder in a later session.
    return Promise.resolve({
      id: randomUUID(),
      projectId,
      title: input.title,
      description: input.description ?? null,
      assigneeId: input.assigneeId ?? null,
      priority: input.priority ?? "medium",
      dueDate: input.dueDate ?? null,
      createdAt: new Date().toISOString(),
    });
  }
}
