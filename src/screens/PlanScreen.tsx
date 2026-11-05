"use client";

/** Экран «План»: баннер, 4 фазы, таймлайн всех 209 дней с раскрытием заданий. */

import { useMemo, useState } from "react";
import Image from "next/image";
import banner from "@/assets/banners/plan.png";
import { useApp } from "@/components/AppShell";
import { Card, Chip, ProgressBar, SectionTitle } from "@/components/ui";
import { PixelIcon, type IconName } from "@/components/PixelIcon";
import { PHASES } from "@/lib/plan-generator";
import { formatDayMonth, formatShort, todayISO, weekdayIndex, WEEKDAYS_SHORT, diffDays } from "@/lib/dates";
import type { TaskType } from "@/lib/plan-generator";

const TYPE_COLOR: Record<TaskType, string> = {
  theory: "var(--color-cyan)",
  practice: "var(--color-violet-2)",
  review: "var(--color-neon)",
  mock: "var(--color-gold)",
};
const TYPE_ICON: Record<TaskType, IconName> = {
  theory: "book",
  practice: "pencil",
  review: "loop",
  mock: "flag",
};

export function PlanScreen() {
  const { data } = useApp();
  const { planDays, tasks, settings } = data;
  const [phaseFilter, setPhaseFilter] = useState<number>(0); // 0 = все
  const [openDay, setOpenDay] = useState<number | null>(null);

  const today = todayISO();
  const start = settings.startDate ?? "2026-11-04";

  const tasksByDay = useMemo(() => {
    const m = new Map<number, typeof tasks>();
    for (const t of tasks) {
      const arr = m.get(t.dayId) ?? [];
      arr.push(t);
      m.set(t.dayId, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.ord - b.ord);
    return m;
  }, [tasks]);

  const visibleDays = planDays.filter((d) => phaseFilter === 0 || d.phase === phaseFilter);

  const todayDay = planDays.find((d) => d.date === today);

  return (
    <div className="flex flex-col gap-5">
      {/* ─── баннер ─── */}
      <div className="pixel-panel overflow-hidden relative">
        <div className="relative w-full h-32">
          <Image
            src={banner}
            alt="Пиксельная карта плана"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            style={{ objectFit: "cover", imageRendering: "pixelated" }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(18,8,31,0.92), rgba(18,8,31,0.35))" }} />
          <div className="absolute inset-0 flex flex-col justify-center px-4">
            <h1 className="text-xl font-bold uppercase tracking-widest" style={{ textShadow: "3px 3px 0 #000" }}>
              План подготовки
            </h1>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <Chip color="var(--color-gold)">209 дней</Chip>
              <Chip color="var(--color-violet-2)">754 задания</Chip>
              <Chip color="var(--color-cyan)">4 фазы</Chip>
            </div>
          </div>
        </div>
      </div>

      {/* ─── фазы ─── */}
      <section>
        <SectionTitle icon="flag">Фазы</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {PHASES.map((p) => {
            const daysInPhase = planDays.filter((d) => d.phase === p.n);
            const ids = new Set(daysInPhase.map((d) => d.id));
            const phaseTasks = tasks.filter((t => ids.has(t.dayId)));
            const done = phaseTasks.filter((t) => t.status === "done").length;
            const first = daysInPhase[0];
            const last = daysInPhase[daysInPhase.length - 1];
            return (
              <Card key={p.n} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm uppercase tracking-wide" style={{ color: "var(--color-violet-2)" }}>
                    {p.n}. {p.name}
                  </b>
                  <Chip color="var(--color-cyan)">{p.budget} мин/день</Chip>
                </div>
                <div className="text-[11px] mt-1" style={{ color: "var(--color-dim)" }}>
                  {first ? formatShort(first.date) : ""} — {last ? formatShort(last.date) : ""} · {p.days} дней
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <ProgressBar value={done} max={phaseTasks.length} segments={14} tone={done === phaseTasks.length && phaseTasks.length > 0 ? "green" : "violet"} className="flex-1" />
                  <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--color-dim)" }}>
                    {done}/{phaseTasks.length}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ─── фильтры ─── */}
      <section>
        <SectionTitle icon="calendar">Таймлайн</SectionTitle>
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          <button
            className="pixel-chip cursor-pointer"
            style={{
              background: phaseFilter === 0 ? "var(--color-violet)" : undefined,
              color: phaseFilter === 0 ? "#fff" : undefined,
            }}
            onClick={() => setPhaseFilter(0)}
          >
            Все
          </button>
          {PHASES.map((p) => (
            <button
              key={p.n}
              className="pixel-chip cursor-pointer"
              style={{
                background: phaseFilter === p.n ? "var(--color-violet)" : undefined,
                color: phaseFilter === p.n ? "#fff" : undefined,
              }}
              onClick={() => setPhaseFilter(p.n)}
            >
              Ф{p.n} · {p.name}
            </button>
          ))}
        </div>

        {/* ─── список дней ─── */}
        <div className="flex flex-col gap-1.5">
          {visibleDays.map((d) => {
            const dayTasks = tasksByDay.get(d.id) ?? [];
            const done = dayTasks.filter((t) => t.status === "done").length;
            const minutes = dayTasks.reduce((a, t) => a + t.minutes, 0);
            const isMock = d.kind === "mock";
            const isToday = d.date === today;
            const isOpen = openDay === d.id;
            const state: "done" | "partial" | "todo" | "future" =
              done > 0 && done === dayTasks.length ? "done" : done > 0 ? "partial" : d.date < today ? "todo" : d.date === today ? "partial" : "future";
            const stateColor =
              state === "done" ? "var(--color-neon)" : state === "partial" ? "var(--color-violet-2)" : "var(--color-dim)";

            return (
              <div
                key={d.id}
                className="pixel-panel-2 overflow-hidden"
                style={{
                  borderColor: isToday ? "var(--color-gold)" : "var(--color-edge)",
                  boxShadow: isToday ? "4px 4px 0 0 var(--color-edge), 0 0 10px rgba(250,204,21,0.35)" : undefined,
                }}
              >
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer"
                  onClick={() => setOpenDay(isOpen ? null : d.id)}
                >
                  <span
                    className="shrink-0 w-8 h-8 flex items-center justify-center border-2 text-[11px] font-bold"
                    style={{
                      borderColor: "var(--color-edge)",
                      background: isMock ? "#3b2d0a" : "var(--color-void)",
                      color: isMock ? "var(--color-gold)" : stateColor,
                    }}
                  >
                    {d.id}
                  </span>

                  <span className="shrink-0 w-14 text-[11px] uppercase" style={{ color: "var(--color-dim)" }}>
                    {WEEKDAYS_SHORT[weekdayIndex(d.date)]} {formatDayMonth(d.date).replace(" ", ".")}
                  </span>

                  {isMock ? (
                    <Chip color="var(--color-gold)" icon="flag">
                      ПРОБНИК
                    </Chip>
                  ) : (
                    <span className="text-[11px] px-1.5 border-2" style={{ borderColor: "var(--color-line)", color: "var(--color-dim)" }}>
                      Ф{d.phase}
                    </span>
                  )}

                  <span className="flex-1" />

                  <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--color-dim)" }}>
                    {done}/{dayTasks.length} · {minutes}м
                  </span>

                  <PixelIcon name={isOpen ? "chevronDown" : "chevron"} size={10} color="var(--color-dim)" />
                  <span
                    className="shrink-0 w-5 h-5 flex items-center justify-center border-2"
                    style={{ borderColor: "var(--color-edge)", background: stateColor }}
                  >
                    {state === "done" ? <PixelIcon name="check" size={10} color="#04120a" /> : null}
                  </span>
                </button>

                {isOpen ? (
                  <div className="border-t-2 px-3 py-2 flex flex-col gap-1.5" style={{ borderColor: "var(--color-edge)", background: "var(--color-void)" }}>
                    <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
                      {formatShort(d.date)} · бюджет {d.budgetMin} мин
                      {todayDay && d.id === todayDay.id ? " · сегодня" : ""}
                    </div>
                    {dayTasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <PixelIcon name={TYPE_ICON[t.type]} size={11} color={TYPE_COLOR[t.type]} />
                        <span className={`flex-1 truncate ${t.status === "done" ? "line-through" : ""}`} style={{ color: t.status === "done" ? "var(--color-dim)" : "var(--color-ink)" }}>
                          {t.title}
                        </span>
                        <span style={{ color: "var(--color-dim)" }}>{t.minutes}м</span>
                        {t.status === "done" ? <PixelIcon name="check" size={10} color="var(--color-neon)" /> : null}
                      </div>
                    ))}
                    <div className="text-[10px] pt-1" style={{ color: "var(--color-dim)" }}>
                      День {diffDays(start, d.date) + 1} из 209
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
