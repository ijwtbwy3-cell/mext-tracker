"use client";

/**
 * Общая оболочка ОБЕИХ сборок: проверка входа, загрузка состояния (bootstrap),
 * контекст с мутациями, шапка, CRT-оверлей и нижний таббар.
 * Web: обычные fetch на Next API. Offline: тот же fetch уводит fetch-bridge в SQLite.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "@/lib/api";
import { parseInventory, parseProfile, type Inventory, type Profile, type ShopSlot } from "@/lib/shop";
import { parseFocus, type FocusKind, type FocusMap } from "@/lib/focus";
import type { BackupV1, BootstrapPayload, CompleteTaskResult, DiaryRow, TopicStatus } from "@/lib/types";
import Link from "next/link";
import { CRT } from "./CRT";
import { PixelAvatar } from "./PixelAvatar";
import { TabBar } from "./TabBar";
import { PixelIcon } from "./PixelIcon";
import { LoginScreen } from "@/screens/LoginScreen";

type AppContextValue = {
  data: BootstrapPayload;
  /** Профиль, инвентарь и фокус-сессии выводятся из settings. */
  profile: Profile;
  inventory: Inventory;
  focus: FocusMap;
  /** Монеты с учётом трат в магазине. */
  coinsBalance: number;
  coinsSpent: number;
  saveProfile: (patch: { username?: string; bio?: string; avatar?: string }) => Promise<Profile | null>;
  buyItem: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
  equipItem: (slot: ShopSlot, itemId: string) => Promise<void>;
  startFocus: (input: { kind: FocusKind; id: string; minutes: number; title?: string }) => Promise<void>;
  cancelFocus: (kind: FocusKind, id: string) => Promise<void>;
  pauseFocus: (kind: FocusKind, id: string) => Promise<void>;
  resumeFocus: (kind: FocusKind, id: string) => Promise<void>;
  finishFocus: (
    kind: FocusKind,
    id: string,
  ) => Promise<{ ok: boolean; error?: string; reward?: { xp: number; coins: number } }>;
  busy: boolean;
  refresh: () => Promise<void>;
  completeTask: (taskId: string, spentMin?: number) => Promise<CompleteTaskResult | null>;
  reopenTask: (taskId: string) => Promise<void>;
  setTopicStatus: (topicId: string, status: TopicStatus) => Promise<void>;
  addDiary: (entry: { date: string; mood: number; text: string }) => Promise<void>;
  updateDiary: (id: string, patch: { date?: string; mood?: number; text?: string }) => Promise<void>;
  deleteDiary: (id: string) => Promise<void>;
  setSetting: (key: string, value: string) => Promise<void>;
  backup: () => Promise<BackupV1>;
  restore: (b: BackupV1) => Promise<void>;
  resetProgress: () => Promise<void>;
  logout: () => Promise<void>;
};

const AppCtx = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp вне AppShell");
  return ctx;
}

type Phase = "boot" | "login" | "ready" | "error";

export function AppShell({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("boot");
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const d = await api.bootstrap();
    setData(d);
    setPhase("ready");
  }, []);

  const boot = useCallback(async () => {
    try {
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setPhase("login");
      } else {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    }
  }, [refresh]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const withBusy = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<AppContextValue | null>(() => {
    if (!data) return null;
    const profile = parseProfile(data.settings.profile);
    const inventory = parseInventory(data.settings.inventory);
    const focus = parseFocus(data.settings.focusSessions);
    const coinsSpent = Math.max(0, Number(data.settings.shopSpent) || 0);
    return {
      data,
      profile,
      inventory,
      focus,
      coinsSpent,
      coinsBalance: Math.max(0, data.totals.coins - coinsSpent),
      busy,
      refresh: () => refresh(),
      completeTask: (taskId, spentMin) =>
        (async () => {
          let result: CompleteTaskResult | null = null;
          await withBusy(async () => {
            result = await api.completeTask(taskId, spentMin);
            await refresh();
          });
          return result;
        })(),
      reopenTask: (taskId) =>
        withBusy(async () => {
          await api.reopenTask(taskId);
          await refresh();
        }),
      setTopicStatus: (topicId, status) =>
        withBusy(async () => {
          await api.setTopicStatus(topicId, status);
          await refresh();
        }),
      addDiary: (entry) =>
        withBusy(async () => {
          await api.addDiary(entry);
          await refresh();
        }),
      updateDiary: (id, patch) =>
        withBusy(async () => {
          await api.updateDiary(id, patch);
          await refresh();
        }),
      deleteDiary: (id) =>
        withBusy(async () => {
          await api.deleteDiary(id);
          await refresh();
        }),
      setSetting: (key, v) =>
        withBusy(async () => {
          await api.setSetting(key, v);
          await refresh();
        }),
      backup: () => api.backup(),
      restore: (b) =>
        withBusy(async () => {
          await api.restore(b);
          await refresh();
        }),
      resetProgress: () =>
        withBusy(async () => {
          await api.reset();
          await refresh();
        }),
      saveProfile: (patch) =>
        (async () => {
          let next: Profile | null = null;
          await withBusy(async () => {
            next = (await api.saveProfile(patch)).profile;
            await refresh();
          });
          return next;
        })(),
      buyItem: (itemId) =>
        (async () => {
          let result: { ok: boolean; error?: string } = { ok: false };
          await withBusy(async () => {
            try {
              await api.buyItem(itemId);
              result = { ok: true };
            } catch (e) {
              result = { ok: false, error: e instanceof Error ? e.message : String(e) };
            }
            await refresh();
          });
          return result;
        })(),
      equipItem: (slot, itemId) =>
        withBusy(async () => {
          await api.equipItem(slot, itemId);
          await refresh();
        }),
      startFocus: (input) =>
        withBusy(async () => {
          await api.startFocus(input);
          await refresh();
        }),
      cancelFocus: (kind, id) =>
        withBusy(async () => {
          await api.cancelFocus(kind, id);
          await refresh();
        }),
      pauseFocus: (kind, id) =>
        withBusy(async () => {
          await api.pauseFocus(kind, id);
          await refresh();
        }),
      resumeFocus: (kind, id) =>
        withBusy(async () => {
          await api.resumeFocus(kind, id);
          await refresh();
        }),
      finishFocus: (kind, id) =>
        (async () => {
          let result: { ok: boolean; error?: string; reward?: { xp: number; coins: number } } = { ok: false };
          await withBusy(async () => {
            try {
              const res = await api.finishFocus(kind, id);
              result = { ok: true, reward: res.result.reward };
            } catch (e) {
              result = { ok: false, error: e instanceof Error ? e.message : String(e) };
            }
            await refresh();
          });
          return result;
        })(),
      logout: async () => {
        await api.logout();
        setPhase("login");
      },
    };
  }, [data, busy, refresh, withBusy]);

  /* ─────────── состояния ─────────── */

  if (phase === "boot") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-4 h-4"
              style={{
                background: "var(--color-violet)",
                border: "2px solid var(--color-edge)",
                animation: `blink 0.9s steps(1,end) ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
        <p className="text-sm uppercase tracking-[0.3em]" style={{ color: "var(--color-dim)" }}>
          Загрузка данных<span className="pixel-blink">...</span>
        </p>
        <style>{`@keyframes blink{0%,60%{opacity:1}61%,100%{opacity:.2}}`}</style>
      </div>
    );
  }

  if (phase === "login") {
    return <LoginScreen onSuccess={() => void boot()} />;
  }

  if (phase === "error" || !value) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <div className="pixel-panel p-6 max-w-md w-full text-center">
          <PixelIcon name="cross" size={32} color="var(--color-rose)" />
          <h1 className="text-lg font-bold mt-3">Ошибка запуска</h1>
          <p className="text-sm mt-2 break-words" style={{ color: "var(--color-dim)" }}>
            {error || "Неизвестная ошибка"}
          </p>
          <button className="pixel-btn mt-4" onClick={() => void boot()}>
            Повторить
          </button>
        </div>
      </div>
    );
  }

  const crtOn = value.data.settings.crt !== "off";

  return (
    <AppCtx.Provider value={value}>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
        <header
          className="border-b-2 sticky top-0 z-30"
          style={{ background: "var(--color-panel)", borderColor: "var(--color-edge)" }}
        >
          <div className="mx-auto max-w-3xl px-3 py-2 flex items-center justify-between gap-3">
            <Link href="/profile" className="flex items-center gap-2 min-w-0 cursor-pointer" title="Профиль и магазин">
              <PixelAvatar avatar={value.profile.avatar} frame={value.profile.frame} size={30} glow={false} />
              <span className="min-w-0">
                <strong className="block text-[13px] tracking-widest uppercase truncate">
                  {value.profile.username}
                </strong>
                <span className="block text-[9px] uppercase tracking-wider truncate" style={{ color: "var(--color-dim)" }}>
                  Профиль · магазин
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-3 text-xs" style={{ color: "var(--color-dim)" }}>
              <span className="flex items-center gap-1" title="XP">
                <PixelIcon name="bolt" size={11} color="var(--color-violet-2)" />
                <b style={{ color: "var(--color-ink)" }}>{value.data.totals.xp}</b>
              </span>
              <span className="flex items-center gap-1" title="Монеты (с учётом трат)">
                <PixelIcon name="coin" size={11} color="var(--color-gold)" />
                <b style={{ color: "var(--color-ink)" }}>{value.coinsBalance}</b>
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-3xl px-3 pt-4 pb-28">{children}</main>

        <TabBar />
        {crtOn ? <CRT /> : null}
      </div>
    </AppCtx.Provider>
  );
}

export type { DiaryRow };
