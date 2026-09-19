import type { CategoryId, GeoPoint } from "@/lib/types";

/**
 * Community photos live entirely OUTSIDE UniversityProfile: they never get a Tier
 * ("Проверено"/"Вероятно"/"Не подтверждено") and never touch lib/scoring. Owner: P1 · community feature.
 */
export type CommunityPhotoStatus = "verified_onsite" | "plausible" | "rejected" | "pending_review";

export interface CommunityCheck {
  id: string;
  label: string;
  result: "pass" | "fail" | "unknown";
  detail: string;
}

export interface CommunityPhoto {
  id: string; // hash of dHash + upload time
  qid: string;
  category: CategoryId; // chosen by the uploader, checked (not overridden) by vision
  jpegBase64: string; // <= 640px long edge, from prepareImage
  dHash: string;
  width: number;
  height: number;
  takenAt?: string; // from EXIF, if present
  geo?: GeoPoint; // from EXIF, if present
  distanceToCampusM?: number;
  status: CommunityPhotoStatus;
  checks: CommunityCheck[];
  caption?: string; // up to 200 chars
  createdAt: string;
  authorKey: string; // anonymous hash of the client key; NEVER sent to the browser
}

/** What GET /api/community/{qid} returns — authorKey is never exposed. */
export type PublicCommunityPhoto = Omit<CommunityPhoto, "authorKey">;

export function toPublicPhoto(photo: CommunityPhoto): PublicCommunityPhoto {
  const { authorKey: _authorKey, ...rest } = photo;
  return rest;
}
