"use client";

/** Пиксельный аватар: пресет (8×8 SVG) или загруженная картинка в рамке из магазина. */

import { AVATAR_PRESETS, isPresetAvatar, ringStyle } from "@/lib/shop";

export function PixelAvatar({
  avatar,
  frame,
  size = 64,
  glow = true,
}: {
  avatar: string;
  frame: string;
  size?: number;
  glow?: boolean;
}) {
  const { ring, gradient } = ringStyle(frame);
  const pad = Math.max(2, Math.round(size / 16));

  const inner =
    avatar.startsWith("data:image/") ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt="Аватар"
        width={size - pad * 2}
        height={size - pad * 2}
        style={{ imageRendering: "pixelated", display: "block", objectFit: "cover" }}
      />
    ) : (
      <PresetAvatar id={isPresetAvatar(avatar) ? avatar : AVATAR_PRESETS[0].id} size={size - pad * 2} />
    );

  return (
    <div
      className="shrink-0"
      style={{
        padding: pad,
        background: gradient ? ring : "transparent",
        backgroundColor: gradient ? "var(--color-panel)" : ring,
        boxShadow: gradient
          ? "0 0 0 2px var(--color-edge)"
          : `0 0 ${glow ? 10 : 0}px ${gradient ? "#000" : ring}, 0 0 0 2px var(--color-edge)`,
      }}
    >
      <div
        style={{
          background: "var(--color-void)",
          border: "2px solid var(--color-edge)",
          width: size - pad * 2,
          height: size - pad * 2,
          overflow: "hidden",
        }}
      >
        {inner}
      </div>
    </div>
  );
}

export function PresetAvatar({ id, size = 56 }: { id: string; size?: number }) {
  const preset = AVATAR_PRESETS.find((p) => p.id === id) ?? AVATAR_PRESETS[0];
  const cell = size / 8;
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" style={{ display: "block" }}>
      <rect x={0} y={0} width={8} height={8} fill="var(--color-void)" />
      {preset.rows.flatMap((row, y) =>
        row.split("").map((ch, x) => {
          if (ch === ".") return null;
          const color = preset.colors[Number(ch) - 1] ?? preset.colors[0];
          return <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={color} />;
        }),
      )}
      <rect
        x={0}
        y={0}
        width={8}
        height={8}
        fill="none"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth={0.001}
        style={{ pointerEvents: "none" }}
      />
      <title>{`Аватар «${preset.name}» · клетка ${cell.toFixed(1)} px`}</title>
    </svg>
  );
}
