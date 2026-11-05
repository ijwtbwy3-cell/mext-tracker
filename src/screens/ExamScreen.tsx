"use client";

/**
 * Экран «Экзамен»: обратный отсчёт, 5 письменных экзаменов MEXT,
 * готовность по темам, резервные копии (JSON v1), сброс и настройки.
 */

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import banner from "@/assets/banners/exam.png";
import { useApp } from "@/components/AppShell";
import { api } from "@/lib/api";
import { Button, Card, Chip, Modal, ProgressBar, SectionTitle } from "@/components/ui";
import { PixelIcon } from "@/components/PixelIcon";
import { EXAM_TITLES } from "@/lib/plan-generator";
import type { ExamKey, SubjectId } from "@/lib/curriculum";
import type { BackupV1 } from "@/lib/types";
import { diffDays, formatShort, todayISO } from "@/lib/dates";

type ExamCard = {
  key: ExamKey;
  date: string;
  subjectIds: SubjectId[];
  note?: string;
};

const EXAMS: ExamCard[] = [
  { key: "japanese", date: "2027-06-01", subjectIds: ["japanese"] },
  { key: "english", date: "2027-06-02", subjectIds: ["english"] },
  { key: "math", date: "2027-06-03", subjectIds: ["math"] },
  { key: "chemistry", date: "2027-06-04", subjectIds: ["chemistry"] },
  { key: "science", date: "2027-06-05", subjectIds: ["physics", "biology"], note: "Выбор: Физика или Биология" },
];

export function ExamScreen() {
  const { data, setSetting, restore, resetProgress, logout, busy } = useApp();
  const { subjects, topics, progress, settings, totals } = data;
  const fileRef = useRef<HTMLInputElement>(null);

  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState("");
  const [backupPreview, setBackupPreview] = useState<BackupV1 | null>(null);

  const examDate = settings.examDate ?? "2027-06-01";
  const daysLeft = diffDays(todayISO(), examDate);

  const statusByTopic = useMemo(() => new Map(progress.map((p) => [p.topicId, p.status])), [progress]);
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2600);
  };

  const exportBackup = async () => {
    const backup = await apiBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mext-backup-v1-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await setSetting("lastBackupAt", new Date().toISOString());
    flash("Резервная копия сохранена (JSON v1)");
  };

  const apiBackup = () => api.backup();

  const onImportFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as BackupV1;
      if (parsed.v !== 1 || parsed.app !== "mext-tracker") throw new Error("Ожидается формат JSON v1");
      setBackupPreview(parsed);
    } catch (e) {
      flash(`Ошибка чтения: ${e instanceof Error ? e.message : e}`);
    }
  };

  const doImport = async () => {
    if (!backupPreview) return;
    await restore(backupPreview);
    setBackupPreview(null);
    flash("Данные восстановлены из копии");
  };

  const crtOn = settings.crt !== "off";

  return (
    <div className="flex flex-col gap-5">
      {/* ─── обратный отсчёт ─── */}
      <div className="pixel-panel overflow-hidden relative">
        <div className="relative w-full h-32">
          <Image
            src={banner}
            alt="Пиксельный кубок"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            style={{ objectFit: "cover", imageRendering: "pixelated" }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(18,8,31,0.93), rgba(18,8,31,0.3))" }} />
          <div className="absolute inset-0 flex flex-col justify-center px-4">
            <h1 className="text-xl font-bold uppercase tracking-widest" style={{ textShadow: "3px 3px 0 #000" }}>
              Экзамен
            </h1>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-bold" style={{ color: "var(--color-gold)", textShadow: "3px 3px 0 #000" }}>
                {daysLeft}
              </span>
              <span className="text-sm uppercase tracking-widest" style={{ color: "var(--color-ink)" }}>
                {daysLeft % 10 === 1 && daysLeft % 100 !== 11
                  ? "день"
                  : daysLeft % 10 >= 2 && daysLeft % 10 <= 4 && (daysLeft % 100 < 10 || daysLeft % 100 >= 20)
                    ? "дня"
                    : "дней"}{" "}
                до экзамена
              </span>
            </div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
              {formatShort(examDate)} · MEXT Natural Sciences
            </div>
          </div>
        </div>
      </div>

      {/* ─── готовность ─── */}
      <Card className="p-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider mb-2" style={{ color: "var(--color-dim)" }}>
          <span>
            Темы: <b style={{ color: "var(--color-neon)" }}>{totals.topicsDone}/284</b>
          </span>
          <span>
            Задания: <b style={{ color: "var(--color-violet-2)" }}>{totals.tasksDone}/754</b>
          </span>
          <span>
            XP: <b style={{ color: "var(--color-gold)" }}>{totals.xp}</b>
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] w-16 shrink-0" style={{ color: "var(--color-dim)" }}>Темы</span>
            <ProgressBar value={totals.topicsDone} max={284} tone="green" segments={24} className="flex-1" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] w-16 shrink-0" style={{ color: "var(--color-dim)" }}>План</span>
            <ProgressBar value={totals.tasksDone} max={754} segments={24} className="flex-1" />
          </div>
        </div>
      </Card>

      {/* ─── 5 экзаменов ─── */}
      <section>
        <SectionTitle icon="trophy">5 письменных экзаменов</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {EXAMS.map((exam, idx) => {
            const examTopics = topics.filter((t) => exam.subjectIds.includes(t.subjectId));
            const done = examTopics.filter((t) => statusByTopic.get(t.id) === "done").length;
            return (
              <Card key={exam.key} className="p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className="shrink-0 w-9 h-9 flex items-center justify-center border-2 text-sm font-bold"
                    style={{
                      borderColor: "var(--color-edge)",
                      background: idx === 4 ? "#3b2d0a" : "var(--color-void)",
                      color: idx === 4 ? "var(--color-gold)" : "var(--color-violet-2)",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="text-sm">{EXAM_TITLES[exam.key]}</b>
                      <Chip color="var(--color-gold)">{formatShort(exam.date)}</Chip>
                      {exam.note ? <Chip color="var(--color-orange)">{exam.note}</Chip> : null}
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {exam.subjectIds.map((sid) => {
                        const s = subjectById.get(sid);
                        return s ? (
                          <span key={sid} className="pixel-chip" style={{ color: s.color }}>
                            {s.title}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs" style={{ color: "var(--color-dim)" }}>
                      {done}/{examTopics.length} тем
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <ProgressBar value={done} max={examTopics.length} segments={20} tone={done === examTopics.length ? "green" : "violet"} />
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ─── данные и копии ─── */}
      <section>
        <SectionTitle icon="save">Данные и копии</SectionTitle>
        <Card className="p-3 flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-2">
            <Button icon="download" onClick={() => void exportBackup()}>
              Экспорт JSON v1
            </Button>
            <Button
              variant="ghost"
              icon="upload"
              onClick={() => fileRef.current?.click()}
            >
              Импорт копии
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="text-[11px] leading-relaxed" style={{ color: "var(--color-dim)" }}>
            Формат: <b style={{ color: "var(--color-ink)" }}>{`{ v: 1, app: "mext-tracker", ... }`}</b> — все 8 таблиц:
            предметы, разделы, темы, прогресс, дни плана, задания, дневник, настройки.
            {settings.lastBackupAt ? (
              <>
                {" "}
                Последний экспорт: <b style={{ color: "var(--color-ink)" }}>{formatShort(settings.lastBackupAt.slice(0, 10))}</b>
              </>
            ) : null}
          </div>

          <div className="border-t-2 pt-2.5 flex flex-wrap items-center gap-2" style={{ borderColor: "var(--color-line)" }}>
            <span className="text-[11px] uppercase tracking-wider mr-auto" style={{ color: "var(--color-dim)" }}>
              CRT-оверлей
            </span>
            <Button
              variant="ghost"
              onClick={() => void setSetting("crt", crtOn ? "off" : "on")}
            >
              {crtOn ? "Выключить" : "Включить"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="danger" icon="trash" onClick={() => setConfirmReset(true)}>
              Сбросить прогресс
            </Button>
            <Button variant="ghost" icon="lock" onClick={() => void logout()}>
              Выйти
            </Button>
          </div>
        </Card>
      </section>

      {/* ─── о приложении ─── */}
      <section>
        <SectionTitle icon="star">О приложении</SectionTitle>
        <Card className="p-3 text-[11px] flex flex-col gap-1" >
          <span style={{ color: "var(--color-dim)" }}>
            MEXT Трекер v1.0.0 · сборка:{" "}
            <b style={{ color: "var(--color-ink)" }}>
              {typeof __BUILD_MODE__ !== "undefined" && __BUILD_MODE__ === "offline"
                ? "offline APK (Capacitor + SQLite)"
                : "web (Next.js + PostgreSQL)"}
            </b>
          </span>
          <span style={{ color: "var(--color-dim)" }}>
            Контент встроен: 6 предметов · 49 разделов · 284 темы · 209 дней · 754 задания.
          </span>
          <span style={{ color: "var(--color-dim)" }}>
            Пароль — из переменной APP_PASSPHRASE. Внешних HTTP-запросов приложение не выполняет.
          </span>
        </Card>
      </section>

      {/* ─── тост ─── */}
      {toast ? (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 pixel-panel px-4 py-2 text-sm"
          style={{ background: "var(--color-panel-2)", color: "var(--color-neon)" }}
        >
          <PixelIcon name="check" size={12} color="var(--color-neon)" /> {toast}
        </div>
      ) : null}

      {/* ─── подтверждение сброса ─── */}
      <Modal open={confirmReset} title="Сброс прогресса" onClose={() => setConfirmReset(false)}>
        <p className="text-sm leading-relaxed">
          Будут очищены: прогресс тем, выполненные задания и все записи дневника.
          Предметы, разделы и план останутся. Действие необратимо.
        </p>
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="ghost" onClick={() => setConfirmReset(false)}>
            Отмена
          </Button>
          <Button
            variant="danger"
            icon="trash"
            disabled={busy}
            onClick={async () => {
              await resetProgress();
              setConfirmReset(false);
              flash("Прогресс сброшен");
            }}
          >
            Сбросить
          </Button>
        </div>
      </Modal>

      {/* ─── предпросмотр импорта ─── */}
      <Modal open={!!backupPreview} title="Импорт резервной копии" onClose={() => setBackupPreview(null)}>
        {backupPreview ? (
          <>
            <div className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--color-dim)" }}>
              <span>Версия: <b style={{ color: "var(--color-ink)" }}>v{backupPreview.v}</b></span>
              <span>Создана: <b style={{ color: "var(--color-ink)" }}>{backupPreview.createdAt.slice(0, 10)}</b></span>
              <span>Тем: <b style={{ color: "var(--color-ink)" }}>{backupPreview.data.topics.length}</b></span>
              <span>Заданий: <b style={{ color: "var(--color-ink)" }}>{backupPreview.data.tasks.length}</b></span>
              <span>Записей дневника: <b style={{ color: "var(--color-ink)" }}>{backupPreview.data.diary.length}</b></span>
              <span>Прогресс тем: <b style={{ color: "var(--color-ink)" }}>{backupPreview.data.progress.length}</b></span>
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--color-rose)" }}>
              ⚠ Текущие данные будут полностью заменены содержимым копии.
            </p>
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="ghost" onClick={() => setBackupPreview(null)}>
                Отмена
              </Button>
              <Button icon="upload" disabled={busy} onClick={() => void doImport()}>
                Восстановить
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
