import type { NextRequest } from "next/server";

/**
 * GET /api/resolve?q=  → { status: "resolved" | "ambiguous" | "not_found", ... }
 * Owner: P1 · Issue: "P1 · /api/resolve" · Spec: docs/architecture.md §5.1
 * Stub until implemented.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  return Response.json(
    { error: "not_implemented", owner: "P1", query: q, spec: "docs/architecture.md#51-resolve" },
    { status: 501 },
  );
}
