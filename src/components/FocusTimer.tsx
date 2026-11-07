"use client";

/**
 * Фокус-таймер: показывает остаток по startedAt (переживает перезагрузку),
 * по нулю сам вызывает onFinish — только тогда задание/тема засчитываются.
 */

import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "./ui";
import { PixelIcon } from "./PixelIcon";
import { formatClock, remainingMs, totalMs, type FocusSession } from "@/lib/focus";

export function FocusTimer({
  session,
  onFinish,
  onCancel,
  busy = false,
  compact = false,
  reward,
}: {
  session: FocusSession;
  onFinish: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  busy?: boolean;
  compact?: boolean;
  reward?: { xp: number; coins: number };
}) {
  const [left, setLeft] = useState(() => remainingMs(session));
  const finished = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    finished.current = false;
    setLeft(remainingMs(session));
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
  }, [session.id, session.startedAt, session.minutes]);

  const total = totalMs(session);
  const elapsed = Math.max(0, total - left);

  return (
    <div
      className="pixel-panel-2 px-2.5 py-2 flex flex-col gap-1.5"
      style={{ borderColor: "var(--color-violet-2)", background: "var(--color-void)", minWidth: compact ? 150 : 190 }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--color-violet-2)" }}>
          <PixelIcon name="clock" size={9} color="var(--color-violet-2)" />
          Фокус
        </span>
        <b className="text-sm tabular-nums" style={{ color: left > 0 ? "var(--color-ink)" : "var(--color-neon)" }}>
          {formatClock(left)}
        </b>
      </div>

      <ProgressBar value={elapsed} max={total} segments={compact ? 10 : 16} tone="gold" />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px]" style={{ color: "var(--color-dim)" }}>
          {left > 0 ? `${session.minutes} мин всего` : "Готово, засчитываем…"}
          {reward ? ` · +${reward.xp} XP` : ""}
        </span>
        <button
          className="pixel-chip cursor-pointer"
          style={{ color: "var(--color-rose)", borderColor: "var(--color-rose)" }}
          disabled={busy}
          onClick={() => void onCancel()}
          title="Прервать фокус — прогресс не засчитывается"
        >
          <PixelIcon name="cross" size={8} color="var(--color-rose)" /> Прервать
        </button>
      </div>

      {error ? (
        <span className="text-[10px]" style={{ color: "var(--color-rose)" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
