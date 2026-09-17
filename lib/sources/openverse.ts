import { notImplemented } from "@/lib/notImplemented";
import type { Candidate, RunContext, UniversityEntity } from "@/lib/types";

/**
 * P2 · issue #33 (stage 2) · FREE CC-licensed photos (incl. Flickr) from https://api.openverse.org/v1/
 * OAuth2 client_credentials with OPENVERSE_CLIENT_ID / OPENVERSE_CLIENT_SECRET (anonymous limits are too low);
 * search by university names; keep results whose title/tags mention the name; map landing URL, creator, license.
 */
export type GatherOpenverse = (entity: UniversityEntity, ctx: RunContext) => Promise<Candidate[]>;
export const gatherOpenverse: GatherOpenverse = async () => notImplemented("gatherOpenverse", "P2", 33);
