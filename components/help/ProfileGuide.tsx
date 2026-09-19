"use client";

import { ArrowRight, Info, SearchCheck, X } from "lucide-react";
import Link from "next/link";
import { useId, useSyncExternalStore } from "react";
import { TierBadge } from "@/components/profile/TierBadge";
import { Button } from "@/components/ui/button";
import { TIER_SHORT_RU } from "@/lib/ui/labels";

export interface ProfileGuideProps {
  photosCount: number; // photos currently visible after filters
}

const STORAGE_KEY = "campusproof:profile-guide-dismissed";
const listeners = new Set<() => void>();
/** Fallback when localStorage is unavailable (private mode, blocked storage): hide for this page view. */
let dismissedThisVisit = false;

function isDismissed(): boolean {
  if (dismissedThisVisit) return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function dismiss() {
  dismissedThisVisit = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // storage unavailable: the in-memory flag above still hides the guide
  }
  for (const listener of listeners) listener();
}

const TIERS = ["verified", "likely", "unconfirmed"] as const;

/**
 * P4 · #37 · dismissible hint for first-time visitors (dismissal flag in localStorage, access wrapped in try/catch):
 * tier legend (✓ Проверено / ◐ Вероятно / ? Не подтверждено), "нажмите на фото, чтобы увидеть доказательства",
 * link to /how-it-works. Render nothing while photosCount === 0.
 */
export function ProfileGuide({ photosCount }: ProfileGuideProps) {
  // Server and hydration render "dismissed" → nothing; the real flag is read right after hydration.
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  const titleId = useId();
  if (photosCount === 0 || dismissed) return null;

  return (
    <aside aria-labelledby={titleId} className="relative border-l-2 border-foreground/25 py-1 pr-12 pl-4 text-base">
      <Button variant="ghost" size="icon" className="absolute top-0 right-0 size-11" onClick={dismiss}>
        <X aria-hidden="true" />
        <span className="sr-only">Скрыть подсказку</span>
      </Button>
      <h2 id={titleId} className="flex items-center gap-2 font-display font-semibold">
        <Info className="size-4 text-muted-foreground" aria-hidden="true" />
        Нажмите на фото, чтобы открыть доказательства
      </h2>
      <details className="mt-1">
        <summary className="min-h-11 cursor-pointer py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Что означают уровни доверия
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          {TIERS.map((tier) => (
            <span key={tier} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <TierBadge tier={tier} />
              <span className="text-muted-foreground">{TIER_SHORT_RU[tier]}</span>
            </span>
          ))}
        </div>
        <p className="mt-3 flex gap-2 text-sm leading-relaxed">
          <SearchCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Пустой раздел значит «не смогли подтвердить», а не «этого нет в университете».</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button size="sm" onClick={dismiss}>
            Понятно
          </Button>
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
          >
            Как мы проверяем фото
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </details>
    </aside>
  );
}
