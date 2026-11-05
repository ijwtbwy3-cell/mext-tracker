/**
 * Шим next/navigation для офлайн-сборки: hash-роутер (#/tasks, #/plan, ...).
 */

import { useEffect, useState } from "react";
import { toHashHref } from "./next-link";

export function currentPath(): string {
  if (typeof window === "undefined") return "/";
  const raw = window.location.hash.replace(/^#/, "");
  const path = (raw.split("?")[0] || "/").trim();
  return path.startsWith("/") ? path : `/${path}`;
}

export function currentSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const raw = window.location.hash.replace(/^#/, "");
  const qIndex = raw.indexOf("?");
  return new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : "");
}

export function usePathname(): string {
  const [path, setPath] = useState<string>(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}

export function useSearchParams(): URLSearchParams {
  const [params, setParams] = useState<URLSearchParams>(currentSearchParams);
  useEffect(() => {
    const onChange = () => setParams(currentSearchParams());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return params;
}

export function useParams(): Record<string, string> {
  return {};
}

export function useRouter() {
  const navigate = (href: string, replace: boolean) => {
    const hash = toHashHref(href);
    if (replace) {
      const url = `${window.location.pathname}${window.location.search}${hash}`;
      window.history.replaceState(null, "", url);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = hash.replace(/^#/, "#");
    }
  };
  return {
    push: (href: string) => navigate(href, false),
    replace: (href: string) => navigate(href, true),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => {},
    prefetch: () => {},
    isReady: true,
  };
}

export function redirect(path: string): never {
  window.location.hash = toHashHref(path).replace(/^#/, "");
  throw new Error(`OFFLINE_REDIRECT:${path}`);
}

export function notFound(): never {
  throw new Error("NOT_FOUND");
}

export function useSelectedLayoutSegment(): string | null {
  return null;
}

export function useSelectedLayoutSegments(): string[] {
  return [];
}
