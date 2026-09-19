"use client";

import { ArrowRight, Info, MousePointerClick, SearchCheck, X } from "lucide-react";
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
    <aside aria-labelledby={titleId} className="relative rounded-xl border bg-surface p-4 pr-12 text-sm">
      <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" onClick={dismiss}>
        <X aria-hidden="true" />
        <span className="sr-only">Скрыть подсказку</span>
      </Button>
      <h2 id={titleId} className="flex items-center gap-2 font-display font-semibold">
        <Info className="size-4 text-muted-foreground" aria-hidden="true" />
        Как читать профиль
      </h2>
      <ul className="mt-3 space-y-2.5">
        <li className="flex gap-2">
          <MousePointerClick className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            Нажмите на фото — откроются доказательства: откуда снимок, когда он сделан и почему мы ему доверяем.
          </span>
        </li>
        <li className="flex flex-col gap-1.5 pl-6">
          {TIERS.map((tier) => (
            <span key={tier} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <TierBadge tier={tier} />
              <span className="text-muted-foreground">{TIER_SHORT_RU[tier]}</span>
            </span>
          ))}
        </li>
        <li className="flex gap-2">
          <SearchCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Пустой раздел значит «не смогли подтвердить», а не «этого нет в университете».</span>
        </li>
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
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
    </aside>
  );
}
