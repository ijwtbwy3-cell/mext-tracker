import { logout, tryLogin } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { passphrase?: string };
  const ok = await tryLogin(String(body.passphrase ?? ""));
  if (!ok) return Response.json({ error: "Неверный пароль" }, { status: 401 });
  return Response.json({ ok: true });
}

export async function DELETE() {
  await logout();
  return Response.json({ ok: true });
}
