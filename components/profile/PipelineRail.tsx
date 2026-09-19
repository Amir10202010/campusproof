import {
  Ban,
  Check,
  CircleCheck,
  CircleDashed,
  Clock,
  Contrast,
  LoaderCircle,
  Minus,
  X,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StageState } from "@/lib/client/profileStream";
import type { PipelineStage, SourceStatus } from "@/lib/types";
import { SOURCE_STATUS_HINT_RU } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";

export interface PipelineRailProps {
  stages: StageState[];
  sources: SourceStatus[];
}

const STAGE_LABEL_RU: Record<PipelineStage, string> = {
  gather: "Поиск",
  fetch: "Загрузка",
  dedup: "Дубли",
  verify: "Проверка",
  assemble: "Профиль",
};

const STAGE_STATUS: Record<StageState["status"], { label: string; icon: LucideIcon; bar: string; iconClass: string }> =
  {
    pending: { label: "ожидает", icon: CircleDashed, bar: "bg-border", iconClass: "text-muted-foreground/70" },
    running: { label: "идёт", icon: LoaderCircle, bar: "animate-pulse bg-foreground/45", iconClass: "animate-spin" },
    done: { label: "готово", icon: CircleCheck, bar: "bg-foreground/70", iconClass: "text-ok" },
  };

/** Russian labels for count keys emitted by the orchestrator (lib/pipeline/orchestrator.ts) and the fixture stream. */
const COUNT_LABEL_RU: Record<string, string> = {
  candidates: "кандидатов",
  fetched: "загружено",
  failed: "не открылись",
  duplicates: "дублей убрано",
  kept: "осталось",
  photos: "фото",
  verified: "проверено",
  likely: "вероятно",
  unconfirmed: "не подтверждено",
  rejected: "отсеяно",
};

const SOURCE_NAME_RU: Record<string, string> = {
  wikidata: "Wikidata",
  wikipedia: "Википедия",
  commons: "Wikimedia Commons",
  web_search: "Веб-поиск",
  openverse: "Openverse",
  vision: "Визуальная проверка",
};

const SOURCE_STATUS: Record<SourceStatus["status"], { label: string; icon: LucideIcon; className: string }> = {
  ok: { label: "ответил", icon: Check, className: "border-ok-border bg-ok-surface text-ok" },
  partial: { label: "ответил частично", icon: Contrast, className: "border-warn-border bg-warn-surface text-warn" },
  timeout: { label: "не успел ответить", icon: Clock, className: "border-warn-border bg-warn-surface text-warn" },
  error: {
    label: "ошибка",
    icon: X,
    className: "border-destructive/35 bg-destructive-surface text-destructive-foreground",
  },
  skipped: { label: "не подключён", icon: Minus, className: "border-dashed text-muted-foreground" },
  simulated_down: {
    label: "отключён (симуляция)",
    icon: Ban,
    className: "border-destructive/35 bg-destructive-surface text-destructive-foreground",
  },
};

/** A zero is news for these counts ("кандидатов: 0"); for the rest ("не открылись: 0") it is noise. */
const ZERO_MATTERS = new Set(["candidates", "fetched", "kept", "photos"]);

function stageSummary(stage: StageState): string {
  const counts = stage.counts ?? {};
  const parts = Object.entries(counts)
    .filter(([key, value]) => COUNT_LABEL_RU[key] && (value > 0 || ZERO_MATTERS.has(key)))
    .map(([key, value]) => `${COUNT_LABEL_RU[key]}: ${value}`);
  if (counts.scoring === 0) parts.push("оценка недоступна");
  return parts.join(" · ");
}

/**
 * P4 · #4 · Поиск → Загрузка → Дубли → Проверка → Профиль with counts; source chips ok / timeout /
 * error / skipped / simulated_down.
 *
 * This is apparatus, not content: it sits on the page's own surface with no card around it, so the
 * photographs below stay the loudest thing on screen. Every number here is a real count from the run.
 */
export function PipelineRail({ stages, sources }: PipelineRailProps) {
  const latest = [...stages].reverse().find((stage) => stage.status !== "pending" && stageSummary(stage));
  const problems = sources.filter((source) => source.status !== "ok");
  const complete = stages.length > 0 && stages.every((stage) => stage.status === "done");

  return (
    <details aria-label="Ход проверки" open={!complete} className="space-y-3 border-y py-3">
      <summary className="cursor-pointer py-1 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
        {complete ? "Как собран профиль" : "Собираем профиль"}
        {problems.length > 0 ? (
          <span className="ml-2 inline-block text-sm font-normal text-warn">Не все источники ответили полностью</span>
        ) : null}
      </summary>
      <ol className="grid grid-cols-5 gap-1.5 sm:gap-3">
        {stages.map((stage) => {
          const status = STAGE_STATUS[stage.status];
          const Icon = status.icon;
          const summary = stageSummary(stage);
          return (
            <li key={stage.stage} className="flex min-w-0 flex-col gap-1.5">
              <span className={cn("h-1 rounded-[1px] transition-colors duration-300", status.bar)} aria-hidden="true" />
              <span className="flex min-w-0 flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
                <Icon className={cn("size-3.5 shrink-0", status.iconClass)} aria-hidden="true" />
                <span className="max-w-full truncate text-xs font-medium sm:text-sm">
                  {STAGE_LABEL_RU[stage.stage]}
                </span>
                <span className="sr-only">
                  : {status.label}
                  {summary ? `, ${summary}` : ""}
                </span>
              </span>
              {summary ? (
                <span className="hidden font-mono text-xs leading-4 text-muted-foreground sm:block" aria-hidden="true">
                  {summary}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {latest ? (
        <p className="font-mono text-xs text-muted-foreground sm:hidden" aria-hidden="true">
          {STAGE_LABEL_RU[latest.stage]}: {stageSummary(latest)}
        </p>
      ) : null}

      <div className="space-y-2 border-t pt-3 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="annotation">Источники</span>
          {sources.length === 0 ? (
            <span className="text-muted-foreground">ждём ответа…</span>
          ) : (
            <ul className="contents">
              {sources.map((source) => (
                <SourceChip key={source.source} source={source} />
              ))}
            </ul>
          )}
        </div>
        {problems.length > 0 ? (
          <ul className="space-y-0.5 text-muted-foreground">
            {problems.map((source) => (
              <li key={source.source}>
                {SOURCE_NAME_RU[source.source] ?? source.source}: {SOURCE_STATUS_HINT_RU[source.status]}.
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

/** P4 · #37 · a source chip with a hint: what this status means for the profile. Developer notes in English stay out. */
function SourceChip({ source }: { source: SourceStatus }) {
  const status = SOURCE_STATUS[source.status];
  const Icon = status.icon;
  const name = SOURCE_NAME_RU[source.source] ?? source.source;
  const hint = SOURCE_STATUS_HINT_RU[source.status];
  return (
    <li>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex cursor-help items-center gap-1.5 rounded-md border px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
              status.className,
            )}
          >
            <Icon className="size-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            <span className="font-medium">{name}</span>
            {source.status === "ok" || source.status === "partial" ? (
              <span className="font-mono tabular-nums">{source.candidates}</span>
            ) : (
              <span>{status.label}</span>
            )}
            <span className="sr-only">: {hint}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 text-pretty">
          {name}: {hint}
          {source.note && /[а-яё]/i.test(source.note) ? ` (${source.note})` : ""}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
