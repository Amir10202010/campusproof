import type { StreamEvent } from "@/lib/types";
import { sampleProfile, samplePhotos, sampleRejected } from "./profile.sample";

/**
 * FIXTURE — a realistic sequence of stream events with delays, replayed by /api/dev/replay
 * (dev/preview only) so the streaming UI can be built before the real pipeline exists.
 */
export const sampleStream: { delayMs: number; event: StreamEvent }[] = [
  { delayMs: 650, event: { type: "resolved", entity: sampleProfile.entity } },
  { delayMs: 50, event: { type: "stage", stage: "gather", status: "start", ms: 650 } },
  { delayMs: 450, event: { type: "source", status: sampleProfile.sources[2] } },
  { delayMs: 180, event: { type: "source", status: sampleProfile.sources[0] } },
  { delayMs: 1250, event: { type: "source", status: sampleProfile.sources[1] } },
  { delayMs: 580, event: { type: "source", status: sampleProfile.sources[3] } },
  { delayMs: 20, event: { type: "stage", stage: "gather", status: "done", counts: { candidates: 79 }, ms: 3_750 } },
  { delayMs: 20, event: { type: "stage", stage: "fetch", status: "start", ms: 3_770 } },
  { delayMs: 2_300, event: { type: "stage", stage: "fetch", status: "done", counts: { fetched: 61, failed: 6 }, ms: 6_070 } },
  { delayMs: 90, event: { type: "stage", stage: "dedup", status: "done", counts: { kept: 40, duplicates: 21 }, ms: 6_160 } },
  { delayMs: 20, event: { type: "stage", stage: "verify", status: "start", ms: 6_180 } },
  { delayMs: 1_940, event: { type: "photos", photos: samplePhotos.slice(0, 5) } },
  { delayMs: 2_600, event: { type: "photos", photos: samplePhotos.slice(5, 10) } },
  { delayMs: 3_200, event: { type: "photos", photos: samplePhotos.slice(10) } },
  { delayMs: 60, event: { type: "stage", stage: "verify", status: "done", counts: { verified: 9, likely: 3, unconfirmed: 2 }, ms: 14_040 } },
  { delayMs: 1_400, event: { type: "description", description: sampleProfile.description } },
  { delayMs: 30, event: { type: "rejected", items: sampleRejected } },
  { delayMs: 490, event: { type: "stage", stage: "assemble", status: "done", ms: 15_960 } },
  { delayMs: 460, event: { type: "done", profile: sampleProfile, cached: false } },
];
