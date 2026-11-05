/**
 * Веб-аутентификация: пароль из APP_PASSPHRASE, cookie подписывает HMAC.
 * (В офлайн-сборке ту же роль выполняет перехватчик /api/auth в fetch-bridge.)
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "mext_session";

export function appPassphrase(): string {
  return process.env.APP_PASSPHRASE ?? "mext-2027";
}

export function sessionToken(): string {
  return createHmac("sha256", appPassphrase()).update("mext-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const val = jar.get(COOKIE)?.value ?? "";
  return safeEqual(val, sessionToken());
}

export async function tryLogin(passphrase: string): Promise<boolean> {
  if (!safeEqual(passphrase, appPassphrase())) return false;
  const jar = await cookies();
  jar.set(COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return true;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function unauthorized(): Response {
  return Response.json({ error: "Не авторизован" }, { status: 401 });
}
