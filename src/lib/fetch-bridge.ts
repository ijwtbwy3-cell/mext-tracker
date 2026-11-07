/**
 * Офлайн-мост: перехватывает fetch('/api/...') и направляет в локальную
 * SQLite (sql.js + IndexedDB) вместо сетевых маршрутов Next.js.
 * Подключается ПЕРВЫМ в src/offline/main.tsx.
 */

declare const __APP_PASSPHRASE__: string;

import { getSqliteStore } from "./offline/sqlite-store";
import {
  SocialError,
  buyItem,
  cancelFocus,
  coinsState,
  equipItem,
  finishFocus,
  readFocus,
  readInventory,
  readProfile,
  saveProfile,
  startFocus,
} from "./social";
import type { FocusKind } from "./focus";
import type { ShopSlot } from "./shop";

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

function socialMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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
  /* ── профиль ── */
  if (path === "/api/profile" && method === "GET") {
    return json({ profile: await readProfile(store), inventory: await readInventory(store) });
  }
  if (path === "/api/profile" && method === "POST") {
    try {
      const patch: { username?: string; bio?: string; avatar?: string } = {};
      if (typeof body?.username === "string") patch.username = body.username;
      if (typeof body?.bio === "string") patch.bio = body.bio;
      if (typeof body?.avatar === "string") patch.avatar = body.avatar;
      return json({ profile: await saveProfile(store, patch) });
    } catch (e) {
      return json({ error: socialMessage(e) }, 400);
    }
  }

  /* ── магазин ── */
  if (path === "/api/shop" && method === "GET") {
    return json({
      profile: await readProfile(store),
      inventory: await readInventory(store),
      coins: await coinsState(store),
    });
  }
  if (path === "/api/shop" && method === "POST") {
    try {
      if (body?.action === "buy") {
        const res = await buyItem(store, String(body?.itemId ?? ""));
        return json({
          profile: res.profile,
          inventory: res.inventory,
          coins: await coinsState(store),
          bought: res.item.id,
        });
      }
      if (body?.action === "equip") {
        const slot = String(body?.slot ?? "") as ShopSlot;
        if (!["frame", "background", "title"].includes(slot)) throw new SocialError("Неверный слот");
        return json({ profile: await equipItem(store, slot, String(body?.itemId ?? "")) });
      }
      return json({ error: "Неизвестное действие" }, 400);
    } catch (e) {
      return json({ error: socialMessage(e) }, 400);
    }
  }

  /* ── фокус-режим ── */
  if (path === "/api/focus" && method === "POST") {
    const kind: FocusKind = body?.kind === "topic" ? "topic" : "task";
    const id = String(body?.id ?? "");
    try {
      if (!id) throw new SocialError("Не указан объект");
      if (body?.action === "start") {
        const session = await startFocus(store, {
          kind,
          id,
          minutes: Number(body?.minutes ?? 0),
          title: typeof body?.title === "string" ? body.title : undefined,
        });
        return json({ session, focus: await readFocus(store) });
      }
      if (body?.action === "cancel") {
        await cancelFocus(store, kind, id);
        return json({ focus: await readFocus(store) });
      }
      if (body?.action === "finish") {
        const result = await finishFocus(store, kind, id);
        return json({ result, focus: await readFocus(store) });
      }
      return json({ error: "Неизвестное действие" }, 400);
    } catch (e) {
      return json({ error: socialMessage(e) }, 400);
    }
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
