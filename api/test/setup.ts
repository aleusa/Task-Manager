import { afterAll } from "vitest";

import { databasePool } from "../src/config/database.js";

if (process.env.NODE_ENV !== "test") {
  throw new Error("Tests must run with NODE_ENV=test");
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Tests require DATABASE_URL");
}

const databaseName = new URL(databaseUrl).pathname.slice(1);

if (!/(^|[_-])test($|[_-])/.test(databaseName.toLowerCase())) {
  throw new Error("Refusing to run tests against a non-test database");
}

afterAll(async () => {
  await databasePool.end();
});
