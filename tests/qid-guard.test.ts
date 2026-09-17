import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { replayFetch } from "@/tests/helpers/replayFetch";
import { NotImplementedError } from "@/lib/notImplemented";
import type { PipelineDeps } from "@/lib/pipeline/deps";
import { runProfilePipeline } from "@/lib/pipeline/orchestrator";
import { clearWikidataMemo, getEntity, NotAUniversityError, WIKIDATA_HOST } from "@/lib/sources/wikidata";
import { wikimediaApiUrl } from "@/lib/sources/wikimediaFetch";
import type { StreamEvent } from "@/lib/types";

const itemUrl = (qid: string) =>
  wikimediaApiUrl(WIKIDATA_HOST, {
    action: "wbgetentities",
    ids: qid,
    props: "labels|aliases|descriptions|claims|sitelinks",
    languages: "ru|en|kk",
  }).toString();

const item = (qid: string, p31: string, label: string) => ({
  entities: {
    [qid]: {
      id: qid,
      labels: { en: { value: label } },
      claims: { P31: [{ mainsnak: { snaktype: "value", datavalue: { value: { id: p31 } } }, rank: "normal" }] },
    },
  },
});

beforeEach(() => clearWikidataMemo());
afterEach(() => vi.unstubAllGlobals());
const signal = () => new AbortController().signal;

describe("getEntity accepts only higher-education institutions", () => {
  it("rejects a person, a city or anything else opened as /u/<qid>", async () => {
    replayFetch({ [itemUrl("Q42")]: item("Q42", "Q5", "Douglas Adams") });
    await expect(getEntity("Q42", signal())).rejects.toMatchObject({ reason: "not_a_university", qid: "Q42" });
  });

  it("rejects a missing item", async () => {
    replayFetch({ [itemUrl("Q999999999")]: { entities: { Q999999999: { id: "Q999999999", missing: true } } } });
    await expect(getEntity("Q999999999", signal())).rejects.toBeInstanceOf(NotAUniversityError);
  });

  it("trusts the index for classes outside the curated list", async () => {
    // Q1534138 (National Academy of Sciences of Kazakhstan) is in data/universities.min.json.
    replayFetch({ [itemUrl("Q1534138")]: item("Q1534138", "Q123", "Academy") });
    await expect(getEntity("Q1534138", signal())).resolves.toMatchObject({ entity: { qid: "Q1534138" } });
  });
});

describe("orchestrator", () => {
  it("answers /u/<qid> of a non-university with an honest, non-retryable error", async () => {
    const missing = (what: string): never => {
      throw new NotImplementedError(what, "PX", 0);
    };
    const gatherCommons = vi.fn(async () => missing("gatherCommons"));
    const deps: PipelineDeps = {
      resolveQuery: async () => missing("resolveQuery"),
      getEntity: async (qid) => {
        throw new NotAUniversityError(qid, "not_a_university");
      },
      getSummaries: async () => missing("getSummaries"),
      gatherCommons,
      gatherWebSearch: async () => missing("gatherWebSearch"),
      gatherOpenverse: async () => missing("gatherOpenverse"),
      fetchCandidates: async () => missing("fetchCandidates"),
      dedupeCandidates: () => missing("dedupeCandidates"),
      visionProvider: { observe: async () => missing("observe") },
      observeAll: async () => missing("observeAll"),
      scoreCandidate: () => missing("scoreCandidate"),
      describeCampus: async () => missing("describeCampus"),
      getCachedProfile: async () => null,
      saveProfile: async () => {},
      now: () => Date.now(),
    };
    const events: StreamEvent[] = [];
    await runProfilePipeline(
      { qid: "Q42", refresh: false, simulate: [], aiAllowed: true },
      deps,
      (e) => events.push(e),
      signal(),
    );
    expect(events).toEqual([expect.objectContaining({ type: "error", code: "not_a_university", retryable: false })]);
    expect(gatherCommons).not.toHaveBeenCalled();
  });
});
