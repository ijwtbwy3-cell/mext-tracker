import { getWebStore } from "@/lib/db/web-store";
import { isAuthenticated, unauthorized } from "@/lib/server/auth";
import { SocialError, buyItem, coinsState, equipItem, readInventory, readProfile } from "@/lib/social";
import type { ShopSlot } from "@/lib/shop";

export const dynamic = "force-dynamic";

const SLOTS: ShopSlot[] = ["frame", "background", "title"];

/** GET — баланс и витрина. POST {action: "buy" | "equip"}. */
export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  const store = getWebStore();
  return Response.json({
    profile: await readProfile(store),
    inventory: await readInventory(store),
    coins: await coinsState(store),
  });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const store = getWebStore();
  const fail = (e: unknown) =>
    Response.json({ error: e instanceof SocialError ? e.message : e instanceof Error ? e.message : String(e) }, { status: 400 });

  try {
    if (body.action === "buy") {
      const res = await buyItem(store, String(body.itemId ?? ""));
      return Response.json({
        profile: res.profile,
        inventory: res.inventory,
        coins: await coinsState(store),
        bought: res.item.id,
      });
    }
    if (body.action === "equip") {
      const slot = String(body.slot ?? "") as ShopSlot;
      if (!SLOTS.includes(slot)) throw new SocialError("Неверный слот");
      const profile = await equipItem(store, slot, String(body.itemId ?? ""));
      return Response.json({ profile });
    }
    return Response.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}
