#!/usr/bin/env bash
# Локальная сборка релиза «в один запуск»: APK + архив исходников + контрольные суммы.
#   ./scripts/release.sh 1.0.0
# Результат кладётся в release/ — дальше либо gh release create, либо загрузка через веб-интерфейс.
set -euo pipefail

VERSION="${1:-1.0.0}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
OUT="$ROOT/release"
mkdir -p "$OUT"

echo "══ 1/5 проверки ══"
npx tsc --noEmit
npm run verify
npm run smoke:offline

echo "══ 2/5 офлайн-бандл ══"
npm run build:offline

echo "══ 3/5 Android ══"
if [ ! -d android ]; then npx cap add android; fi
npx cap sync android
npx @capacitor/assets generate --android --assetPath assets-src \
  --iconBackgroundColor "#a855f7" --splashBackgroundColor "#12081f"
find android/app/src/main/res -name ic_launcher_background.xml -exec sed -i 's/#FFFFFF/#A855F7/g' {} + || true
sed -i "s/versionName \"[^\"]*\"/versionName \"${VERSION}\"/" android/app/build.gradle || true
(cd android && ./gradlew assembleDebug --no-daemon)
cp android/app/build/outputs/apk/debug/app-debug.apk "$OUT/mext-tracker-${VERSION}.apk"

echo "══ 4/5 архив исходников ══"
git archive --format=zip --prefix=mext-tracker/ -o "$OUT/mext-tracker-source-${VERSION}.zip" HEAD

echo "══ 5/5 контрольные суммы ══"
(cd "$OUT" && sha256sum ./*.apk ./*.zip > SHA256SUMS.txt && cat SHA256SUMS.txt)

cat <<TXT

Готово: $OUT
Опубликовать релиз (если установлен GitHub CLI):
  gh release create v${VERSION} \\
    "$OUT/mext-tracker-${VERSION}.apk" \\
    "$OUT/mext-tracker-source-${VERSION}.zip" \\
    "$OUT/SHA256SUMS.txt" \\
    --title "MEXT Трекер v${VERSION}" \\
    --notes-file .github/release-template.md

Или через веб: GitHub → Releases → Draft a new release → тег v${VERSION} → прикрепить файлы из release/.
TXT
