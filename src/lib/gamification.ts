/**
 * Геймификация — точные формулы наград.
 *
 *   XP      = round(минуты × 0.4)
 *   Монеты  = round(минуты / 4)
 *   +25 XP  за пробник
 *   +30 XP  за повторение
 */

import type { TaskType } from "./plan-generator";

export const XP_PER_MINUTE = 0.4;
export const COINS_DIVISOR = 4;
export const MOCK_BONUS_XP = 25;
export const REVIEW_BONUS_XP = 30;

export type Reward = { xp: number; coins: number };

/** Награда за выполненное задание (minutes — фактически потраченные или плановые минуты). */
export function taskReward(minutes: number, type: TaskType): Reward {
  const safe = Math.max(0, Math.round(minutes));
  let xp = Math.round(safe * XP_PER_MINUTE);
  if (type === "mock") xp += MOCK_BONUS_XP;
  if (type === "review") xp += REVIEW_BONUS_XP;
  const coins = Math.round(safe / COINS_DIVISOR);
  return { xp, coins };
}

/** Награда «в прогоне» для предпросмотра на карточке (по плановым минутам). */
export function previewReward(minutes: number, type: TaskType): Reward {
  return taskReward(minutes, type);
}
