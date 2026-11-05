import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { taskId?: string };
  try {
    const totals = await getWebStore().reopenTask(String(body.taskId ?? ""));
    return Response.json({ totals });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
