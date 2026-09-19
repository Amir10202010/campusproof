import { X } from "lucide-react";
import { TierBadge } from "@/components/profile/TierBadge";
import { TIER_THRESHOLDS } from "@/lib/config/limits";
import { cn } from "@/lib/utils";

/** A score is not a probability: strong evidence and visual contradictions also determine the tier. */
export function TrustScale({ className }: { className?: string }) {
  return (
    <dl className={cn("divide-y border-y", className)}>
      <div className="space-y-2 py-4">
        <dt>
          <TierBadge tier="verified" />
        </dt>
        <dd className="text-base leading-relaxed text-muted-foreground">
          От {TIER_THRESHOLDS.verified} баллов, есть сильное доказательство и нет визуальных противоречий.
        </dd>
      </div>
      <div className="space-y-2 py-4">
        <dt>
          <TierBadge tier="likely" />
        </dt>
        <dd className="text-base leading-relaxed text-muted-foreground">
          От {TIER_THRESHOLDS.likely} баллов, но не выполнены все условия «Проверено». Доказательства есть, уверенности
          меньше.
        </dd>
      </div>
      <div className="space-y-2 py-4">
        <dt>
          <TierBadge tier="unconfirmed" />
        </dt>
        <dd className="text-base leading-relaxed text-muted-foreground">
          От {TIER_THRESHOLDS.unconfirmed} баллов, но недостаточно оснований для более высокого уровня. Скрыто по
          умолчанию. Без визуальной проверки фото без сильного доказательства остаётся на этом уровне даже при высокой
          сумме.
        </dd>
      </div>
      <div className="space-y-2 py-4">
        <dt className="stamp border-destructive/35 bg-destructive-surface text-destructive-foreground">
          <X className="size-3.5 shrink-0" strokeWidth={3} aria-hidden="true" />
          Отклонено
        </dt>
        <dd className="text-base leading-relaxed text-muted-foreground">
          Меньше {TIER_THRESHOLDS.unconfirmed} баллов или причина для отклонения независимо от суммы — например, другой
          вуз на снимке. В фотоподборку не попадает.
        </dd>
      </div>
    </dl>
  );
}
