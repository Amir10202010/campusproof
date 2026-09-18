"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CompareTable } from "@/components/compare/CompareTable";
import { ProfileGuide } from "@/components/help/ProfileGuide";
import { CampusMap } from "@/components/profile/CampusMap";
import { CategorySection } from "@/components/profile/CategorySection";
import { CoveragePanel } from "@/components/profile/CoveragePanel";
import { DegradedBanner } from "@/components/profile/DegradedBanner";
import { DescriptionBlock } from "@/components/profile/DescriptionBlock";
import { EvidenceDialog } from "@/components/profile/EvidenceDialog";
import { FilteredOutTray } from "@/components/profile/FilteredOutTray";
import { FilterBar } from "@/components/profile/FilterBar";
import { PhotoCard } from "@/components/profile/PhotoCard";
import { PipelineRail } from "@/components/profile/PipelineRail";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { TierBadge } from "@/components/profile/TierBadge";
import { NotFound } from "@/components/search/NotFound";
import { PickList } from "@/components/search/PickList";
import { ProfileError } from "@/components/search/ProfileError";
import { SearchBox } from "@/components/search/SearchBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StageState } from "@/lib/client/profileStream";
import { CATEGORIES } from "@/lib/config/categories";
import { computeCoverage } from "@/lib/pipeline/coverage";
import type { CandidateCard, CategoryId, Photo, SourceStatus, UniversityProfile } from "@/lib/types";
import { toCompareColumn } from "@/lib/ui/compare";
import { applyFilters, DEFAULT_FILTERS } from "@/lib/ui/filters";

const STAGES_RUNNING: StageState[] = [
  { stage: "gather", status: "done", counts: { candidates: 79 }, ms: 3_750 },
  { stage: "fetch", status: "done", counts: { fetched: 61, failed: 6 }, ms: 6_070 },
  { stage: "dedup", status: "done", counts: { kept: 40, duplicates: 21 }, ms: 6_160 },
  { stage: "verify", status: "running", ms: 6_180 },
  { stage: "assemble", status: "pending" },
];

const STAGES_DONE: StageState[] = STAGES_RUNNING.map((s) =>
  s.stage === "verify"
    ? { ...s, status: "done", counts: { photos: 14, rejected: 6 }, ms: 14_040 }
    : { ...s, status: "done", ms: s.ms ?? 15_960 },
);

const SOURCES_FAILING: SourceStatus[] = [
  { source: "wikipedia", status: "simulated_down", candidates: 0, ms: 1, note: "Симуляция недоступного источника" },
  { source: "commons", status: "timeout", candidates: 0, ms: 7_000 },
  { source: "web_search", status: "error", candidates: 0, ms: 850 },
  { source: "openverse", status: "skipped", candidates: 0, ms: 0, note: "gatherOpenverse is not implemented yet" },
];

/** DEV/PREVIEW ONLY · P4's workbench: every profile component in its interesting states, on fixture data. */
export function FixturesWorkbench({
  profile,
  candidates,
}: {
  profile: UniversityProfile;
  candidates: CandidateCard[];
}) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [openPhoto, setOpenPhoto] = useState<Photo | null>(null);
  const [lastAction, setLastAction] = useState("—");
  const [timer, setTimer] = useState<{ startedAt: number | null; finishedMs: number | null }>({
    startedAt: null,
    finishedMs: null,
  });

  const visible = useMemo(() => applyFilters(profile.photos, filters), [profile.photos, filters]);
  // Counts ignore the category selection, so every chip keeps its own number.
  const counts = useMemo(() => {
    const result: Partial<Record<CategoryId, number>> = {};
    for (const photo of applyFilters(profile.photos, { ...filters, categories: [] })) {
      result[photo.category] = (result[photo.category] ?? 0) + 1;
    }
    return result;
  }, [profile.photos, filters]);
  const shownCategories =
    filters.categories.length > 0 ? CATEGORIES.filter((c) => filters.categories.includes(c.id)) : CATEGORIES;
  const brokenPhoto: Photo = { ...profile.photos[0], id: "fx-broken", thumbUrl: "/fixtures/missing.jpg" };
  // A second fictional university for the compare demo: no library photos → honest empty cell.
  const compareColumns = useMemo(() => {
    const otherPhotos = profile.photos.filter((photo) => photo.category !== "library");
    const other: UniversityProfile = {
      ...profile,
      entity: { ...profile.entity, qid: "Q1-FIXTURE", name: "Демо Технический Университет (ФИКСТУРА)" },
      photos: otherPhotos,
      coverage: computeCoverage(otherPhotos),
      distanceToCityCenterM: undefined,
    };
    return [toCompareColumn(profile), toCompareColumn(other)] as const;
  }, [profile]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-4 py-6 sm:px-6">
      <header className="space-y-2">
        <Badge variant="destructive">ФИКСТУРА — ненастоящие данные</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Песочница компонентов профиля</h1>
        <p className="text-sm text-muted-foreground">
          Стрим целиком:{" "}
          <Link className="underline" href="/search?q=demo&replay=1">
            /search?q=demo&amp;replay=1
          </Link>
          . Последнее действие: <span className="font-medium text-foreground">{lastAction}</span>
        </p>
      </header>

      <Demo title="SearchBox · обычный и в состоянии загрузки">
        <SearchBox
          examples={["ДУ", "Демо Университет", "Demo State University"]}
          onSubmit={(query) => setLastAction(`поиск «${query}»`)}
        />
        <SearchBox defaultValue="Демо Университет" loading onSubmit={() => undefined} />
      </Demo>

      <Demo title="TierBadge">
        <div className="flex flex-wrap gap-2">
          <TierBadge tier="verified" />
          <TierBadge tier="likely" />
          <TierBadge tier="unconfirmed" />
        </div>
      </Demo>

      <Demo title="PhotoCard · превью не загрузилось · карточка без onOpen">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <PhotoCard photo={brokenPhoto} onOpen={setOpenPhoto} />
          <PhotoCard photo={profile.photos[3]} />
        </div>
      </Demo>

      <Demo title="ProfileHeader · живой таймер · сохранённый профиль · ещё ищем">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setTimer({ startedAt: Date.now(), finishedMs: null })}>
            Запустить таймер
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={timer.startedAt === null || timer.finishedMs !== null}
            onClick={() =>
              setTimer((t) => ({ ...t, finishedMs: t.startedAt === null ? null : Date.now() - t.startedAt }))
            }
          >
            Остановить
          </Button>
        </div>
        <ProfileHeader
          entity={profile.entity}
          facts={profile.facts}
          startedAt={timer.startedAt}
          finishedMs={timer.finishedMs}
          cached={false}
          distanceToCityCenterM={profile.distanceToCityCenterM}
        />
        <ProfileHeader
          entity={profile.entity}
          facts={profile.facts}
          startedAt={null}
          finishedMs={240}
          cached
          generatedAt={profile.generatedAt}
          originalTotalMs={profile.timings.totalMs}
          distanceToCityCenterM={profile.distanceToCityCenterM}
          onRefresh={() => setLastAction("обновить профиль")}
        />
        <ProfileHeader entity={null} facts={[]} startedAt={null} finishedMs={null} cached={false} />
      </Demo>

      <Demo title="PipelineRail · идёт проверка · сбои источников">
        <PipelineRail stages={STAGES_RUNNING} sources={profile.sources} />
        <PipelineRail stages={STAGES_DONE} sources={SOURCES_FAILING} />
      </Demo>

      <Demo title="DegradedBanner · все флаги">
        <DegradedBanner degraded={["web_search_unavailable", "vision_unavailable", "wikimedia_unavailable"]} />
      </Demo>

      <Demo title="DescriptionBlock · готовится · готово · нет источников">
        <DescriptionBlock description={null} ready={false} />
        <DescriptionBlock description={profile.description} ready />
        <DescriptionBlock description={null} ready />
      </Demo>

      <Demo title="PickList · NotFound с подсказками · NotFound без подсказок">
        <PickList query="ДУ" candidates={candidates} onPick={(qid) => setLastAction(`выбран ${qid}`)} />
        <NotFound query="Демо Универ" suggestions={candidates.slice(0, 2)} onPick={(qid) => setLastAction(qid)} />
        <NotFound query="фывапролд" suggestions={[]} onPick={(qid) => setLastAction(qid)} />
      </Demo>

      <Demo title="ProfileError · лимит новых проверок · обрыв соединения · не вуз">
        <ProfileError
          error={{
            code: "rate_limited",
            message:
              "Дневной лимит новых проверок исчерпан: сервис работает на бесплатных квотах. Сохранённые профили доступны, новые — завтра.",
            retryable: true,
          }}
          onRetry={() => setLastAction("повторить: rate_limited")}
        />
        <ProfileError
          error={{ code: "stream_failed", message: "Соединение прервалось. Попробуйте ещё раз.", retryable: true }}
          entityName={profile.entity.name}
          onRetry={() => setLastAction("повторить: stream_failed")}
        />
        <ProfileError
          error={{
            code: "not_a_university",
            message: "Q42 в Wikidata — не университет и не вуз, поэтому профиль не строим.",
            retryable: false,
          }}
        />
      </Demo>

      <Demo title="CompareTable · два сохранённых профиля (на телефоне — вкладки)">
        <CompareTable columns={[compareColumns[0], compareColumns[1]]} onOpenPhoto={setOpenPhoto} />
      </Demo>

      <Demo title="Профиль · FilterBar · ProfileGuide · CategorySection · CampusMap · CoveragePanel · FilteredOutTray · EvidenceDialog">
        <FilterBar value={filters} onChange={setFilters} counts={counts} />
        <ProfileGuide photosCount={visible.length} />
        {shownCategories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            photos={visible.filter((p) => p.category === category.id)}
            coverage={profile.coverage[category.id]}
            onOpenPhoto={setOpenPhoto}
          />
        ))}
        <CampusMap
          entity={profile.entity}
          photos={visible}
          distanceToCityCenterM={profile.distanceToCityCenterM}
          onOpenPhoto={setOpenPhoto}
        />
        <CoveragePanel
          coverage={profile.coverage}
          onShowUnconfirmed={(id) => {
            setFilters((f) => ({ ...f, showUnconfirmed: true }));
            setLastAction(`показать неподтверждённые: ${id}`);
          }}
        />
        <FilteredOutTray items={profile.rejected} />
      </Demo>

      <EvidenceDialog
        photo={openPhoto}
        open={openPhoto !== null}
        onOpenChange={(open) => !open && setOpenPhoto(null)}
      />
    </main>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b pb-1 font-mono text-xs text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}
