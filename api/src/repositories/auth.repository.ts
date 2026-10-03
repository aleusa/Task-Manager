import type { Pool, QueryResultRow } from "pg";

import { databasePool } from "../config/database.js";

export interface LoginIdentity {
  userId: string;
  organizationId: string;
  passwordHash: string;
}

interface LoginIdentityRow extends QueryResultRow {
  userId: string;
  organizationId: string;
  passwordHash: string;
}

interface SessionRow extends QueryResultRow {
  expiresAt: Date;
}

export class AuthRepository {
  constructor(private readonly database: Pick<Pool, "query"> = databasePool) {}

  async findLoginIdentity(
    email: string,
    organizationId: string,
  ): Promise<LoginIdentity | null> {
    const result = await this.database.query<LoginIdentityRow>(
      `
        SELECT
          users.id::text AS "userId",
          membership.organization_id::text AS "organizationId",
          users.password_hash AS "passwordHash"
        FROM users
        INNER JOIN organization_memberships AS membership
          ON membership.user_id = users.id
         AND membership.organization_id = $2::bigint
        WHERE users.email = $1
        LIMIT 1
      `,
      [email, organizationId],
    );

    return result.rows[0] ?? null;
  }

  async createSession(
    tokenHash: string,
    userId: string,
    organizationId: string,
    expiresAt: Date,
  ): Promise<Date> {
    const result = await this.database.query<SessionRow>(
      `
        INSERT INTO sessions (
          token_hash,
          user_id,
          organization_id,
          expires_at
        )
        VALUES ($1, $2::bigint, $3::bigint, $4)
        RETURNING expires_at AS "expiresAt"
      `,
      [tokenHash, userId, organizationId, expiresAt],
    );

    const session = result.rows[0];
    if (!session) {
      throw new Error("Session insert returned no row");
    }

    return session.expiresAt;
  }
}
