import { z } from "zod";

import { databaseIdSchema } from "./common.schema.js";

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

export const projectParamsSchema = z.strictObject({
  projectId: databaseIdSchema,
});

export const taskParamsSchema = z.strictObject({
  taskId: databaseIdSchema,
});

export const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).optional(),
  assigneeId: databaseIdSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: z.iso.datetime({ offset: true }).optional(),
});

export const updateTaskSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200).optional(),
    assigneeId: databaseIdSchema.nullable().optional(),
    dueDate: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one task field must be provided",
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type ProjectParams = z.infer<typeof projectParamsSchema>;
export type TaskParams = z.infer<typeof taskParamsSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
