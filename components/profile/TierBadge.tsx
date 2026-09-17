import { Check, CircleQuestionMark, Contrast, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tier } from "@/lib/types";
import { TIER_LABEL_RU, TIER_VERDICT_RU } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";

export interface TierBadgeProps {
  tier: Exclude<Tier, "rejected">;
  className?: string;
}

/** Colors are CSS variables from app/globals.css (--tier-*), shared with the logo and checked for contrast in tests. */
const TIER_STYLE: Record<TierBadgeProps["tier"], { icon: LucideIcon; className: string }> = {
  verified: {
    icon: Check,
    className: "border-tier-verified-border bg-tier-verified text-tier-verified-foreground",
  },
  likely: {
    icon: Contrast,
    className: "border-tier-likely-border bg-tier-likely text-tier-likely-foreground",
  },
  unconfirmed: {
    icon: CircleQuestionMark,
    className: "border-dashed border-tier-unconfirmed-border bg-tier-unconfirmed text-tier-unconfirmed-foreground",
  },
};

/** P4 · #3 · verified → ✓ «Проверено», likely → ◐ «Вероятно», unconfirmed → ? «Не подтверждено». Icon + text, never color only. */
export function TierBadge({ tier, className }: TierBadgeProps) {
  const { icon: Icon, className: tone } = TIER_STYLE[tier];
  // P4 · #37 · hover hint with the plain-language meaning. The trigger stays a non-focusable span: the badge often
  // sits inside a clickable PhotoCard, and the same meaning is spelled out in the evidence dialog and profile guide.
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Badge variant="outline" data-tier={tier} className={cn(tone, className)}>
          <Icon aria-hidden="true" strokeWidth={2.5} />
          {TIER_LABEL_RU[tier]}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-pretty">
        {TIER_VERDICT_RU[tier]}
      </TooltipContent>
    </Tooltip>
  );
}
