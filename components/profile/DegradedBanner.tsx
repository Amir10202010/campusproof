import { ComponentStub } from "@/components/dev/ComponentStub";
import type { DegradedFlag } from "@/lib/types";

export interface DegradedBannerProps {
  degraded: DegradedFlag[];
}

/** P4 · #4 · one honest banner per flag (texts in docs/architecture.md §8.3). Renders nothing when empty. */
export function DegradedBanner(props: DegradedBannerProps) {
  if (props.degraded.length === 0) return null;
  return (
    <ComponentStub name="DegradedBanner" issue={4}>
      {props.degraded.join(", ")}
    </ComponentStub>
  );
}
