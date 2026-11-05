import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { date?: string; mood?: number; text?: string };
  const text = String(body.text ?? "").trim();
  if (!text) return Response.json({ error: "Текст записи пустой" }, { status: 400 });
  const row = await getWebStore().addDiary({
    date: String(body.date ?? ""),
    mood: Math.min(5, Math.max(1, Number(body.mood ?? 3))),
    text,
  });
  return Response.json(row);
}

export async function PUT(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    date?: string;
    mood?: number;
    text?: string;
  };
  const row = await getWebStore().updateDiary(String(body.id ?? ""), {
    date: body.date,
    mood: body.mood,
    text: body.text !== undefined ? String(body.text).trim() : undefined,
  });
  if (!row) return Response.json({ error: "Запись не найдена" }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const url = new URL(req.url);
  const id = body.id ?? url.searchParams.get("id") ?? "";
  await getWebStore().deleteDiary(String(id));
  return Response.json({ ok: true });
}
