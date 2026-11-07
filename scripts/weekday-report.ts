/** Отчёт: главный предмет каждого дня первых 2 недель против экрана «Расписание». */
import { generatePlan, WEEKDAY_MAIN_SUBJECT } from "../src/lib/plan-generator";
import { weekdayIndex, WEEKDAYS_SHORT } from "../src/lib/dates";

const plan = generatePlan("2026-11-04");
const first = new Map<number, string>();
for (const t of plan.tasks) {
  if (t.type === "theory" && !first.has(t.day)) first.set(t.day, t.subjectId ?? "");
}
const title: Record<string, string> = {
  math: "Математика",
  chemistry: "Химия",
  physics: "Физика",
  japanese: "Японский",
  english: "Английский",
};
for (const d of plan.days.slice(0, 16)) {
  const wd = WEEKDAYS_SHORT[weekdayIndex(d.date)];
  if (d.kind === "mock") {
    console.log(`${d.date} ${wd} — ПРОБНИК`);
    continue;
  }
  const s = first.get(d.day)!;
  const home = WEEKDAY_MAIN_SUBJECT[weekdayIndex(d.date)];
  console.log(`${d.date} ${wd} → ${title[s]}${s === home ? "  ✓" : "  (добор)"}`);
}
