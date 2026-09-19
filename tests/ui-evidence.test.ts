import { describe, expect, it } from "vitest";
import { samplePhotos } from "@/fixtures/profile.sample";
import type { Evidence } from "@/lib/types";
import { EVIDENCE_KIND_ORDER, groupEvidence, reportPhotoUrl } from "@/lib/ui/evidence";
import { EVIDENCE_KIND_RU } from "@/lib/ui/labels";

describe("groupEvidence", () => {
  it("keeps every evidence line and follows the display order", () => {
    const evidence = samplePhotos[3].evidence;
    const groups = groupEvidence(evidence);
    expect(groups.flatMap((g) => g.items)).toHaveLength(evidence.length);
    const order = groups.map((g) => EVIDENCE_KIND_ORDER.indexOf(g.kind));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("never hides evidence of a kind this UI does not know yet", () => {
    const unknown = {
      signal: "new_signal",
      kind: "future_kind",
      points: 5,
      label: "Новый сигнал",
    } as unknown as Evidence;
    const groups = groupEvidence([unknown, ...samplePhotos[0].evidence]);
    expect(groups.at(-1)?.items).toEqual([unknown]);
  });

  it("has a title and a hint for every known kind", () => {
    for (const kind of EVIDENCE_KIND_ORDER) {
      expect(EVIDENCE_KIND_RU[kind].title).toBeTruthy();
      expect(EVIDENCE_KIND_RU[kind].hint).toBeTruthy();
    }
  });
});

describe("reportPhotoUrl", () => {
  it("opens a GitHub issue prefilled with what is needed to re-check the photo", () => {
    const photo = samplePhotos[0];
    const url = new URL(reportPhotoUrl(photo, "https://campusproof.vercel.app/u/Q1"));
    expect(url.origin + url.pathname).toBe("https://github.com/Amir10202010/campusproof/issues/new");
    expect(url.searchParams.get("title")).toMatch(/^Ошибка в фото: /);
    const body = url.searchParams.get("body") ?? "";
    expect(body).toContain(photo.imageUrl);
    expect(body).toContain(photo.sourcePageUrl);
    expect(body).toContain(`очков: ${photo.points}`);
    expect(body).toContain("https://campusproof.vercel.app/u/Q1");
  });
});
