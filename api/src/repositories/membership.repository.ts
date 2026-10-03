import type { Pool, QueryResultRow } from "pg";

import { databasePool } from "../config/database.js";
import type { OrganizationRole } from "../types/auth.js";

interface MembershipRow extends QueryResultRow {
  role: OrganizationRole;
}

export class MembershipRepository {
  constructor(private readonly database: Pick<Pool, "query"> = databasePool) {}

  async findRole(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationRole | null> {
    const result = await this.database.query<MembershipRow>(
      `
        SELECT role
        FROM organization_memberships
        WHERE user_id = $1::bigint
          AND organization_id = $2::bigint
        LIMIT 1
      `,
      [userId, organizationId],
    );

    return result.rows[0]?.role ?? null;
  }
}
