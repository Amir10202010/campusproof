import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface StatusPageProps {
  icon: LucideIcon;
  code?: string; // e.g. "404"
  title: string;
  text: string;
  children?: ReactNode; // actions
}

/** P4 · #35 · one look for 404, error and global-error pages: icon, heading, plain-language text, actions. */
export function StatusPage({ icon: Icon, code, title, text, children }: StatusPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-7 px-4 py-16 sm:px-6">
      <div className="space-y-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
        </span>
        {code ? <p className="annotation">Ошибка {code}</p> : null}
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-balance">{title}</h1>
        <p className="leading-relaxed text-muted-foreground">{text}</p>
      </div>
      {children}
    </main>
  );
}
