# MEXT Трекер

Личный трекер подготовки к экзаменам **MEXT (Natural Sciences)**: план на **209 дней**,
**5 письменных экзаменов** (Japanese B, English B, Mathematics B, Chemistry, Physics/Biology),
**284 темы** и **754 задания** с геймификацией (XP и монеты).

Ключевой архитектурный приём — **одна кодовая база, две сборки**:
компоненты из `src/components` и экраны из `src/screens` пишутся один раз под Next.js,
а офлайн-сборка подменяет `next/link`, `next/navigation`, `next/image` шимами через
`resolve.alias` в Vite; `fetch('/api/...')` перенаправляется в локальную SQLite
(sql.js + IndexedDB) через `fetch-bridge.ts`.

---

## 1. Стек и версии

| Слой | Технология | Версия |
|---|---|---|
| Веб-сборка | Next.js (App Router) | **16.4.4** |
| | React / React DOM | **19.2.6** |
| | PostgreSQL + Drizzle ORM + pg | **0.45.2** / 8.23.1 |
| Офлайн-сборка | Capacitor (core/cli/android) | **8.6.0** |
| | Vite | **8.3.5** |
| | sql.js (SQLite в WebAssembly) + IndexedDB | **1.15.2** |
| Общее | TypeScript | **5.9.3** |
| | Tailwind CSS | **4.3.4** (`@tailwindcss/postcss`) |
| UI | Шрифт Pixelify Sans Variable (self-hosted, кириллица) | woff2 в `src/assets/fonts/` |

В APK **нет ни одного внешнего HTTP-запроса**: шрифты, 3 баннера, иконки (инлайновые SVG)
и wasm SQLite лежат в бандле.

---

## 2. Точные числа (проверяются `npm run verify`)

### Учебный контент — `src/lib/curriculum.ts`

**6 предметов · 49 разделов · 284 темы.** Формат темы — кортеж
`[название, описание, часы, сложность, уровень]` (`TopicTuple`), структура — `SUBJECT_SEEDS`.

| Предмет | Экзамен | Разделов | Тем | Часов |
|---|---|---:|---:|---:|
| Математика B | Mathematics B | 10 | 60 | 253 |
| Химия | Chemistry | 9 | 50 | 232 |
| Физика | Physics/Biology | 10 | 60 | 271 |
| Биология | Physics/Biology | 9 | 59 | 269 |
| Японский язык B | Japanese B | 6 | 30 | 205 |
| Английский язык B | English B | 5 | 25 | 114 |
| **Итого** | **5 экзаменов** | **49** | **284** | **1344** |

### Генератор плана — `src/lib/plan-generator.ts`

Детерминированный алгоритм: один и тот же `startDate` всегда даёт один и тот же план.

* **209 дней** (04.11.2026 → 31.05.2027), экзамен **01.06.2027** (старт + 209 дней).
* **4 фазы с бюджетами минут:** «Фундамент» 60 дн × **300**, «Набор объёма» 70 дн × **330**,
  «Пробники» 55 дн × **300**, «Шлифовка» 24 дн × **240**.
* **Главный предмет дня следует экрану «Расписание»** (`WEEKDAY_MAIN_SUBJECT`):
  Пн и Чт — математика, Вт — физика, Ср — химия, Пт — английский; Сб — биология,
  Вс — японский (добор квот: у этих предметов нет дневного слота в расписании).
  В фазе 1 день состоит из одной пары — она всегда равна дневному предмету;
  вторая пара (фазы 2–3) добирается по максимуму «остаток квоты − будущий спрос»,
  поэтому все 284 темы распределяются ровно по своим предметам. Если квота
  предмета исчерпана (английский: 25 тем на ~30 пятниц) — остальные дни добирают
  другой предмет. Каждая тема получает пару **[теория + практика]**.
* Пары распределяются по дням: фаза 1 — 1 пара/день, фаза 2 — 2 пары/день,
  фаза 3 — 2 пары в первые 24 учебных дня, иначе 1, фаза 4 — 1 пара/день.
* **Цикл повторений:** повторение добавляется ежедневно в фазах 1, 2, 4 и по нечётным
  дням в фазе 3; темы «к сроку» (изученные 3 и 10 дней назад) попадают в очередь,
  бандл до 3 тем на задание.
* **Дни пробников:** каждый 14-й день → **14 пробников** (цикл экзаменов
  Japanese → English → Math → Chemistry → Science).
* **Длительности (формулы):** теория `40 + 7×сложность` (47–75 мин),
  практика `30 + 6×сложность` (36–60 мин), повторение `20 + 4×(бандл−1)` (20–28 мин),
  пробник 120 мин. Ни один день не превышает бюджет фазы (максимум 285 из 330).

**Итог: 754 задания** = 284 теории + 284 практики + 172 повторения + 14 пробников.

### Геймификация — `src/lib/gamification.ts`

```
XP     = round(минуты × 0.4)
Монеты = round(минуты / 4)
+25 XP за пробник
+30 XP за повторение
```

> В задании формула «+30 …» была обрезана — реализовано как **+30 XP за повторение**
> (синхронно с циклом повторений в генераторе). Легко поменять в `gamification.ts`.

Статус темы выводится из её заданий «теория» и «практика»: ни одного → `нет`,
часть → `в работе`, оба → `изучено` (плюс ручной переключатель на экране «Предметы»).

---

## 3. Модель данных — 8 таблиц

`subjects, sections, topics, progress, plan_days, tasks, diary, settings`

* **Веб:** Drizzle-схема `src/lib/db/schema.ts` → PostgreSQL (миграции `drizzle/`).
* **Офлайн:** тот же DDL в `src/lib/offline/ddl.ts` → SQLite (sql.js), байты базы
  живут в **IndexedDB** (`mext-tracker/kv/sqlite-bytes`) и сохраняются в неё
  **синхронно после каждой мутации** (`await persistNow()`) — ответ клиенту уходит
  только после фиксации, поэтому перезагрузка страницы не теряет данные;
  дополнительно есть сброс на `pagehide`/`visibilitychange`.
* Имена колонок идентичны в обеих сборках; FK намеренно нет — при обновлении
  `CURRICULUM_VERSION` контент пересеивается, а `progress` и `diary` сохраняются
  (id тем стабильны).

---

## 4. Потоки данных

**Web (Next.js):**

```
экран → fetch('/api/...') → route handlers (cookie HMAC из APP_PASSPHRASE)
       → WebStore (Drizzle) → PostgreSQL
```

**Offline (Capacitor APK):**

```
экран → fetch('/api/...') → fetch-bridge (перехват в window.fetch)
       → SqliteStore (sql.js, SQLite WASM) → IndexedDB
```

Один и тот же интерфейс `DataStore` (`src/lib/store.ts`) реализован дважды
(`db/web-store.ts` и `offline/sqlite-store.ts`), общая логика наград, тоталов и
вывода статусов тем вынесена в чистые функции. Экраны не знают, где они живут.

**Шимы офлайн-сборки** (`vite.config.ts` → `resolve.alias`):

| Next.js-модуль | Шим | Поведение |
|---|---|---|
| `next/link` | `src/shims/next-link.tsx` | `<a href="#/route">` |
| `next/navigation` | `src/shims/next-navigation.ts` | hash-роутер (`usePathname`, `useRouter`, …) |
| `next/image` | `src/shims/next-image.tsx` | обычный `<img>` с локальными ресурсами |
| `next/router` | `src/shims/next-router.ts` | совместимость со старым API |

Точка входа офлайн-сборки — `src/offline/main.tsx`: сначала `configureSqlWasm()` и
`installFetchBridge()`, затем рендерятся **те же экраны**, что и в web.

---

## 5. Что читает приложение

* **Контент** — встроен в бандл (`curriculum.ts` + `plan-generator.ts`), сидируется в БД при
  первом запуске (или при смене `CURRICULUM_VERSION`).
* **Веб-данные** — PostgreSQL (`DATABASE_URL`).
* **Офлайн-данные** — SQLite в WebAssembly, персистентность через IndexedDB.
* **Пароль** — переменная окружения `APP_PASSPHRASE` (веб: проверяется на сервере,
  cookie = HMAC; офлайн: запекается в бандл через `define`, проверяется fetch-bridge).
* **Внешних HTTP-запросов нет** — ни в веб-клиенте, ни в APK.

---

## 6. Резервная копия — JSON v1

Кнопки «Экспорт/Импорт» на экране «Экзамен». Формат:

```json
{
  "v": 1,
  "app": "mext-tracker",
  "curriculumVersion": "1",
  "createdAt": "2026-11-04T14:00:00.000Z",
  "data": {
    "subjects": [ … ],  "sections": [ … ], "topics": [ … ],
    "progress": [ … ],  "planDays": [ … ], "tasks": [ … ],
    "diary":    [ … ],  "settings": { "startDate": "2026-11-04", … }
  }
}
```

Импорт целиком заменяет все 8 таблиц. Формат одинаков для web и offline — копия
переносится между сборками.

---

## 7. Экраны

| Экран | Файлы | Блоки |
|---|---|---|
| **Вход** | `screens/LoginScreen.tsx` | баннер, поле пароля, ошибки, версия |
| **Задачи** | `screens/TasksScreen.tsx` | карточка дня (фаза, бюджет, прогресс), счётчики XP/монет/серии/тем, список блоков с наградами, закрытие дня, прогресс по 4 фазам |
| **План** | `screens/PlanScreen.tsx` | баннер, карточки 4 фаз, фильтры, таймлайн 209 дней с раскрытием заданий, дни пробников |
| **Расписание** | `screens/ScheduleScreen.tsx` | недельный режим дня Пн–Вс (временные блоки с цветовыми категориями), вкладки дней + «Этапы» (карточки этапов до экзамена, чек-лист посольства), привязка «Сегодня» к текущему дню и чипы задач/бюджета из плана |
| **Предметы** | `screens/SubjectsScreen.tsx` | сводка 6/49/284, карточки предметов → разделы → темы (сердца сложности, уровень, часы), цикл статусов, фильтр «незавершённые» |
| **Дневник** | `screens/DiaryScreen.tsx` | форма (дата, 5 настроений, текст), статистика, список записей, правка/удаление |
| **Экзамен** | `screens/ExamScreen.tsx` | обратный отсчёт, готовность, 5 карточек экзаменов, экспорт/импорт JSON v1, сброс, CRT, выход, инфо о сборке |

Стиль: тёмная фиолетовая палитра, 2px-рамки, «chunky»-тени, CRT-оверлей (скан-линии +
виньетка + мерцание, отключается в настройках), пиксельные SVG-иконки 8×8, 3 PNG-баннера,
русская локаль, шрифт Pixelify Sans Variable с кириллицей.

---

## 8. Структура проекта

```
src/
├── app/                    # Next.js: layout, 5 страниц, 10 API-маршрутов
│   ├── api/                #   auth, bootstrap, tasks/*, progress, diary,
│   │                       #   settings, backup, restore, reset
│   └── globals.css         # Tailwind 4 + @font-face + CRT + пиксель-примитивы
├── assets/                 # fonts/*.woff2, banners/*.png (в бандле обеих сборок)
├── assets-src/             # исходники иконок (icon.png 1024 → capacitor-assets)
├── components/             # AppShell (контекст+вход), TabBar, CRT, PixelIcon, ui
├── screens/                # Login, Tasks, Plan, Schedule, Subjects, Diary, Exam
├── lib/
│   ├── curriculum.ts       # SUBJECT_SEEDS, TopicTuple, 284 темы
│   ├── plan-generator.ts   # детерминированный план, 754 задания
│   ├── gamification.ts     # формулы XP/монет
│   ├── day-schedule.ts     # личное расписание: режим дня Пн–Вс + этапы
│   ├── store.ts            # интерфейс DataStore + чистая логика
│   ├── api.ts              # клиент API (одинаков для обеих сборок)
│   ├── fetch-bridge.ts     # офлайн: fetch('/api/*') → sql.js
│   ├── db/                 # Drizzle-схема + WebStore (PostgreSQL)
│   └── offline/            # DDL, sql.js-хранилище, IndexedDB
├── shims/                  # next/link, next/navigation, next/image, next/router
└── offline/main.tsx        # точка входа Vite-сборки
scripts/                    # verify, seed, smoke-offline, e2e
drizzle/                    # SQL-миграции
android/                    # платформа Capacitor (сгенерирована cap add android)
screenshots/                # скриншоты e2e
```

---

## 9. Команды

```bash
# ─── установка ───
npm install

# ─── веб: разработка / сборка ───
npm run dev                 # http://localhost:3000
npm run build && npm start  # production

# ─── база данных (один раз; нужен PostgreSQL + DATABASE_URL в .env) ───
npm run db:push             # drizzle-kit generate && migrate (8 таблиц)
npm run db:seed             # посев контента и плана

# ─── офлайн: разработка / сборка ───
npm run dev:offline         # Vite dev (шимы next/*, fetch-bridge)
npm run build:offline       # dist/ для Capacitor

# ─── Android APK ───
#   ⚠ Capacitor CLI требует Node ≥ 22
npm run android:sync        # build:offline + cap sync android
npm run android:open        # открыть в Android Studio → Build APK

#   или сборка без Android Studio (JDK 21, Android SDK):
#   JAVA_HOME=… ANDROID_HOME=… ./android/gradlew -p android assembleDebug
#   → android/app/build/outputs/apk/debug/app-debug.apk
#   (в репозитории: sdk.dir в android/local.properties, AGP 8.13 / Gradle 8.14.3,
#    compileSdk 36, minSdk 24; подписывается debug-ключом — для личного установки)

#   иконки (пиксельная M на фиолетовом #a855f7): исходник assets-src/icon.png (1024),
#   веб-фавиконы src/app/icon.png + public/icon.png, нативные Android-иконки:
#   npx capacitor-assets generate --android --assetPath assets-src \
#     --iconBackgroundColor "#a855f7" --splashBackgroundColor "#12081f"

# ─── проверки ───
npm run verify              # точные числа: 6/49/284, 754, бюджеты, детерминизм, награды
npm run smoke:offline       # реальный sql.js в Node: сид, награды, дневник, backup/restore
npm run e2e                 # Playwright: обе сборки в браузере (нужны поднятые серверы)
npx tsc --noEmit            # типы
```

Тесты покрывают обе половины архитектуры:

* `verify` — контент и генератор (точные числа ТЗ);
* `smoke:offline` — офлайн-хранилище на настоящем SQLite WASM;
* API-прогоны и `e2e` (Playwright) — веб на PostgreSQL и офлайн-бандл в Chromium:
  вход, все 6 экранов, выполнение задания с наградой, дневник, перезагрузка
  с сохранением данных (IndexedDB/cookie).

---

## 10. Окружение (`.env`)

```bash
APP_PASSPHRASE=mext-2027                      # пароль входа (обе сборки)
DATABASE_URL=postgresql://user:pass@host/db   # только для веб-сборки
```
