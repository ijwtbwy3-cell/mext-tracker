/**
 * Веб-хранилище: PostgreSQL через Drizzle ORM (pg-драйвер).
 * Реализует тот же интерфейс DataStore, что и офлайн SqliteStore.
 */
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import * as t from "./schema";
import { buildContent, defaultSettings } from "../content";
import { CURRICULUM_VERSION } from "../curriculum";
import { DEFAULT_START_DATE } from "../plan-generator";
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
  TaskRow,
  TopicStatus,
} from "../types";

type Db = NodePgDatabase<typeof t.schema>;

export class WebStore implements DataStore {
  constructor(
    private pool: Pool,
    private db: Db,
  ) {}

  private async getSetting(key: string): Promise<string | null> {
    const rows = await this.db.select().from(t.settings).where(eq(t.settings.key, key)).limit(1);
    return rows.length > 0 ? rows[0].value : null;
  }

  private async setSettingRow(key: string, value: string): Promise<void> {
    await this.db
      .insert(t.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: t.settings.key, set: { value } });
  }

  async ensureSeeded(): Promise<void> {
    const version = await this.getSetting("curriculumVersion");
    const subj = await this.db.select({ n: sql<number>`count(*)::int` }).from(t.subjects);
    const subjectCount = subj[0]?.n ?? 0;

    if (version === CURRICULUM_VERSION && subjectCount > 0) {
      const startDate = (await this.getSetting("startDate")) ?? DEFAULT_START_DATE;
      const defaults = defaultSettings(startDate);
      for (const [k, v] of Object.entries(defaults)) {
        if ((await this.getSetting(k)) === null) await this.setSettingRow(k, v);
      }
      return;
    }

    const startDate = (await this.getSetting("startDate")) ?? DEFAULT_START_DATE;
    const content = buildContent(startDate);

    await this.db.transaction(async (tx) => {
      await tx.delete(t.tasks);
      await tx.delete(t.planDays);
      await tx.delete(t.topics);
      await tx.delete(t.sections);
      await tx.delete(t.subjects);

      for (let i = 0; i < content.subjects.length; i += 100) {
        await tx.insert(t.subjects).values(content.subjects.slice(i, i + 100));
      }
      for (let i = 0; i < content.sections.length; i += 100) {
        await tx.insert(t.sections).values(content.sections.slice(i, i + 100));
      }
      for (let i = 0; i < content.topics.length; i += 100) {
        await tx.insert(t.topics).values(content.topics.slice(i, i + 100));
      }
      for (let i = 0; i < content.planDays.length; i += 100) {
        await tx.insert(t.planDays).values(content.planDays.slice(i, i + 100));
      }
      for (let i = 0; i < content.tasks.length; i += 100) {
        await tx.insert(t.tasks).values(content.tasks.slice(i, i + 100));
      }

      const settings = { ...defaultSettings(startDate), startDate };
      for (const [k, v] of Object.entries(settings)) {
        await tx
          .insert(t.settings)
          .values({ key: k, value: v })
          .onConflictDoUpdate({ target: t.settings.key, set: { value: v } });
      }
    });
  }

  async bootstrap(): Promise<BootstrapPayload> {
    await this.ensureSeeded();

    const [subjects, sections, topics, progress, planDays, tasks, diary, settingsRows] =
      await Promise.all([
        this.db.select().from(t.subjects),
        this.db.select().from(t.sections),
        this.db.select().from(t.topics),
        this.db.select().from(t.progress),
        this.db.select().from(t.planDays),
        this.db.select().from(t.tasks),
        this.db.select().from(t.diary),
        this.db.select().from(t.settings),
      ]);

    subjects.sort((a, b) => a.ord - b.ord);
    sections.sort((a, b) => a.ord - b.ord);
    topics.sort((a, b) => a.ord - b.ord);
    planDays.sort((a, b) => a.id - b.id);
    tasks.sort((a, b) => a.dayId - b.dayId || a.ord - b.ord);
    diary.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
    const topicsDone = progress.filter((p) => p.status === "done").length;
    return {
      settings,
      subjects: subjects as unknown as BootstrapPayload["subjects"],
      sections: sections as unknown as BootstrapPayload["sections"],
      topics: topics as unknown as BootstrapPayload["topics"],
      progress: progress as unknown as BootstrapPayload["progress"],
      planDays: planDays as unknown as BootstrapPayload["planDays"],
      tasks: tasks as unknown as BootstrapPayload["tasks"],
      diary: diary as unknown as BootstrapPayload["diary"],
      totals: computeTotals({
        tasks: tasks as unknown as TaskRow[],
        topicsDone,
        topicsTotal: topics.length,
      }),
    };
  }

  private async totalsNow(): Promise<BootstrapPayload["totals"]> {
    const tasks = await this.db.select().from(t.tasks);
    const done = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(t.progress)
      .where(eq(t.progress.status, "done"));
    const total = await this.db.select({ n: sql<number>`count(*)::int` }).from(t.topics);
    return computeTotals({
      tasks: tasks as unknown as TaskRow[],
      topicsDone: done[0]?.n ?? 0,
      topicsTotal: total[0]?.n ?? 0,
    });
  }

  private async rederiveTopic(topicId: string): Promise<void> {
    const scoped = await this.db
      .select({ type: t.tasks.type, status: t.tasks.status })
      .from(t.tasks)
      .where(sql`${t.tasks.topicId} = ${topicId} and ${t.tasks.type} in ('theory','practice')`);
    const status = deriveTopicStatus(scoped as unknown as Pick<TaskRow, "type" | "status">[]);
    await this.db
      .insert(t.progress)
      .values({ topicId, status, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: t.progress.topicId,
        set: { status, updatedAt: new Date().toISOString() },
      });
  }

  async completeTask(taskId: string, spentMin?: number): Promise<CompleteTaskResult> {
    const rows = await this.db.select().from(t.tasks).where(eq(t.tasks.id, taskId)).limit(1);
    if (rows.length === 0) throw new Error("Задание не найдено");
    const { task, reward } = applyCompletion(rows[0] as unknown as TaskRow, spentMin);
    await this.db
      .update(t.tasks)
      .set({
        status: task.status,
        doneAt: task.doneAt,
        spentMin: task.spentMin,
        awardedXp: task.awardedXp,
        awardedCoins: task.awardedCoins,
      })
      .where(eq(t.tasks.id, taskId));
    if (task.topicId && (task.type === "theory" || task.type === "practice")) {
      await this.rederiveTopic(task.topicId);
    }
    return { task, reward, totals: await this.totalsNow() };
  }

  async reopenTask(taskId: string): Promise<BootstrapPayload["totals"]> {
    const rows = await this.db.select().from(t.tasks).where(eq(t.tasks.id, taskId)).limit(1);
    if (rows.length === 0) throw new Error("Задание не найдено");
    const row = rows[0];
    await this.db
      .update(t.tasks)
      .set({ status: "todo", doneAt: null, spentMin: null, awardedXp: 0, awardedCoins: 0 })
      .where(eq(t.tasks.id, taskId));
    if (row.topicId && (row.type === "theory" || row.type === "practice")) {
      await this.rederiveTopic(row.topicId);
    }
    return this.totalsNow();
  }

  async setTopicStatus(topicId: string, status: TopicStatus): Promise<void> {
    await this.db
      .insert(t.progress)
      .values({ topicId, status, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: t.progress.topicId,
        set: { status, updatedAt: new Date().toISOString() },
      });
  }

  async addDiary(entry: { date: string; mood: number; text: string }): Promise<DiaryRow> {
    const row: DiaryRow = {
      id: makeDiaryId(),
      date: entry.date,
      mood: entry.mood,
      text: entry.text,
      createdAt: new Date().toISOString(),
    };
    await this.db.insert(t.diary).values(row);
    return row;
  }

  async updateDiary(
    id: string,
    patch: { date?: string; mood?: number; text?: string },
  ): Promise<DiaryRow | null> {
    const rows = await this.db.select().from(t.diary).where(eq(t.diary.id, id)).limit(1);
    if (rows.length === 0) return null;
    const next = {
      date: patch.date ?? rows[0].date,
      mood: patch.mood ?? rows[0].mood,
      text: patch.text ?? rows[0].text,
    };
    await this.db.update(t.diary).set(next).where(eq(t.diary.id, id));
    return { ...rows[0], ...next };
  }

  async deleteDiary(id: string): Promise<void> {
    await this.db.delete(t.diary).where(eq(t.diary.id, id));
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.setSettingRow(key, value);
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
    await this.db.transaction(async (tx) => {
      await tx.delete(t.tasks);
      await tx.delete(t.planDays);
      await tx.delete(t.topics);
      await tx.delete(t.sections);
      await tx.delete(t.subjects);
      await tx.delete(t.progress);
      await tx.delete(t.diary);
      await tx.delete(t.settings);

      for (let i = 0; i < d.subjects.length; i += 100) await tx.insert(t.subjects).values(d.subjects.slice(i, i + 100));
      for (let i = 0; i < d.sections.length; i += 100) await tx.insert(t.sections).values(d.sections.slice(i, i + 100));
      for (let i = 0; i < d.topics.length; i += 100) await tx.insert(t.topics).values(d.topics.slice(i, i + 100));
      for (let i = 0; i < d.planDays.length; i += 100) await tx.insert(t.planDays).values(d.planDays.slice(i, i + 100));
      for (let i = 0; i < d.tasks.length; i += 100) await tx.insert(t.tasks).values(d.tasks.slice(i, i + 100));
      for (let i = 0; i < d.progress.length; i += 100) await tx.insert(t.progress).values(d.progress.slice(i, i + 100));
      for (let i = 0; i < d.diary.length; i += 100) await tx.insert(t.diary).values(d.diary.slice(i, i + 100));
      for (const [k, v] of Object.entries(d.settings ?? {})) {
        await tx.insert(t.settings).values({ key: k, value: v }).onConflictDoUpdate({ target: t.settings.key, set: { value: v } });
      }
    });
  }

  async resetProgress(): Promise<void> {
    await this.db
      .update(t.tasks)
      .set({ status: "todo", doneAt: null, spentMin: null, awardedXp: 0, awardedCoins: 0 });
    await this.db.delete(t.progress);
    await this.db.delete(t.diary);
  }
}

/* ───────────── синглтон ───────────── */

const g = globalThis as unknown as { __mextWebStore?: WebStore };

export function getWebStore(): WebStore {
  if (!g.__mextWebStore) {
    const pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/mext_tracker",
      max: 4,
    });
    const db = drizzle(pool, { schema: t.schema });
    g.__mextWebStore = new WebStore(pool, db);
  }
  return g.__mextWebStore;
}
