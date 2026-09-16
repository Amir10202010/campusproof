import { ComponentStub } from "@/components/dev/ComponentStub";
import type { Tier } from "@/lib/types";

export interface TierBadgeProps {
  tier: Exclude<Tier, "rejected">;
  className?: string;
}

/** P4 · #3 · verified → ✓ «Проверено», likely → ◐ «Вероятно», unconfirmed → ? «Не подтверждено». Icon + text, never color only. */
export function TierBadge(props: TierBadgeProps) {
  return (
    <ComponentStub name="TierBadge" issue={3}>
      {props.tier}
    </ComponentStub>
  );
}
