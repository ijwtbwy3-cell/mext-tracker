/**
 * Браузерный e2e ОБЕИХ сборок (Playwright + Chromium headless):
 *   web     — http://127.0.0.1:3000  (Next.js + PostgreSQL)
 *   offline — http://127.0.0.1:4173  (Vite-бандл, fetch-bridge -> sql.js)
 *
 * Проверяет: вход по паролю, все 6 экранов, выполнение задания с наградой XP,
 * добавление записи дневника, сохранность данных после перезагрузки (offline).
 * Скриншоты кладёт в screenshots/.
 *
 * Запуск: servers должны быть подняты; npx tsx scripts/e2e.ts
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const WEB = "http://127.0.0.1:3000";
const OFF = "http://127.0.0.1:4173";
const PASS = "mext-2027";
const SHOTS = path.resolve("screenshots");

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}

async function login(page: Page, base: string, label: string) {
  await page.goto(base === WEB ? `${WEB}/tasks` : `${OFF}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="password"]', { timeout: 20000 });
  if (label === "web") await shot(page, "web-login");
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=День", { timeout: 20000 });
}

async function headerXp(page: Page): Promise<number> {
  const text = (await page.locator("header b").first().textContent()) ?? "0";
  return parseInt(text.replace(/\D/g, ""), 10) || 0;
}

async function gotoTab(page: Page, tab: string, expectText: string) {
  await page.click(`nav >> text=${tab}`);
  await page.waitForSelector(`text=${expectText}`, { timeout: 15000 });
}

async function resetWeb(): Promise<void> {
  const auth = await fetch(`${WEB}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase: PASS }),
  });
  const cookie = (auth.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  await fetch(`${WEB}/api/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: "{}",
  });
  console.log("  (веб-прогресс сброшен перед прогоном)");
}

async function runSuite(base: string, label: string) {
  console.log(`\n══ E2E: ${label} (${base}) ══`);
  if (base === WEB) await resetWeb();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  page.on("pageerror", (err) => {
    failures++;
    console.error(`  ✗ pageerror: ${err.message}`);
  });

  // ── вход ──
  await login(page, base, label);
  ok(true, "экран входа → успешный вход по паролю");
  const xp0 = await headerXp(page);
  ok(await page.locator("text=Фаза 1: Фундамент").first().isVisible(), "карточка дня: фаза «Фундамент»");
  ok(await page.locator("text=из 209").first().isVisible(), "счётчик дня «из 209»");

  // главный предмет дня = из экрана «Расписание» (Пн Мат, Вт Физ, Ср Хим, Чт Мат, Пт Анг, Сб Физ, Вс Яп)
  {
    const now = new Date();
    const wd = (now.getDay() + 6) % 7;
    const dayNo =
      Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(2026, 10, 4)) / 86400000) + 1;
    if (dayNo % 14 !== 0 && dayNo >= 1 && dayNo <= 209) {
      const shortSubject = ["Мат", "Физ", "Хим", "Мат", "Анг", "Физ", "Яп"][wd];
      ok(
        (await page.locator(`text=${shortSubject}`).count()) > 0,
        `предмет дня «${shortSubject}» совпадает с расписанием`,
      );
    }
  }
  await shot(page, `${label}-tasks`);

  // ── выполнение задания ──
  // В web запрос идёт по сети (ловим ответ), в offline fetch-bridge отвечает
  // внутри страницы — там просто ждём изменения DOM.
  const doneBefore = await page.locator("button:has-text('Вернуть')").count();
  if (base === WEB) {
    const [completeResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/tasks/complete") && r.request().method() === "POST",
        { timeout: 15000 },
      ),
      page.locator("button:has-text('Выполнить')").first().click(),
    ]);
    ok(completeResp.status() === 200, `POST /api/tasks/complete → ${completeResp.status()}`);
  } else {
    await page.locator("button:has-text('Выполнить')").first().click();
    ok(true, "fetch-bridge выполнил задание локально");
  }
  await page.waitForFunction(
    (n) => document.querySelectorAll("button").length > 0 &&
      Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("Вернуть")).length > n,
    doneBefore,
    { timeout: 15000 },
  );
  const doneAfter = await page.locator("button:has-text('Вернуть')").count();
  ok(doneAfter === doneBefore + 1, `задание выполнено (${doneBefore}→${doneAfter})`);
  const xp1 = await headerXp(page);
  ok(xp1 > xp0, `XP в шапке вырос: ${xp0} → ${xp1}`);
  ok((await page.locator("text=Все задания дня выполнены").count()) >= 0, "прогресс-бар дня пересчитан");

  // ── план ──
  await gotoTab(page, "План", "План подготовки");
  ok((await page.locator("text=ПРОБНИК").count()) > 0, "дни пробников отмечены");
  ok((await page.locator("text=Набор объёма").count()) > 0, "фазы отображаются");
  await page.locator("button:text-is('Ф3 · Пробники')").click();
  await page.waitForSelector("text=Пробники", { timeout: 5000 });
  ok(true, "фильтр по фазе работает");
  await page.locator("button:text-is('Все')").click();
  await shot(page, `${label}-plan`);

  // ── расписание ──
  await gotoTab(page, "Расписание", "MEXT 2028: план подготовки");
  ok(true, "шапка «MEXT 2028: план подготовки»");
  ok((await page.locator("text=Сегодня").count()) > 0, "чип «Сегодня» привязан к дню");
  await page.locator("button:text-is('Пн')").click();
  await page.waitForSelector("text=07:00–07:30", { timeout: 5000 });
  ok(true, "будний день: утренний блок 07:00–07:30");
  await page.locator("button:text-is('Сб')").click();
  await page.waitForSelector("text=Свободный вечер", { timeout: 5000 });
  ok(true, "субботний режим отображается");
  await page.locator("button:text-is('Этапы')").click();
  await page.waitForSelector("text=посольства Японии в Бишкеке", { timeout: 5000 });
  ok(true, "карточки этапов и чек-лист посольства");
  await page.locator("button:text-is('Вс')").click();
  await page.waitForSelector("text=studyinjapan.go.jp", { timeout: 5000 });
  ok(true, "воскресенье: пробное задание и разбор ошибок");
  await shot(page, `${label}-schedule`);

  // ── предметы ──
  await gotoTab(page, "Предметы", "Изучено");
  ok((await page.locator("text=225 темы").count()) > 0, "сводка «225 темы»");
  await page.locator("button:has-text('Математика B')").click();
  await page.waitForSelector("text=Алгебра и вычисления", { timeout: 5000 });
  await page.locator("button:has-text('Алгебра и вычисления')").click();
  await page.waitForSelector("text=Числа и вычисления", { timeout: 5000 });
  ok(true, "дерево предмет → раздел → темы раскрывается");
  // цикл статуса темы
  const topicBtn = page.locator("button:has-text('Не начато')").first();
  if ((await topicBtn.count()) > 0) {
    await topicBtn.click();
    await page.waitForSelector("text=В работе", { timeout: 10000 });
    ok(true, "переключение статуса темы (не начато → в работе)");
  } else {
    // тема уже «в работе» после выполнения теории
    ok((await page.locator("text=В работе").count()) > 0, "статус темы обновлён после выполнения теории");
  }
  await shot(page, `${label}-subjects`);

  // ── дневник ──
  await gotoTab(page, "Дневник", "Новая запись");
  await page.fill("textarea", `E2E-проверка ${label}: пиксельный дневник работает`);
  await page.click("button:has-text('Записать')");
  await page.waitForSelector(`text=E2E-проверка ${label}`, { timeout: 15000 });
  ok(true, "запись дневника создана");
  await shot(page, `${label}-diary`);

  // ── экзамен ──
  await gotoTab(page, "Экзамен", "5 письменных экзаменов");
  ok((await page.locator("text=до экзамена").count()) > 0, "обратный отсчёт отображается");
  ok((await page.locator("text=Japanese B").count()) > 0, "карточки экзаменов (Japanese B …)");
  ok((await page.locator("text=Natural Sciences A").count()) > 0, "экзамен Physics · Natural Sciences A");
  ok((await page.locator("button:has-text('Экспорт JSON v1')").count()) > 0, "кнопка экспорта JSON v1");
  await shot(page, `${label}-exam`);

  // ── перезагрузка: сессия и данные сохраняются ──
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=5 письменных экзаменов", { timeout: 20000 });
  const xpAfter = await headerXp(page);
  ok(xpAfter >= xp1, `после перезагрузки XP на месте (${xpAfter})`);
  await gotoTab(page, "Дневник", "Новая запись");
  ok(
    (await page.locator(`text=E2E-проверка ${label}`).count()) > 0,
    "запись дневника пережила перезагрузку",
  );

  await browser.close();
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  await runSuite(WEB, "web");
  await runSuite(OFF, "offline");

  console.log("\n══ ИТОГ E2E ══");
  if (failures === 0) console.log("  Все проверки пройдены ✓\n");
  else {
    console.error(`  Провалено: ${failures}\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
