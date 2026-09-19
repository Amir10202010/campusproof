import { Check, CircleQuestionMark, Contrast, type LucideIcon } from "lucide-react";
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

/**
 * P4 · #3 · verified → ✓ «Проверено», likely → ◐ «Вероятно», unconfirmed → ? «Не подтверждено».
 * Icon + text, never colour alone. Set as a hard-edged stamp rather than a pill — it is a verdict
 * applied to the frame, and the whole interface reads as generated the moment everything is oval.
 */
export function TierBadge({ tier, className }: TierBadgeProps) {
  const { icon: Icon, className: tone } = TIER_STYLE[tier];
  // P4 · #37 · hover hint with the plain-language meaning. The trigger stays a non-focusable span: the badge often
  // sits inside a clickable PhotoCard, and the same meaning is spelled out in the evidence dialog and profile guide.
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span data-tier={tier} className={cn("stamp", tone, className)}>
          <Icon className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={3} />
          {TIER_LABEL_RU[tier]}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-pretty">
        {TIER_VERDICT_RU[tier]}
      </TooltipContent>
    </Tooltip>
  );
}
