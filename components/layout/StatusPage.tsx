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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-6">
      <div className="space-y-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
        </span>
        {code ? <p className="font-mono text-sm text-muted-foreground">{code}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="text-muted-foreground">{text}</p>
      </div>
      {children}
    </main>
  );
}
