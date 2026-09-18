import type {
  CandidateCard,
  Description,
  Photo,
  PipelineStage,
  RejectedItem,
  SourceStatus,
  StreamEvent,
  StreamEventType,
  UniversityEntity,
  UniversityProfile,
} from "@/lib/types";

/**
 * Client-side state of a profile stream: the contract between the pipeline (P1) and the UI (P4).
 * Pure reducer, no React imports — unit-tested in tests/client-state.test.ts.
 */
export interface StageState {
  stage: PipelineStage;
  status: "pending" | "running" | "done";
  counts?: Record<string, number>;
  ms?: number;
}

export interface ProfileStreamState {
  status: "idle" | "streaming" | "ambiguous" | "not_found" | "done" | "error";
  query?: string;
  entity: UniversityEntity | null;
  candidates: CandidateCard[]; // when ambiguous
  suggestions: CandidateCard[]; // when not_found
  stages: StageState[];
  sources: SourceStatus[];
  photos: Photo[];
  rejected: RejectedItem[];
  description: Description | null;
  descriptionReady: boolean;
  profile: UniversityProfile | null;
  cached: boolean;
  error: { code: string; message: string; retryable: boolean } | null;
  startedAt: number | null;
  finishedMs: number | null;
}

export const PIPELINE_STAGES: PipelineStage[] = ["gather", "fetch", "dedup", "verify", "assemble"];

export const STREAM_EVENT_TYPES: StreamEventType[] = [
  "resolved",
  "ambiguous",
  "not_found",
  "source",
  "stage",
  "photos",
  "rejected",
  "description",
  "done",
  "error",
];

export const TERMINAL_EVENT_TYPES: StreamEventType[] = ["done", "error", "ambiguous", "not_found"];

export const initialProfileStreamState: ProfileStreamState = {
  status: "idle",
  entity: null,
  candidates: [],
  suggestions: [],
  stages: PIPELINE_STAGES.map((stage) => ({ stage, status: "pending" })),
  sources: [],
  photos: [],
  rejected: [],
  description: null,
  descriptionReady: false,
  profile: null,
  cached: false,
  error: null,
  startedAt: null,
  finishedMs: null,
};

export type ProfileStreamAction =
  { type: "start"; startedAt: number; query?: string } | { type: "event"; event: StreamEvent; now: number };

export function profileStreamReducer(state: ProfileStreamState, action: ProfileStreamAction): ProfileStreamState {
  if (action.type === "start") {
    return { ...initialProfileStreamState, status: "streaming", startedAt: action.startedAt, query: action.query };
  }

  const { event, now } = action;
  const finished = (status: ProfileStreamState["status"]) => ({
    status,
    finishedMs: state.startedAt === null ? null : now - state.startedAt,
  });

  switch (event.type) {
    case "resolved":
      return { ...state, entity: event.entity };
    case "ambiguous":
      return { ...state, ...finished("ambiguous"), candidates: event.candidates };
    case "not_found":
      return { ...state, ...finished("not_found"), suggestions: event.suggestions };
    case "source":
      return {
        ...state,
        sources: [...state.sources.filter((s) => s.source !== event.status.source), event.status],
      };
    case "stage":
      return {
        ...state,
        stages: state.stages.map((s) =>
          s.stage === event.stage
            ? {
                stage: s.stage,
                status: event.status === "start" ? "running" : "done",
                counts: event.counts,
                ms: event.ms,
              }
            : s,
        ),
      };
    case "photos": {
      const known = new Set(state.photos.map((p) => p.id));
      return { ...state, photos: [...state.photos, ...event.photos.filter((p) => !known.has(p.id))] };
    }
    case "rejected":
      return { ...state, rejected: event.items };
    case "description":
      return { ...state, description: event.description, descriptionReady: true };
    case "done":
      return {
        ...state,
        ...finished("done"),
        entity: event.profile.entity,
        profile: event.profile,
        photos: event.profile.photos,
        rejected: event.profile.rejected,
        sources: event.profile.sources.length > 0 ? event.profile.sources : state.sources,
        description: event.profile.description,
        descriptionReady: true,
        cached: event.cached,
        stages: state.stages.map((s) => (s.status === "done" ? s : { ...s, status: "done" })),
      };
    case "error":
      return {
        ...state,
        ...finished("error"),
        error: { code: event.code, message: event.message, retryable: event.retryable },
      };
  }
}

export function buildStreamUrl(params: {
  query?: string;
  qid?: string;
  refresh?: boolean;
  simulate?: string;
  replay?: boolean;
}): string {
  if (params.replay) return "/api/dev/replay";
  const search = new URLSearchParams();
  if (params.qid) search.set("qid", params.qid);
  else if (params.query) search.set("q", params.query);
  if (params.refresh) search.set("refresh", "1");
  if (params.simulate) search.set("simulate", params.simulate);
  return `/api/profile/stream?${search.toString()}`;
}

/**
 * The address to show once the university is known: /u/<qid>, so the link can be shared. The spent `q` goes, and so
 * does `refresh=1` — otherwise a reload or a forwarded link starts another fresh run on the free quotas; `simulate`
 * stays, so a reload repeats the simulated outage the person asked for.
 */
export function shareableProfilePath(current: string, qid: string): string {
  const url = new URL(current, "http://localhost");
  url.pathname = `/u/${qid}`;
  url.searchParams.delete("q");
  url.searchParams.delete("refresh");
  return url.pathname + url.search + url.hash;
}

/**
 * Fallback when the stream breaks before a terminal event (docs/architecture.md §4): the saved final profile
 * from GET /api/profile/{qid}, or null when there is none. Never throws.
 */
export async function fetchSavedProfile(
  qid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UniversityProfile | null> {
  try {
    const response = await fetchImpl(`/api/profile/${encodeURIComponent(qid)}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const profile = (await response.json()) as UniversityProfile;
    return profile?.entity?.qid === qid ? profile : null;
  } catch {
    return null;
  }
}
