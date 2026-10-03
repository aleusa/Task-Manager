import { createHash, randomBytes } from "node:crypto";

import argon2 from "argon2";

import { InvalidCredentialsError } from "../errors/http-error.js";
import type { AuthRepository } from "../repositories/auth.repository.js";
import type { LoginInput } from "../schemas/auth.schema.js";

const sessionDurationMilliseconds = 8 * 60 * 60 * 1_000;

// This valid Argon2id hash makes an unknown account perform password-hash work
// too, reducing the timing difference between unknown users and wrong passwords.
const dummyPasswordHash =
  "$argon2id$v=19$m=19456,p=1,t=2$lcPHgu2db84RSze3+9sAUw$teJdXQG50su2ZQdW326gDTqPA+7kMBf6Qu5y2PBgY08";

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
    const tokenHash = createHash("sha256")
      .update(sessionToken)
      .digest("hex");
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
}
