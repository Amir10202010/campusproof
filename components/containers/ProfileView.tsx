"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProfileGuide } from "@/components/help/ProfileGuide";
import { CampusMap } from "@/components/profile/CampusMap";
import { CategorySection } from "@/components/profile/CategorySection";
import { CoveragePanel } from "@/components/profile/CoveragePanel";
import { DegradedBanner } from "@/components/profile/DegradedBanner";
import { DescriptionBlock } from "@/components/profile/DescriptionBlock";
import { EvidenceDialog } from "@/components/profile/EvidenceDialog";
import { FilteredOutTray } from "@/components/profile/FilteredOutTray";
import { FilterBar } from "@/components/profile/FilterBar";
import { PipelineRail } from "@/components/profile/PipelineRail";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { NotFound } from "@/components/search/NotFound";
import { PickList } from "@/components/search/PickList";
import { ProfileError } from "@/components/search/ProfileError";
import { useProfileStream, type ProfileStreamParams } from "@/hooks/useProfileStream";
import { CATEGORIES } from "@/lib/config/categories";
import { computeCoverage } from "@/lib/pipeline/coverage";
import type { CategoryId, Photo } from "@/lib/types";
import { applyFilters, DEFAULT_FILTERS } from "@/lib/ui/filters";

/**
 * Container of the profile page (owner P1, issue #11): stream state → presentational components (P4).
 * P4 changes the look inside components/profile/* and components/search/*; the wiring stays here.
 */
export function ProfileView(props: ProfileStreamParams) {
  const router = useRouter();
  const state = useProfileStream(props);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [openPhoto, setOpenPhoto] = useState<Photo | null>(null);

  // The address bar should hold the link worth sharing: /u/<qid>, plus ?simulate= when what is on
  // screen is a simulated outage — without that flag the copied link would replay as a healthy run.
  // ?refresh=1 is dropped once the run is over: it stays in the URL after the «Oбновить» button,
  // and every reload or shared copy of that address would spend another fresh run on the free quota.
  useEffect(() => {
    if (props.replay || !state.entity) return;
    const fromSearchUrl = !props.qid;
    const refreshFinished = Boolean(props.refresh) && state.status !== "streaming";
    if (!fromSearchUrl && !refreshFinished) return;
    const simulate = props.simulate ? `?simulate=${encodeURIComponent(props.simulate)}` : "";
    window.history.replaceState(null, "", `/u/${state.entity.qid}${simulate}`);
  }, [props.qid, props.refresh, props.replay, props.simulate, state.entity, state.status]);

  const visible = useMemo(() => applyFilters(state.photos, filters), [state.photos, filters]);
  const coverage = useMemo(
    () => state.profile?.coverage ?? computeCoverage(state.photos),
    [state.profile, state.photos],
  );
  // Every chip shows how many photos it would reveal, so choosing one category never zeroes the others (#92):
  // count with the other filters applied, but without the category choice itself.
  const counts = useMemo(() => {
    const result: Partial<Record<CategoryId, number>> = {};
    for (const photo of applyFilters(state.photos, { ...filters, categories: [] })) {
      result[photo.category] = (result[photo.category] ?? 0) + 1;
    }
    return result;
  }, [state.photos, filters]);
  const shownCategories =
    filters.categories.length > 0 ? CATEGORIES.filter((c) => filters.categories.includes(c.id)) : CATEGORIES;
  const pick = (qid: string) => router.push(`/u/${qid}`);

  if (state.status === "ambiguous")
    return <PickList query={state.query ?? ""} candidates={state.candidates} onPick={pick} />;
  if (state.status === "not_found")
    return <NotFound query={state.query ?? ""} suggestions={state.suggestions} onPick={pick} />;
  // The run ended before the university was identified: there is no profile to lay out, so the error
  // box used to sit above an empty skeleton that still said "Ищем университет…". A run that failed
  // later keeps its layout — the photos that did arrive are evidence and stay on screen.
  if (state.error && !state.entity)
    return (
      <ProfileError
        error={state.error}
        query={state.query}
        onRetry={state.error.retryable ? () => window.location.reload() : undefined}
      />
    );

  return (
    <div className="space-y-4">
      {state.error ? (
        <div className="rounded-lg border border-destructive/50 p-3 text-sm">
          {state.error.message} <span className="font-mono text-xs text-muted-foreground">({state.error.code})</span>
        </div>
      ) : null}
      <ProfileHeader
        entity={state.entity}
        facts={state.profile?.facts ?? []}
        startedAt={state.startedAt}
        finishedMs={state.finishedMs}
        cached={state.cached}
        generatedAt={state.profile?.generatedAt}
        originalTotalMs={state.profile?.timings.totalMs}
        distanceToCityCenterM={state.profile?.distanceToCityCenterM}
        onRefresh={state.entity ? () => router.push(`/u/${state.entity?.qid}?refresh=1`) : undefined}
      />
      <PipelineRail stages={state.stages} sources={state.sources} />
      <DegradedBanner degraded={state.profile?.degraded ?? []} />
      <DescriptionBlock description={state.description} ready={state.descriptionReady} />
      <FilterBar value={filters} onChange={setFilters} counts={counts} />
      <ProfileGuide photosCount={visible.length} />
      {shownCategories.map((category) => (
        <CategorySection
          key={category.id}
          category={category}
          photos={visible.filter((p) => p.category === category.id)}
          coverage={coverage[category.id]}
          onOpenPhoto={setOpenPhoto}
          loading={state.status === "streaming"}
        />
      ))}
      <CampusMap
        entity={state.entity}
        photos={visible}
        distanceToCityCenterM={state.profile?.distanceToCityCenterM}
        onOpenPhoto={setOpenPhoto}
      />
      <CoveragePanel
        coverage={coverage}
        onShowUnconfirmed={() => setFilters((f) => ({ ...f, showUnconfirmed: true }))}
      />
      <FilteredOutTray items={state.rejected} />
      <EvidenceDialog
        photo={openPhoto}
        open={openPhoto !== null}
        onOpenChange={(open) => !open && setOpenPhoto(null)}
      />
    </div>
  );
}
