/**
 * Drizzle-схема PostgreSQL для веб-сборки.
 * 8 таблиц (имена колонок — те же, что в офлайн-SQLite, см. src/lib/offline/ddl.ts):
 *   subjects, sections, topics, progress, plan_days, tasks, diary, settings
 *
 * Сознательно без FK-ограничений: контент может пересеиваться при обновлении
 * CURRICULUM_VERSION, а данные пользователя (progress, diary) сохраняются.
 */
import { pgTable, text, integer, real, timestamp, date } from "drizzle-orm/pg-core";

export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  short: text("short").notNull(),
  exam: text("exam").notNull(),
  color: text("color").notNull(),
  icon: text("icon").notNull(),
  ord: integer("ord").notNull(),
});

export const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  title: text("title").notNull(),
  ord: integer("ord").notNull(),
});

export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  sectionId: text("section_id").notNull(),
  subjectId: text("subject_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  hours: real("hours").notNull(),
  difficulty: integer("difficulty").notNull(),
  level: text("level").notNull(),
  ord: integer("ord").notNull(),
});

export const progress = pgTable("progress", {
  topicId: text("topic_id").primaryKey(),
  status: text("status").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const planDays = pgTable("plan_days", {
  id: integer("id").primaryKey(),
  date: date("date").notNull(),
  phase: integer("phase").notNull(),
  kind: text("kind").notNull(),
  budgetMin: integer("budget_min").notNull(),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  dayId: integer("day_id").notNull(),
  subjectId: text("subject_id"),
  topicId: text("topic_id"),
  topicIds: text("topic_ids").notNull(),
  examKey: text("exam_key"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  minutes: integer("minutes").notNull(),
  ord: integer("ord").notNull(),
  status: text("status").notNull(),
  doneAt: timestamp("done_at", { withTimezone: true, mode: "string" }),
  spentMin: integer("spent_min"),
  awardedXp: integer("awarded_xp").notNull(),
  awardedCoins: integer("awarded_coins").notNull(),
});

export const diary = pgTable("diary", {
  id: text("id").primaryKey(),
  date: date("date").notNull(),
  mood: integer("mood").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const schema = { subjects, sections, topics, progress, planDays, tasks, diary, settings };
