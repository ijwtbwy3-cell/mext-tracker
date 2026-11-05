import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/** Веб-сборка: PostgreSQL через Drizzle ORM. */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/mext_tracker",
  },
  strict: true,
  verbose: true,
});
