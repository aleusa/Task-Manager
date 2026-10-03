import { z } from "zod";

import { databaseIdSchema } from "./common.schema.js";

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

export const projectParamsSchema = z.strictObject({
  projectId: databaseIdSchema,
});

export const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).optional(),
  assigneeId: databaseIdSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: z.iso.datetime({ offset: true }).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type ProjectParams = z.infer<typeof projectParamsSchema>;
