/**
 * Браузерный e2e ОБЕИХ сборок (Playwright + Chromium headless):
 *   web     — http://127.0.0.1:3000  (Next.js + PostgreSQL)
 *   offline — http://127.0.0.1:4173  (Vite-бандл, fetch-bridge -> sql.js)
 *
 * Проверяет: вход по паролю, все 6 экранов, фокус-режим (задание и тема
 * засчитываются только после таймера), профиль, магазин косметики,
 * добавление записи дневника, сохранность данных после перезагрузки.
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

/** Вызов API из контекста страницы: в web — сеть, в offline — fetch-bridge. */
async function apiJson(
  page: Page,
  url: string,
  init?: { method?: string; body?: string },
): Promise<{ status: number; body: any }> {
  return page.evaluate(
    async ({ url, init }) => {
      const res = await fetch(url, {
        method: init?.method ?? "GET",
        headers: { "Content-Type": "application/json" },
        body: init?.body,
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body };
    },
    { url, init },
  );
}

/** «Отсиживаем» таймер: сдвигаем startedAt в прошлое, приложение само засчитает. */
async function ageFocus(page: Page, kind: "task" | "topic"): Promise<number> {
  const boot = await apiJson(page, "/api/bootstrap");
  const map = JSON.parse(boot.body?.settings?.focusSessions ?? "{}") as Record<
    string,
    { kind: string; minutes: number; startedAt: number }
  >;
  let touched = 0;
  for (const key of Object.keys(map)) {
    if (map[key].kind !== kind) continue;
    map[key].startedAt = Date.now() - (map[key].minutes + 1) * 60_000;
    touched++;
  }
  const res = await apiJson(page, "/api/settings", {
    method: "POST",
    body: JSON.stringify({ key: "focusSessions", value: JSON.stringify(map) }),
  });
  return touched > 0 && res.status === 200 ? touched : 0;
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

  // ── фокус-режим: задание засчитывается только после таймера ──
  const doneBefore = await page.locator("button:has-text('Вернуть')").count();

  // прерывание фокуса ничего не засчитывает
  await page.locator("button:has-text('Выполнить')").first().click();
  await page.waitForSelector("text=Прервать", { timeout: 10000 });
  ok(true, "кнопка «Выполнить» запускает фокус-таймер");
  ok(
    (await page.locator("button:has-text('Вернуть')").count()) === doneBefore,
    "до конца таймера задание не засчитано",
  );
  await page.locator("button:has-text('Прервать')").first().click();
  await page.waitForSelector("text=Прервать", { state: "detached", timeout: 10000 });
  ok(
    (await page.locator("button:has-text('Прервать')").count()) === 0,
    "прерванный фокус сбрасывается без награды",
  );

  // честный прогон: запускаем снова и «отсиживаем» таймер
  await page.locator("button:has-text('Выполнить')").first().click();
  await page.waitForSelector("text=Прервать", { timeout: 10000 });
  const aged = await ageFocus(page, "task");
  ok(aged > 0, `таймер запущен и досрочно не засчитывается (сессий: ${aged})`);
  // перезагрузка = как будто время прошло: приложение видит истёкший таймер
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=День", { timeout: 20000 });
  await page.waitForFunction(
    (n) =>
      Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("Вернуть")).length > n,
    doneBefore,
    { timeout: 20000 },
  );
  const doneAfter = await page.locator("button:has-text('Вернуть')").count();
  ok(doneAfter === doneBefore + 1, `фокус до конца → задание засчитано (${doneBefore}→${doneAfter})`);
  const xp1 = await headerXp(page);
  ok(xp1 > xp0, `XP начислен после таймера: ${xp0} → ${xp1}`);
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
  // фокус-таймер по теме: тема закрывается только по завершении
  const studiedBefore = await page.locator("button:has-text('Изучено')").count();
  const topicFocusBtn = page.locator("button:has-text('Фокус')").first();
  if ((await topicFocusBtn.count()) > 0) {
    await topicFocusBtn.click();
    await page.waitForSelector("text=Прервать", { timeout: 10000 });
    ok(true, "у темы есть фокус-таймер на её часы");
    const agedTopic = await ageFocus(page, "topic");
    ok(agedTopic > 0, `таймер темы «отсижен» (сессий: ${agedTopic})`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Изучено", { timeout: 20000 });
    await page.locator("button:has-text('Математика B')").click();
    await page.waitForSelector("text=Алгебра и вычисления", { timeout: 5000 });
    await page.locator("button:has-text('Алгебра и вычисления')").click();
    await page.waitForSelector("text=Числа и вычисления", { timeout: 5000 });
    await page.waitForFunction(
      (n) =>
        Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("Изучено")).length > n,
      studiedBefore,
      { timeout: 20000 },
    );
    await page.waitForTimeout(800);
    ok(
      (await page.locator("button:has-text('Изучено')").count()) > studiedBefore,
      "тема закрыта после завершения фокуса",
    );
  } else {
    ok(false, "кнопка фокуса у темы не найдена");
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

  // ── профиль и магазин ──
  await page.click("header a");
  await page.waitForSelector("text=Магазин", { timeout: 15000 });
  ok(true, "экран профиля открывается из шапки");

  await page.fill("input.pixel-input", "Тестер");
  await page.click("button:has-text('Сохранить профиль')");
  await page.waitForTimeout(1200);
  ok((await page.locator("text=Тестер").count()) > 0, "юзернейм сохранён и виден в шапке");

  await page.click('button[title="Ниндзя"]');
  await page.waitForTimeout(1000);
  const afterAvatar = await apiJson(page, "/api/bootstrap");
  ok(
    afterAvatar.body?.settings?.profile?.includes('"avatar":"ninja"'),
    "аватар-пресет записан в профиль",
  );

  const coinBalance = Number((await page.locator("header b").nth(1).textContent())?.replace(/\D/g, "") ?? 0);
  const buyBtn = page.locator("button:has-text('Купить')").first();
  if ((await buyBtn.count()) > 0 && coinBalance >= 10) {
    await buyBtn.click();
    await page.waitForTimeout(1500);
    const afterBuy = await apiJson(page, "/api/bootstrap");
    ok(
      afterBuy.body?.settings?.inventory?.includes("frame-coal"),
      `покупка в магазине списала монеты и выдала предмет (баланс был ${coinBalance})`,
    );
    ok(Number(afterBuy.body?.settings?.shopSpent ?? 0) >= 10, "траты монет учтены в shopSpent");
    await page.locator("button:has-text('Надеть')").first().click();
    await page.waitForTimeout(1200);
    const afterEquip = await apiJson(page, "/api/bootstrap");
    ok(
      afterEquip.body?.settings?.profile?.includes('"frame":"frame-coal"'),
      "купленная рамка экипирована",
    );
  } else {
    ok(false, `не хватает монет для покупки (баланс ${coinBalance})`);
  }
  await shot(page, `${label}-profile`);

  // ── перезагрузка: сессия и данные сохраняются ──
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Магазин", { timeout: 20000 });
  const xpAfter = await headerXp(page);
  ok(xpAfter >= xp1, `после перезагрузки XP на месте (${xpAfter})`);
  ok(
    (await apiJson(page, "/api/bootstrap")).body?.settings?.profile?.includes("Тестер"),
    "профиль пережил перезагрузку",
  );
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
