/** Нижняя пиксельная навигация: 6 экранов. Работает и в web, и в offline (шим next/link). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PixelIcon, type IconName } from "./PixelIcon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/tasks", label: "Задачи", icon: "tasks" },
  { href: "/plan", label: "План", icon: "calendar" },
  { href: "/schedule", label: "Расписание", icon: "clock" },
  { href: "/subjects", label: "Предметы", icon: "book" },
  { href: "/diary", label: "Дневник", icon: "diary" },
  { href: "/exam", label: "Экзамен", icon: "trophy" },
];

export function TabBar() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t-2"
      style={{
        background: "var(--color-panel)",
        borderColor: "var(--color-edge)",
        boxShadow: "0 -4px 0 0 var(--color-edge)",
      }}
    >
      <div className="mx-auto max-w-3xl grid grid-cols-6">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-0.5 py-2 text-[9px] uppercase tracking-wide border-r-2 last:border-r-0"
              style={{
                borderColor: "var(--color-edge)",
                background: active ? "var(--color-panel-2)" : "transparent",
                color: active ? "var(--color-gold)" : "var(--color-dim)",
                textShadow: active ? "2px 2px 0 #000" : "none",
              }}
            >
              <PixelIcon name={tab.icon} size={16} color={active ? "var(--color-gold)" : "var(--color-dim)"} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
