/**
 * CampusProof — shared data contracts (v1).
 *
 * This file is the single source of truth for data passed between the pipeline
 * (P1, P2), the Python data/eval scripts (P3), and the UI (P4).
 * Owner: P1. Change it only after telling P1 + P4; everyone depends on it.
 * Spec: docs/architecture.md §4, §5, §7.
 */

// ─── Categories, tiers, sources ────────────────────────────────────────────────

export type CategoryId = "campus" | "dormitory" | "classroom" | "library" | "city" | "sports" | "lab" | "student_life";

export type Tier = "verified" | "likely" | "unconfirmed" | "rejected";

export type SourceType = "official" | "encyclopedic" | "news" | "independent" | "social" | "unknown";

export type DateKind = "taken" | "uploaded" | "published" | "retrieved";

export type SimulateFlag = "web_search_down" | "vision_down" | "wikimedia_down";

export type DegradedFlag = "web_search_unavailable" | "vision_unavailable" | "wikimedia_unavailable";

// ─── University entity & resolver ──────────────────────────────────────────────

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface UniversityEntity {
  qid: string; // Wikidata ID, e.g. "Q1234"
  name: string; // display name in the UI language
  names: { en?: string; ru?: string; kk?: string };
  aliases: string[];
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  city?: { name: string; qid?: string; lat?: number; lon?: number };
  coords?: GeoPoint;
  website?: string;
  domains: string[]; // official domains, e.g. ["nu.edu.kz"]
  commonsCategory?: string; // without the "Category:" prefix
  wikipedia: { lang: string; title: string; url: string }[];
  logoUrl?: string;
}

/** Card shown in the pick-list for ambiguous queries. */
export interface CandidateCard {
  qid: string;
  name: string;
  city?: string;
  country: string;
  founded?: string;
  logoUrl?: string;
}

/**
 * One row of data/universities.min.json, produced by scripts/python/build_index.py (P3)
 * and consumed by the resolver (P1).
 */
export interface UniversityIndexEntry {
  qid: string;
  names: { en?: string; ru?: string; kk?: string };
  aliases: string[]; // all languages, incl. short names / abbreviations
  country: string;
  countryCode: string;
  city?: {
    name: string;
    qid?: string;
    lat?: number;
    lon?: number;
    commonsCategory?: string;
  };
  coords?: GeoPoint;
  website?: string;
  domains: string[];
  commonsCategory?: string;
  logo?: string; // Commons file name
  inception?: string; // year, e.g. "2010"
  students?: number;
  sitelinks: number; // popularity signal
  wikipedia: { lang: string; title: string }[];
}

/** Result of GET /api/resolve and of lib/resolver/resolve.ts. */
export type ResolveResult =
  | { status: "resolved"; entity: UniversityEntity }
  | { status: "ambiguous"; query: string; candidates: CandidateCard[] }
  | { status: "not_found"; query: string; suggestions: CandidateCard[] };

export interface ProfileFact {
  label: string; // RU label, e.g. "Основан"
  value: string;
  sourceUrl: string;
}

/** Output of lib/sources/wikidata.ts → getEntity(). */
export interface EntityDetails {
  entity: UniversityEntity;
  facts: ProfileFact[];
}

export interface WikipediaSummary {
  lang: string;
  title: string;
  url: string;
  extract: string;
}

// ─── Pipeline internals ────────────────────────────────────────────────────────

export interface PipelineInput {
  query?: string;
  qid?: string;
  refresh: boolean;
  simulate: SimulateFlag[];
}

export interface RunContext {
  requestId: string;
  startedAt: number; // Date.now() when the request started
  deadlineAt: number; // startedAt + LIMITS.GLOBAL_DEADLINE_MS
  signal: AbortSignal;
  simulate: SimulateFlag[];
  lang: "ru" | "en";
}

/** Raw image candidate produced by a source adapter, before fetch/dedup/verification. */
export interface Candidate {
  imageUrl: string;
  thumbUrl?: string;
  sourcePageUrl: string;
  sourceDomain: string;
  provider: string; // "commons" | "serper" | "brave" | ...
  title?: string;
  caption?: string;
  categoryHint?: CategoryId;
  provenance: {
    commonsCategoryMatch?: boolean;
    depictsQid?: boolean;
    usedOnWikipedia?: boolean;
    officialDomain?: boolean;
    pageMentionsName?: boolean;
    sourceType: SourceType;
  };
  geo?: GeoPoint;
  date?: { value: string; kind: DateKind };
  license?: { name: string; url?: string; author?: string };
  width?: number;
  height?: number;
}

/** Output of lib/images/prepare.ts: what the pipeline keeps after downloading an image. */
export interface PreparedImage {
  jpeg: Buffer; // resized JPEG (long edge LIMITS.VISION_IMAGE_LONG_EDGE_PX), sent to the vision model
  width: number; // original width
  height: number; // original height
  dHash: string; // 16 hex chars (64-bit)
  exif?: { takenAt?: string; gps?: GeoPoint };
}

/** A candidate that was downloaded and prepared (lib/images/fetchAll.ts), before scoring. */
export interface FetchedCandidate extends Candidate {
  id: string; // stable hash of canonicalUrl
  canonicalUrl: string;
  prepared: PreparedImage;
  lowRes: boolean; // verified from a provider thumbnail only
  alsoFoundAt: { sourcePageUrl: string; sourceDomain: string }[]; // filled by dedup
}

/** Input of lib/scoring/score.ts. */
export interface ScoringContext {
  entity: UniversityEntity;
  visionAvailable: boolean;
}

/** Output of lib/scoring/score.ts. The orchestrator turns it into a Photo or a RejectedItem. */
export interface ScoreResult {
  points: number;
  tier: Tier;
  category: CategoryId;
  secondary: CategoryId[];
  evidence: Evidence[];
  labels: PhotoLabel[];
  reject?: { reason: RejectReason; detail: string };
}

/** What the vision model reports for one image (docs/architecture.md §5.5). Code decides the tier. */
export interface VisionObservation {
  id: string;
  image_type:
    | "photo"
    | "render_or_illustration"
    | "logo_or_emblem"
    | "map_or_plan"
    | "document_or_screenshot"
    | "collage"
    | "other";
  stock_like: boolean;
  watermark_text: string | null;
  primary_category: CategoryId | "other";
  secondary_categories: CategoryId[];
  visible_text: string;
  names_institution: "this" | "other" | "none" | "unclear";
  other_institution_name: string | null;
  scene_consistent_with_context: "consistent" | "inconsistent" | "unclear";
  close_up_portrait: boolean;
  near_duplicate_of: string | null;
  quality: 1 | 2 | 3 | 4 | 5;
  reason: string;
}

// ─── Profile (what the UI renders) ─────────────────────────────────────────────

export interface Evidence {
  signal: string; // e.g. "commons_category", "geo_near_campus"
  kind: "provenance" | "geo" | "visual" | "text" | "cross_source" | "quality" | "community";
  points: number;
  label: string; // plain language, shown in the evidence dialog
}

export type PhotoLabel = "render" | "possibly_outdated" | "visual_check_unavailable" | "low_res_verification";

export interface Photo {
  id: string; // hash of the canonical URL
  imageUrl: string;
  thumbUrl: string;
  width?: number;
  height?: number;
  sourcePageUrl: string;
  sourceDomain: string;
  sourceType: SourceType;
  provider: string;
  title?: string;
  date?: { value: string; kind: DateKind };
  retrievedAt: string; // ISO timestamp; always present
  license?: { name: string; url?: string; author?: string };
  geo?: GeoPoint & { distanceToCampusM?: number };
  category: CategoryId;
  secondary: CategoryId[];
  tier: Exclude<Tier, "rejected">;
  points: number;
  evidence: Evidence[];
  labels: PhotoLabel[];
  alsoFoundAt: { sourcePageUrl: string; sourceDomain: string }[];
  dHash: string; // 16 hex chars (64-bit)
}

export type RejectReason =
  | "duplicate"
  | "not_a_photo"
  | "stock_source"
  | "stock_reuse"
  | "reused_across_universities"
  | "render"
  | "other_institution"
  | "far_geotag"
  | "low_quality"
  | "portrait"
  | "fetch_failed"
  | "verification_timeout"
  | "low_score";

export interface RejectedItem {
  thumbUrl?: string; // omitted for portraits / unsafe content
  sourcePageUrl: string;
  reason: RejectReason;
  detail: string;
  duplicateOf?: string; // Photo.id
}

export interface SourceStatus {
  source: string;
  status: "ok" | "partial" | "timeout" | "error" | "skipped" | "simulated_down";
  candidates: number;
  ms: number;
  note?: string;
}

export interface CategoryCoverage {
  verified: number;
  likely: number;
  unconfirmed: number;
  status: "good" | "thin" | "none";
}

export interface Description {
  text: string; // contains [n] citation markers
  citations: { n: number; url: string; title: string; quote?: string }[];
}

export interface UniversityProfile {
  pipelineVersion: string;
  entity: UniversityEntity;
  facts: ProfileFact[];
  description: Description | null;
  photos: Photo[]; // verified + likely + unconfirmed; the UI filters by tier
  rejected: RejectedItem[];
  coverage: Record<CategoryId, CategoryCoverage>;
  sources: SourceStatus[];
  distanceToCityCenterM?: number;
  degraded: DegradedFlag[];
  timings: {
    totalMs: number;
    firstPhotoMs?: number;
    stages: Record<string, number>;
  };
  generatedAt: string; // ISO
}

// ─── Streaming protocol (Server-Sent Events) ───────────────────────────────────

export type PipelineStage = "gather" | "fetch" | "dedup" | "verify" | "assemble";

export type StreamEvent =
  | { type: "resolved"; entity: UniversityEntity }
  | { type: "ambiguous"; query: string; candidates: CandidateCard[] }
  | { type: "not_found"; query: string; suggestions: CandidateCard[] }
  | { type: "source"; status: SourceStatus }
  | {
      type: "stage";
      stage: PipelineStage;
      status: "start" | "done";
      counts?: Record<string, number>;
      ms: number;
    }
  | { type: "photos"; photos: Photo[] }
  | { type: "rejected"; items: RejectedItem[] }
  | { type: "description"; description: Description | null }
  | { type: "done"; profile: UniversityProfile; cached: boolean }
  | { type: "error"; code: string; message: string; retryable: boolean };

export type StreamEventType = StreamEvent["type"];
