"use client";

/** Экран «Задачи»: карточка сегодняшнего дня плана, счётчики, награды, список заданий. */

import { useMemo } from "react";
import { useApp } from "@/components/AppShell";
import { Button, Card, Chip, ProgressBar, SectionTitle, StatBox } from "@/components/ui";
import { PixelIcon, type IconName } from "@/components/PixelIcon";
import { PHASES } from "@/lib/plan-generator";
import { FocusTimer } from "@/components/FocusTimer";
import { formatDuration, focusKey, taskFocusReward } from "@/lib/focus";
import type { TaskRow } from "@/lib/types";
import { formatFull, todayISO, weekdayIndex, WEEKDAYS_SHORT, diffDays } from "@/lib/dates";
import type { TaskType } from "@/lib/plan-generator";

const TYPE_META: Record<TaskType, { label: string; color: string; icon: IconName }> = {
  theory: { label: "Теория", color: "var(--color-cyan)", icon: "book" },
  practice: { label: "Практика", color: "var(--color-violet-2)", icon: "pencil" },
  review: { label: "Повторение", color: "var(--color-neon)", icon: "loop" },
  mock: { label: "Пробник", color: "var(--color-gold)", icon: "flag" },
};

function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function calcStreak(tasks: TaskRow[]): number {
  const doneDays = new Set(
    tasks.filter((t) => t.status === "done" && t.doneAt).map((t) => localDate(new Date(t.doneAt!))),
  );
  if (doneDays.size === 0) return 0;
  const cursor = new Date();
  if (!doneDays.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (doneDays.has(localDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function TasksScreen() {
  const { data, reopenTask, busy, focus, startFocus, cancelFocus, finishFocus } = useApp();
  const { tasks, planDays, settings, subjects, totals } = data;

  const today = todayISO();

  const day = useMemo(() => {
    const exact = planDays.find((d) => d.date === today);
    if (exact) return exact;
    const before = planDays.filter((d) => d.date <= today);
    if (before.length > 0) return before[before.length - 1];
    return planDays[0];
  }, [planDays, today]);

  const dayTasks = useMemo(
    () => tasks.filter((t) => t.dayId === day.id).sort((a, b) => a.ord - b.ord),
    [tasks, day.id],
  );

  const doneTasks = dayTasks.filter((t) => t.status === "done");
  const minutesPlan = dayTasks.reduce((a, t) => a + t.minutes, 0);
  const minutesDone = doneTasks.reduce((a, t) => a + (t.spentMin ?? t.minutes), 0);
  const xpToday = doneTasks.reduce((a, t) => a + t.awardedXp, 0);
  const coinsToday = doneTasks.reduce((a, t) => a + t.awardedCoins, 0);
  const allDone = dayTasks.length > 0 && doneTasks.length === dayTasks.length;
  const streak = useMemo(() => calcStreak(tasks), [tasks]);
  const phase = PHASES[day.phase - 1];
  const start = settings.startDate ?? "2026-11-04";
  const dayIndex = diffDays(start, day.date) + 1;
  const isMock = day.kind === "mock";
  const isToday = day.date === today;

  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-5">
      {/* ─── карточка дня ─── */}
      <Card className={isToday ? "today-glow overflow-hidden" : "overflow-hidden"}>
        <div
          className="px-4 py-3 border-b-2 flex flex-wrap items-center justify-between gap-2"
          style={{
            borderColor: "var(--color-edge)",
            background: isMock ? "#3b2d0a" : "var(--color-panel-2)",
          }}
        >
          <div className="flex items-center gap-2">
            <PixelIcon name={isMock ? "flag" : "calendar"} size={16} color={isMock ? "var(--color-gold)" : "var(--color-violet-2)"} />
            <div>
              <div className="text-[11px] uppercase tracking-widest" style={{ color: "var(--color-dim)" }}>
                {WEEKDAYS_SHORT[weekdayIndex(day.date)]} · День {dayIndex} из 209
              </div>
              <div className="font-bold text-sm">{formatFull(day.date)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip color="var(--color-violet-2)">
              Фаза {phase.n}: {phase.name}
            </Chip>
            <Chip color="var(--color-cyan)">{phase.budget} мин</Chip>
            {isToday ? <Chip color="var(--color-gold)">СЕГОДНЯ</Chip> : null}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {isMock ? (
            <div
              className="pixel-panel-2 px-3 py-2 flex items-center gap-2 text-sm"
              style={{ borderColor: "var(--color-gold)" }}
            >
              <PixelIcon name="trophy" size={16} color="var(--color-gold)" />
              <b style={{ color: "var(--color-gold)" }}>День пробника.</b>
              <span style={{ color: "var(--color-dim)" }}>Полный тест вместо обычного блока.</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
            <span>
              Задания: <b style={{ color: "var(--color-ink)" }}>{doneTasks.length}/{dayTasks.length}</b>
            </span>
            <span>
              Минуты: <b style={{ color: "var(--color-ink)" }}>{minutesDone}/{minutesPlan}</b>
            </span>
            <span>
              Награда дня: <b style={{ color: "var(--color-gold)" }}>+{xpToday} XP</b> ·{" "}
              <b style={{ color: "var(--color-gold)" }}>+{coinsToday} 🪙</b>
            </span>
          </div>

          <ProgressBar value={doneTasks.length} max={dayTasks.length} tone={allDone ? "green" : "violet"} segments={24} />

          {allDone ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-neon)" }}>
              <PixelIcon name="check" size={14} color="var(--color-neon)" />
              <b>Все задания дня выполнены! День закрыт.</b>
            </div>
          ) : null}
        </div>
      </Card>

      {/* ─── счётчики ─── */}
      <div className="flex gap-2">
        <StatBox icon="bolt" label="Всего XP" value={totals.xp} />
        <StatBox icon="coin" label="Монеты" value={totals.coins} color="var(--color-gold)" />
        <StatBox icon="flame" label="Серия" value={streak} color="var(--color-orange)" />
        <StatBox icon="star" label="Темы" value={`${totals.topicsDone}/${totals.topicsTotal}`} color="var(--color-neon)" />
      </div>

      {/* ─── список заданий ─── */}
      <section>
        <SectionTitle icon={isMock ? "flag" : "tasks"}>{isMock ? "Задание дня" : "Блоки дня"}</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {dayTasks.map((task) => {
            const meta = TYPE_META[task.type];
            const subject = task.subjectId ? subjectById.get(task.subjectId) : null;
            const done = task.status === "done";
            const session = focus[focusKey("task", task.id)];
            const reward = taskFocusReward(task.minutes, task.type);
            const bonus =
              task.type === "mock" ? "+25 XP за пробник" : task.type === "review" ? "+30 XP за повторение" : null;

            return (
              <div
                key={task.id}
                className="pixel-panel-2 p-3 flex gap-3 items-start"
                style={{
                  opacity: done ? 0.72 : 1,
                  borderLeft: `4px solid ${done ? "var(--color-neon)" : meta.color}`,
                }}
              >
                <div
                  className="shrink-0 w-9 h-9 flex items-center justify-center border-2"
                  style={{ borderColor: "var(--color-edge)", background: "var(--color-void)" }}
                >
                  <PixelIcon name={meta.icon} size={16} color={done ? "var(--color-neon)" : meta.color} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wider">
                    <span style={{ color: meta.color }}>{meta.label}</span>
                    <span className="flex items-center gap-1" style={{ color: "var(--color-dim)" }}>
                      <PixelIcon name="clock" size={9} color="var(--color-dim)" />
                      {task.minutes} мин
                    </span>
                    {subject ? (
                      <Chip color={subject.color}>{subject.short}</Chip>
                    ) : null}
                    {task.examKey ? <Chip color="var(--color-gold)">{task.examKey.toUpperCase()}</Chip> : null}
                  </div>

                  <p className="text-sm font-semibold mt-1 leading-snug break-words">{task.title}</p>

                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs">
                    <span style={{ color: "var(--color-violet-2)" }}>
                      +{Math.round(task.minutes * 0.4) + (task.type === "mock" ? 25 : task.type === "review" ? 30 : 0)} XP
                    </span>
                    <span style={{ color: "var(--color-gold)" }}>+{Math.round(task.minutes / 4)} 🪙</span>
                    {bonus ? (
                      <span style={{ color: "var(--color-orange)" }}>{bonus}</span>
                    ) : null}
                    {done ? (
                      <span style={{ color: "var(--color-neon)" }}>
                        ✓ выполнено{task.spentMin ? ` · ${task.spentMin} мин` : ""}
                      </span>
                    ) : session ? null : (
                      <span className="flex items-center gap-1" style={{ color: "var(--color-dim)" }}>
                        <PixelIcon name="clock" size={9} color="var(--color-dim)" />
                        фокус {formatDuration(task.minutes)} → потом зачёт
                      </span>
                    )}
                  </div>

                  {session ? (
                    <div className="mt-2">
                      <FocusTimer
                        session={session}
                        busy={busy}
                        reward={reward}
                        onCancel={() => void cancelFocus("task", task.id)}
                        onFinish={async () => {
                          const res = await finishFocus("task", task.id);
                          if (!res.ok) throw new Error(res.error ?? "Не удалось засчитать задание");
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 flex flex-col gap-1.5">
                  {done ? (
                    <Button variant="ghost" icon="loop" disabled={busy} onClick={() => void reopenTask(task.id)}>
                      Вернуть
                    </Button>
                  ) : session ? null : (
                    <Button
                      icon="check"
                      disabled={busy}
                      onClick={() =>
                        void startFocus({
                          kind: "task",
                          id: task.id,
                          minutes: task.minutes,
                          title: task.title,
                        })
                      }
                    >
                      Выполнить
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {dayTasks.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--color-dim)" }}>
              В этот день заданий нет — отдыхайте!
            </p>
          ) : null}
        </div>
      </section>

      {/* ─── сводка недели ─── */}
      <section>
        <SectionTitle icon="calendar">Прогресс по фазам</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {PHASES.map((p) => {
            const phaseTaskIds = new Set(tasks.filter((t) => planDays.find((d) => d.id === t.dayId)?.phase === p.n).map((t) => t.id));
            const total = phaseTaskIds.size;
            const done = tasks.filter((t) => phaseTaskIds.has(t.id) && t.status === "done").length;
            return (
              <Card key={p.n} className="p-2.5">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider mb-1.5">
                  <b style={{ color: "var(--color-violet-2)" }}>
                    Ф{p.n} · {p.name}
                  </b>
                  <span style={{ color: "var(--color-dim)" }}>
                    {done}/{total}
                  </span>
                </div>
                <ProgressBar value={done} max={total} segments={12} tone={done === total && total > 0 ? "green" : "violet"} />
                <div className="text-[10px] mt-1" style={{ color: "var(--color-dim)" }}>
                  {p.days} дней · {p.budget} мин/день
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
