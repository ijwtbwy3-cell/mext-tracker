import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { taskId?: string; spentMin?: number };
  try {
    const result = await getWebStore().completeTask(String(body.taskId ?? ""), body.spentMin);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
