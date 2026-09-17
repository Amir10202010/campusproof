import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { canonicalizeImageUrl } from "@/lib/images/canonicalize";
import { computeDHash, hammingDistance } from "@/lib/images/dhash";
import { parseExif } from "@/lib/images/exif";
import { candidatePrior, selectWithQuotas } from "@/lib/images/fetchAll";
import { prepareImage } from "@/lib/images/prepare";
import { assertPublicUrl, isPrivateAddress, readCappedBody, SafeFetchError } from "@/lib/images/safeFetch";
import type { Candidate } from "@/lib/types";

/** Horizontal gradient; `reverse` mirrors it, which flips every dHash bit. */
async function gradientJpeg(width: number, height: number, reverse = false): Promise<Buffer> {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = Math.round((255 * (reverse ? width - 1 - x : x)) / (width - 1));
      raw.fill(value, (y * width + x) * channels, (y * width + x) * channels + channels);
    }
  }
  return sharp(raw, { raw: { width, height, channels } }).jpeg().toBuffer();
}

describe("canonicalizeImageUrl", () => {
  it("maps a Commons thumbnail to the original file", () => {
    expect(
      canonicalizeImageUrl(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Nazarbayev_University.jpg/640px-Nazarbayev_University.jpg",
      ),
    ).toBe("https://upload.wikimedia.org/wikipedia/commons/a/ab/Nazarbayev_University.jpg");
  });

  it("gives the same key to thumbnails of different sizes", () => {
    const base = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Campus.jpg";
    expect(canonicalizeImageUrl(`${base}/320px-Campus.jpg`)).toBe(canonicalizeImageUrl(`${base}/1024px-Campus.jpg`));
  });

  it("drops tracking and size parameters, lowercases the host and unifies the scheme", () => {
    expect(canonicalizeImageUrl("http://WWW.Kbtu.KZ/img/Campus.jpg?utm_source=x&w=800&id=7")).toBe(
      "https://kbtu.kz/img/Campus.jpg?id=7",
    );
  });

  it("strips size and retina suffixes from the file name", () => {
    expect(canonicalizeImageUrl("https://nu.edu.kz/photo-1024x768.jpg")).toBe("https://nu.edu.kz/photo.jpg");
    expect(canonicalizeImageUrl("https://nu.edu.kz/photo_thumb.jpg")).toBe("https://nu.edu.kz/photo.jpg");
    expect(canonicalizeImageUrl("https://nu.edu.kz/photo@2x.jpg")).toBe("https://nu.edu.kz/photo.jpg");
  });

  it("returns non-http input unchanged", () => {
    expect(canonicalizeImageUrl("not a url")).toBe("not a url");
    expect(canonicalizeImageUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });
});

describe("dHash", () => {
  it("returns 16 hex characters", async () => {
    expect(await computeDHash(await gradientJpeg(200, 150))).toMatch(/^[0-9a-f]{16}$/);
  });

  it("keeps resized and recompressed copies close", async () => {
    const original = await gradientJpeg(800, 600);
    const smaller = await sharp(original).resize(320).jpeg({ quality: 55 }).toBuffer();
    expect(hammingDistance(await computeDHash(original), await computeDHash(smaller))).toBeLessThanOrEqual(4);
  });

  it("keeps different images far apart", async () => {
    const [a, b] = await Promise.all([gradientJpeg(400, 300), gradientJpeg(400, 300, true)]);
    expect(hammingDistance(await computeDHash(a), await computeDHash(b))).toBeGreaterThan(20);
  });

  it("refuses malformed hashes", () => {
    expect(() => hammingDistance("abc", "0000000000000000")).toThrow(TypeError);
  });
});

describe("prepareImage", () => {
  it("keeps the original size, shrinks the long edge to 640 px and hashes the result", async () => {
    const prepared = await prepareImage(await gradientJpeg(1200, 900));
    expect([prepared.width, prepared.height]).toEqual([1200, 900]);
    const resized = await sharp(prepared.jpeg).metadata();
    expect(Math.max(resized.width ?? 0, resized.height ?? 0)).toBe(640);
    expect(prepared.dHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("does not enlarge small images", async () => {
    const prepared = await prepareImage(await gradientJpeg(320, 240));
    const resized = await sharp(prepared.jpeg).metadata();
    expect([resized.width, resized.height]).toEqual([320, 240]);
  });
});

describe("parseExif", () => {
  function entry(buffer: Buffer, at: number, tag: number, type: number, count: number, value: number) {
    buffer.writeUInt16LE(tag, at);
    buffer.writeUInt16LE(type, at + 2);
    buffer.writeUInt32LE(count, at + 4);
    buffer.writeUInt32LE(value, at + 8);
  }

  /** Minimal little-endian TIFF block with DateTimeOriginal and GPS coordinates. */
  function exifBlock(): Buffer {
    const buffer = Buffer.alloc(400);
    buffer.write("II", 0, "latin1");
    buffer.writeUInt16LE(42, 2);
    buffer.writeUInt32LE(8, 4);

    buffer.writeUInt16LE(2, 8); // IFD0: 2 entries
    entry(buffer, 10, 0x8769, 4, 1, 100); // Exif IFD
    entry(buffer, 22, 0x8825, 4, 1, 150); // GPS IFD
    buffer.writeUInt32LE(0, 34);

    buffer.writeUInt16LE(1, 100); // Exif IFD
    entry(buffer, 102, 0x9003, 2, 20, 300); // DateTimeOriginal
    buffer.writeUInt32LE(0, 114);
    buffer.write("2021:07:04 12:30:00\0", 300, "latin1");

    buffer.writeUInt16LE(4, 150); // GPS IFD
    entry(buffer, 152, 1, 2, 2, 0); // GPSLatitudeRef, inline
    buffer.write("N\0", 160, "latin1");
    entry(buffer, 164, 2, 5, 3, 230); // GPSLatitude
    entry(buffer, 176, 3, 2, 2, 0); // GPSLongitudeRef, inline
    buffer.write("E\0", 184, "latin1");
    entry(buffer, 188, 4, 5, 3, 260); // GPSLongitude
    buffer.writeUInt32LE(0, 204); // GPS IFD: no next IFD

    for (const [at, values] of [
      [230, [51, 10, 30]],
      [260, [71, 26, 0]],
    ] as const) {
      values.forEach((value, index) => {
        buffer.writeUInt32LE(value, at + index * 8);
        buffer.writeUInt32LE(1, at + index * 8 + 4);
      });
    }
    return buffer;
  }

  it("reads the capture date and GPS position", () => {
    const exif = parseExif(exifBlock());
    expect(exif.takenAt).toBe("2021-07-04");
    expect(exif.gps?.lat).toBeCloseTo(51.175, 3);
    expect(exif.gps?.lon).toBeCloseTo(71.4333, 3);
  });

  it("accepts the JPEG APP1 header and survives garbage", () => {
    expect(parseExif(Buffer.concat([Buffer.from("Exif\0\0", "latin1"), exifBlock()])).takenAt).toBe("2021-07-04");
    expect(parseExif(Buffer.from("not exif at all"))).toEqual({});
    expect(parseExif(Buffer.alloc(0))).toEqual({});
  });
});

describe("safe fetch guards", () => {
  it("treats loopback, private, link-local and mapped addresses as private", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.0.1",
      "172.20.0.1",
      "169.254.169.254",
      "::1",
      "fd00::1",
      "::ffff:127.0.0.1",
      "0.0.0.0",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
    for (const address of ["8.8.8.8", "91.198.174.192", "2001:4860:4860::8888"]) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });

  it("refuses non-http schemes, internal hosts and IP literals", () => {
    for (const url of [
      "ftp://example.com/a.jpg",
      "file:///etc/passwd",
      "http://localhost/a.jpg",
      "http://router.local/a.jpg",
      "http://127.0.0.1:8080/a.jpg",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/a.jpg",
      "http://intranet/a.jpg",
    ]) {
      expect(() => assertPublicUrl(url), url).toThrow(SafeFetchError);
    }
  });

  it("accepts a normal image URL", () => {
    expect(assertPublicUrl("https://upload.wikimedia.org/wikipedia/commons/a/ab/Campus.jpg").hostname).toBe(
      "upload.wikimedia.org",
    );
  });

  it("stops reading a body that exceeds the cap", async () => {
    const chunk = new Uint8Array(1024);
    const response = () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (let i = 0; i < 4; i++) controller.enqueue(chunk);
            controller.close();
          },
        }),
      );
    await expect(readCappedBody(response(), 2048)).rejects.toThrow(SafeFetchError);
    expect((await readCappedBody(response(), 8192)).byteLength).toBe(4096);
  });
});

describe("candidate ranking", () => {
  const candidate = (over: Partial<Candidate> = {}): Candidate => ({
    imageUrl: "https://example.org/a.jpg",
    sourcePageUrl: "https://example.org/page",
    sourceDomain: "example.org",
    provider: "web_search",
    provenance: { sourceType: "unknown" },
    ...over,
  });

  it("puts Commons provenance above an unknown web page", () => {
    const commons = candidate({
      provenance: { sourceType: "encyclopedic", depictsQid: true, commonsCategoryMatch: true },
    });
    expect(candidatePrior(commons)).toBeGreaterThan(candidatePrior(candidate()));
  });

  it("gives every category a share of the budget", () => {
    const items = [
      { id: "c1", category: "campus" },
      { id: "c2", category: "campus" },
      { id: "c3", category: "campus" },
      { id: "l1", category: "library" },
      { id: "d1", category: "dormitory" },
    ];
    const selected = selectWithQuotas(items, 3, (item) => item.category);
    expect(selected.map((item) => item.id)).toEqual(["c1", "l1", "d1"]);
  });

  it("fills the budget from the largest bucket when the others run out", () => {
    const items = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
    expect(selectWithQuotas(items, 10, () => "campus")).toHaveLength(3);
  });
});
