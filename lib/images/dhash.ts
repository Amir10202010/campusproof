import sharp from "sharp";

/** P2 · issue #15 · 64-bit difference hash: sharp → grayscale → resize 9×8 → compare neighbours → 16 hex chars. */
export type ComputeDHash = (image: Buffer) => Promise<string>;

const DHASH = /^[0-9a-f]{16}$/i;

export const computeDHash: ComputeDHash = async (image) => {
  const pixels = await sharp(image, { failOn: "none" }).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();

  let bits = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = pixels[row * 9 + col];
      bits += left < pixels[row * 9 + col + 1] ? "1" : "0";
    }
  }

  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
};

/** P2 · issue #15 · number of differing bits between two 16-hex-char hashes (0–64). */
export type HammingDistance = (a: string, b: string) => number;

export const hammingDistance: HammingDistance = (a, b) => {
  if (!DHASH.test(a) || !DHASH.test(b)) throw new TypeError("dHash must be 16 hex characters");
  let distance = 0;
  for (let i = 0; i < 16; i++) {
    let diff = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (diff) {
      distance += diff & 1;
      diff >>= 1;
    }
  }
  return distance;
};
