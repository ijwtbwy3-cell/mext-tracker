/**
 * Фокус-режим: задание или тема засчитываются только после того, как
 * таймер на запланированное время дошёл до нуля.
 *
 * Сессии хранятся в settings (JSON), поэтому таймер продолжает идти при
 * перезагрузке страницы и переключении экранов: считается по startedAt.
 */

import { COINS_DIVISOR, XP_PER_MINUTE, taskReward } from "./gamification";
import type { TaskType } from "./plan-generator";

export const FOCUS_KEY = "focusSessions";

export type FocusKind = "task" | "topic";

export type FocusSession = {
  kind: FocusKind;
  id: string;
  /** Плановая длительность в минутах — её и надо «отсидеть». */
  minutes: number;
  /** Момент старта, epoch ms. */
  startedAt: number;
  title?: string;
};

export type FocusMap = Record<string, FocusSession>;

export function focusKey(kind: FocusKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseFocus(raw?: string | null): FocusMap {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== "object") return {};
  const out: FocusMap = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const v = value as Partial<FocusSession>;
    if (typeof v?.id !== "string" || typeof v?.minutes !== "number" || typeof v?.startedAt !== "number") continue;
    const kind: FocusKind = v.kind === "topic" ? "topic" : "task";
    out[key] = {
      kind,
      id: v.id,
      minutes: Math.max(0, Math.round(v.minutes)),
      startedAt: Math.round(v.startedAt),
      title: typeof v.title === "string" ? v.title : undefined,
    };
  }
  return out;
}

export function serializeFocus(map: FocusMap): string {
  return JSON.stringify(map);
}

export function totalMs(session: FocusSession): number {
  return session.minutes * 60_000;
}

export function remainingMs(session: FocusSession, now: number = Date.now()): number {
  return Math.max(0, session.startedAt + totalMs(session) - now);
}

export function isFinished(session: FocusSession, now: number = Date.now()): boolean {
  return remainingMs(session, now) <= 0;
}

/** 12:34 или 1:05:09 для длинных сессий. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** «54 мин», «2 ч 05 мин». */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} ч` : `${h} ч ${String(rest).padStart(2, "0")} мин`;
}

/** Минуты темы: в контенте часы, в фокусе — минуты. */
export function topicMinutes(hours: number): number {
  return Math.max(1, Math.round(hours * 60));
}

/** Награда, которую даст завершённая фокус-сессия задания (по плановым минутам). */
export function taskFocusReward(minutes: number, type: TaskType) {
  return taskReward(minutes, type);
}

/** Награда за тему, закрытую фокус-таймером: те же 0.4 XP и 0.25 монеты за минуту. */
export function topicFocusReward(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  return { xp: Math.round(safe * XP_PER_MINUTE), coins: Math.round(safe / COINS_DIVISOR) };
}

