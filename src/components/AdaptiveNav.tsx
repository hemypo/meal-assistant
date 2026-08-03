"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChefHat,
  Receipt,
  Refrigerator,
  Scale,
  Settings,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Same 5 destinations, same order, same icons in both modes (MASTER.md §4). */
const NAV = [
  { href: "/inventory", label: "Запасы", icon: Refrigerator },
  { href: "/menu", label: "Рацион", icon: ChefHat },
  { href: "/receipts", label: "Чеки", icon: Receipt },
  { href: "/finance", label: "Финансы", icon: BarChart3 },
  { href: "/weight", label: "Вес", icon: Scale },
] as const;

/**
 * Settings is a utility surface, not a sixth module: MASTER.md §4 fixes the
 * bar at five destinations and §7 bans hamburger menus. So it sits in the
 * sidebar footer on desktop and as a header icon on mobile.
 */
export function SettingsLink({ variant }: { variant: "sidebar" | "header" }) {
  const pathname = usePathname();
  const active = pathname.startsWith("/settings");

  if (variant === "header") {
    return (
      <Link
        href="/settings"
        aria-label="Настройки"
        title="Настройки"
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors duration-[160ms] lg:hidden",
          active
            ? "bg-primary-soft text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Settings className="h-5 w-5" aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      href="/settings"
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-bold transition-colors duration-[160ms]",
        active
          ? "bg-primary-soft text-primary"
          : "text-muted-foreground hover:bg-primary-soft hover:text-primary",
      )}
    >
      <Settings className="h-5 w-5" aria-hidden />
      Настройки
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-muted p-4 lg:flex"
    >
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <Utensils className="h-5 w-5 text-primary-foreground" aria-hidden />
        </div>
        <div>
          <p className="text-[15px] font-extrabold leading-tight">Провизия</p>
          <p className="text-[11px] font-semibold text-muted-foreground">
            кухня под контролем
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-bold",
                  "transition-colors duration-[160ms]",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-primary-soft hover:text-primary",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto border-t border-border pt-3">
        <SettingsLink variant="sidebar" />
      </div>
    </nav>
  );
}

export function BottomBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-1 py-2",
              "transition-colors duration-[160ms]",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-[22px] w-[22px]" aria-hidden />
            <span className="text-xs font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
