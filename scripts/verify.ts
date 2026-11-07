/**
 * Проверка «точных чисел» ТЗ:
 *   • 5 предметов, 40 разделов, 225 тем (с раскладкой по каждому предмету)
 *   • 636 заданий по типам, детерминизм, бюджеты дней не превышены
 *   • полное покрытие тем планом (каждая тема = теория + практика)
 *   • формулы наград
 *
 * Запуск: npm run verify
 */
import { SUBJECT_SEEDS, FLAT_SECTIONS, FLAT_TOPICS, curriculumStats } from "../src/lib/curriculum";
import { generatePlan, PLAN_DAYS, PHASES, theoryMinutes, practiceMinutes, MOCK_EVERY, WEEKDAY_MAIN_SUBJECT } from "../src/lib/plan-generator";
import { weekdayIndex } from "../src/lib/dates";
import { taskReward, XP_PER_MINUTE, COINS_DIVISOR, MOCK_BONUS_XP, REVIEW_BONUS_XP } from "../src/lib/gamification";
import {
  AVATAR_PRESETS,
  DEFAULT_PROFILE,
  FREE_BACKGROUND,
  FREE_FRAME,
  NO_TITLE,
  SHOP_ITEMS,
  parseInventory,
  sanitizeProfile,
} from "../src/lib/shop";
import {
  elapsedMsTotal,
  isFinished,
  isPaused,
  pauseSession,
  remainingMs,
  resumeSession,
  topicFocusReward,
  topicMinutes,
  type FocusSession,
} from "../src/lib/focus";
import { parseTopicFocus, topicFocusBonus } from "../src/lib/social";

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

console.log("\n══ КУРРИКУЛУМ ══");
const stats = curriculumStats();
console.table(stats.perSubject.map((s) => ({ Предмет: s.title, Разделы: s.sections, Темы: s.topics, Часы: s.hours })));
ok(stats.subjects === 5, `предметов: ${stats.subjects} (нужно 5)`);
ok(stats.sections === 40, `разделов: ${stats.sections} (нужно 40)`);
ok(stats.topics === 225, `тем: ${stats.topics} (нужно 225)`);
ok(SUBJECT_SEEDS.every((s) => s.sections.length >= 2 && s.sections.every((sec) => sec.topics.length > 0)), "у каждого предмета есть разделы с темами");
ok(FLAT_TOPICS.every((t) => t.title.length > 0 && t.description.length > 0 && t.hours > 0 && t.difficulty >= 1 && t.difficulty <= 5), "каждая тема: название, описание, часы, сложность 1..5");
ok(FLAT_TOPICS.every((t) => ["базовый", "средний", "продвинутый"].includes(t.level)), "уровни только из допустимого набора");
ok(new Set(FLAT_TOPICS.map((t) => t.id)).size === FLAT_TOPICS.length, "id тем уникальны");
ok(new Set(FLAT_SECTIONS.map((s) => s.id)).size === FLAT_SECTIONS.length, "id разделов уникальны");

console.log("\n══ ПЛАН ══");
const plan = generatePlan("2026-11-04");
const st = plan.stats;
console.log(`  фазы: ${PHASES.map((p) => `${p.n} «${p.name}» ${p.days}д × ${p.budget}м`).join(" | ")}`);
console.log(`  всего дней: ${plan.days.length}, пробников: ${st.mockDays} (каждые ${MOCK_EVERY}-й)`);
console.log(`  задания по типам: теория ${st.byType.theory}, практика ${st.byType.practice}, повторение ${st.byType.review}, пробник ${st.byType.mock}`);
console.log(`  суммарно: ${st.total}, минут в плане: ${st.totalMinutes}`);
console.log(`  максимальная загрузка дня: ${st.maxDayLoad?.minutes} мин (бюджет ${st.maxDayLoad?.budget})`);

ok(plan.days.length === PLAN_DAYS && PLAN_DAYS === 209, `дней плана: ${plan.days.length} (нужно 209)`);
ok(st.total === 636, `всего заданий: ${st.total} (нужно 636)`);
ok(st.byType.theory === 225, `теория: ${st.byType.theory} (нужно 225)`);
ok(st.byType.practice === 225, `практика: ${st.byType.practice} (нужно 225)`);
ok(st.byType.review === 172, `повторение: ${st.byType.review} (нужно 172)`);
ok(st.byType.mock === 14, `пробник: ${st.byType.mock} (нужно 14)`);
ok(st.overBudgetDays === 0, `дней с превышением бюджета: ${st.overBudgetDays} (нужно 0)`);

// детерминизм
const plan2 = generatePlan("2026-11-04");
ok(JSON.stringify(plan.tasks) === JSON.stringify(plan2.tasks) && JSON.stringify(plan.days) === JSON.stringify(plan2.days), "детерминизм: два запуска дают идентичный план");

// покрытие: у каждой темы есть теория и практика
const theoryTopics = new Set(plan.tasks.filter((t) => t.type === "theory").map((t) => t.topicId));
const practiceTopics = new Set(plan.tasks.filter((t) => t.type === "practice").map((t) => t.topicId));
ok(theoryTopics.size === 225 && FLAT_TOPICS.every((t) => theoryTopics.has(t.id)), "каждая тема получила теорию");
ok(practiceTopics.size === 225 && FLAT_TOPICS.every((t) => practiceTopics.has(t.id)), "каждая тема получила практику");

// повторения: бандлы непусты и темы существуют
const reviews = plan.tasks.filter((t) => t.type === "review");
ok(reviews.every((t) => t.topicIds.length >= 1 && t.topicIds.every((id) => FLAT_TOPICS.some((f) => f.id === id))), "повторения содержат только существующие темы");

// бюджет: длительности теории/практики в формулах
const maxTh = Math.max(...FLAT_TOPICS.map((t) => theoryMinutes(t.difficulty)));
const maxPr = Math.max(...FLAT_TOPICS.map((t) => practiceMinutes(t.difficulty)));
console.log(`  формулы: теория 40+7d → до ${maxTh} мин; практика 30+6d → до ${maxPr} мин`);

// даты
ok(plan.days[0].date === "2026-11-04", `старт: ${plan.days[0].date}`);
ok(plan.examDate === "2027-06-01", `экзамен: ${plan.examDate} (старт + 209 дней)`);

// соответствие экрану «Расписание»: главный (первый) предмет дня = дневной по weekday.
// Внутри квоты предмета — строго; когда квота исчерпана (английский: 25 тем на ~30
// пятниц) — допускается добор другого предмета.
const firstSubjectByDay = new Map<number, string>();
for (const t of plan.tasks) {
  if (t.type === "theory" && !firstSubjectByDay.has(t.day)) firstSubjectByDay.set(t.day, t.subjectId ?? "");
}
const quotaBySubject = new Map<string, number>();
for (const t of plan.tasks) {
  if (t.type === "theory" && t.subjectId) quotaBySubject.set(t.subjectId, (quotaBySubject.get(t.subjectId) ?? 0) + 1);
}
const homeSeen = new Map<string, number>();
let alignChecked = 0;
let alignBad = 0;
let tailDays = 0;
for (const d of plan.days) {
  if (d.kind === "mock") continue;
  alignChecked++;
  const expected = WEEKDAY_MAIN_SUBJECT[weekdayIndex(d.date)];
  const seen = (homeSeen.get(expected) ?? 0) + 1;
  homeSeen.set(expected, seen);
  const inQuota = seen <= (quotaBySubject.get(expected) ?? 0);
  const got = firstSubjectByDay.get(d.day);
  if (inQuota) {
    if (got !== expected) {
      alignBad++;
      if (alignBad <= 5) console.error(`  ✗ д ${d.day} (${d.date}): ждали ${expected}, получили ${got}`);
    }
  } else {
    tailDays++;
  }
}
ok(alignBad === 0 && alignChecked > 0, `расписание: главный предмет дня = экран «Расписание» в пределах квот (${alignChecked} дней, расхождений ${alignBad}, хвост после квоты: ${tailDays})`);

console.log("\n══ НАГРАДЫ ══");
const rTheory = taskReward(50, "theory");
const rMock = taskReward(120, "mock");
const rReview = taskReward(24, "review");
console.log(`  теория 50м: +${rTheory.xp} XP, +${rTheory.coins} монет`);
console.log(`  пробник 120м: +${rMock.xp} XP (120×0.4 + 25), +${rMock.coins} монет`);
console.log(`  повторение 24м: +${rReview.xp} XP (24×0.4 + 30), +${rReview.coins} монет`);
ok(rTheory.xp === Math.round(50 * XP_PER_MINUTE) && rTheory.coins === Math.round(50 / COINS_DIVISOR), "XP = round(минуты × 0.4), монеты = round(минуты / 4)");
ok(rMock.xp === Math.round(120 * XP_PER_MINUTE) + MOCK_BONUS_XP, "+25 XP за пробник");
ok(rReview.xp === Math.round(24 * XP_PER_MINUTE) + REVIEW_BONUS_XP, "+30 XP за повторение");

console.log("\n══ МАГАЗИН И ПРОФИЛЬ ══");
ok(new Set(SHOP_ITEMS.map((i) => i.id)).size === SHOP_ITEMS.length, `id товаров уникальны (${SHOP_ITEMS.length} шт.)`);
ok(SHOP_ITEMS.every((i) => i.price >= 0), "цены не отрицательные");
ok(
  SHOP_ITEMS.filter((i) => i.price === 0).map((i) => i.id).sort().join(",") ===
    [FREE_FRAME, FREE_BACKGROUND, NO_TITLE].sort().join(","),
  "бесплатны только базовые предметы",
);
ok(
  ["frame", "background", "title"].every((slot) => SHOP_ITEMS.filter((i) => i.slot === slot).length >= 4),
  "в каждом слоте не меньше 4 предметов",
);
ok(
  AVATAR_PRESETS.every((p) => p.rows.length === 8 && p.rows.every((r) => r.length === 8)),
  `пиксельные аватары 8×8 (${AVATAR_PRESETS.length} шт.)`,
);
ok(sanitizeProfile({ username: "x".repeat(40) }).username.length === 24, "юзернейм обрезается до 24 символов");
ok(sanitizeProfile({ avatar: "hack.png" }).avatar === DEFAULT_PROFILE.avatar, "неизвестный аватар отбрасывается");
ok(sanitizeProfile({ frame: "frame-nope" }).frame === FREE_FRAME, "неизвестная рамка отбрасывается");
ok(parseInventory(null).frames.includes(FREE_FRAME), "в инвентаре всегда есть базовая рамка");

console.log("\n══ ФОКУС-РЕЖИМ ══");
const now = Date.now();
const fresh: FocusSession = { kind: "task", id: "t", minutes: 50, elapsedMs: 0, startedAt: now };
const expired: FocusSession = { ...fresh, startedAt: now - 51 * 60_000 };
ok(remainingMs(fresh, now) === 50 * 60_000, "свежий таймер показывает полное время");
ok(remainingMs(expired, now) === 0, "истёкший таймер = 0 (только тогда зачёт)");
ok(remainingMs({ ...fresh, startedAt: now - 25 * 60_000 }, now) === 25 * 60_000, "обратный отсчёт идёт по startedAt");

// пауза: остаток замирает и переживает «следующий заход»
const after10 = { ...fresh, startedAt: now - 10 * 60_000 };
const paused = pauseSession(after10, now);
ok(isPaused(paused), "пауза переводит таймер в состояние «на паузе»");
ok(paused.elapsedMs === 10 * 60_000, `на паузе накоплено 10 мин (${Math.round(paused.elapsedMs / 60000)} мин)`);
ok(!isFinished(paused, now), "на паузе задание не засчитывается");
ok(remainingMs(paused, now + 60 * 60_000) === 40 * 60_000, "через час на паузе остаток тот же — 40 мин");
ok(
  remainingMs(paused, now + 5 * 24 * 60 * 60_000) === 40 * 60_000,
  "даже через 5 дней пауза держит остаток",
);
const resumed = resumeSession(paused, now + 60 * 60_000);
ok(!isPaused(resumed) && remainingMs(resumed, now + 60 * 60_000) === 40 * 60_000, "продолжение стартует с того же остатка");
ok(elapsedMsTotal(resumed, now + 65 * 60_000) === 15 * 60_000, "после продолжения время снова тикает");
ok(isFinished({ ...resumed, startedAt: now + 60 * 60_000 - 41 * 60_000 }, now + 60 * 60_000), "после добивания таймер истекает");
ok(topicMinutes(2.5) === 150, "часы темы переводятся в минуты (2.5 ч = 150 мин)");
const tr = topicFocusReward(120);
ok(tr.xp === Math.round(120 * XP_PER_MINUTE) && tr.coins === Math.round(120 / COINS_DIVISOR), "тема даёт XP 0.4/мин и монеты 0.25/мин");
const bonus = topicFocusBonus(JSON.stringify({ a: 120, b: 60 }));
ok(bonus.xp === 72 && bonus.coins === 45, `награды за темы суммируются (${bonus.xp} XP, ${bonus.coins} монет)`);
ok(Object.keys(parseTopicFocus("не json")).length === 0, "битый JSON наград за темы игнорируется");

console.log("\n══ ИТОГ ══");
if (failures === 0) {
  console.log("  Все проверки пройдены ✓\n");
} else {
  console.error(`  Провалено проверок: ${failures}\n`);
  process.exit(1);
}
