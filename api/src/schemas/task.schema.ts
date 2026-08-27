import { z } from "zod";

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

export const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).optional(),
  assigneeId: z.uuid().optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: z.iso.datetime({ offset: true }).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
