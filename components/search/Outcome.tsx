import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface OutcomeProps {
  icon?: LucideIcon;
  title: string;
  lead: ReactNode;
  /** A run that failed: announce the heading block to assistive tech the moment it replaces the profile. */
  alert?: boolean;
  children: ReactNode;
}

/**
 * The shell shared by the three ways a search can end without a profile: several matches, no match,
 * or a run that failed. They are the same moment for the visitor — "we can't show you photos yet,
 * here is why and what to do" — so they get the same shape rather than three near-identical layouts.
 */
export function Outcome({ icon: Icon, title, lead, alert = false, children }: OutcomeProps) {
  return (
    <section className="mx-auto max-w-3xl space-y-6 py-4 sm:py-8">
      <div className="space-y-3" role={alert ? "alert" : undefined}>
        {Icon ? (
          <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
            <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
        ) : null}
        <h1 className="font-display text-[1.625rem] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
          {title}
        </h1>
        <p className="max-w-xl leading-relaxed text-muted-foreground">{lead}</p>
      </div>
      {children}
    </section>
  );
}

/** The quiet "what to try next" box that closes every outcome. */
export function OutcomeHints({ title, items, children }: { title: string; items: string[]; children?: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-dashed p-4 text-sm">
      <p className="font-medium">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground marker:text-border">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {children}
    </div>
  );
}
