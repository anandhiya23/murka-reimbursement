import sharp from "sharp";
import { toJpeg } from "@/lib/to-jpeg";

// Single source of truth for the event banner image (1200x600, 2:1).
export const BANNER_BUCKET = "eventid-banners";
export const BANNER_W = 1200;
export const BANNER_H = 600;

// Normalise any uploaded image to a 1200x600 cover-cropped JPEG.
// HEIC is decoded first (sharp lacks a HEIC decoder in this runtime).
export async function processBanner(file: File): Promise<Buffer> {
  const jpeg = await toJpeg({
    name: file.name,
    type: file.type,
    buffer: await file.arrayBuffer(),
  });
  return sharp(jpeg.buffer)
    .resize(BANNER_W, BANNER_H, { fit: "cover", position: "centre" })
    .jpeg({ quality: 85 })
    .toBuffer();
}

// Public URL for a stored banner path. Bucket is public, so no signing.
export function bannerPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BANNER_BUCKET}/${path}`;
}
