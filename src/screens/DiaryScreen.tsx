"use client";

/** Экран «Дневник»: форма записи (дата, настроение, текст), статистика, список записей. */

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppShell";
import { Button, Card, Chip, SectionTitle, StatBox } from "@/components/ui";
import { PixelIcon } from "@/components/PixelIcon";
import { formatFull, formatShort, todayISO } from "@/lib/dates";

const MOODS = [
  { value: 1, label: "Ужасно", icon: "mood1" as const, color: "#fb7185" },
  { value: 2, label: "Плохо", icon: "mood2" as const, color: "#fb923c" },
  { value: 3, label: "Нормально", icon: "mood3" as const, color: "#facc15" },
  { value: 4, label: "Хорошо", icon: "mood4" as const, color: "#4ade80" },
  { value: 5, label: "Отлично", icon: "mood5" as const, color: "#22d3ee" },
];

export function DiaryScreen() {
  const { data, addDiary, updateDiary, deleteDiary, busy } = useApp();
  const { diary } = data;

  const [date, setDate] = useState(todayISO());
  const [mood, setMood] = useState(4);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const count = diary.length;
    const avg = count > 0 ? diary.reduce((a, d) => a + d.mood, 0) / count : 0;
    // серия дней с записью (подряд, оканчивая сегодня или вчера)
    const days = new Set(diary.map((d) => d.date));
    let streak = 0;
    const cursor = new Date();
    const fmt = (dt: Date) => {
      const p = (n: number) => String(n).padStart(2, "0");
      return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
    };
    if (!days.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(fmt(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { count, avg, streak };
  }, [diary]);

  const submit = async () => {
    if (!text.trim()) {
      setError("Напишите текст записи");
      return;
    }
    setError("");
    if (editingId) {
      await updateDiary(editingId, { date, mood, text: text.trim() });
    } else {
      await addDiary({ date, mood, text: text.trim() });
    }
    setText("");
    setEditingId(null);
  };

  const startEdit = (id: string) => {
    const entry = diary.find((d) => d.id === id);
    if (!entry) return;
    setEditingId(id);
    setDate(entry.date);
    setMood(entry.mood);
    setText(entry.text);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string) => {
    if (!window.confirm("Удалить запись дневника?")) return;
    if (editingId === id) {
      setEditingId(null);
      setText("");
    }
    await deleteDiary(id);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ─── форма ─── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle icon="diary">{editingId ? "Редактирование записи" : "Новая запись"}</SectionTitle>
          {editingId ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setText("");
              }}
            >
              Отмена
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-xs uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
            Дата
            <input className="pixel-input mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <div>
            <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: "var(--color-dim)" }}>
              Настроение
            </div>
            <div className="flex gap-1.5">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  className="flex flex-col items-center gap-0.5 px-2 py-1.5 border-2 cursor-pointer"
                  style={{
                    borderColor: mood === m.value ? m.color : "var(--color-edge)",
                    background: mood === m.value ? "var(--color-panel-2)" : "var(--color-void)",
                    boxShadow: mood === m.value ? `2px 2px 0 0 var(--color-edge)` : "none",
                  }}
                  onClick={() => setMood(m.value)}
                  title={m.label}
                >
                  <PixelIcon name={m.icon} size={18} color={m.color} />
                  <span className="text-[9px] uppercase" style={{ color: mood === m.value ? m.color : "var(--color-dim)" }}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="text-xs uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
            Запись
            <textarea
              className="pixel-input mt-1 min-h-24 resize-y"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Что получилось сегодня? Что далось тяжело? Планы на завтра..."
            />
          </label>

          {error ? (
            <p className="text-xs uppercase" style={{ color: "var(--color-rose)" }}>
              ✕ {error}
            </p>
          ) : null}

          <Button icon={editingId ? "save" : "plus"} disabled={busy} onClick={() => void submit()}>
            {editingId ? "Сохранить изменения" : "Записать"}
          </Button>
        </div>
      </Card>

      {/* ─── статистика ─── */}
      <div className="flex gap-2">
        <StatBox icon="diary" label="Записей" value={stats.count} />
        <StatBox icon="flame" label="Серия" value={stats.streak} color="var(--color-orange)" />
        <StatBox
          icon="star"
          label="Ср. оценка"
          value={stats.avg > 0 ? stats.avg.toFixed(1) : "—"}
          color="var(--color-gold)"
        />
      </div>

      {/* ─── записи ─── */}
      <section>
        <SectionTitle icon="book">Записи</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {diary.length === 0 ? (
            <Card className="p-6 text-center">
              <PixelIcon name="pencil" size={28} color="var(--color-line)" />
              <p className="text-sm mt-2" style={{ color: "var(--color-dim)" }}>
                Пока ни одной записи. Дневник — лучший способ заметить прогресс.
              </p>
            </Card>
          ) : null}

          {diary.map((entry) => {
            const meta = MOODS.find((m) => m.value === entry.mood) ?? MOODS[2];
            return (
              <Card key={entry.id} className="p-3 flex gap-3">
                <div
                  className="shrink-0 w-11 h-11 flex flex-col items-center justify-center border-2"
                  style={{ borderColor: "var(--color-edge)", background: "var(--color-void)" }}
                >
                  <PixelIcon name={meta.icon} size={20} color={meta.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
                      {formatFull(entry.date)}
                    </span>
                    <span className="text-[11px]" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words leading-snug">{entry.text}</p>
                </div>
                <div className="shrink-0 flex flex-col gap-1.5">
                  <Button variant="ghost" icon="edit" onClick={() => startEdit(entry.id)}>
                    Изм.
                  </Button>
                  <Button variant="danger" icon="trash" disabled={busy} onClick={() => void remove(entry.id)}>
                    Уд.
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
