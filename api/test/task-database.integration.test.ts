import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { QueryResultRow } from "pg";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app.js";
import { databasePool } from "../src/config/database.js";

interface TaskCountRow extends QueryResultRow {
  count: number;
}

interface TaskStateRow extends QueryResultRow {
  title: string;
  assigneeId: string | null;
  dueDate: Date | null;
}

const sessionToken = "a".repeat(43);
const sessionTokenHash = createHash("sha256")
  .update(sessionToken)
  .digest("hex");

async function clearTestData(): Promise<void> {
  await databasePool.query(`
    TRUNCATE TABLE
      tasks,
      sessions,
      projects,
      organization_memberships,
      users,
      organizations
    RESTART IDENTITY CASCADE
  `);
}

async function countProjectTasks(projectId: string): Promise<number> {
  const result = await databasePool.query<TaskCountRow>(
    `
      SELECT COUNT(*)::int AS count
      FROM tasks
      WHERE project_id = $1::bigint
    `,
    [projectId],
  );

  return result.rows[0]?.count ?? 0;
}

async function getTaskState(taskId: string): Promise<TaskStateRow | undefined> {
  const result = await databasePool.query<TaskStateRow>(
    `
      SELECT
        title,
        assignee_id::text AS "assigneeId",
        due_date AS "dueDate"
      FROM tasks
      WHERE id = $1::bigint
    `,
    [taskId],
  );

  return result.rows[0];
}

describe("task assignment tenant isolation", () => {
  beforeAll(async () => {
    const schemaUrl = new URL("../database/001_initial.sql", import.meta.url);
    const schema = await readFile(schemaUrl, "utf8");
    await databasePool.query(schema);
  });

  beforeEach(async () => {
    await clearTestData();

    await databasePool.query(`
      INSERT INTO organizations (id, name)
      VALUES
        (10, 'Organization 10'),
        (20, 'Organization 20');

      INSERT INTO users (id, email, password_hash)
      VALUES
        (1, 'manager-org-10@example.com', 'unused'),
        (2, 'member-org-20@example.com', 'unused'),
        (3, 'member-org-10@example.com', 'unused');

      INSERT INTO organization_memberships (organization_id, user_id, role)
      VALUES
        (10, 1, 'MANAGER'),
        (20, 2, 'MEMBER'),
        (10, 3, 'MEMBER');

      INSERT INTO projects (id, organization_id, name)
      VALUES (100, 10, 'Organization 10 project');

      INSERT INTO tasks (
        id,
        project_id,
        title,
        assignee_id,
        due_date,
        created_by
      )
      VALUES (
        500,
        100,
        'Keep this task unchanged',
        3,
        '2030-01-15T17:00:00Z',
        1
      );
    `);

    await databasePool.query(
      `
        INSERT INTO sessions (
          token_hash,
          user_id,
          organization_id,
          expires_at
        )
        VALUES ($1, 1, 10, NOW() + INTERVAL '1 hour')
      `,
      [sessionTokenHash],
    );
  });

  afterEach(async () => {
    await clearTestData();
  });

  it("does not assign an organization task to a user from another organization", async () => {
    const taskBefore = await getTaskState("500");

    const response = await request(app)
      .patch("/tasks/500")
      .set("Cookie", `sid=${sessionToken}`)
      .send({ assigneeId: "2" });

    const taskAfter = await getTaskState("500");

    expect(taskBefore?.assigneeId).toBe("3");
    expect(taskAfter).toEqual(taskBefore);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Assignee must belong to the task organization",
      },
    });
  });
});

describe("task database authorization", () => {
  beforeAll(async () => {
    const schemaUrl = new URL("../database/001_initial.sql", import.meta.url);
    const schema = await readFile(schemaUrl, "utf8");
    await databasePool.query(schema);
  });

  beforeEach(async () => {
    await clearTestData();

    await databasePool.query(`
      INSERT INTO organizations (id, name)
      VALUES
        (10, 'Organization 10'),
        (20, 'Organization 20');

      INSERT INTO users (id, email, password_hash)
      VALUES
        (1, 'manager-org-10@example.com', 'unused'),
        (2, 'manager-org-20@example.com', 'unused');
        
      INSERT INTO organization_memberships (organization_id, user_id, role)
      VALUES
        (10, 1, 'MANAGER'),
        (20, 2, 'MANAGER');

      INSERT INTO projects (id, organization_id, name)
      VALUES (100, 10, 'Organization 10 project');
    `);

    await databasePool.query(
      `
        INSERT INTO sessions (
          token_hash,
          user_id,
          organization_id,
          expires_at
        )
        VALUES ($1, 2, 20, NOW() + INTERVAL '1 hour')
      `,
      [sessionTokenHash],
    );
  });

  afterEach(async () => {
    await clearTestData();
  });

  it("does not insert a task when the project belongs to another organization", async () => {
    const taskCountBefore = await countProjectTasks("100");

    const response = await request(app)
      .post("/projects/100/tasks")
      .set("Cookie", `sid=${sessionToken}`)
      .send({ title: "Cross-tenant task" });

    const taskCountAfter = await countProjectTasks("100");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "Project or assignee not found",
      },
    });
    expect(taskCountBefore).toBe(0);
    expect(taskCountAfter).toBe(taskCountBefore);
  });
});

describe("task database authorization for members", () => {
  beforeAll(async () => {
    const schemaUrl = new URL("../database/001_initial.sql", import.meta.url);
    const schema = await readFile(schemaUrl, "utf8");
    await databasePool.query(schema);
  });

  beforeEach(async () => {
    await clearTestData();

    await databasePool.query(`
      INSERT INTO organizations (id, name)
      VALUES
        (10, 'Organization 10');

      INSERT INTO users (id, email, password_hash)
      VALUES
        (1, 'member-org-10@example.com', 'unused');

      INSERT INTO organization_memberships (organization_id, user_id, role)
      VALUES
        (10, 1, 'MEMBER');

      INSERT INTO projects (id, organization_id, name)
      VALUES (100, 10, 'Organization 10 project');
    `);

    await databasePool.query(
      `
        INSERT INTO sessions (
          token_hash,
          user_id,
          organization_id,
          expires_at
        )
        VALUES ($1, 1, 10, NOW() + INTERVAL '1 hour')
      `,
      [sessionTokenHash],
    );
  });

  afterEach(async () => {
    await clearTestData();
  });

  it("does not insert a task when the user doesnt have the correct role", async () => {
    const taskCountBefore = await countProjectTasks("100");

    const response = await request(app)
      .post("/projects/100/tasks")
      .set("Cookie", `sid=${sessionToken}`)
      .send({ title: "role-based authorization" });

    const taskCountAfter = await countProjectTasks("100");
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Only administrators and managers can create tasks",
      },
    });
    expect(taskCountBefore).toBe(0);
    expect(taskCountAfter).toBe(taskCountBefore);
  });
});

describe("task creation idempotency", () => {
  beforeAll(async () => {
    const schemaUrl = new URL("../database/001_initial.sql", import.meta.url);
    const schema = await readFile(schemaUrl, "utf8");
    await databasePool.query(schema);
  });

  beforeEach(async () => {
    await clearTestData();

    await databasePool.query(`
      INSERT INTO organizations (id, name)
      VALUES (10, 'Organization 10');

      INSERT INTO users (id, email, password_hash)
      VALUES (1, 'manager-org-10@example.com', 'unused');

      INSERT INTO organization_memberships (organization_id, user_id, role)
      VALUES (10, 1, 'MANAGER');

      INSERT INTO projects (id, organization_id, name)
      VALUES (100, 10, 'Organization 10 project');
    `);

    await databasePool.query(
      `
        INSERT INTO sessions (
          token_hash,
          user_id,
          organization_id,
          expires_at
        )
        VALUES ($1, 1, 10, NOW() + INTERVAL '1 hour')
      `,
      [sessionTokenHash],
    );
  });

  afterEach(async () => {
    await clearTestData();
  });

  it("does not create two tasks when the same idempotency key is submitted twice", async () => {
    const requestBody = {
      title: "Idempotent task",
      description: "Created exactly once",
      priority: "high",
    };

    const firstResponse = await request(app)
      .post("/projects/100/tasks")
      .set("Cookie", `sid=${sessionToken}`)
      .set("Idempotency-Key", "create-task-abc123")
      .send(requestBody);

    const replayResponse = await request(app)
      .post("/projects/100/tasks")
      .set("Cookie", `sid=${sessionToken}`)
      .set("Idempotency-Key", "create-task-abc123")
      .send(requestBody);

    const taskCount = await countProjectTasks("100");

    expect(firstResponse.status).toBe(201);
    expect(firstResponse.headers["idempotency-replayed"]).toBeUndefined();
    expect(replayResponse.status).toBe(200);
    expect(replayResponse.headers["idempotency-replayed"]).toBe("true");
    expect(replayResponse.body.data.id).toBe(firstResponse.body.data.id);
    expect(taskCount).toBe(1);
  });
});
