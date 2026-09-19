import { describe, expect, it } from "vitest";
import { scoreCandidate } from "@/lib/community/matchWeights";

describe("scoreCandidate", () => {
  it("rewards a country match with a named reason", () => {
    const { score, reasons } = scoreCandidate(
      { countryCode: "KZ", importantCategories: [] },
      { countryCode: "KZ", country: "Казахстан", sitelinks: 0, coverage: null },
    );
    expect(score).toBeGreaterThan(0);
    expect(reasons.some((r) => r.includes("Казахстан"))).toBe(true);
  });

  it("does not reward a country mismatch", () => {
    const { score } = scoreCandidate(
      { countryCode: "KZ", importantCategories: [] },
      { countryCode: "UZ", country: "Узбекистан", sitelinks: 0, coverage: null },
    );
    expect(score).toBe(0);
  });

  it("rewards good category coverage more than thin coverage", () => {
    const good = scoreCandidate(
      { importantCategories: ["dormitory"] },
      {
        countryCode: "KZ",
        country: "Казахстан",
        sitelinks: 0,
        coverage: { dormitory: { verified: 3, likely: 1, unconfirmed: 0, status: "good" } },
      },
    );
    const thin = scoreCandidate(
      { importantCategories: ["dormitory"] },
      {
        countryCode: "KZ",
        country: "Казахстан",
        sitelinks: 0,
        coverage: { dormitory: { verified: 0, likely: 1, unconfirmed: 0, status: "thin" } },
      },
    );
    expect(good.score).toBeGreaterThan(thin.score);
  });

  it("is honest when there is no coverage data for a requested category — no fabricated score", () => {
    const { score, reasons } = scoreCandidate(
      { importantCategories: ["lab"] },
      { countryCode: "KZ", country: "Казахстан", sitelinks: 0, coverage: null },
    );
    expect(score).toBe(0);
    expect(reasons.some((r) => r.includes("честно"))).toBe(true);
  });

  it("caps the popularity nudge instead of letting sitelinks dominate", () => {
    const { score } = scoreCandidate(
      { importantCategories: [] },
      { countryCode: "KZ", country: "Казахстан", sitelinks: 100_000, coverage: null },
    );
    expect(score).toBeLessThanOrEqual(8);
  });
});
