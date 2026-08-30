import type { Pool, QueryResultRow } from "pg";

import { databasePool } from "../config/database.js";
import type { CreateTaskInput } from "../schemas/task.schema.js";

export interface TaskRecord {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  createdAt: string;
}

interface TaskRow extends QueryResultRow {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  priority: "low" | "medium" | "high";
  dueDate: Date | null;
  createdAt: Date;
}

export class TaskRepository {
  constructor(private readonly database: Pick<Pool, "query"> = databasePool) {}

  async createForOrganization(
    projectId: string,
    organizationId: string,
    currentUserId: string,
    input: CreateTaskInput,
  ): Promise<TaskRecord | null> {
    const result = await this.database.query<TaskRow>(
      `
        INSERT INTO tasks (
          project_id,
          title,
          description,
          assignee_id,
          priority,
          due_date,
          created_by
        )
        SELECT
          project.id,
          $3,
          $4,
          $5::bigint,
          $6,
          $7::timestamptz,
          $8::bigint
        FROM projects AS project
        WHERE project.id = $1::bigint
          AND project.organization_id = $2::bigint
          AND EXISTS (
            SELECT 1
            FROM organization_memberships AS actor_membership
            WHERE actor_membership.organization_id = $2::bigint
              AND actor_membership.user_id = $8::bigint
          )
          AND (
            $5::bigint IS NULL
            OR EXISTS (
              SELECT 1
              FROM organization_memberships AS membership
              WHERE membership.organization_id = $2::bigint
                AND membership.user_id = $5::bigint
            )
          )
        RETURNING
          id::text AS "id",
          project_id::text AS "projectId",
          title,
          description,
          assignee_id::text AS "assigneeId",
          priority,
          due_date AS "dueDate",
          created_at AS "createdAt"
      `,
      [
        projectId,
        organizationId,
        input.title,
        input.description ?? null,
        input.assigneeId ?? null,
        input.priority ?? "medium",
        input.dueDate ?? null,
        currentUserId,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      ...row,
      dueDate: row.dueDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
