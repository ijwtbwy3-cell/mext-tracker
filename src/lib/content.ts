/**
 * Сборка строк контента (предметы, разделы, темы, дни плана, задания)
 * из единого источника curriculum.ts + plan-generator.ts.
 * Используется ОБЕИМИ сборками: web (seed в PostgreSQL) и offline (seed в SQLite),
 * а также скриптом db:seed.
 */
import { CURRICULUM_VERSION, FLAT_SECTIONS, FLAT_TOPICS, SUBJECT_SEEDS } from "./curriculum";
import { DEFAULT_START_DATE, generatePlan, addDaysISO } from "./plan-generator";
import type {
  PlanDayRow,
  SectionRow,
  SubjectRow,
  TaskRow,
  TopicRow,
} from "./types";

export type ContentRows = {
  subjects: SubjectRow[];
  sections: SectionRow[];
  topics: TopicRow[];
  planDays: PlanDayRow[];
  tasks: TaskRow[];
};

export function buildContent(startDate: string = DEFAULT_START_DATE): ContentRows {
  const subjects: SubjectRow[] = SUBJECT_SEEDS.map((s, i) => ({
    id: s.id,
    title: s.title,
    short: s.short,
    exam: s.exam,
    color: s.color,
    icon: s.icon,
    ord: i,
  }));

  const sections: SectionRow[] = FLAT_SECTIONS.map((s) => ({
    id: s.id,
    subjectId: s.subjectId,
    title: s.title,
    ord: s.ord,
  }));

  const topics: TopicRow[] = FLAT_TOPICS.map((t) => ({
    id: t.id,
    sectionId: t.sectionId,
    subjectId: t.subjectId,
    title: t.title,
    description: t.description,
    hours: t.hours,
    difficulty: t.difficulty,
    level: t.level,
    ord: t.ord,
  }));

  const plan = generatePlan(startDate);
  const planDays: PlanDayRow[] = plan.days.map((d) => ({
    id: d.day,
    date: d.date,
    phase: d.phase,
    kind: d.kind,
    budgetMin: d.budgetMin,
  }));

  const tasks: TaskRow[] = plan.tasks.map((t) => ({
    id: t.id,
    dayId: t.day,
    subjectId: t.subjectId,
    topicId: t.topicId,
    topicIds: JSON.stringify(t.topicIds),
    examKey: t.examKey,
    type: t.type,
    title: t.title,
    minutes: t.minutes,
    ord: t.ord,
    status: "todo",
    doneAt: null,
    spentMin: null,
    awardedXp: 0,
    awardedCoins: 0,
  }));

  return { subjects, sections, topics, planDays, tasks };
}

/** Настройки по умолчанию при первой загрузке. */
export function defaultSettings(startDate: string = DEFAULT_START_DATE): Record<string, string> {
  return {
    startDate,
    examDate: addDaysISO(startDate, 209),
    curriculumVersion: CURRICULUM_VERSION,
    crt: "on",
    lastBackupAt: "",
  };
}
