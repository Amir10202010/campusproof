"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

/**
 * Links appear only once their page is in main: «Бенчмарк» → /benchmark (P3) is still to come.
 */
const NAV_LINKS = [
  { href: "/", label: "Поиск" },
  { href: "/compare", label: "Сравнение" },
  { href: "/how-it-works", label: "Как мы проверяем" },
];

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:outline-solid";

/** P4 · #36 · logo → home, navigation; on phones a compact menu in a side sheet. */
export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const links = (onNavigate?: () => void, vertical = false) => (
    <ul className={cn("flex gap-1", vertical ? "flex-col" : "items-center")}>
      {NAV_LINKS.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            onClick={onNavigate}
            aria-current={isActive(link.href) ? "page" : undefined}
            className={cn(
              "block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground",
              vertical && "text-base",
              FOCUS_RING,
            )}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className={cn("rounded-md", FOCUS_RING)}>
          <Logo />
        </Link>

        <nav aria-label="Основная навигация" className="hidden sm:block">
          {links()}
        </nav>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className={cn("sm:hidden", FOCUS_RING)}>
              <Menu aria-hidden="true" />
              <span className="sr-only">Открыть меню</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" showCloseButton={false} aria-describedby={undefined} className="w-72 gap-2 p-4">
            <div className="flex items-center justify-between">
              <SheetTitle>Меню</SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="icon-sm" className={FOCUS_RING}>
                  <X aria-hidden="true" />
                  <span className="sr-only">Закрыть меню</span>
                </Button>
              </SheetClose>
            </div>
            <nav aria-label="Основная навигация">{links(() => setMenuOpen(false), true)}</nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
