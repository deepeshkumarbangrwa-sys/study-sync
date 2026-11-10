import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const source = readFileSync("prisma/schema.prisma", "utf8");
const postgres = source.replace(/datasource db \{[\s\S]*?\}/, `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}`);
const target = "prisma/postgres/schema.prisma";
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== postgres) {
    throw new Error("Production schema is out of date. Run node scripts/sync-postgres-schema.mjs and create the corresponding Postgres migration.");
  }
} else {
  mkdirSync("prisma/postgres", { recursive: true });
  writeFileSync(target, postgres);
}
