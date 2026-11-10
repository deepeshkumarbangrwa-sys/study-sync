import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

export function runIsolatedTests(kind, run) {
  const directory = mkdtempSync(join(tmpdir(), `studysync-${kind}-`));
  // Ensure SQLite exists before migrate deploy (Prisma 5 can fail on a missing file).
  writeFileSync(join(directory, "test.db"), "", { flag: "wx" });
  const env = {
    ...process.env,
    DATABASE_URL: `file:${join(directory, "test.db")}`,
    STUDYSYNC_TEST_DATABASE: "1",
    AUTH_SECRET: randomBytes(32).toString("hex"),
    AUTH_URL: "http://localhost:3100",
    AUTH_TRUST_HOST: "true",
    AUTH_GOOGLE_ID: "test-google-client",
    AUTH_GOOGLE_SECRET: "test-google-secret",
    AUTH_MICROSOFT_ENTRA_ID_ID: "test-microsoft-client",
    AUTH_MICROSOFT_ENTRA_ID_SECRET: "test-microsoft-secret",
    AUTH_MICROSOFT_ENTRA_ID_ISSUER: "https://login.microsoftonline.com/common/v2.0",
  };
  const command = (script, args = []) => {
    const result = spawnSync(process.execPath, [script, ...args], {
      env,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Test command exited with ${result.status ?? result.signal}`);
  };
  try {
    command("node_modules/prisma/build/index.js", ["generate"]);
    command("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
    run(command);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
