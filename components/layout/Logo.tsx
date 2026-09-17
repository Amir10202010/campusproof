import { cn } from "@/lib/utils";

/** P4 · #36 · the CampusProof mark: a checked photo in viewfinder brackets. Same drawing as app/icon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="#171717" />
      <path
        d="M8 13V9a1 1 0 0 1 1-1h4M19 8h4a1 1 0 0 1 1 1v4M24 19v4a1 1 0 0 1-1 1h-4M13 24H9a1 1 0 0 1-1-1v-4"
        fill="none"
        stroke="#fafafa"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m11.5 16.2 3 3 6-6.4"
        fill="none"
        stroke="#34d399"
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
      <span className="text-base font-semibold tracking-tight">
        Campus<span className="text-tier-verified">Proof</span>
      </span>
    </span>
  );
}
