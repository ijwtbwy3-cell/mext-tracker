"use client";

/**
 * Экран «Расписание»: недельный режим дня (Пн–Вс) и этапы подготовки —
 * перенос личного расписания пользователя в стиль трекера.
 * По умолчанию открывается сегодняшний день недели.
 */

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppShell";
import { Chip, SectionTitle } from "@/components/ui";
import { PixelIcon } from "@/components/PixelIcon";
import {
  CAT_COLORS,
  CAT_LEGEND,
  SCHEDULE_SUBTITLE,
  STAGES,
  WEEK,
  type ScheduleCat,
} from "@/lib/day-schedule";
import { todayISO, weekdayIndex, WEEKDAYS_LONG } from "@/lib/dates";

const TAB_LABELS = [...WEEK.map((w) => w.short), "Этапы"];

export function ScheduleScreen() {
  const { data } = useApp();
  const { planDays, tasks, settings } = data;

  const today = todayISO();
  const [tab, setTab] = useState<number>(() => weekdayIndex(today)); // 0..6 = Пн..Вс, 7 = Этапы

  /* связка с планом: что сегодня по трекеру */
  const todayStats = useMemo(() => {
    const exact = planDays.find((d) => d.date === today);
    const before = planDays.filter((d) => d.date <= today);
    const day = exact ?? (before.length > 0 ? before[before.length - 1] : planDays[0]);
    const dayTasks = tasks.filter((t) => t.dayId === day?.id);
    return {
      done: dayTasks.filter((t) => t.status === "done").length,
      total: dayTasks.length,
      minutes: dayTasks.reduce((s, t) => s + t.minutes, 0),
    };
  }, [planDays, tasks, today]);

  const start = settings.startDate ?? "2026-11-04";

  return (
    <div className="flex flex-col gap-5">
      {/* ─── шапка ─── */}
      <div className="pixel-panel p-4">
        <SectionTitle icon="clock">Расписание</SectionTitle>
        <b className="block text-sm" style={{ color: "var(--color-ink)" }}>
          MEXT 2028: план подготовки
        </b>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--color-dim)" }}>
          {SCHEDULE_SUBTITLE}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Chip color="var(--color-gold)">
            Сегодня · {WEEKDAYS_LONG[weekdayIndex(today)]}
          </Chip>
          <Chip color="var(--color-violet-2)">
            Задачи {todayStats.done}/{todayStats.total}
          </Chip>
          <Chip color="var(--color-cyan)">Бюджет {todayStats.minutes} мин</Chip>
          <Chip>День 1 — {start}</Chip>
        </div>
      </div>

      {/* ─── вкладки дней + этапы ─── */}
      <div className="flex flex-wrap gap-2">
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            className="pixel-chip cursor-pointer"
            style={{
              background: tab === i ? "var(--color-violet)" : undefined,
              color: tab === i ? "#fff" : undefined,
            }}
            onClick={() => setTab(i)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── содержимое ─── */}
      {tab < 7 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-widest" style={{ color: "var(--color-dim)" }}>
            {WEEK[tab].long} · {CAT_LEGEND}
          </p>
          {WEEK[tab].rows.map((row, i) => {
            const color = CAT_COLORS[row.cat as ScheduleCat];
            const dim = row.cat === "rest";
            return (
              <div
                key={`${row.time}-${i}`}
                className="pixel-panel px-3 py-2.5 flex items-start gap-3"
                style={dim ? { opacity: 0.85 } : undefined}
              >
                <span
                  className="block w-2.5 h-2.5 mt-1 shrink-0"
                  style={{ background: color, border: "2px solid #00000055" }}
                />
                <span
                  className="shrink-0 w-[84px] text-[11px] font-bold leading-5"
                  style={{ color, fontVariantNumeric: "tabular-nums" }}
                >
                  {row.time}
                </span>
                <span className="min-w-0 flex-1">
                  <b
                    className="block text-sm leading-5"
                    style={{ color: dim ? "var(--color-dim)" : "var(--color-ink)" }}
                  >
                    {row.title}
                  </b>
                  {row.note ? (
                    <span className="block text-xs mt-0.5 leading-4" style={{ color: "var(--color-dim)" }}>
                      {row.note}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {STAGES.map((stage) => (
            <div key={stage.title} className="pixel-panel p-4">
              <div className="flex items-center gap-2 mb-2">
                <PixelIcon name="flag" size={14} color="var(--color-gold)" />
                <b className="text-sm uppercase tracking-wide" style={{ color: "var(--color-violet-2)" }}>
                  {stage.title}
                </b>
              </div>
              <ul className="flex flex-col gap-1.5">
                {stage.items.map((item) => (
                  <li key={item} className="flex gap-2 text-[13px] leading-5">
                    <span
                      className="block w-1.5 h-1.5 mt-1.5 shrink-0"
                      style={{ background: "var(--color-violet-2)" }}
                    />
                    <span style={{ color: "var(--color-ink)" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
