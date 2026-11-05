/**
 * Пересеивание веб-базы (PostgreSQL): контент + план из единого источника.
 * Запуск: npm run db:push && npm run db:seed
 */
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { schema } from "../src/lib/db/schema";
import { WebStore } from "../src/lib/db/web-store";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const db = drizzle(pool, { schema });
  const store = new WebStore(pool, db);
  await store.ensureSeeded();
  const boot = await store.bootstrap();
  console.log(
    `✓ Посеяно: ${boot.subjects.length} предметов, ${boot.sections.length} разделов, ${boot.topics.length} тем, ${boot.planDays.length} дней плана, ${boot.tasks.length} заданий`,
  );
  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("Ошибка сева:", e);
  process.exit(1);
});
