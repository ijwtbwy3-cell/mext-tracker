/**
 * Точка входа ОФЛАЙН-сборки (Vite + Capacitor).
 *
 * Порядок важен:
 *   1) installFetchBridge() — перехватывает fetch('/api/...') -> локальная SQLite
 *   2) импорт глобальных стилей (те же globals.css, что и в Next)
 *   3) hash-роутер + те же экраны, что и в веб-сборке
 */

import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { configureSqlWasm } from "@/lib/offline/sqlite-store";
import { installFetchBridge } from "@/lib/fetch-bridge";

configureSqlWasm(() => wasmUrl);
installFetchBridge();

import "@/app/globals.css";

import { StrictMode, useEffect, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/AppShell";
import { currentPath } from "@/shims/next-navigation";
import { TasksScreen } from "@/screens/TasksScreen";
import { PlanScreen } from "@/screens/PlanScreen";
import { ScheduleScreen } from "@/screens/ScheduleScreen";
import { SubjectsScreen } from "@/screens/SubjectsScreen";
import { DiaryScreen } from "@/screens/DiaryScreen";
import { ExamScreen } from "@/screens/ExamScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";

const ROUTES: Record<string, ComponentType> = {
  "/tasks": TasksScreen,
  "/plan": PlanScreen,
  "/schedule": ScheduleScreen,
  "/subjects": SubjectsScreen,
  "/diary": DiaryScreen,
  "/exam": ExamScreen,
  "/profile": ProfileScreen,
};

function OfflineApp() {
  const [route, setRoute] = useState<string>(currentPath);

  useEffect(() => {
    if (!window.location.hash || window.location.hash === "#") {
      window.location.hash = "#/tasks";
    }
    const onChange = () => setRoute(currentPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const Screen = ROUTES[route] ?? TasksScreen;
  return (
    <AppShell>
      <Screen />
    </AppShell>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

createRoot(rootEl).render(
  <StrictMode>
    <OfflineApp />
  </StrictMode>,
);
