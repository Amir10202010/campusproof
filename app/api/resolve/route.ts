import type { NextRequest } from "next/server";
import { LIMITS } from "@/lib/config/limits";
import { isNotImplemented } from "@/lib/notImplemented";
import { resolveQuery } from "@/lib/resolver/resolve";

/**
 * GET /api/resolve?q=  → ResolveResult (lib/types.ts). Owner: P1 · issue #7.
 * The route is final; the logic lives in lib/resolver/resolve.ts.
 */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, LIMITS.QUERY_MAX_LENGTH);
  if (!query) return Response.json({ error: "empty_query" }, { status: 400 });

  try {
    return Response.json(await resolveQuery(query, request.signal));
  } catch (error) {
    if (isNotImplemented(error)) {
      return Response.json({ error: "not_implemented", message: error.message }, { status: 501 });
    }
    console.error(JSON.stringify({ at: "api/resolve", error: String(error) }));
    return Response.json({ error: "resolve_failed" }, { status: 502 });
  }
}
