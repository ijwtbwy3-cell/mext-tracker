/** Одноразовая проверка вёрстки экрана «Расписание»: переполнение, переносы, строки. */
import { chromium } from "playwright";

const PASS = "mext-2027";

async function probe(base: string, offline: boolean) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
  await page.goto(`${base}/${offline ? "" : "tasks"}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="password"]', { timeout: 20000 });
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector("nav >> text=Задачи", { timeout: 20000 });
  await page.click("nav >> text=Расписание");
  await page.waitForSelector("text=07:00–07:30", { timeout: 15000 });

  const report = await page.evaluate(() => {
    const doc = document.documentElement;
    const nav = document.querySelector("nav") as HTMLElement;
    const links = Array.from(nav.querySelectorAll("a")) as HTMLElement[];
    const heights = links.map((a) => Math.round(a.getBoundingClientRect().height));
    const widths = links.map((a) => Math.round(a.getBoundingClientRect().width));
    const labels = links.map((a) => a.textContent?.trim());
    return {
      docOverflow: doc.scrollWidth - window.innerWidth,
      navOverflow: nav.scrollWidth - nav.clientWidth,
      tabCount: links.length,
      labels,
      heights,
      widths,
      tabHeightSpread: Math.max(...heights) - Math.min(...heights),
      scheduleRows: document.querySelectorAll(".pixel-panel.px-3").length,
    };
  });

  // суббота и этапы
  await page.locator("button:text-is('Сб')").click();
  await page.waitForSelector("text=Свободный вечер");
  const satRows = await page.locator(".pixel-panel.px-3").count();
  await page.locator("button:text-is('Этапы')").click();
  await page.waitForSelector("text=посольства Японии");
  const stageCards = await page.locator("text=Этап 1: ноябрь-декабрь 2026").count();

  console.log(`\n== ${offline ? "offline" : "web"} ==`);
  console.log(JSON.stringify({ ...report, satRows, stageCards }, null, 1));
  const fail =
    report.docOverflow > 1 ||
    report.navOverflow > 1 ||
    report.tabCount !== 6 ||
    report.tabHeightSpread > 2 ||
    report.scheduleRows < 10 ||
    satRows !== 8 ||
    stageCards < 1;
  console.log(fail ? "LAYOUT FAIL" : "LAYOUT OK");
  await browser.close();
  return fail;
}

const w = await probe("http://127.0.0.1:3000", false);
const o = await probe("http://127.0.0.1:4173", true);
process.exit(w || o ? 1 : 0);
