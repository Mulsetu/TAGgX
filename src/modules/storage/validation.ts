import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "./types";

const MIME_BY_SIGNATURE: { mime: string; test: (bytes: Uint8Array) => boolean }[] = [
  { mime: "image/jpeg", test: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  {
    mime: "image/png",
    test: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  {
    mime: "image/gif",
    test: (bytes) =>
      bytes.length >= 6 &&
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61,
  },
  {
    mime: "image/webp",
    test: (bytes) =>
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50,
  },
  {
    mime: "application/pdf",
    test: (bytes) => bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d,
  },
  {
    mime: "application/msword",
    test: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 &&
      bytes[5] === 0xb1 &&
      bytes[6] === 0x1a &&
      bytes[7] === 0xe1,
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    test: (bytes) => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04,
  },
];

export const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function sniffMime(bytes: Uint8Array): string | null {
  for (const entry of MIME_BY_SIGNATURE) {
    if (entry.test(bytes)) {
      return entry.mime;
    }
  }
  return null;
}

/**
 * Size + magic-byte allow-list. Client-reported MIME and filename are ignored.
 */
export async function inspectUploadFile(file: File): Promise<{ error: string } | { mimeType: string }> {
  if (file.size <= 0) {
    return { error: "File is empty." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: `File is too large. Max size is ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.` };
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mimeType = sniffMime(header);
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return { error: "This file type isn't allowed. Upload an image, PDF, or Word document." };
  }

  return { mimeType };
}
