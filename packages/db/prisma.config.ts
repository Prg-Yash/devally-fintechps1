// Load env from the monorepo root (two levels up from packages/db)
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

try {
  loadEnvFile(resolve(__dirname, "../../.env"));
} catch {
  // fallback: try local .env if root one not found
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
