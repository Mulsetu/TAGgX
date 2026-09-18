"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { mediaSrc } from "@/lib/media-url";
import { deleteAssetDocumentAction, uploadAssetAttachmentAction } from "@/modules/assets/actions";
import type { AssetAttachment, DocumentTypeOption } from "@/modules/assets/types";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  // eslint-disable-next-line security/detect-object-injection
  const unit = units[exponent];
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${unit}`;
}

function expiryLabel(status: AssetAttachment["expiryStatus"], expiresAt: string | null): string {
  if (!expiresAt) {
    return "";
  }
  if (status === "expired") {
    return ` · expired ${expiresAt}`;
  }
  if (status === "expiring") {
    return ` · expires soon ${expiresAt}`;
  }
  return ` · expires ${expiresAt}`;
}

interface AttachmentUploaderProps {
  assetId: string;
  attachments: AssetAttachment[];
  documentTypes: DocumentTypeOption[];
  canEdit: boolean;
}

export function AttachmentUploader({ assetId, attachments, documentTypes, canEdit }: AttachmentUploaderProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, startTransition] = useTransition();
  const photos = attachments.filter((attachment) => attachment.documentType === "photo");
  const documents = attachments.filter((attachment) => attachment.documentType !== "photo");

  function handleSubmit(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await uploadAssetAttachmentAction(assetId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(documentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteAssetDocumentAction(documentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <a key={photo.id} href={mediaSrc(photo.fileUrl) ?? photo.fileUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaSrc(photo.fileUrl) ?? photo.fileUrl}
                alt={photo.fileName}
                className="h-24 w-full rounded-md border object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
      <ul className="flex flex-col gap-2">
        {documents.length === 0 && photos.length === 0 ? (
          <li className="text-xs text-muted-foreground">No attachments yet.</li>
        ) : (
          documents.map((attachment) => (
            <li key={attachment.id} className="flex flex-wrap items-center gap-2 text-sm">
              <a
                href={mediaSrc(attachment.fileUrl) ?? attachment.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {attachment.fileName}
              </a>
              <a
                href={mediaSrc(attachment.fileUrl) ?? attachment.fileUrl}
                download={attachment.fileName}
                className="text-xs text-muted-foreground hover:underline"
              >
                Download
              </a>
              <span
                className={`text-xs ${
                  attachment.expiryStatus === "expired"
                    ? "text-destructive"
                    : attachment.expiryStatus === "expiring"
                      ? "text-amber-700"
                      : "text-muted-foreground"
                }`}
              >
                {attachment.documentType ?? "other"} · {formatBytes(attachment.fileSizeBytes)}
                {expiryLabel(attachment.expiryStatus, attachment.expiresAt)}
              </span>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => handleDelete(attachment.id)}
                >
                  Delete
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>
      {canEdit ? (
        <form action={handleSubmit} className="grid grid-cols-1 gap-3 @sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="attachmentFile">Add attachment</Label>
            <Input id="attachmentFile" name="file" type="file" disabled={isUploading} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="documentType">Type</Label>
            <NativeSelect id="documentType" name="documentType" defaultValue="other">
              {(documentTypes.length > 0 ? documentTypes : [{ key: "other", name: "Other" }]).map((type) => (
                <option key={type.key} value={type.key}>
                  {type.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expiresAt">Expiry (optional)</Label>
            <Input id="expiresAt" name="expiresAt" type="date" disabled={isUploading} />
          </div>
          {isUploading ? <p className="text-xs text-muted-foreground">Uploading...</p> : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" disabled={isUploading} size="sm" className="w-fit">
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </form>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
