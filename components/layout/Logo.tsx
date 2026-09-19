import { cn } from "@/lib/utils";

/**
 * The CampusProof mark: a check inside viewfinder brackets — something framed, examined and passed.
 * The plate and brackets are drawn from the theme tokens so the mark inverts cleanly in dark mode;
 * the check keeps its own token (--logo-check), which flips lightness with the theme.
 * app/icon.svg is the same drawing, frozen in the light palette for browser chrome.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="9" className="fill-foreground" />
      <path
        d="M8 13V9a1 1 0 0 1 1-1h4M19 8h4a1 1 0 0 1 1 1v4M24 19v4a1 1 0 0 1-1 1h-4M13 24H9a1 1 0 0 1-1-1v-4"
        fill="none"
        className="stroke-background"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m11.5 16.2 3 3 6-6.4"
        fill="none"
        className="stroke-logo-check"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark + wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-[0.9375rem] font-semibold tracking-[-0.015em]">
        Campus<span className="text-logo-check">Proof</span>
      </span>
    </span>
  );
}
