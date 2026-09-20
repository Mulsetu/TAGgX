import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "./types";

/**
 * Plain validation rather than a zod schema: `File` is a runtime/web API
 * object (size, type, arrayBuffer()), not data zod's `instanceof` checks
 * are worth reaching for here — this just needs a size and MIME allowlist
 * check before anything gets uploaded.
 */
export function validateUploadFile(file: File): string | null {
  if (file.size <= 0) {
    return "File is empty.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is too large. Max size is ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`;
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "This file type isn't allowed. Upload an image, PDF, or Word document.";
  }

  return null;
}
