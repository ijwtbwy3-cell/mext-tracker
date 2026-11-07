"use client";

/** Экран «Предметы»: предметы → разделы → темы со статусами и сложностью. */

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppShell";
import { Button, Card, Chip, Hearts, ProgressBar, SectionTitle } from "@/components/ui";
import { PixelIcon } from "@/components/PixelIcon";
import { FocusTimer } from "@/components/FocusTimer";
import { focusKey, formatDuration, topicFocusReward, topicMinutes } from "@/lib/focus";
import type { TopicRow, TopicStatus } from "@/lib/types";
import { nextTopicStatus } from "@/lib/store";

const STATUS_META: Record<TopicStatus, { label: string; color: string }> = {
  none: { label: "Не начато", color: "var(--color-dim)" },
  doing: { label: "В работе", color: "var(--color-orange)" },
  done: { label: "Изучено", color: "var(--color-neon)" },
};

export function SubjectsScreen() {
  const { data, setTopicStatus, busy, focus, startFocus, cancelFocus, finishFocus, pauseFocus, resumeFocus } = useApp();
  const { subjects, sections, topics, progress, totals } = data;

  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [onlyUnfinished, setOnlyUnfinished] = useState(false);

  const statusByTopic = useMemo(() => new Map(progress.map((p) => [p.topicId, p.status])), [progress]);
  const topicsDone = progress.filter((p) => p.status === "done").length;

  const sectionsBySubject = useMemo(() => {
    const m = new Map<string, typeof sections>();
    for (const s of sections) {
      const arr = m.get(s.subjectId) ?? [];
      arr.push(s);
      m.set(s.subjectId, arr);
    }
    return m;
  }, [sections]);

  const topicsBySection = useMemo(() => {
    const m = new Map<string, TopicRow[]>();
    for (const t of topics) {
      const arr = m.get(t.sectionId) ?? [];
      arr.push(t);
      m.set(t.sectionId, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.ord - b.ord);
    return m;
  }, [topics]);

  return (
    <div className="flex flex-col gap-5">
      {/* ─── сводка ─── */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-lg font-bold uppercase tracking-widest" style={{ textShadow: "3px 3px 0 #000" }}>
            Предметы
          </h1>
          <div className="flex gap-1.5">
            <Chip color="var(--color-violet-2)">{subjects.length} предметов</Chip>
            <Chip color="var(--color-cyan)">{sections.length} разделов</Chip>
            <Chip color="var(--color-gold)">{topics.length} темы</Chip>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--color-dim)" }}>
            Изучено: <b style={{ color: "var(--color-neon)" }}>{topicsDone}/{totals.topicsTotal}</b>
          </span>
          <ProgressBar value={topicsDone} max={totals.topicsTotal} tone="green" segments={28} className="flex-1" />
        </div>
        <div className="mt-2">
          <button className="pixel-chip cursor-pointer" onClick={() => setOnlyUnfinished((v) => !v)}>
            {onlyUnfinished ? "✓ Показывать только незавершённые" : "Показывать только незавершённые"}
          </button>
        </div>
      </Card>

      {/* ─── предметы ─── */}
      <div className="flex flex-col gap-2.5">
        {subjects.map((subject) => {
          const subjSections = sectionsBySubject.get(subject.id) ?? [];
          const subjTopics = topics.filter((t) => t.subjectId === subject.id);
          const done = subjTopics.filter((t) => statusByTopic.get(t.id) === "done").length;
          const hours = subjTopics.reduce((a, t) => a + t.hours, 0);
          const isOpen = openSubject === subject.id;

          return (
            <Card key={subject.id} className="overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-3 py-3 text-left cursor-pointer"
                onClick={() => {
                  setOpenSubject(isOpen ? null : subject.id);
                  setOpenSection(null);
                }}
              >
                <span
                  className="shrink-0 w-10 h-10 flex items-center justify-center border-2"
                  style={{ borderColor: "var(--color-edge)", background: "var(--color-void)" }}
                >
                  <PixelIcon name={subject.icon} size={20} color={subject.color} />
                </span>

                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <b className="text-sm">{subject.title}</b>
                    <Chip color={subject.color}>{subjSections.length} разд.</Chip>
                    <Chip color="var(--color-gold)">{subjTopics.length} тем</Chip>
                    <Chip>{hours} ч</Chip>
                  </span>
                  <span className="block mt-1.5">
                    <ProgressBar value={done} max={subjTopics.length} segments={16} tone={done === subjTopics.length ? "green" : "violet"} />
                  </span>
                </span>

                <span className="text-xs whitespace-nowrap" style={{ color: done === subjTopics.length ? "var(--color-neon)" : "var(--color-dim)" }}>
                  {done}/{subjTopics.length}
                </span>
                <PixelIcon name={isOpen ? "chevronDown" : "chevron"} size={10} color="var(--color-dim)" />
              </button>

              {isOpen ? (
                <div className="border-t-2 px-3 py-2.5 flex flex-col gap-1.5" style={{ borderColor: "var(--color-edge)", background: "var(--color-void)" }}>
                  {subjSections.map((section) => {
                    const secTopics = (topicsBySection.get(section.id) ?? []).filter(
                      (t) => !onlyUnfinished || statusByTopic.get(t.id) !== "done",
                    );
                    const secOpen = openSection === section.id;
                    if (onlyUnfinished && secTopics.length === 0) return null;
                    const secDone = (topicsBySection.get(section.id) ?? []).filter(
                      (t) => statusByTopic.get(t.id) === "done",
                    ).length;
                    const secTotal = (topicsBySection.get(section.id) ?? []).length;

                    return (
                      <div key={section.id} className="border-2" style={{ borderColor: "var(--color-line)", background: "var(--color-panel)" }}>
                        <button
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-left cursor-pointer"
                          onClick={() => setOpenSection(secOpen ? null : section.id)}
                        >
                          <b className="text-xs flex-1">{section.title}</b>
                          <span className="text-[11px]" style={{ color: "var(--color-dim)" }}>
                            {secDone}/{secTotal}
                          </span>
                          <PixelIcon name={secOpen ? "chevronDown" : "chevron"} size={10} color="var(--color-dim)" />
                        </button>

                        {secOpen ? (
                          <div className="border-t-2 px-2.5 py-2 flex flex-col gap-2" style={{ borderColor: "var(--color-line)" }}>
                            {secTopics.map((topic) => {
                              const status = statusByTopic.get(topic.id) ?? "none";
                              const meta = STATUS_META[status];
                              const session = focus[focusKey("topic", topic.id)];
                              const minutes = topicMinutes(topic.hours);
                              return (
                                <div key={topic.id} className="flex gap-2.5 items-start">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <b className="text-xs">{topic.title}</b>
                                      <Hearts value={topic.difficulty} />
                                      <Chip>{topic.level}</Chip>
                                      <Chip color="var(--color-cyan)">{topic.hours} ч</Chip>
                                    </div>
                                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--color-dim)" }}>
                                      {topic.description}
                                    </p>
                                    {session ? (
                                      <div className="mt-1.5">
                                        <FocusTimer
                                          session={session}
                                          busy={busy}
                                          compact
                                          reward={topicFocusReward(session.minutes)}
                                          onCancel={() => void cancelFocus("topic", topic.id)}
                                          onPause={() => void pauseFocus("topic", topic.id)}
                                          onResume={() => void resumeFocus("topic", topic.id)}
                                          onFinish={async () => {
                                            const res = await finishFocus("topic", topic.id);
                                            if (!res.ok) throw new Error(res.error ?? "Не удалось засчитать тему");
                                          }}
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="shrink-0 flex flex-col gap-1 items-end">
                                    <button
                                      className="pixel-chip cursor-pointer whitespace-nowrap"
                                      style={{ color: meta.color, borderColor: meta.color }}
                                      disabled={busy}
                                      onClick={() => void setTopicStatus(topic.id, nextTopicStatus(status))}
                                      title="Сменить статус"
                                    >
                                      {status === "done" ? <PixelIcon name="check" size={9} color={meta.color} /> : null}
                                      {status === "doing" ? "◐" : status === "done" ? "★" : "○"} {meta.label}
                                    </button>
                                    {status !== "done" && !session ? (
                                      <button
                                        className="pixel-chip cursor-pointer whitespace-nowrap"
                                        style={{ color: "var(--color-violet-2)", borderColor: "var(--color-violet-2)" }}
                                        disabled={busy}
                                        onClick={() =>
                                          void startFocus({
                                            kind: "topic",
                                            id: topic.id,
                                            minutes,
                                            title: topic.title,
                                          })
                                        }
                                        title={`Фокус-таймер на ${formatDuration(minutes)}`}
                                      >
                                        <PixelIcon name="clock" size={8} color="var(--color-violet-2)" /> Фокус
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {onlyUnfinished && subjSections.every((s) => {
                    const list = topicsBySection.get(s.id) ?? [];
                    return list.every((t) => statusByTopic.get(t.id) === "done");
                  }) ? (
                    <p className="text-xs text-center py-2" style={{ color: "var(--color-neon)" }}>
                      ✓ По этому предмету всё изучено!
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      {/* ─── легенда ─── */}
      <SectionTitle icon="star">Как отмечать</SectionTitle>
      <Card className="p-3 text-xs flex flex-col gap-1.5" >
        <span style={{ color: "var(--color-dim)" }}>
          <b style={{ color: "var(--color-dim)" }}>○ Не начато</b> — тема не открывалась.{" "}
          <b style={{ color: "var(--color-orange)" }}>◐ В работе</b> — начата, но не доведена.{" "}
          <b style={{ color: "var(--color-neon)" }}>★ Изучено</b> — тема закрыта.
        </span>
        <span style={{ color: "var(--color-dim)" }}>
          Статус также обновляется автоматически, когда закрываются задания «Теория» и «Практика» по теме на экране «Задачи».
        </span>
      </Card>
    </div>
  );
}
