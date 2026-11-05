import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { key?: string; value?: string };
  if (!body.key) return Response.json({ error: "Нет key" }, { status: 400 });
  await getWebStore().setSetting(String(body.key), String(body.value ?? ""));
  return Response.json({ ok: true });
}
