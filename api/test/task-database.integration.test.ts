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
