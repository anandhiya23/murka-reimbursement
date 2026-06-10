import heicConvert from "heic-convert";

export interface RawFile {
  name: string;
  type: string;
  buffer: ArrayBuffer;
}

export interface JpegFile {
  name: string;
  type: string;
  buffer: Buffer;
}

// Converts HEIC/HEIF images to JPEG; passes other types through unchanged.
// Shared by reimbursement uploads and EventID photo submissions.
export async function toJpeg(file: RawFile): Promise<JpegFile> {
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic");

  if (!isHeic) {
    return { name: file.name, type: file.type, buffer: Buffer.from(file.buffer) };
  }

  const converted = await heicConvert({
    buffer: Buffer.from(file.buffer),
    format: "JPEG",
    quality: 0.88,
  });
  return {
    name: file.name.replace(/\.heic$/i, ".jpg"),
    type: "image/jpeg",
    buffer: Buffer.from(converted),
  };
}
