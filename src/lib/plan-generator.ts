/**
 * Генератор плана подготовки — ДЕТЕРМИНИРОВАННЫЙ алгоритм.
 *
 * Дано:
 *   • 209 дней плана, 4 фазы с бюджетами минут: 300 / 330 / 300 / 240
 *   • главный предмет дня следует ЭКРАНУ «Расписание» (WEEKDAY_MAIN_SUBJECT):
 *     Пн/Чт — математика, Вт/Сб — физика, Ср — химия, Пт — английский,
 *     Вс — японский; вторая пара дня добирается
 *     по максимуму «остаток − будущий спрос», чтобы квоты сошлись точно
 *   • формулы длительности теории и практики от сложности темы
 *   • цикл повторений (due через 3 и 10 дней после изучения, очередь с буфером)
 *   • дни пробников: каждые 14-й день
 *
 * Итог (проверяется scripts/verify.ts):
 *   636 заданий = 225 теорий + 225 практик + 172 повторения + 14 пробников
 *
 * Каждая из 225 тем получает ровно одну пару [теория + практика];
 * 225 пар: фаза 1 — 1 пара/день, фаза 2 — 2 пары в первые 30 учебных дней
 * иначе 1, фазы 3 и 4 — 1 пара/день.
 * Повторения: ежедневно в фазах 1, 2, 4; в фазе 3 — только по нечётным дням.
 */

import { FLAT_TOPICS, SUBJECT_SEEDS, type ExamKey, type SubjectId } from "./curriculum";
import { weekdayIndex } from "./dates";

export type TaskType = "theory" | "practice" | "review" | "mock";

export type PhaseDef = {
  n: 1 | 2 | 3 | 4;
  name: string;
  days: number;
  budget: number; // бюджет минут в день
};

export const PHASES: PhaseDef[] = [
  { n: 1, name: "Фундамент", days: 60, budget: 300 },
  { n: 2, name: "Набор объёма", days: 70, budget: 330 },
  { n: 3, name: "Пробники", days: 55, budget: 300 },
  { n: 4, name: "Шлифовка", days: 24, budget: 240 },
];

export const PLAN_DAYS = PHASES.reduce((a, p) => a + p.days, 0); // 209

/** Дата старта плана по умолчанию (хранится в settings.startDate). */
export const DEFAULT_START_DATE = "2026-11-04";

export const MOCK_EVERY = 14; // день кратный 14 — пробник
export const MOCK_MINUTES = 120;

/** Формула длительности теории: 40 + 7·сложность (47..75 мин). */
export const theoryMinutes = (difficulty: number): number => 40 + difficulty * 7;

/** Формула длительности практики: 30 + 6·сложность (36..60 мин). */
export const practiceMinutes = (difficulty: number): number => 30 + difficulty * 6;

/** Формула длительности повторения: 20 + 4·(размер-бюфера), максимум 28 мин. */
export const reviewMinutes = (bundle: number): number => 20 + Math.min(Math.max(bundle - 1, 0), 2) * 4;

/** Фиксированный порядок предметов для детерминированных тай-брейков. */
export const SUBJECT_ROUND_ROBIN: SubjectId[] = ["math", "chemistry", "physics", "japanese", "english"];

/**
 * «Дневной главный предмет» по дню недели (0=Пн … 6=Вс) — как на экране «Расписание»:
 * Пн и Чт — математика, Вт и Сб — физика, Ср — химия, Пт — английский,
 * Вс — японский (суббота совпадает с блоком «Физика и химия» в расписании).
 * В фазе 1 день состоит из одной пары — она всегда равна этому предмету.
 */
export const WEEKDAY_MAIN_SUBJECT: SubjectId[] = [
  "math", // Пн
  "physics", // Вт
  "chemistry", // Ср
  "math", // Чт
  "english", // Пт
  "physics", // Сб
  "japanese", // Вс
];

/** Цикл экзаменов для пробников: 5 письменных экзаменов. */
const MOCK_EXAM_CYCLE: ExamKey[] = ["japanese", "english", "math", "chemistry", "science"];

export const EXAM_TITLES: Record<ExamKey, string> = {
  japanese: "Japanese B",
  english: "English B",
  math: "Mathematics B",
  chemistry: "Chemistry",
  science: "Physics",
};

export type PlanDay = {
  day: number; // 1..209
  date: string; // YYYY-MM-DD (UTC)
  phase: 1 | 2 | 3 | 4;
  kind: "study" | "mock";
  budgetMin: number;
};

export type PlanTask = {
  id: string;
  day: number;
  ord: number; // порядок внутри дня
  type: TaskType;
  subjectId: SubjectId | null;
  topicId: string | null;
  topicIds: string[]; // для повторения — бандл тем
  examKey: ExamKey | null; // для пробника
  title: string;
  minutes: number;
};

export type PlanStats = {
  total: number;
  byType: Record<TaskType, number>;
  bySubject: Record<string, number>;
  totalMinutes: number;
  mockDays: number;
  maxDayLoad: { day: number; minutes: number; budget: number } | null;
  overBudgetDays: number;
};

export type GeneratedPlan = {
  startDate: string;
  examDate: string;
  days: PlanDay[];
  tasks: PlanTask[];
  stats: PlanStats;
};

export function addDaysISO(dateISO: string, delta: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + delta * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function phaseOfDay(day: number): PhaseDef {
  let acc = 0;
  for (const p of PHASES) {
    acc += p.days;
    if (day <= acc) return p;
  }
  return PHASES[PHASES.length - 1];
}

/** Пулы тем по предметам (в порядке куррикулума) + остатки квот. */
function buildSubjectPools(): {
  bySubject: Map<SubjectId, typeof FLAT_TOPICS>;
  cursor: Map<SubjectId, number>;
  remaining: Map<SubjectId, number>;
} {
  const bySubject = new Map<SubjectId, typeof FLAT_TOPICS>();
  const cursor = new Map<SubjectId, number>();
  const remaining = new Map<SubjectId, number>();
  for (const id of SUBJECT_ROUND_ROBIN) {
    const list = FLAT_TOPICS.filter((t) => t.subjectId === id);
    bySubject.set(id, list);
    cursor.set(id, 0);
    remaining.set(id, list.length);
  }
  return { bySubject, cursor, remaining };
}

/**
 * Главная функция: строит полный план для startDate.
 * Один и тот же startDate всегда даёт один и тот же план (детерминизм).
 */
export function generatePlan(startDate: string = DEFAULT_START_DATE): GeneratedPlan {
  const { bySubject, cursor, remaining } = buildSubjectPools();
  const days: PlanDay[] = [];
  const tasks: PlanTask[] = [];

  // ——— будущий спрос «домашних» дней: сколько ещё учебных дней ждёт предмет ———
  const homeDemand = new Map<SubjectId, number>();
  for (const id of SUBJECT_ROUND_ROBIN) homeDemand.set(id, 0);
  for (let day = 1; day <= PLAN_DAYS; day++) {
    if (day % MOCK_EVERY === 0) continue; // на пробнике пар нет
    const home = WEEKDAY_MAIN_SUBJECT[weekdayIndex(addDaysISO(startDate, day - 1))];
    homeDemand.set(home, (homeDemand.get(home) ?? 0) + 1);
  }

  /** Следующая тема предмета в порядке куррикулума; квота уменьшается. */
  const takeTopic = (id: SubjectId): (typeof FLAT_TOPICS)[number] => {
    const list = bySubject.get(id)!;
    const i = cursor.get(id)!;
    cursor.set(id, i + 1);
    remaining.set(id, remaining.get(id)! - 1);
    return list[i];
  };

  /**
   * Кандидат на пару: максимум «остаток квоты − будущий спрос» — предметы,
   * у которых ещё много незакрытых дней, уходят в приоритет; тай-брейк — порядок
   * SUBJECT_ROUND_ROBIN (детерминизм).
   */
  const pickSubject = (exclude: SubjectId | null): SubjectId | null => {
    let best: SubjectId | null = null;
    let bestScore = -Infinity;
    for (const id of SUBJECT_ROUND_ROBIN) {
      if (id === exclude) continue;
      const r = remaining.get(id) ?? 0;
      if (r <= 0) continue;
      const score = r - (homeDemand.get(id) ?? 0);
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return best;
  };

  // ——— распределение пар по учебным дням ———
  const isMockDay = (day: number) => day % MOCK_EVERY === 0;
  const studyIndexInPhase = new Map<number, number>(); // day -> № учебного дня в своей фазе
  {
    const counters = new Map<number, number>();
    for (let day = 1; day <= PLAN_DAYS; day++) {
      const phase = phaseOfDay(day);
      if (!isMockDay(day)) {
        const n = (counters.get(phase.n) ?? 0) + 1;
        counters.set(phase.n, n);
        studyIndexInPhase.set(day, n);
      }
    }
  }

  const pairsForDay = (day: number, phase: PhaseDef, studyIdx: number): number => {
    switch (phase.n) {
      case 1:
        return 1;
      case 2:
        return studyIdx <= 30 ? 2 : 1;
      case 3:
        return 1;
      case 4:
        return 1;
      default:
        return 1;
    }
  };

  const reviewDue = (day: number, phase: PhaseDef): boolean => {
    if (phase.n === 3) return day % 2 === 1; // в фазе пробников — через день
    return true; // фазы 1, 2, 4 — ежедневно
  };

  // ——— генерация ———
  const theoryTimeline = new Map<number, string[]>(); // день -> темы, изученные теорией
  const reviewQueue: string[] = []; // очередь тем на повторение
  const seenInQueue = new Set<string>();
  let mockCounter = 0;
  let reviewCounter = 0;

  for (let day = 1; day <= PLAN_DAYS; day++) {
    const phase = phaseOfDay(day);
    const date = addDaysISO(startDate, day - 1);

    if (isMockDay(day)) {
      mockCounter += 1;
      days.push({ day, date, phase: phase.n, kind: "mock", budgetMin: phase.budget });
      const examKey = MOCK_EXAM_CYCLE[(mockCounter - 1) % MOCK_EXAM_CYCLE.length];
      tasks.push({
        id: `d${day}-o0`,
        day,
        ord: 0,
        type: "mock",
        subjectId: null,
        topicId: null,
        topicIds: [],
        examKey,
        title: `Пробник №${mockCounter}: ${EXAM_TITLES[examKey]}`,
        minutes: MOCK_MINUTES,
      });
      continue;
    }

    days.push({ day, date, phase: phase.n, kind: "study", budgetMin: phase.budget });
    const studyIdx = studyIndexInPhase.get(day)!;
    const pairs = pairsForDay(day, phase, studyIdx);

    // главный предмет дня — по расписанию (экран «Расписание»); день прошёл —
    // спрос уменьшаем до выбора, чтобы вторая пара видела честный остаток
    const home = WEEKDAY_MAIN_SUBJECT[weekdayIndex(date)];
    homeDemand.set(home, (homeDemand.get(home) ?? 1) - 1);
    const primary = (remaining.get(home) ?? 0) > 0 ? home : pickSubject(null);
    if (!primary) throw new Error("квоты предметов исчерпаны раньше конца плана");

    const dayTopics: string[] = [];
    let ord = 0;
    for (let p = 0; p < pairs; p++) {
      const subjectId = p === 0 ? primary : (pickSubject(primary) ?? primary);
      const topic = takeTopic(subjectId);
      dayTopics.push(topic.id);

      tasks.push({
        id: `d${day}-o${ord}`,
        day,
        ord,
        type: "theory",
        subjectId: topic.subjectId,
        topicId: topic.id,
        topicIds: [topic.id],
        examKey: null,
        title: topic.title,
        minutes: theoryMinutes(topic.difficulty),
      });
      ord++;

      tasks.push({
        id: `d${day}-o${ord}`,
        day,
        ord,
        type: "practice",
        subjectId: topic.subjectId,
        topicId: topic.id,
        topicIds: [topic.id],
        examKey: null,
        title: topic.title,
        minutes: practiceMinutes(topic.difficulty),
      });
      ord++;
    }
    theoryTimeline.set(day, dayTopics);

    // ——— цикл повторений ———
    if (reviewDue(day, phase)) {
      for (const offset of [10, 3]) {
        const due = theoryTimeline.get(day - offset);
        if (due) {
          for (const id of due) {
            if (!seenInQueue.has(id)) {
              seenInQueue.add(id);
              reviewQueue.push(id);
            }
          }
        }
      }
      if (reviewQueue.length === 0 && dayTopics.length > 0) {
        // первый день: закрепляем вчерашнюю/сегодняшнюю тему
        const fallback = dayTopics[dayTopics.length - 1];
        if (!seenInQueue.has(fallback)) {
          seenInQueue.add(fallback);
          reviewQueue.push(fallback);
        }
      }
      if (reviewQueue.length > 0) {
        const bundle = reviewQueue.splice(0, 3);
        reviewCounter += 1;
        const titles = bundle.map((id) => FLAT_TOPICS.find((t) => t.id === id)?.title ?? id);
        const label =
          titles.length > 1 ? `Повторение: ${titles.slice(0, 2).join(" · ")}${titles.length > 2 ? ` +${titles.length - 2}` : ""}` : `Повторение: ${titles[0]}`;
        tasks.push({
          id: `d${day}-o${ord}`,
          day,
          ord,
          type: "review",
          subjectId: null,
          topicId: bundle[0],
          topicIds: bundle,
          examKey: null,
          title: label,
          minutes: reviewMinutes(bundle.length),
        });
      }
    }
  }

  // ——— статистика ———
  const byType: Record<TaskType, number> = { theory: 0, practice: 0, review: 0, mock: 0 };
  const tasksBySubject: Record<string, number> = {};
  const loadByDay = new Map<number, number>();
  let totalMinutes = 0;
  for (const t of tasks) {
    byType[t.type]++;
    const key = t.subjectId ?? (t.type === "mock" ? "mock" : "review");
    tasksBySubject[key] = (tasksBySubject[key] ?? 0) + 1;
    loadByDay.set(t.day, (loadByDay.get(t.day) ?? 0) + t.minutes);
    totalMinutes += t.minutes;
  }

  let overBudgetDays = 0;
  let maxDayLoad: PlanStats["maxDayLoad"] = null;
  for (const d of days) {
    const load = loadByDay.get(d.day) ?? 0;
    if (load > d.budgetMin) overBudgetDays++;
    if (!maxDayLoad || load > maxDayLoad.minutes) {
      maxDayLoad = { day: d.day, minutes: load, budget: d.budgetMin };
    }
  }

  return {
    startDate,
    examDate: addDaysISO(startDate, PLAN_DAYS),
    days,
    tasks,
    stats: {
      total: tasks.length,
      byType,
      bySubject: tasksBySubject,
      totalMinutes,
      mockDays: days.filter((d) => d.kind === "mock").length,
      maxDayLoad,
      overBudgetDays,
    },
  };
}
