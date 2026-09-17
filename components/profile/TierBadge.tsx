import { Check, CircleQuestionMark, Contrast, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tier } from "@/lib/types";
import { TIER_LABEL_RU } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";

export interface TierBadgeProps {
  tier: Exclude<Tier, "rejected">;
  className?: string;
}

const TIER_STYLE: Record<TierBadgeProps["tier"], { icon: LucideIcon; className: string }> = {
  verified: { icon: Check, className: "border-emerald-800 bg-emerald-700 text-white" },
  likely: { icon: Contrast, className: "border-amber-300 bg-amber-100 text-amber-950" },
  unconfirmed: { icon: CircleQuestionMark, className: "border-dashed border-zinc-400 bg-zinc-100 text-zinc-700" },
};

/** P4 · #3 · verified → ✓ «Проверено», likely → ◐ «Вероятно», unconfirmed → ? «Не подтверждено». Icon + text, never color only. */
export function TierBadge({ tier, className }: TierBadgeProps) {
  const { icon: Icon, className: tone } = TIER_STYLE[tier];
  return (
    <Badge variant="outline" data-tier={tier} className={cn(tone, className)}>
      <Icon aria-hidden="true" strokeWidth={2.5} />
      {TIER_LABEL_RU[tier]}
    </Badge>
  );
}
