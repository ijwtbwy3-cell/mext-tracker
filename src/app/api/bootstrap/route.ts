import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  try {
    return Response.json(await getWebStore().bootstrap());
  } catch (e) {
    return Response.json({ error: `Ошибка базы данных: ${String(e)}` }, { status: 500 });
  }
}
