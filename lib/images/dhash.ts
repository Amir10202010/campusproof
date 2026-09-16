import { notImplemented } from "@/lib/notImplemented";

/** P2 · issue #15 · 64-bit difference hash: sharp → grayscale → resize 9×8 → compare neighbours → 16 hex chars. */
export type ComputeDHash = (image: Buffer) => Promise<string>;
export const computeDHash: ComputeDHash = async () => notImplemented("computeDHash", "P2", 15);

/** P2 · issue #15 · number of differing bits between two 16-hex-char hashes (0–64). */
export type HammingDistance = (a: string, b: string) => number;
export const hammingDistance: HammingDistance = () => notImplemented("hammingDistance", "P2", 15);
