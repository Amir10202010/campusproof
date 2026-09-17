"use client";

import {
  Archive,
  Check,
  CircleDot,
  Eye,
  ExternalLink,
  Flag,
  Layers,
  MapPin,
  Minus,
  ScanSearch,
  TriangleAlert,
  Type,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CATEGORY_BY_ID } from "@/lib/config/categories";
import type { Evidence, Photo } from "@/lib/types";
import { groupEvidence } from "@/lib/ui/evidence";
import { displayHost, formatDateRu, formatDistanceRu, photoAlt, safeHttpUrl } from "@/lib/ui/format";
import {
  DATE_KIND_HINT_RU,
  DATE_KIND_RU,
  EVIDENCE_KIND_RU,
  PHOTO_LABEL_DETAIL_RU,
  PROVIDER_RU,
  SOURCE_TYPE_RU,
  TIER_VERDICT_RU,
} from "@/lib/ui/labels";
import { ExternalImage } from "./ExternalImage";
import { TierBadge } from "./TierBadge";

/** P4 · #37 · an icon per evidence kind, next to the plain-language hint from EVIDENCE_KIND_RU. */
const EVIDENCE_KIND_ICON: Record<Evidence["kind"], LucideIcon> = {
  provenance: Archive,
  geo: MapPin,
  text: Type,
  visual: Eye,
  cross_source: Layers,
  community: Users,
  quality: ScanSearch,
};

export interface EvidenceDialogProps {
  photo: Photo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DESKTOP_QUERY = "(min-width: 640px)";

function subscribeToViewport(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * P4 · #4 · shadcn Dialog (Sheet on mobile): big image, tier + plain-language verdict, evidence list
 * (points > 0 → ✓, < 0 → ✗), "Открыть источник" (target=_blank rel="noopener noreferrer"), date + kind,
 * license/author, distance from campus, "Также найдено на", disabled "Сообщить об ошибке".
 */
export function EvidenceDialog({ photo, open, onOpenChange }: EvidenceDialogProps) {
  const isDesktop = useSyncExternalStore(
    subscribeToViewport,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
  if (!photo) return null;

  // Sheet and Dialog share the Radix Dialog primitive, so DialogTitle/DialogClose work inside both.
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          <EvidenceBody photo={photo} />
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-2xl">
        <EvidenceBody photo={photo} />
      </SheetContent>
    </Sheet>
  );
}

function EvidenceBody({ photo }: { photo: Photo }) {
  const category = CATEGORY_BY_ID[photo.category];
  const sourceUrl = safeHttpUrl(photo.sourcePageUrl);
  const licenseUrl = safeHttpUrl(photo.license?.url);
  const retrievedDay = formatDateRu(photo.retrievedAt);
  const distance = photo.geo?.distanceToCampusM;

  return (
    <div className="shrink-0">
      <div className="relative flex min-h-40 items-center justify-center bg-muted">
        <ExternalImage
          src={photo.imageUrl}
          fallbackSrc={photo.thumbUrl}
          alt={photoAlt(photo)}
          loading="eager"
          fallbackText="Изображение не загрузилось — его можно посмотреть в источнике"
          className="max-h-[45dvh] w-full object-contain"
        />
        <DialogClose asChild>
          <Button variant="secondary" size="icon-sm" className="absolute top-2 right-2 rounded-full shadow-sm">
            <X aria-hidden="true" />
            <span className="sr-only">Закрыть</span>
          </Button>
        </DialogClose>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="space-y-2">
          <TierBadge tier={photo.tier} />
          <DialogTitle className="text-lg leading-snug font-semibold">{photoAlt(photo)}</DialogTitle>
          <DialogDescription className="text-sm text-foreground/80">{TIER_VERDICT_RU[photo.tier]}</DialogDescription>
        </div>

        <section className="space-y-3" aria-label="Доказательства">
          <h3 className="text-sm font-medium">Почему такой уровень</h3>
          {groupEvidence(photo.evidence).map((group) => {
            const meta = EVIDENCE_KIND_RU[group.kind] ?? { title: "Другое", hint: "прочие сигналы" };
            const KindIcon = EVIDENCE_KIND_ICON[group.kind] ?? CircleDot;
            return (
              <div key={group.kind} className="space-y-1">
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <KindIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="font-medium text-foreground">{meta.title}</span>
                  <span>— {meta.hint}</span>
                </p>
                <ul className="space-y-1 text-sm">
                  {group.items.map((evidence, index) => (
                    <EvidenceLine key={`${evidence.signal}-${index}`} evidence={evidence} />
                  ))}
                </ul>
              </div>
            );
          })}
          {photo.labels.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {photo.labels.map((label) => (
                <li key={label} className="flex gap-2 text-amber-900">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{PHOTO_LABEL_DETAIL_RU[label]}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none hover:text-foreground">
              Очки доказательств: {photo.points}
            </summary>
            <p className="mt-1">
              Это очки доказательств, а не вероятность: сумма за найденные признаки. Уровень выставляют правила по этим
              очкам.
            </p>
            <ul className="mt-1 space-y-0.5 tabular-nums">
              {photo.evidence.map((evidence, index) => (
                <li key={`${evidence.signal}-${index}`}>
                  {evidence.points > 0 ? "+" : ""}
                  {evidence.points} · {evidence.label}
                </li>
              ))}
            </ul>
          </details>
        </section>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <Row term="Источник">
            {photo.sourceDomain} · {SOURCE_TYPE_RU[photo.sourceType]}
          </Row>
          <Row term="Найдено через">{PROVIDER_RU[photo.provider] ?? photo.provider}</Row>
          <Row term="Дата">
            {photo.date ? (
              <>
                {capitalize(DATE_KIND_RU[photo.date.kind])} {formatDateRu(photo.date.value)}
                <span className="block text-xs text-muted-foreground">{DATE_KIND_HINT_RU[photo.date.kind]}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Дата съёмки неизвестна</span>
            )}
            <span className="block text-xs text-muted-foreground">Найдено CampusProof {retrievedDay}</span>
          </Row>
          <Row term="Лицензия">
            {photo.license ? (
              <>
                {licenseUrl ? (
                  <a
                    className="underline underline-offset-3"
                    href={licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {photo.license.name}
                  </a>
                ) : (
                  photo.license.name
                )}
                {photo.license.author ? (
                  <span className="block text-muted-foreground">Автор: {photo.license.author}</span>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">Не указана — права принадлежат владельцу источника</span>
            )}
          </Row>
          <Row term="Геометка">
            {distance !== undefined ? (
              `Снято ≈ ${formatDistanceRu(distance)} от кампуса`
            ) : photo.geo ? (
              "Есть, расстояние до кампуса неизвестно"
            ) : (
              <span className="text-muted-foreground">Нет</span>
            )}
          </Row>
          <Row term="Раздел">
            {category.labelRu}
            {photo.secondary.length > 0 ? (
              <span className="text-muted-foreground">
                {" "}
                · также {photo.secondary.map((id) => CATEGORY_BY_ID[id].labelRu.toLowerCase()).join(", ")}
              </span>
            ) : null}
          </Row>
        </dl>

        {photo.alsoFoundAt.length > 0 ? (
          <section className="space-y-1.5" aria-label="Также найдено на">
            <h3 className="text-sm font-medium">Также найдено на</h3>
            <ul className="flex flex-wrap gap-2 text-sm">
              {photo.alsoFoundAt.map((place) => {
                const href = safeHttpUrl(place.sourcePageUrl);
                const label = place.sourceDomain || displayHost(place.sourcePageUrl);
                return (
                  <li key={place.sourcePageUrl}>
                    {href ? (
                      <a
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 hover:bg-muted"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {label}
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="rounded-full border px-2.5 py-1">{label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
          {sourceUrl ? (
            <Button asChild size="lg" className="h-10">
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Открыть источник
                <span className="sr-only"> (откроется в новой вкладке)</span>
              </a>
            </Button>
          ) : null}
          <Button variant="outline" size="lg" className="h-10" disabled title="Скоро">
            <Flag aria-hidden="true" />
            Сообщить об ошибке
          </Button>
        </div>
      </div>
    </div>
  );
}

function EvidenceLine({ evidence }: { evidence: Evidence }) {
  const [Icon, tone, prefix] =
    evidence.points > 0
      ? [Check, "text-emerald-700", "За:"]
      : evidence.points < 0
        ? [X, "text-red-600", "Против:"]
        : [Minus, "text-muted-foreground", "Нейтрально:"];
  return (
    <li className="flex gap-2">
      <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} strokeWidth={2.5} aria-hidden="true" />
      <span>
        <span className="sr-only">{prefix} </span>
        {evidence.label}
      </span>
    </li>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="mb-1 sm:mb-0">{children}</dd>
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
