import { readdirSync } from "node:fs";
import { runIsolatedTests } from "./test-environment.mjs";

const files = readdirSync("tests").filter((name) => name.endsWith(".test.ts"));
if (!files.length) throw new Error("No test files were found.");
runIsolatedTests("test", (command) => {
  command("node_modules/tsx/dist/cli.mjs", ["--test", "--test-concurrency=1", ...files.map((name) => `tests/${name}`)]);
});
