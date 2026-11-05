/**
 * Офлайн-мост: перехватывает fetch('/api/...') и направляет в локальную
 * SQLite (sql.js + IndexedDB) вместо сетевых маршрутов Next.js.
 * Подключается ПЕРВЫМ в src/offline/main.tsx.
 */

declare const __APP_PASSPHRASE__: string;

import { getSqliteStore } from "./offline/sqlite-store";

const AUTH_FLAG = "mext-authed";

type Json = Record<string, unknown> | unknown[] | null;

function json(data: Json, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAuthed(): boolean {
  try {
    return localStorage.getItem(AUTH_FLAG) === "1";
  } catch {
    return false;
  }
}

async function handle(path: string, method: string, body: Record<string, unknown> | undefined): Promise<Response> {
  // ── аутентификация ──
  if (path === "/api/auth" && method === "POST") {
    const pass = String(body?.passphrase ?? "");
    if (pass === __APP_PASSPHRASE__) {
      localStorage.setItem(AUTH_FLAG, "1");
      return json({ ok: true });
    }
    return json({ error: "Неверный пароль" }, 401);
  }
  if (path === "/api/auth" && method === "DELETE") {
    localStorage.removeItem(AUTH_FLAG);
    return json({ ok: true });
  }

  if (!isAuthed()) return json({ error: "Не авторизован" }, 401);

  const store = await getSqliteStore();

  if (path === "/api/bootstrap" && method === "GET") {
    return json(await store.bootstrap());
  }
  if (path === "/api/tasks/complete" && method === "POST") {
    try {
      return json(await store.completeTask(String(body?.taskId ?? ""), body?.spentMin as number | undefined));
    } catch (e) {
      return json({ error: String(e) }, 400);
    }
  }
  if (path === "/api/tasks/reopen" && method === "POST") {
    try {
      return json({ totals: await store.reopenTask(String(body?.taskId ?? "")) });
    } catch (e) {
      return json({ error: String(e) }, 400);
    }
  }
  if (path === "/api/progress" && method === "POST") {
    await store.setTopicStatus(String(body?.topicId ?? ""), body?.status as never);
    return json({ ok: true });
  }
  if (path === "/api/diary" && method === "POST") {
    const date = String(body?.date ?? "");
    const mood = Number(body?.mood ?? 3);
    const text = String(body?.text ?? "").trim();
    if (!text) return json({ error: "Текст пустой" }, 400);
    return json(await store.addDiary({ date, mood, text }));
  }
  if (path === "/api/diary" && method === "PUT") {
    const row = await store.updateDiary(String(body?.id ?? ""), {
      date: body?.date as string | undefined,
      mood: body?.mood as number | undefined,
      text: body?.text as string | undefined,
    });
    if (!row) return json({ error: "Запись не найдена" }, 404);
    return json(row);
  }
  if (path === "/api/diary" && method === "DELETE") {
    const id = body?.id ?? new URLSearchParams(path.split("?")[1] ?? "").get("id");
    await store.deleteDiary(String(id ?? ""));
    return json({ ok: true });
  }
  if (path === "/api/settings" && method === "POST") {
    await store.setSetting(String(body?.key ?? ""), String(body?.value ?? ""));
    return json({ ok: true });
  }
  if (path === "/api/backup" && method === "GET") {
    return json(await store.exportBackup());
  }
  if (path === "/api/restore" && method === "POST") {
    try {
      await store.importBackup(body as never);
      return json({ ok: true });
    } catch (e) {
      return json({ error: String(e) }, 400);
    }
  }
  if (path === "/api/reset" && method === "POST") {
    await store.resetProgress();
    return json({ ok: true });
  }

  return json({ error: `Неизвестный маршрут: ${method} ${path}` }, 404);
}

/** Устанавливает перехватчик глобального fetch. Вызывать до первого рендера. */
export function installFetchBridge(): void {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (!url.includes("/api/")) return original(input, init);

    const method = (init?.method ?? (typeof input === "object" && !(input instanceof URL) && "method" in input ? input.method : "GET") ?? "GET").toUpperCase();
    let body: Record<string, unknown> | undefined;
    if (init?.body && typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = undefined;
      }
    }
    const path = new URL(url, "http://mext.local").pathname;
    try {
      return await handle(path, method, body);
    } catch (e) {
      console.error("[fetch-bridge]", e);
      return json({ error: String(e) }, 500);
    }
  };
}
