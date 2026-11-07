/**
 * Профиль, магазин и пиксельная косметика.
 *
 * Косметика — это чистый CSS/пиксельная графика, поэтому она одинаково
 * выглядит в вебе и в офлайн-APK и не требует внешних файлов.
 * Всё хранится в таблице settings (JSON-строки), без изменения схемы БД:
 *   profile       — { username, bio, avatar, frame, background, title }
 *   inventory     — { frames: [], backgrounds: [], titles: [] }
 *   shopSpent     — сколько монет уже потрачено
 *   topicFocus    — { topicId: минуты } награды за темы, закрытые фокус-таймером
 */

export type ShopSlot = "frame" | "background" | "title";

export type ShopItem = {
  id: string;
  slot: ShopSlot;
  name: string;
  desc: string;
  price: number;
  /** Как выглядит рамка аватара. */
  ring?: string;
  /** Фон профиля (CSS background). */
  bg?: string;
  /** Цвет/оформление титула. */
  text?: string;
};

export const PROFILE_KEY = "profile";
export const INVENTORY_KEY = "inventory";
export const SPENT_KEY = "shopSpent";
export const TOPIC_FOCUS_KEY = "topicFocus";

export const FREE_FRAME = "frame-none";
export const FREE_BACKGROUND = "bg-default";
export const NO_TITLE = "title-none";

export const SHOP_ITEMS: ShopItem[] = [
  /* ── рамки ── */
  {
    id: FREE_FRAME,
    slot: "frame",
    name: "Без рамки",
    desc: "Стандартная пиксельная обводка",
    price: 0,
    ring: "var(--color-edge)",
  },
  {
    id: "frame-coal",
    slot: "frame",
    name: "Рамка «Уголёк»",
    desc: "Скромная серая рамка для старта",
    price: 10,
    ring: "#94a3b8",
  },
  {
    id: "frame-neon",
    slot: "frame",
    name: "Рамка «Неон»",
    desc: "Фиолетовое свечение вокруг аватара",
    price: 250,
    ring: "#a855f7",
  },
  {
    id: "frame-gold",
    slot: "frame",
    name: "Рамка «Золото»",
    desc: "Для тех, кто держит темп",
    price: 500,
    ring: "#fbbf24",
  },
  {
    id: "frame-sakura",
    slot: "frame",
    name: "Рамка «Сакура»",
    desc: "Розовые лепестки экзаменационного сезона",
    price: 750,
    ring: "#f9a8d4",
  },
  {
    id: "frame-matrix",
    slot: "frame",
    name: "Рамка «Матрица»",
    desc: "Зелёный код из ночных зубрёжек",
    price: 900,
    ring: "#22c55e",
  },
  {
    id: "frame-rainbow",
    slot: "frame",
    name: "Рамка «Радуга»",
    desc: "Всё сразу: 5 предметов, 5 цветов",
    price: 1200,
    ring: "linear-gradient(135deg,#f472b6,#fbbf24,#22c55e,#22d3ee,#a855f7)",
  },

  /* ── фоны профиля ── */
  {
    id: FREE_BACKGROUND,
    slot: "background",
    name: "Тёмная панель",
    desc: "Стандартный фон",
    price: 0,
    bg: "linear-gradient(160deg,#1b0f2e,#12081f)",
  },
  {
    id: "bg-stars",
    slot: "background",
    name: "Фон «Звёздное небо»",
    desc: "Пиксельные звёзды над Токио",
    price: 300,
    bg:
      "repeating-linear-gradient(90deg,rgba(255,255,255,.10) 0 2px,transparent 2px 26px)," +
      "repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 2px,transparent 2px 22px)," +
      "linear-gradient(160deg,#150a26,#0a0512)",
  },
  {
    id: "bg-sunset",
    slot: "background",
    name: "Фон «Закат»",
    desc: "Оранжево-фиолетовое небо",
    price: 400,
    bg: "linear-gradient(180deg,#3b0a2a 0%,#7c2d12 55%,#f59e0b 100%)",
  },
  {
    id: "bg-grid",
    slot: "background",
    name: "Фон «Сетка»",
    desc: "Синтвейв-сетка из 8-битных времён",
    price: 600,
    bg:
      "repeating-linear-gradient(90deg,rgba(168,85,247,.35) 0 3px,transparent 3px 28px)," +
      "repeating-linear-gradient(0deg,rgba(168,85,247,.35) 0 3px,transparent 3px 28px)," +
      "linear-gradient(180deg,#1a0b2e,#0a0512)",
  },
  {
    id: "bg-sakura",
    slot: "background",
    name: "Фон «Сакура»",
    desc: "Весна, до экзамена ещё есть время",
    price: 800,
    bg: "radial-gradient(circle at 20% 20%,#f9a8d4 0%,transparent 45%),radial-gradient(circle at 80% 10%,#fda4af 0%,transparent 40%),linear-gradient(160deg,#3b0f2b,#12081f)",
  },
  {
    id: "bg-void",
    slot: "background",
    name: "Фон «Пустота»",
    desc: "Чёрный экран CRT с фиолетовым свечением",
    price: 1500,
    bg: "radial-gradient(circle at 50% 0%,rgba(168,85,247,.45),transparent 60%),linear-gradient(180deg,#0a0512,#050208)",
  },

  /* ── титулы ── */
  {
    id: NO_TITLE,
    slot: "title",
    name: "Без титула",
    desc: "Просто имя",
    price: 0,
    text: "var(--color-dim)",
  },
  {
    id: "title-ronin",
    slot: "title",
    name: "Титул «Ронин»",
    desc: "Идёшь своим путём",
    price: 200,
    text: "#94a3b8",
  },
  {
    id: "title-sensei",
    slot: "title",
    name: "Титул «Сенсей»",
    desc: "Учишь сам себя",
    price: 600,
    text: "#22d3ee",
  },
  {
    id: "title-samurai",
    slot: "title",
    name: "Титул «Самурай»",
    desc: "Дисциплина важнее мотивации",
    price: 1000,
    text: "#f87171",
  },
  {
    id: "title-kaiju",
    slot: "title",
    name: "Титул «Кайдзю»",
    desc: "Сносишь темы одну за другой",
    price: 1500,
    text: "#4ade80",
  },
];

export const SLOT_LABEL: Record<ShopSlot, string> = {
  frame: "Рамки",
  background: "Фоны",
  title: "Титулы",
};

/** Пиксельные аватары: 8×8, символы 1..3 — индексы палитры, "." — прозрачно. */
export type AvatarPreset = { id: string; name: string; colors: [string, string, string]; rows: string[] };

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "cat",
    name: "Кот",
    colors: ["#fbbf24", "#12081f", "#f472b6"],
    rows: [
      ".1....1.",
      ".11..11.",
      ".111111.",
      ".131131.",
      ".111111.",
      ".111111.",
      ".1.11.1.",
      "........",
    ],
  },
  {
    id: "ghost",
    name: "Призрак",
    colors: ["#e2e8f0", "#12081f", "#a855f7"],
    rows: [
      "..1111..",
      ".111111.",
      "11111111",
      "13111311",
      "11111111",
      "11111111",
      "11133111",
      "1.11.1.1",
    ],
  },
  {
    id: "ninja",
    name: "Ниндзя",
    colors: ["#1e293b", "#e2e8f0", "#f9a8d4"],
    rows: [
      "..1111..",
      ".111111.",
      "11111111",
      "13333331",
      "11133111",
      "11111111",
      ".111111.",
      "..1111..",
    ],
  },
  {
    id: "robot",
    name: "Робот",
    colors: ["#22d3ee", "#12081f", "#fbbf24"],
    rows: [
      "...11...",
      ".111111.",
      "11111111",
      "13111311",
      "11111111",
      "11133111",
      "11111111",
      ".111111.",
    ],
  },
  {
    id: "fox",
    name: "Лис",
    colors: ["#fb923c", "#12081f", "#fef3c7"],
    rows: [
      "11....11",
      "111..111",
      "11111111",
      "13211231",
      "11133111",
      ".111111.",
      "..1111..",
      "...11...",
    ],
  },
  {
    id: "owl",
    name: "Сова",
    colors: ["#a78bfa", "#12081f", "#fbbf24"],
    rows: [
      ".111111.",
      "13311331",
      "13211321",
      "11111111",
      "11133111",
      "11111111",
      ".111111.",
      "..1111..",
    ],
  },
];

/* ═══════════════════════ модель профиля ═══════════════════════ */

export type Profile = {
  username: string;
  bio: string;
  /** id пресета или data URL загруженной картинки */
  avatar: string;
  frame: string;
  background: string;
  title: string;
};

export type Inventory = {
  frames: string[];
  backgrounds: string[];
  titles: string[];
};

export const DEFAULT_PROFILE: Profile = {
  username: "Странник",
  bio: "Готовлюсь к MEXT. Natural Sciences A.",
  avatar: "cat",
  frame: FREE_FRAME,
  background: FREE_BACKGROUND,
  title: NO_TITLE,
};

export const DEFAULT_INVENTORY: Inventory = {
  frames: [FREE_FRAME],
  backgrounds: [FREE_BACKGROUND],
  titles: [NO_TITLE],
};

const MAX_USERNAME = 24;
const MAX_BIO = 160;

export function sanitizeProfile(raw: unknown): Profile {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Profile>;
  const pickSlot = (slot: ShopSlot, value: unknown, free: string): string => {
    const items = SHOP_ITEMS.filter((i) => i.slot === slot);
    const id = typeof value === "string" && items.some((i) => i.id === value) ? value : free;
    return id;
  };
  const avatar =
    typeof p.avatar === "string" && (isPresetAvatar(p.avatar) || p.avatar.startsWith("data:image/"))
      ? p.avatar
      : DEFAULT_PROFILE.avatar;
  return {
    username: (typeof p.username === "string" ? p.username : DEFAULT_PROFILE.username).trim().slice(0, MAX_USERNAME) ||
      DEFAULT_PROFILE.username,
    bio: (typeof p.bio === "string" ? p.bio : "").slice(0, MAX_BIO),
    avatar,
    frame: pickSlot("frame", p.frame, FREE_FRAME),
    background: pickSlot("background", p.background, FREE_BACKGROUND),
    title: pickSlot("title", p.title, NO_TITLE),
  };
}

export function parseProfile(raw?: string | null): Profile {
  if (!raw) return { ...DEFAULT_PROFILE };
  try {
    return sanitizeProfile(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function parseInventory(raw?: string | null): Inventory {
  const base: Inventory = { frames: [], backgrounds: [], titles: [] };
  if (!raw) return { ...DEFAULT_INVENTORY };
  let data: Partial<Inventory> = {};
  try {
    data = JSON.parse(raw) as Partial<Inventory>;
  } catch {
    return { ...DEFAULT_INVENTORY };
  }
  const clean = (slot: ShopSlot, list: unknown, free: string): string[] => {
    const allowed = new Set(SHOP_ITEMS.filter((i) => i.slot === slot).map((i) => i.id));
    const arr = Array.isArray(list) ? list.filter((x): x is string => typeof x === "string" && allowed.has(x)) : [];
    return Array.from(new Set([free, ...arr]));
  };
  base.frames = clean("frame", data.frames, FREE_FRAME);
  base.backgrounds = clean("background", data.backgrounds, FREE_BACKGROUND);
  base.titles = clean("title", data.titles, NO_TITLE);
  return base;
}

export function isPresetAvatar(id: string): boolean {
  return AVATAR_PRESETS.some((p) => p.id === id);
}

export function findItem(id: string): ShopItem | null {
  return SHOP_ITEMS.find((i) => i.id === id) ?? null;
}

export function itemsBySlot(slot: ShopSlot): ShopItem[] {
  return SHOP_ITEMS.filter((i) => i.slot === slot);
}

export function ownedList(inv: Inventory, slot: ShopSlot): string[] {
  if (slot === "frame") return inv.frames;
  if (slot === "background") return inv.backgrounds;
  return inv.titles;
}

export function addToInventory(inv: Inventory, item: ShopItem): Inventory {
  const next: Inventory = { ...inv, frames: [...inv.frames], backgrounds: [...inv.backgrounds], titles: [...inv.titles] };
  if (item.slot === "frame" && !next.frames.includes(item.id)) next.frames.push(item.id);
  if (item.slot === "background" && !next.backgrounds.includes(item.id)) next.backgrounds.push(item.id);
  if (item.slot === "title" && !next.titles.includes(item.id)) next.titles.push(item.id);
  return next;
}

export function equippedId(profile: Profile, slot: ShopSlot): string {
  if (slot === "frame") return profile.frame;
  if (slot === "background") return profile.background;
  return profile.title;
}

export function withEquipped(profile: Profile, slot: ShopSlot, itemId: string): Profile {
  const next = { ...profile };
  if (slot === "frame") next.frame = itemId;
  if (slot === "background") next.background = itemId;
  if (slot === "title") next.title = itemId;
  return next;
}

/** CSS-стили выбранного фона профиля. */
export function backgroundStyle(id: string): { background: string } {
  const item = findItem(id);
  return { background: item?.bg ?? "linear-gradient(160deg,#1b0f2e,#12081f)" };
}

/** CSS-обводка рамки аватара: сплошной цвет или градиент. */
export function ringStyle(id: string): { ring: string; gradient: boolean } {
  const item = findItem(id);
  const ring = item?.ring ?? "var(--color-edge)";
  return { ring, gradient: ring.startsWith("linear-gradient") };
}

export function titleColor(id: string): string {
  return findItem(id)?.text ?? "var(--color-dim)";
}

export function titleName(id: string): string {
  return id === NO_TITLE ? "" : (findItem(id)?.name.replace(/^Титул\s*/i, "") ?? "");
}
