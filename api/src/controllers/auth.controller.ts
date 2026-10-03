import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { sessionCookieName } from "../config/session.js";
import type { LoginInput } from "../schemas/auth.schema.js";
import type { AuthService } from "../services/auth.service.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login: RequestHandler<Record<string, string>, unknown, LoginInput> = async (
    request,
    response,
  ) => {
    const result = await this.authService.login(request.body);
    const expiresAt = new Date(result.expiresAt);

    response.cookie(sessionCookieName, result.sessionToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    response.set("Cache-Control", "no-store");
    response.status(200).json({
      data: {
        userId: result.userId,
        organizationId: result.organizationId,
        expiresAt: result.expiresAt,
      },
    });
  };
}
