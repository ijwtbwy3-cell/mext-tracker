"use client";

/**
 * Фокус-таймер: считает остаток по сохранённой сессии
 * (elapsedMs + startedAt), поэтому переживает перезагрузку, а
 * пауза «замораживает» остаток до следующего захода.
 */

import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "./ui";
import { PixelIcon } from "./PixelIcon";
import {
  elapsedMsTotal,
  formatClock,
  isPaused,
  remainingMs,
  totalMs,
  type FocusSession,
} from "@/lib/focus";

export function FocusTimer({
  session,
  onFinish,
  onCancel,
  onPause,
  onResume,
  busy = false,
  compact = false,
  reward,
}: {
  session: FocusSession;
  onFinish: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  onPause: () => void | Promise<void>;
  onResume: () => void | Promise<void>;
  busy?: boolean;
  compact?: boolean;
  reward?: { xp: number; coins: number };
}) {
  const paused = isPaused(session);
  const [left, setLeft] = useState(() => remainingMs(session));
  const finished = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLeft(remainingMs(session));
    if (paused) {
      // на паузе ничего не тикает и не засчитывается
      finished.current = false;
      return;
    }
    finished.current = false;
    const id = window.setInterval(() => {
      const rest = remainingMs(session);
      setLeft(rest);
      if (rest <= 0 && !finished.current) {
        finished.current = true;
        Promise.resolve(onFinish()).catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
          finished.current = false;
        });
      }
    }, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, session.startedAt, session.elapsedMs, session.minutes]);

  const total = totalMs(session);
  const elapsed = Math.min(total, elapsedMsTotal(session));
  const accent = paused ? "var(--color-orange)" : "var(--color-violet-2)";

  return (
    <div
      className="pixel-panel-2 px-2.5 py-2 flex flex-col gap-1.5"
      style={{ borderColor: accent, background: "var(--color-void)", minWidth: compact ? 168 : 200 }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider" style={{ color: accent }}>
          <PixelIcon name={paused ? "pause" : "clock"} size={9} color={accent} />
          {paused ? "Пауза" : "Фокус"}
        </span>
        <b className="text-sm tabular-nums" style={{ color: left > 0 ? "var(--color-ink)" : "var(--color-neon)" }}>
          {formatClock(left)}
        </b>
      </div>

      <ProgressBar value={elapsed} max={total} segments={compact ? 10 : 16} tone={paused ? "gold" : "gold"} />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px]" style={{ color: "var(--color-dim)" }}>
          {paused
            ? `осталось ${formatClock(left)} · ждёт продолжения`
            : left > 0
              ? `${session.minutes} мин всего`
              : "Готово, засчитываем…"}
          {reward ? ` · +${reward.xp} XP` : ""}
        </span>
        <span className="flex items-center gap-1">
          <button
            className="pixel-chip cursor-pointer"
            style={{ color: accent, borderColor: accent }}
            disabled={busy}
            onClick={() => void (paused ? onResume() : onPause())}
            title={paused ? "Продолжить с того же места" : "Поставить на паузу — остаток сохранится"}
          >
            <PixelIcon name={paused ? "play" : "pause"} size={8} color={accent} />
            {paused ? "Продолжить" : "Пауза"}
          </button>
          <button
            className="pixel-chip cursor-pointer"
            style={{ color: "var(--color-rose)", borderColor: "var(--color-rose)" }}
            disabled={busy}
            onClick={() => void onCancel()}
            title="Прервать фокус — прогресс не засчитывается"
          >
            <PixelIcon name="cross" size={8} color="var(--color-rose)" /> Прервать
          </button>
        </span>
      </div>

      {error ? (
        <span className="text-[10px]" style={{ color: "var(--color-rose)" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
