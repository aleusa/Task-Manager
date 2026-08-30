import { z } from "zod";

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

const maxBigIntId = 9_223_372_036_854_775_807n;

export const databaseIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Must be a positive integer")
  .refine((value) => BigInt(value) <= maxBigIntId, "Value is too large");

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
