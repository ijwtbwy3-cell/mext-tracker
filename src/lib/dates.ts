/** Работа с датами (русская локаль). Даты хранятся строкой YYYY-MM-DD. */

export const WEEKDAYS_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
export const WEEKDAYS_LONG = [
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
  "воскресенье",
];
export const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Индекс дня недели: 0 = понедельник … 6 = воскресенье. */
export function weekdayIndex(iso: string): number {
  const js = parseISO(iso).getUTCDay(); // 0 = воскресенье
  return (js + 6) % 7;
}

export function formatDayMonth(iso: string): string {
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()]}`;
}

export function formatFull(iso: string): string {
  const wd = WEEKDAYS_LONG[weekdayIndex(iso)];
  return `${formatDayMonth(iso)}, ${wd}`;
}

export function formatShort(iso: string): string {
  const d = parseISO(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

export function diffDays(fromISO: string, toISO: string): number {
  return Math.round((parseISO(toISO).getTime() - parseISO(fromISO).getTime()) / 86_400_000);
}

export function addDaysISO(iso: string, delta: number): string {
  const t = parseISO(iso).getTime() + delta * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
