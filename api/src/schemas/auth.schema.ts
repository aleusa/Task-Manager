import { z } from "zod";

import { databaseIdSchema } from "./common.schema.js";

export const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(1_024),
  organizationId: databaseIdSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
