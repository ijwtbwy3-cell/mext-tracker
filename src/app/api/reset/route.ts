import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAuthenticated())) return unauthorized();
  await getWebStore().resetProgress();
  return Response.json({ ok: true });
}
