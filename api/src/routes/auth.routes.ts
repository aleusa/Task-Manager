import { Router } from "express";

import type { AuthController } from "../controllers/auth.controller.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema, type LoginInput } from "../schemas/auth.schema.js";

export function createAuthRouter(authController: AuthController): Router {
  const router = Router();

  router.post<Record<string, string>, unknown, LoginInput>(
    "/auth/login",
    validateBody(loginSchema),
    authController.login,
  );

  return router;
}
