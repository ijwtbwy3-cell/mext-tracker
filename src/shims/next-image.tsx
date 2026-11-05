/**
 * Шим next/image для офлайн-сборки: обычный <img> с теми же пропсами.
 * Картинки — локальные ресурсы бандла, внешние URL не используются.
 */

import type { ImgHTMLAttributes } from "react";

type ImageProps = {
  src: string | { src: string; width?: number; height?: number };
  alt: string;
  width?: number | `${number}`;
  height?: number | `${number}`;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  placeholder?: string;
  blurDataURL?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height">;

export default function Image({ src, alt, width, height, fill, priority, sizes: _s, quality: _q, placeholder: _p, blurDataURL: _b, style, ...rest }: ImageProps) {
  const resolved = typeof src === "string" ? src : src.src;
  if (fill) {
    return (
      <img
        src={resolved}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }}
        {...rest}
      />
    );
  }
  return (
    <img
      src={resolved}
      alt={alt}
      width={typeof width === "string" ? Number(width) : width}
      height={typeof height === "string" ? Number(height) : height}
      loading={priority ? "eager" : "lazy"}
      style={style}
      {...rest}
    />
  );
}
