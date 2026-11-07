"use client";

/**
 * Экран «Профиль»: аватар, юзернейм, описание, экипировка косметики и магазин,
 * где монеты тратятся на рамки, фоны и титулы.
 */

import Link from "next/link";
import { useRef, useState } from "react";
import { useApp } from "@/components/AppShell";
import { PixelAvatar, PresetAvatar } from "@/components/PixelAvatar";
import { Button, Card, Chip, ProgressBar, SectionTitle, StatBox } from "@/components/ui";
import { PixelIcon } from "@/components/PixelIcon";
import {
  AVATAR_PRESETS,
  SLOT_LABEL,
  backgroundStyle,
  equippedId,
  itemsBySlot,
  ownedList,
  titleColor,
  titleName,
  type ShopItem,
  type ShopSlot,
} from "@/lib/shop";

const SLOTS: ShopSlot[] = ["frame", "background", "title"];

async function fileToAvatar(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Это не картинка"));
    el.src = dataUrl;
  });
  const side = 96;
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");
  const scale = Math.max(side / img.width, side / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, (side - w) / 2, (side - h) / 2, w, h);
  return canvas.toDataURL("image/png");
}

export function ProfileScreen() {
  const { data, profile, inventory, coinsBalance, coinsSpent, busy, saveProfile, buyItem, equipItem } = useApp();
  const { totals } = data;

  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [tab, setTab] = useState<ShopSlot>("frame");
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const say = (text: string, ok: boolean) => {
    setFlash({ text, ok });
    window.setTimeout(() => setFlash(null), 2600);
  };

  const bg = backgroundStyle(profile.background);

  const onSave = async () => {
    const next = await saveProfile({ username, bio });
    if (next) say("Профиль сохранён", true);
  };

  const onAvatarPreset = async (id: string) => {
    await saveProfile({ avatar: id });
    say("Аватар обновлён", true);
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToAvatar(file);
      await saveProfile({ avatar: dataUrl });
      say("Аватар загружен", true);
    } catch (e) {
      say(e instanceof Error ? e.message : "Ошибка загрузки", false);
    }
  };

  const onBuy = async (item: ShopItem) => {
    const res = await buyItem(item.id);
    if (res.ok) say(`Куплено: ${item.name}`, true);
    else say(res.error ?? "Не удалось купить", false);
  };

  const onEquip = async (slot: ShopSlot, itemId: string) => {
    await equipItem(slot, itemId);
    say("Экипировано", true);
  };

  const itemCard = (item: ShopItem) => {
    const owned = ownedList(inventory, item.slot).includes(item.id);
    const equipped = equippedId(profile, item.slot) === item.id;
    const affordable = coinsBalance >= item.price;
    return (
      <div
        key={item.id}
        className="pixel-panel-2 p-2.5 flex flex-col gap-2"
        style={{ borderColor: equipped ? "var(--color-neon)" : "var(--color-edge)" }}
      >
        <div className="flex items-start gap-2">
          <Preview item={item} />
          <div className="flex-1 min-w-0">
            <b className="block text-xs leading-tight">{item.name}</b>
            <span className="block text-[10px] mt-0.5" style={{ color: "var(--color-dim)" }}>
              {item.desc}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-gold)" }}>
            <PixelIcon name="coin" size={9} color="var(--color-gold)" />
            {item.price === 0 ? "бесплатно" : item.price}
          </span>
          {equipped ? (
            <Chip color="var(--color-neon)">надето</Chip>
          ) : owned ? (
            <button
              className="pixel-chip cursor-pointer"
              style={{ color: "var(--color-cyan)", borderColor: "var(--color-cyan)" }}
              disabled={busy}
              onClick={() => void onEquip(item.slot, item.id)}
            >
              Надеть
            </button>
          ) : (
            <button
              className="pixel-chip cursor-pointer"
              style={{
                color: affordable ? "var(--color-gold)" : "var(--color-dim)",
                borderColor: affordable ? "var(--color-gold)" : "var(--color-edge)",
              }}
              disabled={busy || !affordable}
              onClick={() => void onBuy(item)}
              title={affordable ? "Купить" : "Не хватает монет"}
            >
              Купить
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ─── карточка профиля ─── */}
      <Card className="overflow-hidden">
        <div className="p-4 flex items-center gap-3" style={bg}>
          <PixelAvatar avatar={profile.avatar} frame={profile.frame} size={84} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-lg leading-tight truncate" style={{ textShadow: "3px 3px 0 #000" }}>
                {profile.username}
              </b>
              {titleName(profile.title) ? (
                <Chip color={titleColor(profile.title)}>{titleName(profile.title)}</Chip>
              ) : null}
            </div>
            <p className="text-[11px] mt-1 leading-snug" style={{ color: "var(--color-dim)" }}>
              {profile.bio || "Добавь описание профиля ниже"}
            </p>
          </div>
        </div>

        <div className="p-3 border-t-2 flex gap-2 flex-wrap" style={{ borderColor: "var(--color-edge)" }}>
          <StatBox icon="bolt" label="XP" value={totals.xp} />
          <StatBox icon="coin" label="Монеты" value={coinsBalance} color="var(--color-gold)" />
          <StatBox icon="star" label="Темы" value={`${totals.topicsDone}/${totals.topicsTotal}`} color="var(--color-neon)" />
          <StatBox icon="check" label="Задания" value={`${totals.tasksDone}/${totals.tasksTotal}`} color="var(--color-cyan)" />
        </div>

        {coinsSpent > 0 ? (
          <div className="px-3 pb-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
            Потрачено в магазине: {coinsSpent} монет · заработано всего: {totals.coins}
          </div>
        ) : null}
      </Card>

      {/* ─── редактирование ─── */}
      <section>
        <SectionTitle icon="edit">Профиль</SectionTitle>
        <Card className="p-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
              Юзернейм
            </span>
            <input
              className="pixel-input"
              value={username}
              maxLength={24}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Как тебя звать"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
              Описание профиля
            </span>
            <textarea
              className="pixel-input min-h-[64px] resize-y"
              value={bio}
              maxLength={160}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Цель, дедлайн, девиз"
            />
            <span className="text-[10px] text-right" style={{ color: "var(--color-dim)" }}>
              {bio.length}/160
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
              Аватар
            </span>
            <div className="flex flex-wrap gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const active = profile.avatar === preset.id;
                return (
                  <button
                    key={preset.id}
                    className="cursor-pointer p-1 border-2"
                    style={{
                      borderColor: active ? "var(--color-neon)" : "var(--color-edge)",
                      background: "var(--color-void)",
                    }}
                    title={preset.name}
                    disabled={busy}
                    onClick={() => void onAvatarPreset(preset.id)}
                  >
                    <PresetAvatar id={preset.id} size={40} />
                  </button>
                );
              })}
              <button
                className="pixel-chip cursor-pointer self-center"
                style={{ color: "var(--color-cyan)", borderColor: "var(--color-cyan)" }}
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <PixelIcon name="upload" size={10} color="var(--color-cyan)" /> Своя картинка
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <Button icon="save" disabled={busy} onClick={() => void onSave()}>
            Сохранить профиль
          </Button>

          {flash ? (
            <span className="text-[11px]" style={{ color: flash.ok ? "var(--color-neon)" : "var(--color-rose)" }}>
              {flash.text}
            </span>
          ) : null}
        </Card>
      </section>

      {/* ─── экипировка ─── */}
      <section>
        <SectionTitle icon="star">Экипировано</SectionTitle>
        <Card className="p-3 flex flex-col gap-2">
          {SLOTS.map((slot) => {
            const owned = ownedList(inventory, slot);
            return (
              <div key={slot} className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
                  {SLOT_LABEL[slot]}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {owned.map((id) => {
                    const item = itemsBySlot(slot).find((i) => i.id === id);
                    if (!item) return null;
                    const active = equippedId(profile, slot) === id;
                    return (
                      <button
                        key={id}
                        className="pixel-chip cursor-pointer"
                        style={{
                          color: active ? "var(--color-neon)" : "var(--color-dim)",
                          borderColor: active ? "var(--color-neon)" : "var(--color-edge)",
                        }}
                        disabled={busy || active}
                        onClick={() => void onEquip(slot, id)}
                        title={item.desc}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Card>
      </section>

      {/* ─── магазин ─── */}
      <section>
        <SectionTitle icon="coin">Магазин</SectionTitle>
        <Card className="p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5">
              {SLOTS.map((slot) => (
                <button
                  key={slot}
                  className="pixel-chip cursor-pointer"
                  style={{
                    color: tab === slot ? "var(--color-gold)" : "var(--color-dim)",
                    borderColor: tab === slot ? "var(--color-gold)" : "var(--color-edge)",
                  }}
                  onClick={() => setTab(slot)}
                >
                  {SLOT_LABEL[slot]}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-gold)" }}>
              <PixelIcon name="coin" size={11} color="var(--color-gold)" />
              <b>{coinsBalance}</b>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{itemsBySlot(tab).map(itemCard)}</div>

          <div className="text-[10px] leading-relaxed" style={{ color: "var(--color-dim)" }}>
            Монеты начисляются за выполненные задания (+1 за каждые 4 минуты фокуса). Тратятся один раз — предмет
            остаётся в инвентаре навсегда.
          </div>
          <ProgressBar value={Math.min(coinsBalance, 1500)} max={1500} segments={24} tone="gold" />
        </Card>
      </section>

      <Link href="/tasks" className="pixel-btn ghost inline-flex items-center justify-center gap-2 text-sm">
        <PixelIcon name="chevron" size={12} /> К задачам
      </Link>
    </div>
  );
}

/** Мини-превью товара: рамка вокруг аватара, полоска фона или титул. */
function Preview({ item }: { item: ShopItem }) {
  if (item.slot === "frame") {
    return <PixelAvatar avatar="cat" frame={item.id} size={36} glow={false} />;
  }
  if (item.slot === "background") {
    return (
      <div
        className="shrink-0 border-2"
        style={{ width: 36, height: 36, borderColor: "var(--color-edge)", ...backgroundStyle(item.id) }}
      />
    );
  }
  return (
    <div
      className="shrink-0 flex items-center justify-center border-2 text-[9px] uppercase"
      style={{ width: 36, height: 36, borderColor: "var(--color-edge)", background: "var(--color-void)", color: titleColor(item.id) }}
    >
      ★
    </div>
  );
}
