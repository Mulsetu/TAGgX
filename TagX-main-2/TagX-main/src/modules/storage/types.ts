export interface CompanyStorageUsage {
  companyId: string;
  totalBytes: number;
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

export const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // PDF
  "application/pdf",
  // Word (.doc / .docx)
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type UploadFileResult =
  | { key: string; url: string; sizeBytes: number; mimeType: string }
  | { error: string };
