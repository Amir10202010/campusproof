import { describe, expect, it } from "vitest";
import { sampleRejected } from "@/fixtures/profile.sample";
import type { RejectedItem } from "@/lib/types";
import { REJECT_REASON_RU } from "@/lib/ui/labels";
import { groupRejected, rejectedThumb } from "@/lib/ui/rejected";

describe("groupRejected", () => {
  it("keeps every item and puts accuracy reasons before technical ones", () => {
    const items: RejectedItem[] = [
      ...sampleRejected,
      { sourcePageUrl: "https://example.com/a", reason: "duplicate", detail: "Копия" },
      { sourcePageUrl: "https://example.com/b", reason: "fetch_failed", detail: "Не открылось" },
    ];
    const groups = groupRejected(items);

    expect(groups.flatMap((g) => g.items)).toHaveLength(items.length);
    expect(groups[0].reason).toBe("other_institution");
    expect(groups.at(-1)?.reason).toBe("fetch_failed");
    expect(groups.find((g) => g.reason === "duplicate")?.items).toHaveLength(2);
  });

  it("has a Russian title for every reason", () => {
    for (const title of Object.values(REJECT_REASON_RU)) expect(title).toMatch(/[а-яё]/i);
  });
});

describe("rejectedThumb", () => {
  it("never returns a thumbnail for a portrait", () => {
    const portrait: RejectedItem = {
      thumbUrl: "https://example.com/face.jpg",
      sourcePageUrl: "https://example.com/p",
      reason: "portrait",
      detail: "Портрет",
    };
    expect(rejectedThumb(portrait)).toBeUndefined();
    expect(rejectedThumb({ ...portrait, reason: "render" })).toBe("https://example.com/face.jpg");
  });
});
