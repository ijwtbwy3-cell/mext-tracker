/**
 * Фокус-режим: задание или тема засчитываются только после того, как
 * таймер на запланированное время дошёл до нуля.
 *
 * Сессия хранится в settings (JSON), поэтому:
 *   • таймер продолжает идти после перезагрузки и переключения экранов;
 *   • пауза сохраняется — при следующем заходе остаток будет тем же,
 *     что и в момент нажатия «Пауза».
 *
 * Модель времени: `elapsedMs` (накопленное «отсиженное») + `startedAt`
 * (старт текущего отрезка). На паузе `startedAt = null`, и остаток
 * считается как total − elapsedMs, то есть «замирает».
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
  /** Сколько уже натикало (мс). На паузе значение заморожено. */
  elapsedMs: number;
  /** Старт текущего отрезка; null — сессия на паузе. */
  startedAt: number | null;
  /** Когда нажали «Пауза» (для подписи в интерфейсе). */
  pausedAt?: number;
  title?: string;
};

export type FocusMap = Record<string, FocusSession>;

export function focusKey(kind: FocusKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Разбор сессий из settings. Поддерживает старый формат (только startedAt):
 * такая сессия считается запущенной с этого момента, elapsedMs = 0.
 */
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
    const v = value as Partial<FocusSession> & { startedAt?: number | null };
    if (typeof v?.id !== "string" || typeof v?.minutes !== "number") continue;
    const kind: FocusKind = v.kind === "topic" ? "topic" : "task";
    const startedAt = typeof v.startedAt === "number" ? Math.round(v.startedAt) : null;
    out[key] = {
      kind,
      id: v.id,
      minutes: Math.max(0, Math.round(v.minutes)),
      elapsedMs: typeof v.elapsedMs === "number" ? Math.max(0, Math.round(v.elapsedMs)) : 0,
      startedAt,
      pausedAt: typeof v.pausedAt === "number" ? Math.round(v.pausedAt) : undefined,
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

export function isPaused(session: FocusSession): boolean {
  return session.startedAt === null;
}

/** Сколько уже прошло с учётом текущего отрезка (на паузе — заморожено). */
export function elapsedMsTotal(session: FocusSession, now: number = Date.now()): number {
  const running = session.startedAt === null ? 0 : Math.max(0, now - session.startedAt);
  return Math.min(totalMs(session), session.elapsedMs + running);
}

export function remainingMs(session: FocusSession, now: number = Date.now()): number {
  return Math.max(0, totalMs(session) - elapsedMsTotal(session, now));
}

export function isFinished(session: FocusSession, now: number = Date.now()): boolean {
  return remainingMs(session, now) <= 0;
}

/** Поставить на паузу: накопленное фиксируется, отрезок останавливается. */
export function pauseSession(session: FocusSession, now: number = Date.now()): FocusSession {
  if (isPaused(session)) return session;
  return { ...session, elapsedMs: elapsedMsTotal(session, now), startedAt: null, pausedAt: now };
}

/** Продолжить с того же места: новый отрезок стартует сейчас. */
export function resumeSession(session: FocusSession, now: number = Date.now()): FocusSession {
  if (!isPaused(session)) return session;
  return { ...session, startedAt: now, pausedAt: undefined };
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
