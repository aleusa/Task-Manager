import { createHash, randomBytes } from "node:crypto";

import argon2 from "argon2";

import {
  AuthenticationRequiredError,
  InvalidCredentialsError,
} from "../errors/http-error.js";
import type { AuthRepository } from "../repositories/auth.repository.js";
import type { LoginInput } from "../schemas/auth.schema.js";
import type { AuthContext } from "../types/auth.js";

const sessionDurationMilliseconds = 8 * 60 * 60 * 1_000;

// This valid Argon2id hash makes an unknown account perform password-hash work
// too, reducing the timing difference between unknown users and wrong passwords.
const dummyPasswordHash =
  "$argon2id$v=19$m=19456,p=1,t=2$lcPHgu2db84RSze3+9sAUw$teJdXQG50su2ZQdW326gDTqPA+7kMBf6Qu5y2PBgY08";

function hashSessionToken(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

export interface LoginResult {
  sessionToken: string;
  userId: string;
  organizationId: string;
  expiresAt: string;
}

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const identity = await this.authRepository.findLoginIdentity(
      input.email,
      input.organizationId,
    );

    const passwordMatches = await argon2.verify(
      identity?.passwordHash ?? dummyPasswordHash,
      input.password,
    );

    if (!identity || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const sessionToken = randomBytes(32).toString("base64url");
    const tokenHash = hashSessionToken(sessionToken);
    const requestedExpiration = new Date(
      Date.now() + sessionDurationMilliseconds,
    );

    const expiresAt = await this.authRepository.createSession(
      tokenHash,
      identity.userId,
      identity.organizationId,
      requestedExpiration,
    );

    return {
      sessionToken,
      userId: identity.userId,
      organizationId: identity.organizationId,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async authenticate(sessionToken: string): Promise<AuthContext> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(sessionToken)) {
      throw new AuthenticationRequiredError();
    }

    const session = await this.authRepository.findActiveSession(
      hashSessionToken(sessionToken),
    );

    if (!session) {
      throw new AuthenticationRequiredError();
    }

    return {
      currentUserId: session.userId,
      currentOrganizationId: session.organizationId,
    };
  }
}
