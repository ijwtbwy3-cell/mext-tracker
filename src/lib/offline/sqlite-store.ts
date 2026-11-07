/**
 * Офлайн-хранилище: SQLite в WebAssembly (sql.js), байты базы живут в IndexedDB.
 * Поверх него работает fetch-bridge: fetch('/api/...') -> этот класс.
 */
import initSqlJs, { type Database } from "sql.js";
import { DDL } from "./ddl";
import { idbGet, idbSet } from "./idb";
import { buildContent, defaultSettings } from "../content";
import { applySocialTotals } from "../social";
import { CURRICULUM_VERSION } from "../curriculum";
import { DEFAULT_START_DATE, addDaysISO } from "../plan-generator";
import {
  applyCompletion,
  computeTotals,
  deriveTopicStatus,
  makeDiaryId,
  type DataStore,
} from "../store";
import type {
  BackupV1,
  BootstrapPayload,
  CompleteTaskResult,
  DiaryRow,
  PlanDayRow,
  ProgressRow,
  SectionRow,
  SettingsMap,
  SubjectRow,
  TaskRow,
  TopicRow,
  TopicStatus,
} from "../types";

const KEY = "sqlite-bytes";

/** Локатор wasm-файла sql.js. В офлайн-сборке его задаёт src/offline/main.tsx
 *  (импорт ?url из бандла), в Node-тестах — scripts/smoke-offline.ts. */
let wasmLocator: (() => string) | null = null;
export function configureSqlWasm(locator: () => string): void {
  wasmLocator = locator;
}

type AnyRow = Record<string, unknown>;

function all<T>(db: Database, sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params as never);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

function get<T>(db: Database, sql: string, params: unknown[] = []): T | null {
  const rows = all<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(db: Database, sql: string, params: unknown[] = []): void {
  db.run(sql, params as never);
}

function scalar(db: Database, sql: string, params: unknown[] = []): number {
  const row = get<{ n: number }>(db, sql, params);
  return row ? Number(row.n) : 0;
}

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function insertRows(db: Database, table: string, rows: AnyRow[]): void {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const colList = keys.map((k) => `"${toSnake(k)}"`).join(", ");
  const chunkSize = 80;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk
      .map((r) => `(${keys.map(() => "?").join(", ")})`)
      .join(", ");
    const params = chunk.flatMap((r) => keys.map((k) => (r[k] === undefined ? null : r[k])));
    run(db, `INSERT INTO "${table}" (${colList}) VALUES ${values}`, params);
  }
}

export class SqliteStore implements DataStore {
  private writing: Promise<void> = Promise.resolve();

  constructor(private db: Database) {}

  /* ───────────── persistence ───────────── */

  /**
   * Сохранение байтов SQLite в IndexedDB после КАЖДОЙ мутации (await):
   * ответ уходит клиенту только после фиксации на диске — перезагрузка
   * страницы не может «обогнать» запись (раньше был дебаунс250 мс).
   */
  async persistNow(): Promise<void> {
    this.writing = this.writing.then(async () => {
      const bytes = this.db.export();
      await idbSet(KEY, bytes);
    });
    return this.writing;
  }

  /* ───────────── settings helpers ───────────── */

  getSetting(key: string): string | null {
    const row = get<{ value: string }>(this.db, "SELECT value FROM settings WHERE key = ?", [key]);
    return row ? row.value : null;
  }

  private setSettingRow(key: string, value: string): void {
    run(
      this.db,
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }

  /* ───────────── seeding ───────────── */

  async ensureSeeded(): Promise<void> {
    const version = this.getSetting("curriculumVersion");
    const subjectCount = scalar(this.db, "SELECT COUNT(*) AS n FROM subjects");
    if (version === CURRICULUM_VERSION && subjectCount > 0) {
      // дозаполняем недостающие дефолты настроек
      const defaults = defaultSettings(this.getSetting("startDate") ?? DEFAULT_START_DATE);
      for (const [k, v] of Object.entries(defaults)) {
        if (this.getSetting(k) === null) this.setSettingRow(k, v);
      }
      return;
    }

    const startDate = this.getSetting("startDate") ?? DEFAULT_START_DATE;
    const content = buildContent(startDate);

    // полная замена контента; progress/diary сохраняются (id тем стабильны)
    for (const table of ["tasks", "plan_days", "topics", "sections", "subjects"]) {
      run(this.db, `DELETE FROM "${table}"`);
    }
    insertRows(this.db, "subjects", content.subjects as unknown as AnyRow[]);
    insertRows(this.db, "sections", content.sections as unknown as AnyRow[]);
    insertRows(this.db, "topics", content.topics as unknown as AnyRow[]);
    // подчистка прогресса по темам, которых больше нет (например, убранная биология)
    run(this.db, "DELETE FROM progress WHERE topic_id NOT IN (SELECT id FROM topics)");
    insertRows(this.db, "plan_days", content.planDays as unknown as AnyRow[]);
    insertRows(this.db, "tasks", content.tasks as unknown as AnyRow[]);

    const settings = { ...defaultSettings(startDate), startDate };
    for (const [k, v] of Object.entries(settings)) this.setSettingRow(k, v);
    await this.persistNow();
  }

  /* ───────────── DataStore ───────────── */

  async bootstrap(): Promise<BootstrapPayload> {
    await this.ensureSeeded();

    const subjects = all<SubjectRow>(this.db, "SELECT * FROM subjects ORDER BY ord");
    const sections = all<SectionRow>(
      this.db,
      'SELECT id, subject_id AS subjectId, title, ord FROM sections ORDER BY ord',
    );
    const topics = all<TopicRow>(
      this.db,
      'SELECT id, section_id AS sectionId, subject_id AS subjectId, title, description, hours, difficulty, level, ord FROM topics ORDER BY ord',
    );
    const progress = all<ProgressRow>(
      this.db,
      'SELECT topic_id AS topicId, status, updated_at AS updatedAt FROM progress',
    );
    const planDays = all<PlanDayRow>(
      this.db,
      'SELECT id, date, phase, kind, budget_min AS budgetMin FROM plan_days ORDER BY id',
    );
    const taskRows = all<Record<string, unknown>>(
      this.db,
      `SELECT id, day_id AS dayId, subject_id AS subjectId, topic_id AS topicId, topic_ids AS topicIds,
              exam_key AS examKey, type, title, minutes, ord, status, done_at AS doneAt,
              spent_min AS spentMin, awarded_xp AS awardedXp, awarded_coins AS awardedCoins
       FROM tasks ORDER BY day_id, ord`,
    );
    const tasks: TaskRow[] = taskRows.map((r) => ({
      ...(r as unknown as TaskRow),
      topicIds: typeof r.topicIds === "string" ? r.topicIds : "[]",
    }));
    const diary = all<DiaryRow>(
      this.db,
      "SELECT id, date, mood, text, created_at AS createdAt FROM diary ORDER BY date DESC, created_at DESC",
    );
    const settingsRows = all<{ key: string; value: string }>(this.db, "SELECT key, value FROM settings");
    const settings: SettingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));

    const topicsDone = progress.filter((p) => p.status === "done").length;
    return {
      settings,
      subjects,
      sections,
      topics,
      progress,
      planDays,
      tasks,
      diary,
      totals: applySocialTotals(computeTotals({ tasks, topicsDone, topicsTotal: topics.length }), settings),
    };
  }

  private refreshDerivedTotals(): BootstrapPayload["totals"] {
    const taskRows = all<TaskRow>(
      this.db,
      `SELECT id, day_id AS dayId, subject_id AS subjectId, topic_id AS topicId, topic_ids AS topicIds,
              exam_key AS examKey, type, title, minutes, ord, status, done_at AS doneAt,
              spent_min AS spentMin, awarded_xp AS awardedXp, awarded_coins AS awardedCoins
       FROM tasks`,
    );
    const topicsDone = scalar(this.db, "SELECT COUNT(*) AS n FROM progress WHERE status = 'done'");
    const topicsTotal = scalar(this.db, "SELECT COUNT(*) AS n FROM topics");
    const settingsRows = all<{ key: string; value: string }>(this.db, "SELECT key, value FROM settings");
    const settings: SettingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
    return applySocialTotals(computeTotals({ tasks: taskRows, topicsDone, topicsTotal }), settings);
  }

  private rederiveTopic(topicId: string): void {
    const rows = all<Pick<TaskRow, "type" | "status">>(
      this.db,
      "SELECT type, status FROM tasks WHERE topic_id = ? AND type IN ('theory','practice')",
      [topicId],
    );
    const status = deriveTopicStatus(rows);
    run(
      this.db,
      "INSERT INTO progress (topic_id, status, updated_at) VALUES (?, ?, ?) ON CONFLICT(topic_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at",
      [topicId, status, new Date().toISOString()],
    );
  }

  async completeTask(taskId: string, spentMin?: number): Promise<CompleteTaskResult> {
    const row = get<TaskRow>(
      this.db,
      `SELECT id, day_id AS dayId, subject_id AS subjectId, topic_id AS topicId, topic_ids AS topicIds,
              exam_key AS examKey, type, title, minutes, ord, status, done_at AS doneAt,
              spent_min AS spentMin, awarded_xp AS awardedXp, awarded_coins AS awardedCoins
       FROM tasks WHERE id = ?`,
      [taskId],
    );
    if (!row) throw new Error("Задание не найдено");
    const { task, reward } = applyCompletion(row, spentMin);
    run(
      this.db,
      `UPDATE tasks SET status = ?, done_at = ?, spent_min = ?, awarded_xp = ?, awarded_coins = ? WHERE id = ?`,
      [task.status, task.doneAt, task.spentMin, task.awardedXp, task.awardedCoins, taskId],
    );
    if (task.topicId && (task.type === "theory" || task.type === "practice")) {
      this.rederiveTopic(task.topicId);
    }
    await this.persistNow();
    return { task, reward, totals: this.refreshDerivedTotals() };
  }

  async reopenTask(taskId: string): Promise<BootstrapPayload["totals"]> {
    const row = get<{ topicId: string | null; type: string }>(
      this.db,
      "SELECT topic_id AS topicId, type FROM tasks WHERE id = ?",
      [taskId],
    );
    if (!row) throw new Error("Задание не найдено");
    run(
      this.db,
      "UPDATE tasks SET status = 'todo', done_at = NULL, spent_min = NULL, awarded_xp = 0, awarded_coins = 0 WHERE id = ?",
      [taskId],
    );
    if (row.topicId && (row.type === "theory" || row.type === "practice")) {
      this.rederiveTopic(row.topicId);
    }
    await this.persistNow();
    return this.refreshDerivedTotals();
  }

  async setTopicStatus(topicId: string, status: TopicStatus): Promise<void> {
    run(
      this.db,
      "INSERT INTO progress (topic_id, status, updated_at) VALUES (?, ?, ?) ON CONFLICT(topic_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at",
      [topicId, status, new Date().toISOString()],
    );
    await this.persistNow();
  }

  async addDiary(entry: { date: string; mood: number; text: string }): Promise<DiaryRow> {
    const row: DiaryRow = {
      id: makeDiaryId(),
      date: entry.date,
      mood: entry.mood,
      text: entry.text,
      createdAt: new Date().toISOString(),
    };
    run(this.db, "INSERT INTO diary (id, date, mood, text, created_at) VALUES (?, ?, ?, ?, ?)", [
      row.id,
      row.date,
      row.mood,
      row.text,
      row.createdAt,
    ]);
    await this.persistNow();
    return row;
  }

  async updateDiary(
    id: string,
    patch: { date?: string; mood?: number; text?: string },
  ): Promise<DiaryRow | null> {
    const existing = get<DiaryRow>(
      this.db,
      "SELECT id, date, mood, text, created_at AS createdAt FROM diary WHERE id = ?",
      [id],
    );
    if (!existing) return null;
    const next: DiaryRow = {
      ...existing,
      date: patch.date ?? existing.date,
      mood: patch.mood ?? existing.mood,
      text: patch.text ?? existing.text,
    };
    run(this.db, "UPDATE diary SET date = ?, mood = ?, text = ? WHERE id = ?", [
      next.date,
      next.mood,
      next.text,
      id,
    ]);
    await this.persistNow();
    return next;
  }

  async deleteDiary(id: string): Promise<void> {
    run(this.db, "DELETE FROM diary WHERE id = ?", [id]);
    await this.persistNow();
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.setSettingRow(key, value);
    await this.persistNow();
  }

  /** Сколько монет заработано заданиями (без учёта трат в магазине). */
  async earnedCoins(): Promise<number> {
    return scalar(this.db, "SELECT COALESCE(SUM(awarded_coins), 0) AS n FROM tasks");
  }

  async exportBackup(): Promise<BackupV1> {
    const payload = await this.bootstrap();
    return {
      v: 1,
      app: "mext-tracker",
      curriculumVersion: CURRICULUM_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        subjects: payload.subjects,
        sections: payload.sections,
        topics: payload.topics,
        progress: payload.progress,
        planDays: payload.planDays,
        tasks: payload.tasks,
        diary: payload.diary,
        settings: payload.settings,
      },
    };
  }

  async importBackup(backup: BackupV1): Promise<void> {
    if (!backup || backup.v !== 1 || backup.app !== "mext-tracker") {
      throw new Error("Неверный формат резервной копии (ожидается JSON v1)");
    }
    const d = backup.data;
    for (const table of ["tasks", "plan_days", "topics", "sections", "subjects", "progress", "diary", "settings"]) {
      run(this.db, `DELETE FROM "${table}"`);
    }
    insertRows(this.db, "subjects", d.subjects as unknown as AnyRow[]);
    insertRows(this.db, "sections", d.sections as unknown as AnyRow[]);
    insertRows(this.db, "topics", d.topics as unknown as AnyRow[]);
    insertRows(this.db, "plan_days", d.planDays as unknown as AnyRow[]);
    insertRows(this.db, "tasks", d.tasks as unknown as AnyRow[]);
    insertRows(this.db, "progress", d.progress as unknown as AnyRow[]);
    insertRows(this.db, "diary", d.diary as unknown as AnyRow[]);
    for (const [k, v] of Object.entries(d.settings ?? {})) this.setSettingRow(k, v);
    await this.persistNow();
    await this.persistNow();
  }

  async resetProgress(): Promise<void> {
    run(this.db, "UPDATE tasks SET status = 'todo', done_at = NULL, spent_min = NULL, awarded_xp = 0, awarded_coins = 0");
    run(this.db, "DELETE FROM progress");
    run(this.db, "DELETE FROM diary");
    await this.persistNow();
  }
}

/* ───────────── фабрика с загрузкой из IndexedDB ───────────── */

let storePromise: Promise<SqliteStore> | null = null;

export function getSqliteStore(): Promise<SqliteStore> {
  if (!storePromise) {
    storePromise = (async () => {
      if (!wasmLocator) throw new Error("configureSqlWasm() не вызван");
      const SQL = await initSqlJs({ locateFile: () => wasmLocator!() });
      const bytes = await idbGet(KEY);
      const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
      db.run(DDL);
      const store = new SqliteStore(db);
      await store.ensureSeeded();
      await store.persistNow();

      const flush = () => void store.persistNow();
      window.addEventListener("pagehide", flush);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flush();
      });
      return store;
    })();
  }
  return storePromise;
}

/** Сброс хранилища (используется при импорте/ошибке совместимости). */
export function resetSqliteStore(): void {
  storePromise = null;
}
