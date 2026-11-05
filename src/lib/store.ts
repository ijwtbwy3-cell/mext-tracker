/**
 * Абстракция хранилища данных: одна и та же логика для обеих сборок.
 *   web     -> WebStore (Drizzle + PostgreSQL)      — src/lib/db/web-store.ts
 *   offline -> SqliteStore (sql.js + IndexedDB)     — src/lib/offline/sqlite-store.ts
 * Экраны общаются с хранилищем только через fetch('/api/...'), который на
 * офлайн-сборке перехватывается fetch-bridge.ts.
 */
import type {
  BackupV1,
  BootstrapPayload,
  CompleteTaskResult,
  DiaryRow,
  TaskRow,
  TopicStatus,
} from "./types";
import { taskReward } from "./gamification";

export interface DataStore {
  bootstrap(): Promise<BootstrapPayload>;
  completeTask(taskId: string, spentMin?: number): Promise<CompleteTaskResult>;
  reopenTask(taskId: string): Promise<BootstrapPayload["totals"]>;
  setTopicStatus(topicId: string, status: TopicStatus): Promise<void>;
  addDiary(entry: { date: string; mood: number; text: string }): Promise<DiaryRow>;
  updateDiary(
    id: string,
    patch: { date?: string; mood?: number; text?: string },
  ): Promise<DiaryRow | null>;
  deleteDiary(id: string): Promise<void>;
  setSetting(key: string, value: string): Promise<void>;
  exportBackup(): Promise<BackupV1>;
  importBackup(backup: BackupV1): Promise<void>;
  resetProgress(): Promise<void>;
}

/* ═══════════════════════ общие чистые функции ═══════════════════════ */

export function computeTotals(p: {
  tasks: TaskRow[];
  topicsDone: number;
  topicsTotal: number;
}): BootstrapPayload["totals"] {
  let xp = 0;
  let coins = 0;
  let tasksDone = 0;
  for (const t of p.tasks) {
    xp += t.awardedXp;
    coins += t.awardedCoins;
    if (t.status === "done") tasksDone++;
  }
  return {
    xp,
    coins,
    tasksDone,
    tasksTotal: p.tasks.length,
    topicsDone: p.topicsDone,
    topicsTotal: p.topicsTotal,
  };
}

/** Статус темы выводится из её заданий «теория» и «практика». */
export function deriveTopicStatus(topicTasks: Pick<TaskRow, "type" | "status">[]): TopicStatus {
  const core = topicTasks.filter((t) => t.type === "theory" || t.type === "practice");
  if (core.length === 0) return "none";
  const done = core.filter((t) => t.status === "done").length;
  if (done === core.length) return "done";
  if (done > 0) return "doing";
  return "none";
}

/** Ручной переключатель статуса темы на экране «Предметы». */
export function nextTopicStatus(current: TopicStatus): TopicStatus {
  if (current === "none") return "doing";
  if (current === "doing") return "done";
  return "none";
}

/** Идемпотентное выполнение задания: возвращает награду (0 при повторном вызове). */
export function applyCompletion(
  task: TaskRow,
  spentMin?: number,
): { task: TaskRow; reward: { xp: number; coins: number } } {
  if (task.status === "done") {
    return { task, reward: { xp: 0, coins: 0 } };
  }
  const spent = Math.max(1, Math.round(spentMin ?? task.minutes));
  const reward = taskReward(spent, task.type as TaskRow["type"]);
  const doneAt = new Date().toISOString();
  return {
    task: {
      ...task,
      status: "done",
      doneAt,
      spentMin: spent,
      awardedXp: reward.xp,
      awardedCoins: reward.coins,
    },
    reward,
  };
}

export function makeDiaryId(): string {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
