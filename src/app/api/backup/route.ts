import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  return Response.json(await getWebStore().exportBackup());
}
