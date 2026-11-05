/** Базовые «пиксельные» UI-примитивы, общие для всех экранов. */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { PixelIcon, type IconName } from "./PixelIcon";

export function Button({
  variant = "primary",
  icon,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "gold";
  icon?: IconName;
}) {
  const cls = [
    "pixel-btn inline-flex items-center justify-center gap-2 text-sm font-semibold",
    variant !== "primary" ? variant : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {icon ? <PixelIcon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return <div className={`pixel-panel ${glow ? "today-glow" : ""} ${className}`}>{children}</div>;
}

export function Chip({
  children,
  color,
  icon,
}: {
  children: ReactNode;
  color?: string;
  icon?: IconName;
}) {
  return (
    <span className="pixel-chip" style={color ? { color, borderColor: "#0a0512" } : undefined}>
      {icon ? <PixelIcon name={icon} size={10} color={color ?? "currentColor"} /> : null}
      {children}
    </span>
  );
}

/** Сегментированный прогресс-бар: totalSeg сегментов, заполнено filled. */
export function ProgressBar({
  value,
  max,
  tone = "violet",
  segments = 20,
  className = "",
}: {
  value: number;
  max: number;
  tone?: "violet" | "green" | "gold";
  segments?: number;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const filled = Math.round(ratio * segments);
  return (
    <div className={`pixel-progress ${tone === "green" ? "green" : tone === "gold" ? "gold" : ""} ${className}`}>
      {Array.from({ length: segments }, (_, i) => (
        <i key={i} className={i < filled ? "on" : ""} style={{ flex: 1 }} />
      ))}
    </div>
  );
}

/** Сложность темы — пиксельные сердца 1..5. */
export function Hearts({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5" title={`Сложность ${value}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <PixelIcon key={i} name="heart" size={9} color={i < value ? "#fb7185" : "#3b2566"} />
      ))}
    </span>
  );
}

export function StatBox({
  icon,
  label,
  value,
  color = "var(--color-violet-2)",
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <div className="pixel-panel-2 flex flex-col items-center gap-0.5 px-2 py-2 flex-1 min-w-0">
      <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider" style={{ color: "var(--color-dim)" }}>
        <PixelIcon name={icon} size={10} color={color} />
        {label}
      </span>
      <strong className="text-lg leading-none truncate w-full text-center" style={{ color }}>
        {value}
      </strong>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(6,2,16,0.8)" }}
      onClick={onClose}
    >
      <div className="pixel-panel w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div
          className="flex items-center justify-between px-4 py-3 border-b-2"
          style={{ borderColor: "var(--color-edge)", background: "var(--color-panel-2)" }}
        >
          <h3 className="font-bold text-sm uppercase tracking-wide">{title}</h3>
          <button className="pixel-btn ghost !px-2 !py-1" onClick={onClose} aria-label="Закрыть">
            <PixelIcon name="cross" size={12} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function SectionTitle({ children, icon }: { children: ReactNode; icon?: IconName }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--color-violet-2)" }}>
      {icon ? <PixelIcon name={icon} size={14} color="var(--color-gold)" /> : null}
      {children}
    </h2>
  );
}
