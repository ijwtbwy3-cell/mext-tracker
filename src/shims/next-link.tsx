/**
 * Шим next/link для офлайн-сборки (resolve.alias в vite.config.ts).
 * Веб-сборка использует настоящий next/link; здесь ссылки ведут на hash-роутер.
 */

import type { AnchorHTMLAttributes, ReactNode } from "react";

type HrefInput =
  | string
  | URL
  | { pathname?: string; query?: string; hash?: string };

export function toPathString(href: HrefInput): string {
  if (typeof href === "string") return href;
  if (href instanceof URL) return href.toString();
  return `${href.pathname ?? "/"}${href.query ?? ""}`;
}

export function toHashHref(href: HrefInput): string {
  const path = toPathString(href);
  if (/^(https?:)?\/\//.test(path) || path.startsWith("#") || path.startsWith("mailto:")) return path;
  return `#${path.startsWith("/") ? path : `/${path}`}`;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: HrefInput;
  children?: ReactNode;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  legacyBehavior?: boolean;
};

export default function Link({ href, children, replace: _r, scroll: _s, prefetch: _p, legacyBehavior: _l, ...rest }: LinkProps) {
  return (
    <a href={toHashHref(href)} {...rest}>
      {children}
    </a>
  );
}
