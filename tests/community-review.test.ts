import { describe, expect, it } from "vitest";
import { statusAfterReport, statusFromLabel, stripPersonalData } from "@/lib/community/moderateReview";

describe("stripPersonalData", () => {
  it("removes emails, phone numbers and @handles before the text reaches the model", () => {
    const text = "Пишите мне на ivan@example.com или +7 701 234 56 78, ник @ivan_k";
    const stripped = stripPersonalData(text);
    expect(stripped).not.toMatch(/ivan@example\.com/);
    expect(stripped).not.toMatch(/\+7 701 234 56 78/);
    expect(stripped).not.toMatch(/@ivan_k/);
  });

  it("leaves ordinary text untouched", () => {
    const text = "Общежитие хорошее, но далеко от кампуса.";
    expect(stripPersonalData(text)).toBe(text);
  });
});

describe("statusFromLabel", () => {
  it("publishes only the ok label", () => {
    expect(statusFromLabel("ok")).toBe("published");
  });

  it("holds every other label, including a missing one (model unavailable)", () => {
    expect(statusFromLabel("insult")).toBe("held");
    expect(statusFromLabel("personal_data")).toBe("held");
    expect(statusFromLabel("spam")).toBe("held");
    expect(statusFromLabel("unverifiable_accusation")).toBe("held");
    expect(statusFromLabel(null)).toBe("held");
  });
});

describe("statusAfterReport", () => {
  it("keeps a published review published below the threshold", () => {
    expect(statusAfterReport("published", 2)).toBe("published");
  });

  it("auto-holds at the report threshold", () => {
    expect(statusAfterReport("published", 3)).toBe("held");
  });

  it("a review already held stays held", () => {
    expect(statusAfterReport("held", 1)).toBe("held");
  });
});
