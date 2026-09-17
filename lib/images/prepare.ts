import sharp from "sharp";
import { LIMITS } from "@/lib/config/limits";
import type { PreparedImage } from "@/lib/types";
import { computeDHash } from "./dhash";
import { parseExif } from "./exif";

/**
 * P2 · issue #15 · sharp: rotate() by EXIF → keep original width/height → resize to
 * LIMITS.VISION_IMAGE_LONG_EDGE_PX long edge → JPEG (quality ~85) → dHash → EXIF date/GPS if present.
 */
export type PrepareImage = (image: Buffer) => Promise<PreparedImage>;

export const prepareImage: PrepareImage = async (image) => {
  const metadata = await sharp(image, { failOn: "none" }).metadata();
  // EXIF orientation 5–8 stores the image rotated by 90°, so the displayed size has width and height swapped.
  const turned = (metadata.orientation ?? 1) >= 5;
  const width = (turned ? metadata.height : metadata.width) ?? 0;
  const height = (turned ? metadata.width : metadata.height) ?? 0;

  const jpeg = await sharp(image, { failOn: "none" })
    .rotate()
    .resize({
      width: LIMITS.VISION_IMAGE_LONG_EDGE_PX,
      height: LIMITS.VISION_IMAGE_LONG_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  const exif = metadata.exif ? parseExif(metadata.exif) : {};
  return {
    jpeg,
    width,
    height,
    dHash: await computeDHash(jpeg),
    ...(exif.takenAt || exif.gps ? { exif } : {}),
  };
};
