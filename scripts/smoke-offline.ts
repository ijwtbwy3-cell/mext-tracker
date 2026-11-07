/**
 * Смоук-тест офлайн-слоя данных: реальный sql.js (SQLite WASM) в Node.
 * Проверяет: сид контента и плана (5/40/225, 636), выполнение задания
 * с наградами, статусы тем, дневник, резервную копию v1, сброс,
 * фокус-режим, профиль и магазин косметики.
 *
 * Запуск: npx tsx scripts/smoke-offline.ts
 */
import path from "node:path";
import { DDL } from "../src/lib/offline/ddl";
import { SqliteStore } from "../src/lib/offline/sqlite-store";
import { CURRICULUM_VERSION } from "../src/lib/curriculum";
import { isPaused, parseFocus, topicFocusReward } from "../src/lib/focus";
import {
  SocialError,
  buyItem,
  coinsState,
  equipItem,
  finishFocus,
  pauseFocus,
  readProfile,
  resumeFocus,
  saveProfile,
  startFocus,
} from "../src/lib/social";

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
  ok(boot.subjects.length === 5, `предметов: ${boot.subjects.length}`);
  ok(boot.sections.length === 40, `разделов: ${boot.sections.length}`);
  ok(boot.topics.length === 225, `тем: ${boot.topics.length}`);
  ok(boot.planDays.length === 209, `дней плана: ${boot.planDays.length}`);
  ok(boot.tasks.length === 636, `заданий: ${boot.tasks.length}`);
  ok(boot.settings.curriculumVersion === CURRICULUM_VERSION, `curriculumVersion=${boot.settings.curriculumVersion}`);
  ok(boot.settings.startDate === "2026-11-04", `startDate=${boot.settings.startDate}`);
  ok(boot.settings.examDate === "2027-06-01", `examDate=${boot.settings.examDate}`);
  ok(boot.totals.tasksTotal === 636 && boot.totals.xp === 0, "стартовые тоталы нулевые");

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
  ok(backup.data.tasks.length === 636 && backup.data.diary.length === 1, "в копии 636 заданий и 1 запись");
  await store.resetProgress();
  const afterReset = await store.bootstrap();
  ok(afterReset.totals.tasksDone === 0 && afterReset.diary.length === 0, "сброс прогресса очистил данные");
  await store.importBackup(backup);
  const afterRestore = await store.bootstrap();
  ok(afterRestore.diary.length === 1, "импорт восстановил дневник");
  ok(afterRestore.tasks.filter((t) => t.status === "done").length >= 3, "импорт восстановил выполненные задания");
  ok(afterRestore.progress.length > 0, `импорт восстановил прогресс (${afterRestore.progress.length} тем)`);

  console.log("\n══ профиль, магазин, фокус ══");
  const prof = await saveProfile(store, { username: "Тестер", bio: "Готовлюсь к MEXT" });
  ok(prof.username === "Тестер" && prof.bio.includes("MEXT"), "профиль сохраняется");
  ok((await readProfile(store)).username === "Тестер", "профиль читается обратно");

  // фокус по заданию: до конца таймера зачёта нет
  const focusTask = (await store.bootstrap()).tasks.find((t) => t.status === "todo")!;
  await startFocus(store, { kind: "task", id: focusTask.id, minutes: focusTask.minutes, title: focusTask.title });
  let earlyBlocked = false;
  try {
    await finishFocus(store, "task", focusTask.id);
  } catch (e) {
    earlyBlocked = e instanceof SocialError;
  }
  ok(earlyBlocked, "досрочно завершить фокус нельзя");

  // «отсиживаем» таймер и завершаем
  const rawFocus = JSON.parse((await store.getSetting("focusSessions")) ?? "{}");
  for (const k of Object.keys(rawFocus)) rawFocus[k].startedAt = Date.now() - (rawFocus[k].minutes + 1) * 60_000;
  await store.setSetting("focusSessions", JSON.stringify(rawFocus));
  const fin = await finishFocus(store, "task", focusTask.id);
  ok(fin.reward.xp > 0 && fin.reward.coins > 0, `фокус засчитал задание: +${fin.reward.xp} XP, +${fin.reward.coins} монет`);
  const afterFocus = await store.bootstrap();
  ok(afterFocus.tasks.find((t) => t.id === focusTask.id)?.status === "done", "задание закрыто после таймера");
  ok(Object.keys(JSON.parse(afterFocus.settings.focusSessions ?? "{}")).length === 0, "сессия фокуса очищена");

  // пауза сохраняется между «заходами»
  const pauseTask = (await store.bootstrap()).tasks.find((t) => t.status === "todo")!;
  await startFocus(store, { kind: "task", id: pauseTask.id, minutes: 40 });
  const pausedSession = await pauseFocus(store, "task", pauseTask.id);
  ok(isPaused(pausedSession), "пауза записана в settings");
  let pausedBlocked = false;
  try {
    await finishFocus(store, "task", pauseTask.id);
  } catch (e) {
    pausedBlocked = e instanceof SocialError;
  }
  ok(pausedBlocked, "на паузе задание не засчитывается даже при «истёкшем» времени");

  const reopened = parseFocus(new SqliteStore(db).getSetting("focusSessions") as string)[`task:${pauseTask.id}`];
  ok(
    isPaused(reopened) && reopened.elapsedMs === pausedSession.elapsedMs,
    "после перезапуска приложения пауза на том же месте",
  );

  await resumeFocus(store, "task", pauseTask.id);
  const rawPause = JSON.parse((await store.getSetting("focusSessions")) ?? "{}");
  rawPause[`task:${pauseTask.id}`].startedAt = Date.now() - (pauseTask.minutes + 1) * 60_000;
  await store.setSetting("focusSessions", JSON.stringify(rawPause));
  const finPause = await finishFocus(store, "task", pauseTask.id);
  ok(finPause.reward.xp > 0, `после продолжения и добивания задание засчитано (+${finPause.reward.xp} XP)`);

  // фокус по теме даёт XP и статус «изучено»
  const topic = (await store.bootstrap()).topics[0];
  const tp = await startFocus(store, { kind: "topic", id: topic.id, minutes: 30 });
  const rawTopic = JSON.parse((await store.getSetting("focusSessions")) ?? "{}");
  rawTopic[`topic:${topic.id}`].startedAt = Date.now() - (tp.minutes + 1) * 60_000;
  await store.setSetting("focusSessions", JSON.stringify(rawTopic));
  const finTopic = await finishFocus(store, "topic", topic.id);
  const afterTopic = await store.bootstrap();
  ok(finTopic.reward.xp === topicFocusReward(30).xp, `тема дала +${finTopic.reward.xp} XP`);
  ok(afterTopic.progress.find((p) => p.topicId === topic.id)?.status === "done", "тема помечена изученной");
  ok(afterTopic.totals.xp > afterFocus.totals.xp, "награда за тему попала в тоталы");

  // магазин: покупка списывает монеты, экипировка сохраняется
  const before = await coinsState(store as never);
  ok(before.balance >= 10, `баланс монет: ${before.balance}`);
  const bought = await buyItem(store as never, "frame-coal");
  ok(bought.inventory.frames.includes("frame-coal"), "рамка «Уголёк» куплена");
  const afterBuy = await coinsState(store as never);
  ok(afterBuy.balance === before.balance - 10, `монеты списаны (${before.balance} → ${afterBuy.balance})`);
  let doubleBlocked = false;
  try {
    await buyItem(store as never, "frame-coal");
  } catch (e) {
    doubleBlocked = e instanceof SocialError;
  }
  ok(doubleBlocked, "повторно купить тот же предмет нельзя");
  let poorBlocked = false;
  try {
    await buyItem(store as never, "frame-rainbow");
  } catch (e) {
    poorBlocked = e instanceof SocialError;
  }
  ok(poorBlocked, "дорогой предмет без монет не покупается");
  const equipped = await equipItem(store as never, "frame", "frame-coal");
  ok(equipped.frame === "frame-coal", "рамка экипирована в профиль");

  console.log("\n══ повторное открытие (сид идемпотентен) ══");
  const store2 = new SqliteStore(db);
  const bootAgain = await store2.bootstrap();
  ok(bootAgain.tasks.length === 636 && bootAgain.subjects.length === 5, "ensureSeeded не перетирает данные при совпадении версии");

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
