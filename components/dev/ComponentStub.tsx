import type { ReactNode } from "react";

/**
 * Placeholder rendered by UI components that P4 hasn't designed yet. It shows the real data
 * as plain text so the live pipeline is already visible end-to-end. Delete the usage when you
 * implement the component.
 */
export function ComponentStub({ name, issue, children }: { name: string; issue: number; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-muted-foreground/40 p-3 text-xs text-muted-foreground">
      <div className="font-mono">
        {name} · заглушка · P4 #{issue}
      </div>
      {children ? <div className="mt-1 space-y-1 text-foreground">{children}</div> : null}
    </div>
  );
}
