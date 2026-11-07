## MEXT Трекер — офлайн-APK

Приложение для Android без интернета: весь контент (5 предметов · 40 разделов · 225 тем ·
636 заданий) и база SQLite живут внутри APK, внешних HTTP-запросов нет.

### Файлы релиза

| Файл | Что это |
|---|---|
| `mext-tracker-<версия>.apk` | готовое приложение для Android (debug-подпись, для личной установки) |
| `mext-tracker-source-<версия>.zip` | полный исходный код: веб-сборка (Next.js + PostgreSQL) и офлайн-сборка (Capacitor + sql.js) |
| `SHA256SUMS.txt` | контрольные суммы — можно сверить после скачивания |

### Установка APK

1. Скачать `.apk` на телефон.
2. Разрешить установку из неизвестных источников для файлового менеджера/браузера.
3. Открыть файл → «Установить».
4. Пароль при первом запуске: **`mext-2027`** (меняется переменной `APP_PASSPHRASE` при сборке).

> APK подписан debug-ключом Capacitor: при обновлении поверх старой версии данные
> сохраняются, но при удалении приложения база стирается — сделайте резервную копию
> (экран «Экзамен» → «Экспорт JSON v1») перед переустановкой.

### Запуск из исходников

```bash
unzip mext-tracker-source-<версия>.zip && cd mext-tracker

# веб (Next.js + PostgreSQL)
cp .env.example .env && npm i && npm run db:push && npm run db:seed && npm run dev

# офлайн-сборка в браузере
npm run build:offline && npx vite preview

# APK (нужны JDK 21 и Android SDK 36)
npx cap add android && npm run android:sync && (cd android && ./gradlew assembleDebug)
```

Подробности — в `README.md` (архитектура, точные числа, экраны) и `CHANGELOG-natural-sciences-a.md`.
