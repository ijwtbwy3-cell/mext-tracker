import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";
import { SocialError, cancelFocus, finishFocus, pauseFocus, readFocus, resumeFocus, startFocus } from "@/lib/social";
import type { FocusKind } from "@/lib/focus";

export const dynamic = "force-dynamic";

/** Фокус-режим: POST {action: "start" | "cancel" | "finish", kind, id, minutes?, title?}. */
export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const kind: FocusKind = body.kind === "topic" ? "topic" : "task";
  const id = String(body.id ?? "");
  const store = getWebStore();

  try {
    if (!id) throw new SocialError("Не указан объект");
    if (body.action === "start") {
      const session = await startFocus(store, {
        kind,
        id,
        minutes: Number(body.minutes ?? 0),
        title: typeof body.title === "string" ? body.title : undefined,
      });
      return Response.json({ session, focus: await readFocus(store) });
    }
    if (body.action === "cancel") {
      await cancelFocus(store, kind, id);
      return Response.json({ focus: await readFocus(store) });
    }
    if (body.action === "pause") {
      const session = await pauseFocus(store, kind, id);
      return Response.json({ session, focus: await readFocus(store) });
    }
    if (body.action === "resume") {
      const session = await resumeFocus(store, kind, id);
      return Response.json({ session, focus: await readFocus(store) });
    }
    if (body.action === "finish") {
      const result = await finishFocus(store, kind, id);
      return Response.json({ result, focus: await readFocus(store) });
    }
    return Response.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    const message = e instanceof SocialError ? e.message : e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 400 });
  }
}
