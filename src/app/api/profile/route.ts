import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";
import { SocialError, readInventory, readProfile, saveProfile } from "@/lib/social";
import { parseThemePayload } from "./payload";

export const dynamic = "force-dynamic";

/** GET — профиль и инвентарь. POST — сохранить юзернейм/описание/аватар. */
export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  const store = getWebStore();
  return Response.json({ profile: await readProfile(store), inventory: await readInventory(store) });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = parseThemePayload(await req.json().catch(() => ({})));
  try {
    const profile = await saveProfile(getWebStore(), body);
    return Response.json({ profile });
  } catch (e) {
    const message = e instanceof SocialError ? e.message : e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 400 });
  }
}
