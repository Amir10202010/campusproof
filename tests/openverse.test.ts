import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRunContext } from "@/lib/pipeline/context";
import { gatherOpenverse, resetOpenverseToken, toCandidate } from "@/lib/sources/openverse";
import type { UniversityEntity } from "@/lib/types";

const entity: UniversityEntity = {
  qid: "Q2783344",
  name: "Назарбаев Университет",
  names: { en: "Nazarbayev University", ru: "Назарбаев Университет" },
  aliases: ["NU"],
  country: "Казахстан",
  countryCode: "KZ",
  domains: ["nu.edu.kz"],
  wikipedia: [],
};

const row = (overrides: Record<string, unknown> = {}) => ({
  title: "Nazarbayev University campus",
  url: "https://live.staticflickr.com/1/photo.jpg",
  thumbnail: "https://api.openverse.org/v1/images/1/thumb/",
  foreign_landing_url: "https://www.flickr.com/photos/user/1",
  creator: "Photographer",
  license: "by-sa",
  license_version: "2.0",
  license_url: "https://creativecommons.org/licenses/by-sa/2.0/",
  filetype: "jpg",
  width: 1024,
  height: 682,
  tags: [{ name: "astana" }],
  ...overrides,
});

const ctx = () => createRunContext({ signal: new AbortController().signal });

beforeEach(() => resetOpenverseToken());
afterEach(() => vi.unstubAllGlobals());

describe("openverse adapter (#33)", () => {
  it("maps rows to candidates with license, author and source page", async () => {
    const fetchMock = vi.fn(async () => Response.json({ results: [row()] }));
    vi.stubGlobal("fetch", fetchMock);
    const [candidate] = await gatherOpenverse(entity, ctx());
    expect(candidate).toMatchObject({
      provider: "openverse",
      sourceDomain: "flickr.com",
      sourcePageUrl: "https://www.flickr.com/photos/user/1",
      license: { name: "CC BY-SA 2.0", author: "Photographer" },
      provenance: { sourceType: "independent", pageMentionsName: true },
    });
    // The English and Russian names are two separate queries (LIMITS.OPENVERSE_MAX_QUERIES).
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("q=Nazarbayev+University");
  });

  it("drops rows that never name the university, are not photos, mature or tiny", () => {
    expect(toCandidate(row({ title: "Astana skyline", tags: [] }), entity)).toBeNull();
    expect(toCandidate(row({ filetype: "svg" }), entity)).toBeNull();
    expect(toCandidate(row({ mature: true }), entity)).toBeNull();
    expect(toCandidate(row({ width: 200, height: 150 }), entity)).toBeNull();
    expect(toCandidate(row({ foreign_landing_url: "https://www.shutterstock.com/x" }), entity)).toBeNull();
  });

  it("fails loudly only when every query fails, with the API status in the message", async () => {
    vi.stubGlobal("fetch", async () => new Response("rate limited", { status: 429 }));
    await expect(gatherOpenverse(entity, ctx())).rejects.toThrow("Openverse ответил HTTP 429 (лимит запросов)");

    let call = 0;
    vi.stubGlobal("fetch", async () => {
      call += 1;
      return call === 1 ? new Response("boom", { status: 500 }) : Response.json({ results: [row()] });
    });
    expect(await gatherOpenverse(entity, ctx())).toHaveLength(1);
  });
});
