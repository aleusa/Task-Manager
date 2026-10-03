import { z } from "zod";

const maxBigIntId = 9_223_372_036_854_775_807n;

export const databaseIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Must be a positive integer")
  .refine((value) => BigInt(value) <= maxBigIntId, "Value is too large");
