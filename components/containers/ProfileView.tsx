"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CommunityGallery } from "@/components/community/CommunityGallery";
import { ContributePhoto, type UploadOutcome } from "@/components/community/ContributePhoto";
import { ReviewForm, type ReviewOutcome } from "@/components/community/ReviewForm";
import { ReviewList } from "@/components/community/ReviewList";
import { ProfileGuide } from "@/components/help/ProfileGuide";
import { CampusMap } from "@/components/profile/CampusMap";
import { CategoryNav } from "@/components/profile/CategoryNav";
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
import { shareableProfilePath } from "@/lib/client/profileStream";
import { CATEGORIES } from "@/lib/config/categories";
import type { PublicCommunityPhoto, PublicCommunityReview, ReviewAspect } from "@/lib/community/types";
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
  const [loadedCommunity, setLoadedCommunity] = useState<{ qid: string; photos: PublicCommunityPhoto[] } | null>(null);
  const qid = state.entity?.qid;
  const communityPhotos = loadedCommunity && loadedCommunity.qid === qid ? loadedCommunity.photos : [];

  const refreshCommunityPhotos = useCallback(async (forQid: string) => {
    try {
      const response = await fetch(`/api/community/${forQid}`);
      const data = await response.json();
      setLoadedCommunity({ qid: forQid, photos: Array.isArray(data.photos) ? data.photos : [] });
    } catch {
      setLoadedCommunity({ qid: forQid, photos: [] });
    }
  }, []);

  useEffect(() => {
    if (!qid) return;
    const controller = new AbortController();
    fetch(`/api/community/${qid}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setLoadedCommunity({ qid, photos: Array.isArray(data.photos) ? data.photos : [] }))
      .catch(() => setLoadedCommunity({ qid, photos: [] }));
    return () => controller.abort();
  }, [qid]);

  const handleUpload = useCallback(
    async (file: File, category: CategoryId, caption: string): Promise<UploadOutcome> => {
      if (!qid) return { checks: [], error: "Сначала выберите университет." };
      const form = new FormData();
      form.set("file", file);
      form.set("qid", qid);
      form.set("category", category);
      form.set("caption", caption);
      try {
        const response = await fetch("/api/community/photo", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) return { checks: data.checks ?? [], error: data.message ?? "Не удалось загрузить фото." };
        if (response.status === 201) void refreshCommunityPhotos(qid);
        return { status: data.status, checks: data.checks ?? [] };
      } catch {
        return { checks: [], error: "Сеть недоступна — попробуйте ещё раз." };
      }
    },
    [qid, refreshCommunityPhotos],
  );

  const [loadedReviews, setLoadedReviews] = useState<{ qid: string; reviews: PublicCommunityReview[] } | null>(null);
  const reviews = loadedReviews && loadedReviews.qid === qid ? loadedReviews.reviews : [];

  useEffect(() => {
    if (!qid) return;
    const controller = new AbortController();
    fetch(`/api/community/reviews/${qid}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setLoadedReviews({ qid, reviews: Array.isArray(data.reviews) ? data.reviews : [] }))
      .catch(() => setLoadedReviews({ qid, reviews: [] }));
    return () => controller.abort();
  }, [qid]);

  const handleReviewSubmit = useCallback(
    async (aspect: ReviewAspect, rating: number, text: string): Promise<ReviewOutcome> => {
      if (!qid) return { error: "Сначала выберите университет." };
      try {
        const response = await fetch("/api/community/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ qid, aspect, rating, text }),
        });
        const data = await response.json();
        if (!response.ok) return { error: data.message ?? "Не удалось отправить отзыв." };
        if (data.status === "published")
          setLoadedReviews((prev) => ({ qid, reviews: [data, ...(prev?.reviews ?? [])] }));
        return { review: data };
      } catch {
        return { error: "Сеть недоступна — попробуйте ещё раз." };
      }
    },
    [qid],
  );

  const handleReviewReport = useCallback((id: string) => {
    void fetch(`/api/community/review/${id}/report`, { method: "POST" });
  }, []);

  // /search?q=… and /u/<qid>?refresh=1 become the shareable /u/<qid> without re-running the stream.
  useEffect(() => {
    if (props.replay || !state.entity) return;
    const next = shareableProfilePath(window.location.href, state.entity.qid);
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, "", next);
    }
  }, [props.replay, state.entity]);

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
  // What each section actually shows right now — the side rail reports the page, not the filter chips.
  const visibleCounts = useMemo(() => {
    const result: Partial<Record<CategoryId, number>> = {};
    for (const photo of visible) result[photo.category] = (result[photo.category] ?? 0) + 1;
    return result;
  }, [visible]);
  const shownCategories =
    filters.categories.length > 0 ? CATEGORIES.filter((c) => filters.categories.includes(c.id)) : CATEGORIES;
  const pick = (qid: string) => router.push(`/u/${qid}`);

  if (state.status === "ambiguous")
    return <PickList query={state.query ?? ""} candidates={state.candidates} onPick={pick} />;
  if (state.status === "not_found")
    return <NotFound query={state.query ?? ""} suggestions={state.suggestions} onPick={pick} />;
  // The run failed before any photo arrived: an honest error screen instead of a "searching…" skeleton that never ends.
  if (state.status === "error" && state.error && state.photos.length === 0)
    return (
      <ProfileError error={state.error} entityName={state.entity?.name} onRetry={() => window.location.reload()} />
    );

  return (
    <div className="space-y-6">
      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/35 bg-destructive-surface px-3.5 py-3 text-sm text-destructive-foreground"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {state.error.message} <span className="font-mono text-xs opacity-75">({state.error.code})</span>
          </span>
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
      <DegradedBanner
        degraded={state.profile?.degraded ?? []}
        visionPartial={state.sources.some((source) => source.source === "vision" && source.status === "partial")}
      />
      <DescriptionBlock description={state.description} ready={state.descriptionReady || state.status === "error"} />
      <FilterBar value={filters} onChange={setFilters} counts={counts} />
      <ProfileGuide photosCount={visible.length} />

      {/* The photographs are the page. The side rail says where you are in them; it never competes. */}
      <div className="grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="min-w-0 space-y-10">
          {shownCategories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              photos={visible.filter((p) => p.category === category.id)}
              coverage={coverage[category.id]}
              onOpenPhoto={setOpenPhoto}
            />
          ))}
          <CampusMap
            entity={state.entity}
            photos={visible}
            distanceToCityCenterM={state.profile?.distanceToCityCenterM}
            onOpenPhoto={setOpenPhoto}
          />
        </div>
        <aside className="hidden xl:block">
          <div className="sticky top-36">
            <CategoryNav categories={shownCategories} coverage={coverage} counts={visibleCounts} />
          </div>
        </aside>
      </div>

      {/* How the run accounts for itself: what got confirmed, and what was thrown away and why. */}
      <div className="space-y-4 border-t pt-8">
        <CoveragePanel
          coverage={coverage}
          onShowUnconfirmed={() => setFilters((f) => ({ ...f, showUnconfirmed: true }))}
        />
        <FilteredOutTray items={state.rejected} />
      </div>

      {qid ? (
        <div className="space-y-3 border-t pt-8">
          <div>
            <h2 className="text-lg font-semibold">Фото студентов</h2>
            <p className="text-sm text-muted-foreground">
              Загружено студентами · не является проверенным источником и не влияет на баллы и уровни выше.
            </p>
          </div>
          <ContributePhoto onUpload={handleUpload} />
          <CommunityGallery photos={communityPhotos} />
        </div>
      ) : null}

      {qid ? (
        <div className="space-y-3 border-t pt-8">
          <h2 className="text-lg font-semibold">Отзывы студентов</h2>
          <ReviewForm onSubmit={handleReviewSubmit} />
          <ReviewList reviews={reviews} onReport={handleReviewReport} />
        </div>
      ) : null}

      <EvidenceDialog
        photo={openPhoto}
        open={openPhoto !== null}
        onOpenChange={(open) => !open && setOpenPhoto(null)}
      />
    </div>
  );
}
