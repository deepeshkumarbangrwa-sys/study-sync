import { runIsolatedTests } from "./test-environment.mjs";

runIsolatedTests("e2e", (command) => {
  command("node_modules/@playwright/test/cli.js", ["test", ...process.argv.slice(2)]);
});
