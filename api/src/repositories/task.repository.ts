import type { Pool, PoolClient, QueryResultRow } from "pg";

import { databasePool } from "../config/database.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
} from "../schemas/task.schema.js";

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

interface IdempotentTaskRow extends TaskRow {
  requestMatches: boolean;
}

type QueryableDatabase = Pick<Pool | PoolClient, "query">;

export type IdempotentTaskCreationResult =
  | { status: "created"; task: TaskRecord }
  | { status: "replayed"; task: TaskRecord }
  | { status: "conflict" }
  | { status: "not_found" };

export class TaskRepository {
  constructor(
    private readonly database: Pick<Pool, "query" | "connect"> = databasePool,
  ) {}

  async createForOrganization(
    projectId: string,
    organizationId: string,
    currentUserId: string,
    input: CreateTaskInput,
  ): Promise<TaskRecord | null> {
    return this.createForOrganizationWith(
      this.database,
      projectId,
      organizationId,
      currentUserId,
      input,
    );
  }

  async createIdempotentForOrganization(
    projectId: string,
    organizationId: string,
    currentUserId: string,
    idempotencyKey: string,
    input: CreateTaskInput,
  ): Promise<IdempotentTaskCreationResult> {
    const client = await this.database.connect();
    const requestPayload = JSON.stringify({ projectId, currentUserId, input });

    try {
      await client.query("BEGIN");

      const reservation = await client.query(
        `
          INSERT INTO task_creation_idempotency (
            organization_id,
            idempotency_key,
            request_payload
          )
          VALUES ($1::bigint, $2, $3::jsonb)
          ON CONFLICT (organization_id, idempotency_key) DO NOTHING
          RETURNING idempotency_key
        `,
        [organizationId, idempotencyKey, requestPayload],
      );

      if (reservation.rowCount === 0) {
        const existing = await client.query<IdempotentTaskRow>(
          `
            SELECT
              task.id::text AS "id",
              task.project_id::text AS "projectId",
              task.title,
              task.description,
              task.assignee_id::text AS "assigneeId",
              task.priority,
              task.due_date AS "dueDate",
              task.created_at AS "createdAt",
              idempotency.request_payload = $3::jsonb AS "requestMatches"
            FROM task_creation_idempotency AS idempotency
            JOIN tasks AS task
              ON task.id = idempotency.task_id
            WHERE idempotency.organization_id = $1::bigint
              AND idempotency.idempotency_key = $2
          `,
          [organizationId, idempotencyKey, requestPayload],
        );

        const row = existing.rows[0];
        if (!row) {
          throw new Error("Idempotency record is missing its task result");
        }

        if (!row.requestMatches) {
          await client.query("ROLLBACK");
          return { status: "conflict" };
        }

        await client.query("COMMIT");
        return { status: "replayed", task: this.toTaskRecord(row) };
      }

      const task = await this.createForOrganizationWith(
        client,
        projectId,
        organizationId,
        currentUserId,
        input,
      );

      if (!task) {
        await client.query("ROLLBACK");
        return { status: "not_found" };
      }

      await client.query(
        `
          UPDATE task_creation_idempotency
          SET task_id = $3::bigint,
              completed_at = NOW()
          WHERE organization_id = $1::bigint
            AND idempotency_key = $2
        `,
        [organizationId, idempotencyKey, task.id],
      );

      await client.query("COMMIT");
      return { status: "created", task };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateForOrganization(
    taskId: string,
    organizationId: string,
    currentUserId: string,
    input: UpdateTaskInput,
  ): Promise<TaskRecord | null> {
    const updatesTitle = input.title !== undefined;
    const updatesAssignee = input.assigneeId !== undefined;
    const updatesDueDate = input.dueDate !== undefined;

    const result = await this.database.query<TaskRow>(
      `
        UPDATE tasks AS task
        SET
          title = CASE WHEN $4::boolean THEN $5 ELSE task.title END,
          assignee_id = CASE
            WHEN $6::boolean THEN $7::bigint
            ELSE task.assignee_id
          END,
          due_date = CASE
            WHEN $8::boolean THEN $9::timestamptz
            ELSE task.due_date
          END
        FROM projects AS project
        WHERE task.id = $1::bigint
          AND project.id = task.project_id
          AND project.organization_id = $2::bigint
          AND EXISTS (
            SELECT 1
            FROM organization_memberships AS actor_membership
            WHERE actor_membership.organization_id = $2::bigint
              AND actor_membership.user_id = $3::bigint
          )
          AND (
            NOT $6::boolean
            OR $7::bigint IS NULL
            OR EXISTS (
              SELECT 1
              FROM organization_memberships AS assignee_membership
              WHERE assignee_membership.organization_id = $2::bigint
                AND assignee_membership.user_id = $7::bigint
            )
          )
        RETURNING
          task.id::text AS "id",
          task.project_id::text AS "projectId",
          task.title,
          task.description,
          task.assignee_id::text AS "assigneeId",
          task.priority,
          task.due_date AS "dueDate",
          task.created_at AS "createdAt"
      `,
      [
        taskId,
        organizationId,
        currentUserId,
        updatesTitle,
        input.title ?? null,
        updatesAssignee,
        input.assigneeId ?? null,
        updatesDueDate,
        input.dueDate ?? null,
      ],
    );

    const row = result.rows[0];
    return row ? this.toTaskRecord(row) : null;
  }

  private async createForOrganizationWith(
    database: QueryableDatabase,
    projectId: string,
    organizationId: string,
    currentUserId: string,
    input: CreateTaskInput,
  ): Promise<TaskRecord | null> {
    const result = await database.query<TaskRow>(
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

    return this.toTaskRecord(row);
  }

  private toTaskRecord(row: TaskRow): TaskRecord {
    return {
      ...row,
      dueDate: row.dueDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
