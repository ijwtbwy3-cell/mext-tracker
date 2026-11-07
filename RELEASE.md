# Релизы

Приложение распространяется двумя способами: **GitHub Release** (скачать APK и исходники)
и обычный `git clone` + локальная сборка.

## Как выпустить релиз (автоматически)

В репозитории лежит готовый workflow `.github/workflows/release.yml` — он сам собирает APK
и публикует Release.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Через 3–5 минут в разделе **Releases** появится релиз с файлами:

| Файл | Что это |
|---|---|
| `mext-tracker-1.0.0.apk` | приложение для Android (debug-подпись, личная установка) |
| `mext-tracker-source-1.0.0.zip` | полный исходный код этого тега |
| `SHA256SUMS.txt` | контрольные суммы |

Что делает workflow по шагам: `npm ci` → `tsc --noEmit` → `verify` → `smoke:offline` →
`vite build` → `cap add android` (папки `android/` в репозитории нет) → иконки
`@capacitor/assets` + фон `#A855F7` → `gradle assembleDebug` → `git archive` → публикация.

Версия (`versionName`) и `versionCode` берутся из тега и номера прогона — править файлы
вручную не нужно.

### Без тега, кнопкой

Actions → **Релиз (APK + исходники)** → *Run workflow* → указать тег (например `v1.0.0`).

### Вручную, без CI

```bash
./scripts/release.sh 1.0.0     # соберёт release/*.apk, release/*-source.zip, SHA256SUMS.txt
gh release create v1.0.0 release/*.apk release/*-source.zip release/SHA256SUMS.txt \
  --title "MEXT Трекер v1.0.0" --notes-file .github/release-template.md
```

Без GitHub CLI: **Releases → Draft a new release** → тег `v1.0.0` → прикрепить файлы из `release/`.

## Проверки на каждый пуш

`.github/workflows/checks.yml` прогоняет `tsc --noEmit`, `npm run verify` (точные числа
5/40/225, 636 заданий, бюджеты, фокус, магазин) и `npm run smoke:offline` (реальный sql.js).
Браузерный e2e требует PostgreSQL и двух dev-серверов, поэтому запускается локально:

```bash
npm run dev            # терминал 1 (нужен .env с DATABASE_URL)
npm run build:offline && npx vite preview --port 4173   # терминал 2
npm run e2e            # 81 проверка в обеих сборках
```

## Важное про подпись APK

Сборка использует **debug-подпись** Capacitor — этого достаточно для личной установки, но
не для Google Play. Для нормальной подписи создайте keystore и добавьте в
`android/app/build.gradle` блок `signingConfigs.release` + секреты в GitHub Actions
(`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`), затем замените
`assembleDebug` на `assembleRelease` в workflow.

## Обновление установленного APK

Ставить новую версию **поверх** старой (не удалять приложение) — тогда база SQLite в
IndexedDB сохранится. Перед обновлением полезно сделать резервную копию:
экран «Экзамен» → **Экспорт JSON v1**.
