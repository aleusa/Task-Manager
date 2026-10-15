import { defineConfig } from "vitest/config";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://localhost:5432/task_management_test";

const testDatabaseName = new URL(testDatabaseUrl).pathname.slice(1);

if (!/(^|[_-])test($|[_-])/.test(testDatabaseName.toLowerCase())) {
  throw new Error(
    "TEST_DATABASE_URL must identify a database whose name contains a standalone 'test' segment",
  );
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.integration.test.ts"],
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
