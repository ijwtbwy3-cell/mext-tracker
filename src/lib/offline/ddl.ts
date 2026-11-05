/**
 * DDL офлайн-SQLite (sql.js). Имена таблиц и колонок — 1-в-1 со Drizzle-схемой
 * веб-сборки (src/lib/db/schema.ts). Восемь таблиц:
 *   subjects, sections, topics, progress, plan_days, tasks, diary, settings
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  short TEXT NOT NULL,
  exam TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  ord INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  ord INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  hours REAL NOT NULL,
  difficulty INTEGER NOT NULL,
  level TEXT NOT NULL,
  ord INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  topic_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plan_days (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  phase INTEGER NOT NULL,
  kind TEXT NOT NULL,
  budget_min INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  day_id INTEGER NOT NULL,
  subject_id TEXT,
  topic_id TEXT,
  topic_ids TEXT NOT NULL,
  exam_key TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  ord INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  done_at TEXT,
  spent_min INTEGER,
  awarded_xp INTEGER NOT NULL DEFAULT 0,
  awarded_coins INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS diary (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  mood INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/** Данные пользователя, которые НЕ трогает пересеивание контента. */
export const USER_TABLES = ["progress", "diary"] as const;

/** Таблицы контента (пересеиваются при смене CURRICULUM_VERSION). */
export const CONTENT_TABLES = ["tasks", "plan_days", "topics", "sections", "subjects"] as const;
