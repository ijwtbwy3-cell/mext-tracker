/** Разбор тела запроса профиля — общая часть для веба и офлайн-моста. */
export function parseThemePayload(raw: unknown): { username?: string; bio?: string; avatar?: string } {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: { username?: string; bio?: string; avatar?: string } = {};
  if (typeof body.username === "string") out.username = body.username;
  if (typeof body.bio === "string") out.bio = body.bio;
  if (typeof body.avatar === "string") out.avatar = body.avatar;
  return out;
}
