import { closeSync, mkdirSync, openSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";

try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("file:")) {
  throw new Error("Set DATABASE_URL to your SQLite file URL in .env before migrating.");
}
const relativeFile = databaseUrl.slice(5).split("?")[0];
if (!relativeFile || relativeFile === ":memory:") {
  throw new Error("Migrations require a persistent SQLite file.");
}
const databaseFile = isAbsolute(relativeFile)
  ? relativeFile
  : resolve("prisma", relativeFile);
mkdirSync(dirname(databaseFile), { recursive: true });
// Ensure the SQLite file exists without truncating any existing database.
closeSync(openSync(databaseFile, "a", 0o600));

const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
  env: process.env,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
