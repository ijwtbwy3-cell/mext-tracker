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
import type { BackupV1, BootstrapPayload, CompleteTaskResult, DiaryRow, TopicStatus } from "@/lib/types";
import { CRT } from "./CRT";
import { TabBar } from "./TabBar";
import { PixelIcon } from "./PixelIcon";
import { LoginScreen } from "@/screens/LoginScreen";

type AppContextValue = {
  data: BootstrapPayload;
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
    return {
      data,
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
            <div className="flex items-center gap-2 min-w-0">
              <PixelIcon name="star" size={16} color="var(--color-gold)" />
              <strong className="text-sm tracking-widest uppercase truncate">
                MEXT <span style={{ color: "var(--color-violet-2)" }}>Трекер</span>
              </strong>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: "var(--color-dim)" }}>
              <span className="flex items-center gap-1" title="XP">
                <PixelIcon name="bolt" size={11} color="var(--color-violet-2)" />
                <b style={{ color: "var(--color-ink)" }}>{value.data.totals.xp}</b>
              </span>
              <span className="flex items-center gap-1" title="Монеты">
                <PixelIcon name="coin" size={11} color="var(--color-gold)" />
                <b style={{ color: "var(--color-ink)" }}>{value.data.totals.coins}</b>
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
