"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Links appear only once their page is in main: «Бенчмарк» → /benchmark (P3) is still to come.
 */
const NAV_LINKS = [
  { href: "/", label: "Поиск" },
  { href: "/compare", label: "Сравнение" },
  { href: "/how-it-works", label: "Как мы проверяем" },
];

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid";

/**
 * P4 · #36 · logo → home, navigation, theme switch; on phones a compact menu in a side sheet.
 * The bar sticks: on a profile that scrolls for several screens, the way back has to stay reachable.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const links = (onNavigate?: () => void, vertical = false) => (
    <ul className={cn("flex", vertical ? "flex-col gap-0.5" : "items-center gap-0.5")}>
      {NAV_LINKS.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            onClick={onNavigate}
            aria-current={isActive(link.href) ? "page" : undefined}
            className={cn(
              // The active page is marked by a rule under the label, not by a filled pill: the header
              // should stay quiet next to the photographs.
              "relative block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground",
              !vertical &&
                "after:absolute after:inset-x-3 after:-bottom-px after:h-px after:scale-x-0 after:bg-foreground after:transition-transform after:duration-200 after:content-[''] aria-[current=page]:after:scale-x-100",
              vertical && "text-base aria-[current=page]:bg-accent",
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
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-xl supports-backdrop-filter:bg-background/88">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="CampusProof — на главную" className={cn("rounded-md", FOCUS_RING)}>
          <Logo />
        </Link>

        <div className="flex items-center gap-1">
          <nav aria-label="Основная навигация" className="hidden sm:block">
            {links()}
          </nav>
          <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <ThemeToggle className="size-9" />

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className={cn("size-9 sm:hidden", FOCUS_RING)}>
                <Menu aria-hidden="true" />
                <span className="sr-only">Открыть меню</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" showCloseButton={false} aria-describedby={undefined} className="w-72 gap-2 p-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="font-display">Меню</SheetTitle>
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
      </div>
    </header>
  );
}
