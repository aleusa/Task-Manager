import type { RequestHandler } from "express";

import { sessionCookieName } from "../config/session.js";
import { AuthenticationRequiredError } from "../errors/http-error.js";
import type { AuthService } from "../services/auth.service.js";

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");

    if (cookieName === name) {
      try {
        return decodeURIComponent(valueParts.join("="));
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function createAuthenticationMiddleware(
  authService: AuthService,
): RequestHandler {
  return async (request, _response, next) => {
    const sessionToken = readCookie(
      request.headers.cookie,
      sessionCookieName,
    );

    if (!sessionToken) {
      throw new AuthenticationRequiredError();
    }

    request.auth = await authService.authenticate(sessionToken);
    next();
  };
}
