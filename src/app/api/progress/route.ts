import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";
import type { TopicStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { topicId?: string; status?: TopicStatus };
  if (!body.topicId || !["none", "doing", "done"].includes(String(body.status))) {
    return Response.json({ error: "Некорректные данные" }, { status: 400 });
  }
  await getWebStore().setTopicStatus(body.topicId, body.status as TopicStatus);
  return Response.json({ ok: true });
}
