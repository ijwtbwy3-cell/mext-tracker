/** Общие типы модели данных (одинаковы для web и offline). */

import type { ExamKey, Level, SubjectIcon, SubjectId } from "./curriculum";
import type { TaskType } from "./plan-generator";

export type TopicStatus = "none" | "doing" | "done";
export type TaskStatus = "todo" | "done";

export type SubjectRow = {
  id: SubjectId;
  title: string;
  short: string;
  exam: ExamKey;
  color: string;
  icon: SubjectIcon;
  ord: number;
};

export type SectionRow = {
  id: string;
  subjectId: SubjectId;
  title: string;
  ord: number;
};

export type TopicRow = {
  id: string;
  sectionId: string;
  subjectId: SubjectId;
  title: string;
  description: string;
  hours: number;
  difficulty: number;
  level: Level;
  ord: number;
};

export type ProgressRow = {
  topicId: string;
  status: TopicStatus;
  updatedAt: string;
};

export type PlanDayRow = {
  id: number;
  date: string;
  phase: 1 | 2 | 3 | 4;
  kind: "study" | "mock";
  budgetMin: number;
};

export type TaskRow = {
  id: string;
  dayId: number;
  subjectId: SubjectId | null;
  topicId: string | null;
  topicIds: string; // JSON-массив строк
  examKey: ExamKey | null;
  type: TaskType;
  title: string;
  minutes: number;
  ord: number;
  status: TaskStatus;
  doneAt: string | null;
  spentMin: number | null;
  awardedXp: number;
  awardedCoins: number;
};

export type DiaryRow = {
  id: string;
  date: string;
  mood: number; // 1..5
  text: string;
  createdAt: string;
};

export type SettingsRow = {
  key: string;
  value: string;
};

export type SettingsMap = Record<string, string>;

export type BootstrapPayload = {
  settings: SettingsMap;
  subjects: SubjectRow[];
  sections: SectionRow[];
  topics: TopicRow[];
  progress: ProgressRow[];
  planDays: PlanDayRow[];
  tasks: TaskRow[];
  diary: DiaryRow[];
  totals: {
    xp: number;
    coins: number;
    tasksDone: number;
    tasksTotal: number;
    topicsDone: number;
    topicsTotal: number;
  };
};

export type CompleteTaskResult = {
  task: TaskRow;
  reward: { xp: number; coins: number };
  totals: BootstrapPayload["totals"];
};

/** Формат резервной копии JSON v1. */
export type BackupV1 = {
  v: 1;
  app: "mext-tracker";
  curriculumVersion: string;
  createdAt: string;
  data: {
    subjects: SubjectRow[];
    sections: SectionRow[];
    topics: TopicRow[];
    progress: ProgressRow[];
    planDays: PlanDayRow[];
    tasks: TaskRow[];
    diary: DiaryRow[];
    settings: SettingsMap;
  };
};
