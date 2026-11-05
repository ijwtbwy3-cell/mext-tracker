/**
 * Смоук-тест офлайн-слоя данных: реальный sql.js (SQLite WASM) в Node.
 * Проверяет: сид контента и плана (6/49/284, 754), выполнение задания
 * с наградами, статусы тем, дневник, резервную копию v1, сброс.
 *
 * Запуск: npx tsx scripts/smoke-offline.ts
 */
import path from "node:path";
import { DDL } from "../src/lib/offline/ddl";
import { SqliteStore } from "../src/lib/offline/sqlite-store";
import { CURRICULUM_VERSION } from "../src/lib/curriculum";

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

async function main() {
  const { default: initSqlJs } = await import("sql.js");
  const wasmDir = path.resolve("node_modules/sql.js/dist");
  const SQL = await initSqlJs({ locateFile: (f: string) => path.join(wasmDir, f) });
  const db = new SQL.Database();
  db.run(DDL);
  const store = new SqliteStore(db);

  console.log("\n══ OFFLINE SMOKE: sql.js ══");
  const boot = await store.bootstrap();
  ok(boot.subjects.length === 6, `предметов: ${boot.subjects.length}`);
  ok(boot.sections.length === 49, `разделов: ${boot.sections.length}`);
  ok(boot.topics.length === 284, `тем: ${boot.topics.length}`);
  ok(boot.planDays.length === 209, `дней плана: ${boot.planDays.length}`);
  ok(boot.tasks.length === 754, `заданий: ${boot.tasks.length}`);
  ok(boot.settings.curriculumVersion === CURRICULUM_VERSION, `curriculumVersion=${boot.settings.curriculumVersion}`);
  ok(boot.settings.startDate === "2026-11-04", `startDate=${boot.settings.startDate}`);
  ok(boot.settings.examDate === "2027-06-01", `examDate=${boot.settings.examDate}`);
  ok(boot.totals.tasksTotal === 754 && boot.totals.xp === 0, "стартовые тоталы нулевые");

  console.log("\n══ выполнение задания ══");
  const first = boot.tasks.find((t) => t.type === "theory")!;
  const res = await store.completeTask(first.id);
  const expectXp = Math.round(first.minutes * 0.4);
  ok(res.task.status === "done", `задание ${first.id} выполнено`);
  ok(res.reward.xp === expectXp, `XP = round(${first.minutes}×0.4) = ${res.reward.xp}`);
  ok(res.reward.coins === Math.round(first.minutes / 4), `монеты = ${res.reward.coins}`);
  ok(res.totals.xp === expectXp, `тотал XP = ${res.totals.xp}`);
  ok(res.totals.tasksDone === 1, `выполнено заданий: ${res.totals.tasksDone}`);

  // статус темы выводится из теории+практики
  const boot2 = await store.bootstrap();
  const prog = boot2.progress.find((p) => p.topicId === first.topicId);
  ok(prog?.status === "doing", `статус темы после теории: ${prog?.status} (ожидается doing)`);

  const practice = boot2.tasks.find((t) => t.type === "practice" && t.topicId === first.topicId)!;
  await store.completeTask(practice.id);
  const boot3 = await store.bootstrap();
  const prog2 = boot3.progress.find((p) => p.topicId === first.topicId);
  ok(prog2?.status === "done", `статус темы после теории+практики: ${prog2?.status}`);

  // идемпотентность
  const again = await store.completeTask(first.id);
  ok(again.reward.xp === 0, "повторное выполнение не даёт награду");

  // возврат задания
  const totalsAfterReopen = await store.reopenTask(first.id);
  ok(totalsAfterReopen.tasksDone === 1, `после возврата одной из двух: ${totalsAfterReopen.tasksDone}`);

  console.log("\n══ пробник: бонус +25 XP ══");
  const mock = boot3.tasks.find((t) => t.type === "mock")!;
  const mockRes = await store.completeTask(mock.id);
  ok(mockRes.reward.xp === Math.round(mock.minutes * 0.4) + 25, `пробник: +${mockRes.reward.xp} XP (вкл. +25)`);

  console.log("\n══ повторение: бонус +30 XP ══");
  const review = boot3.tasks.find((t) => t.type === "review")!;
  const reviewRes = await store.completeTask(review.id);
  ok(reviewRes.reward.xp === Math.round(review.minutes * 0.4) + 30, `повторение: +${reviewRes.reward.xp} XP (вкл. +30)`);

  console.log("\n══ дневник ══");
  const entry = await store.addDiary({ date: "2026-11-04", mood: 4, text: "Первый день!" });
  const entry2 = await store.updateDiary(entry.id, { mood: 5, text: "Отлично пошло!" });
  ok(entry2?.mood === 5 && entry2.text === "Отлично пошло!", "дневник: обновление");
  const diaryCount = (await store.bootstrap()).diary.length;
  ok(diaryCount === 1, `записей дневника: ${diaryCount}`);

  console.log("\n══ настройки ══");
  await store.setSetting("crt", "off");
  ok((await store.bootstrap()).settings.crt === "off", "crt=off сохранён");

  console.log("\n══ резервная копия JSON v1 ══");
  const backup = await store.exportBackup();
  ok(backup.v === 1 && backup.app === "mext-tracker", `формат v${backup.v}/${backup.app}`);
  ok(backup.data.tasks.length === 754 && backup.data.diary.length === 1, "в копии 754 задания и 1 запись");
  await store.resetProgress();
  const afterReset = await store.bootstrap();
  ok(afterReset.totals.tasksDone === 0 && afterReset.diary.length === 0, "сброс прогресса очистил данные");
  await store.importBackup(backup);
  const afterRestore = await store.bootstrap();
  ok(afterRestore.diary.length === 1, "импорт восстановил дневник");
  ok(afterRestore.tasks.filter((t) => t.status === "done").length >= 3, "импорт восстановил выполненные задания");
  ok(afterRestore.progress.length > 0, `импорт восстановил прогресс (${afterRestore.progress.length} тем)`);

  console.log("\n══ повторное открытие (сид идемпотентен) ══");
  const store2 = new SqliteStore(db);
  const bootAgain = await store2.bootstrap();
  ok(bootAgain.tasks.length === 754 && bootAgain.subjects.length === 6, "ensureSeeded не перетирает данные при совпадении версии");

  console.log("\n══ ИТОГ ══");
  if (failures === 0) console.log("  Все проверки пройдены ✓\n");
  else {
    console.error(`  Провалено: ${failures}\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
