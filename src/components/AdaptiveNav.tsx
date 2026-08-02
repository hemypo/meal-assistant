"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChefHat,
  Receipt,
  Refrigerator,
  Scale,
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
