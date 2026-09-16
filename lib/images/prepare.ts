import { notImplemented } from "@/lib/notImplemented";
import type { PreparedImage } from "@/lib/types";

/**
 * P2 · issue #15 · sharp: rotate() by EXIF → keep original width/height → resize to
 * LIMITS.VISION_IMAGE_LONG_EDGE_PX long edge → JPEG (quality ~85) → dHash → EXIF date/GPS if present.
 */
export type PrepareImage = (image: Buffer) => Promise<PreparedImage>;
export const prepareImage: PrepareImage = async () => notImplemented("prepareImage", "P2", 15);
