/** Шим next/router для офлайн-сборки (совместимость со старым API). */

import { useRouter } from "./next-navigation";

export { useRouter, usePathname, useSearchParams } from "./next-navigation";

const router = {
  push: (href: string) => {
    window.location.hash = href.startsWith("/") ? href : `/${href}`;
  },
  replace: (href: string) => {
    const url = `${window.location.pathname}${window.location.search}#${href.startsWith("/") ? href : `/${href}`}`;
    window.history.replaceState(null, "", url);
  },
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  refresh: () => {},
  prefetch: () => {},
  isReady: true,
  events: { on: () => {}, off: () => {}, emit: () => {} },
  asPath: () => window.location.hash || "#/",
  pathname: () => window.location.hash || "#/",
};

export default { useRouter, ...router };
