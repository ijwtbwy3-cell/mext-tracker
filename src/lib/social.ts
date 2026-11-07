/**
 * Профиль, магазин и фокус-режим — общий сервисный слой.
 *
 * Один и тот же код вызывают и веб-маршруты Next.js (PostgreSQL),
 * и офлайн-мост fetch-bridge (SQLite WASM): хранилище передаётся как
 * минимальный интерфейс SocialStore.
 */

import {
  DEFAULT_INVENTORY,
  DEFAULT_PROFILE,
  INVENTORY_KEY,
  PROFILE_KEY,
  SPENT_KEY,
  TOPIC_FOCUS_KEY,
  addToInventory,
  findItem,
  ownedList,
  parseInventory,
  parseProfile,
  sanitizeProfile,
  withEquipped,
  type Inventory,
  type Profile,
  type ShopItem,
  type ShopSlot,
} from "./shop";
import {
  FOCUS_KEY,
  focusKey,
  isFinished,
  isPaused,
  parseFocus,
  pauseSession,
  remainingMs,
  resumeSession,
  serializeFocus,
  topicFocusReward,
  type FocusKind,
  type FocusMap,
  type FocusSession,
} from "./focus";
import type { CompleteTaskResult, SettingsMap, TopicStatus } from "./types";

export type SocialStore = {
  /** В офлайн-хранилище чтение синхронное — допускаем оба варианта. */
  getSetting(key: string): Promise<string | null> | string | null;
  setSetting(key: string, value: string): Promise<void>;
  earnedCoins(): Promise<number>;
  completeTask(taskId: string, spentMin?: number): Promise<CompleteTaskResult>;
  setTopicStatus(topicId: string, status: TopicStatus): Promise<void>;
};

export class SocialError extends Error {}

/* ─────────────────────────── чтение состояния ─────────────────────────── */

export async function readProfile(store: SocialStore): Promise<Profile> {
  return parseProfile(await store.getSetting(PROFILE_KEY));
}

export async function readInventory(store: SocialStore): Promise<Inventory> {
  return parseInventory(await store.getSetting(INVENTORY_KEY));
}

export async function readFocus(store: SocialStore): Promise<FocusMap> {
  return parseFocus(await store.getSetting(FOCUS_KEY));
}

/** { topicId: минуты } — темы, закрытые фокус-таймером. */
export function parseTopicFocus(raw?: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = Math.round(v);
    }
    return out;
  } catch {
    return {};
  }
}

/** XP и монеты за темы, изученные через фокус-таймер. */
export function topicFocusBonus(raw?: string | null): { xp: number; coins: number } {
  const map = parseTopicFocus(raw);
  let xp = 0;
  let coins = 0;
  for (const minutes of Object.values(map)) {
    const r = topicFocusReward(minutes);
    xp += r.xp;
    coins += r.coins;
  }
  return { xp, coins };
}

/** Добавляет к тоталам награды за темы, закрытые таймером. */
export function applySocialTotals<T extends { xp: number; coins: number }>(totals: T, settings: SettingsMap): T {
  const bonus = topicFocusBonus(settings[TOPIC_FOCUS_KEY]);
  return { ...totals, xp: totals.xp + bonus.xp, coins: totals.coins + bonus.coins };
}

export async function coinsState(
  store: SocialStore,
): Promise<{ earned: number; bonus: number; spent: number; balance: number }> {
  const earned = await store.earnedCoins();
  const bonus = topicFocusBonus(await store.getSetting(TOPIC_FOCUS_KEY)).coins;
  const spent = Math.max(0, Number(await store.getSetting(SPENT_KEY)) || 0);
  const balance = Math.max(0, earned + bonus - spent);
  return { earned, bonus, spent, balance };
}

/* ─────────────────────────── профиль ─────────────────────────── */

export async function saveProfile(
  store: SocialStore,
  patch: Partial<Pick<Profile, "username" | "bio" | "avatar">>,
): Promise<Profile> {
  const current = await readProfile(store);
  const next = sanitizeProfile({ ...current, ...patch });
  if (patch.avatar) {
    const ok = next.avatar === patch.avatar;
    if (!ok) throw new SocialError("Аватар: используйте пресет или PNG/JPG до 1 МБ");
  }
  await store.setSetting(PROFILE_KEY, JSON.stringify(next));
  return next;
}

/* ─────────────────────────── магазин ─────────────────────────── */

export async function buyItem(
  store: SocialStore,
  itemId: string,
): Promise<{ profile: Profile; inventory: Inventory; balance: number; item: ShopItem }> {
  const item = findItem(itemId);
  if (!item) throw new SocialError("Такого товара нет");
  if (item.price <= 0) throw new SocialError("Этот предмет уже доступен всем");
  const inventory = await readInventory(store);
  if (ownedList(inventory, item.slot).includes(item.id)) throw new SocialError("Уже куплено");
  const { balance } = await coinsState(store);
  if (balance < item.price) {
    throw new SocialError(`Не хватает ${item.price - balance} монет`);
  }
  const spent = Math.max(0, Number(await store.getSetting(SPENT_KEY)) || 0) + item.price;
  await store.setSetting(SPENT_KEY, String(spent));
  const nextInv = addToInventory(inventory, item);
  await store.setSetting(INVENTORY_KEY, JSON.stringify(nextInv));
  const profile = await readProfile(store);
  return { profile, inventory: nextInv, balance: balance - item.price, item };
}

export async function equipItem(
  store: SocialStore,
  slot: ShopSlot,
  itemId: string,
): Promise<Profile> {
  const item = findItem(itemId);
  if (!item || item.slot !== slot) throw new SocialError("Такого предмета нет");
  const inventory = await readInventory(store);
  if (!ownedList(inventory, slot).includes(itemId)) throw new SocialError("Предмет не куплен");
  const profile = withEquipped(await readProfile(store), slot, itemId);
  await store.setSetting(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

/* ─────────────────────────── фокус-режим ─────────────────────────── */

export async function startFocus(
  store: SocialStore,
  input: { kind: FocusKind; id: string; minutes: number; title?: string },
): Promise<FocusSession> {
  const minutes = Math.max(0, Math.round(input.minutes));
  if (!input.id) throw new SocialError("Не указан объект фокуса");
  const map = await readFocus(store);
  const key = focusKey(input.kind, input.id);
  const existing = map[key];
  if (existing) return existing; // уже идёт — не сбрасываем прогресс
  const session: FocusSession = {
    kind: input.kind,
    id: input.id,
    minutes,
    elapsedMs: 0,
    startedAt: Date.now(),
    title: input.title,
  };
  map[key] = session;
  await store.setSetting(FOCUS_KEY, serializeFocus(map));
  return session;
}

export async function cancelFocus(store: SocialStore, kind: FocusKind, id: string): Promise<void> {
  const map = await readFocus(store);
  const key = focusKey(kind, id);
  if (!map[key]) return;
  delete map[key];
  await store.setSetting(FOCUS_KEY, serializeFocus(map));
}

async function patchFocus(
  store: SocialStore,
  kind: FocusKind,
  id: string,
  patch: (session: FocusSession, now: number) => FocusSession,
  now: number,
): Promise<FocusSession> {
  const map = await readFocus(store);
  const key = focusKey(kind, id);
  const session = map[key];
  if (!session) throw new SocialError("Таймер не запущен");
  const next = patch(session, now);
  map[key] = next;
  await store.setSetting(FOCUS_KEY, serializeFocus(map));
  return next;
}

/** Пауза: остаток фиксируется и сохраняется между заходами. */
export async function pauseFocus(
  store: SocialStore,
  kind: FocusKind,
  id: string,
  now: number = Date.now(),
): Promise<FocusSession> {
  return patchFocus(store, kind, id, (session, at) => pauseSession(session, at), now);
}

/** Продолжить с того же места. */
export async function resumeFocus(
  store: SocialStore,
  kind: FocusKind,
  id: string,
  now: number = Date.now(),
): Promise<FocusSession> {
  return patchFocus(store, kind, id, (session, at) => resumeSession(session, at), now);
}

export type FocusFinishResult = {
  kind: FocusKind;
  id: string;
  minutes: number;
  reward: { xp: number; coins: number };
};

export async function finishFocus(
  store: SocialStore,
  kind: FocusKind,
  id: string,
  now: number = Date.now(),
): Promise<FocusFinishResult> {
  const map = await readFocus(store);
  const key = focusKey(kind, id);
  const session = map[key];
  if (!session) throw new SocialError("Таймер не запущен");
  if (!isFinished(session, now)) {
    const left = Math.ceil(remainingMs(session, now) / 1000);
    throw new SocialError(
      isPaused(session)
        ? `Таймер на паузе: осталось ${left} с — сначала продолжите`
        : `Ещё не время: осталось ${left} с`,
    );
  }

  if (kind === "task") {
    const result = await store.completeTask(id, session.minutes);
    delete map[key];
    await store.setSetting(FOCUS_KEY, serializeFocus(map));
    return { kind, id, minutes: session.minutes, reward: result.reward };
  }

  // тема: статус «изучено» + награда один раз на тему
  await store.setTopicStatus(id, "done");
  const focusRaw = await store.getSetting(TOPIC_FOCUS_KEY);
  const map2 = parseTopicFocus(focusRaw);
  map2[id] = session.minutes;
  await store.setSetting(TOPIC_FOCUS_KEY, JSON.stringify(map2));
  delete map[key];
  await store.setSetting(FOCUS_KEY, serializeFocus(map));
  return { kind, id, minutes: session.minutes, reward: topicFocusReward(session.minutes) };
}

export { DEFAULT_INVENTORY, DEFAULT_PROFILE };
