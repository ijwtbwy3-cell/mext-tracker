import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";
import type { BackupV1 } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as BackupV1;
  try {
    await getWebStore().importBackup(body);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
