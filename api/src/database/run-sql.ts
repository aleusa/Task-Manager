import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { databasePool } from "../config/database.js";

const sqlFile = process.argv[2];

if (!sqlFile) {
  throw new Error("Usage: tsx src/database/run-sql.ts <sql-file>");
}

try {
  const absolutePath = resolve(process.cwd(), sqlFile);
  const sql = await readFile(absolutePath, "utf8");
  await databasePool.query(sql);
  console.log(`Applied ${sqlFile}`);
} finally {
  await databasePool.end();
}
