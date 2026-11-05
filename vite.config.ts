import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Офлайн-сборка (Capacitor APK).
 *
 * Ключевой приём «одна кодовая база, две сборки»: компоненты из src/components
 * и экраны из src/screens пишутся один раз под Next.js-импорты. Здесь эти
 * импорты подменяются шимами через resolve.alias:
 *   next/link      -> src/shims/next-link.tsx
 *   next/image     -> src/shims/next-image.tsx
 *   next/navigation-> src/shims/next-navigation.ts
 * А fetch('/api/...') перенаправляется в локальную SQLite (sql.js + IndexedDB)
 * через src/lib/fetch-bridge.ts (подключается в src/offline/main.tsx ДО рендера).
 */
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "next/link": path.resolve(rootDir, "src/shims/next-link.tsx"),
      "next/image": path.resolve(rootDir, "src/shims/next-image.tsx"),
      "next/navigation": path.resolve(rootDir, "src/shims/next-navigation.ts"),
      "next/router": path.resolve(rootDir, "src/shims/next-router.ts"),
    },
  },
  define: {
    // Пароль берётся из переменной APP_PASSPHRASE (та же, что для веб-сборки),
    // но запекается в бандл на этапе сборки — снаружи APK сетевых запросов нет.
    __APP_PASSPHRASE__: JSON.stringify(process.env.APP_PASSPHRASE ?? "mext-2027"),
    __BUILD_MODE__: JSON.stringify("offline"),
  },
  css: {
    // Tailwind 4 подключается через postcss.config.mjs (@tailwindcss/postcss) —
    // тот же конфиг читает и Next, поэтому отдельного блока здесь не нужно.
  },
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    // Песочный превью-хост вида 4173-<id>.e2b.app
    allow: [".e2b.app", "localhost", "127.0.0.1"],
    allowedHosts: true,
  },
});
