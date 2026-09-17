import type { GeoPoint } from "@/lib/types";

/**
 * P2 · issue #15 · minimal EXIF reader for the two fields the pipeline uses as evidence:
 * DateTimeOriginal ("снято") and GPS coordinates. Everything is bounds-checked; a malformed
 * blob returns `{}` instead of throwing — a broken photo must never break a profile.
 */
export interface ExifData {
  takenAt?: string; // ISO date, e.g. "2021-07-04"
  gps?: GeoPoint;
}

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_DATE_TIME = 0x0132;
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

interface Entry {
  type: number;
  count: number;
  offset: number; // absolute offset of the value inside the TIFF block
}

export function parseExif(blob: Buffer): ExifData {
  try {
    // JPEG APP1 payloads start with "Exif\0\0"; sharp may hand over the raw TIFF block instead.
    const tiff = blob.subarray(blob.subarray(0, 6).toString("latin1") === "Exif\0\0" ? 6 : 0);
    const order = tiff.subarray(0, 2).toString("latin1");
    if (order !== "II" && order !== "MM") return {};
    const little = order === "II";
    if (readU16(tiff, 2, little) !== 42) return {};

    const ifd0 = readIfd(tiff, readU32(tiff, 4, little), little);
    const exifIfd = pointer(tiff, ifd0.get(TAG_EXIF_IFD), little);
    const gpsIfd = pointer(tiff, ifd0.get(TAG_GPS_IFD), little);

    const exif = exifIfd ? readIfd(tiff, exifIfd, little) : new Map<number, Entry>();
    const takenAt =
      readDate(tiff, exif.get(TAG_DATE_TIME_ORIGINAL)) ?? readDate(tiff, ifd0.get(TAG_DATE_TIME)) ?? undefined;
    const gps = gpsIfd ? readGps(tiff, readIfd(tiff, gpsIfd, little), little) : undefined;

    return { ...(takenAt ? { takenAt } : {}), ...(gps ? { gps } : {}) };
  } catch {
    return {};
  }
}

function readIfd(tiff: Buffer, offset: number, little: boolean): Map<number, Entry> {
  const entries = new Map<number, Entry>();
  if (offset <= 0 || offset + 2 > tiff.length) return entries;
  const count = readU16(tiff, offset, little);
  for (let i = 0; i < count; i++) {
    const at = offset + 2 + i * 12;
    if (at + 12 > tiff.length) break;
    const tag = readU16(tiff, at, little);
    const type = readU16(tiff, at + 2, little);
    const valueCount = readU32(tiff, at + 4, little);
    const size = (TYPE_SIZE[type] ?? 0) * valueCount;
    if (size === 0) continue;
    entries.set(tag, { type, count: valueCount, offset: size <= 4 ? at + 8 : readU32(tiff, at + 8, little) });
  }
  return entries;
}

function pointer(tiff: Buffer, entry: Entry | undefined, little: boolean): number | undefined {
  if (!entry || entry.type !== 4) return undefined;
  const value = readU32(tiff, entry.offset, little);
  return value > 0 && value < tiff.length ? value : undefined;
}

/** EXIF dates look like "2021:07:04 12:30:00"; we keep the day only. */
function readDate(tiff: Buffer, entry: Entry | undefined): string | undefined {
  if (!entry || entry.type !== 2 || entry.offset + 10 > tiff.length) return undefined;
  const text = tiff.subarray(entry.offset, entry.offset + Math.min(entry.count, 20)).toString("latin1");
  const match = /^(\d{4}):(\d{2}):(\d{2})/.exec(text);
  if (!match) return undefined;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

function readGps(tiff: Buffer, gps: Map<number, Entry>, little: boolean): GeoPoint | undefined {
  const lat = degrees(tiff, gps.get(2), little);
  const lon = degrees(tiff, gps.get(4), little);
  if (lat === undefined || lon === undefined) return undefined;
  const latRef = ref(tiff, gps.get(1));
  const lonRef = ref(tiff, gps.get(3));
  const point = {
    lat: latRef === "S" ? -lat : lat,
    lon: lonRef === "W" ? -lon : lon,
  };
  const valid = Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180 && (point.lat !== 0 || point.lon !== 0);
  return valid ? point : undefined;
}

/** GPSLatitude / GPSLongitude are three rationals: degrees, minutes, seconds. */
function degrees(tiff: Buffer, entry: Entry | undefined, little: boolean): number | undefined {
  if (!entry || entry.type !== 5 || entry.count < 3 || entry.offset + 24 > tiff.length) return undefined;
  const parts = [0, 1, 2].map((i) => {
    const numerator = readU32(tiff, entry.offset + i * 8, little);
    const denominator = readU32(tiff, entry.offset + i * 8 + 4, little);
    return denominator === 0 ? 0 : numerator / denominator;
  });
  const value = parts[0] + parts[1] / 60 + parts[2] / 3600;
  return Number.isFinite(value) ? value : undefined;
}

function ref(tiff: Buffer, entry: Entry | undefined): string | undefined {
  if (!entry || entry.type !== 2 || entry.offset >= tiff.length) return undefined;
  return tiff
    .subarray(entry.offset, entry.offset + 1)
    .toString("latin1")
    .toUpperCase();
}

const readU16 = (buffer: Buffer, offset: number, little: boolean) =>
  little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);

const readU32 = (buffer: Buffer, offset: number, little: boolean) =>
  little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
