"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mediaSrc } from "@/lib/media-url";
import { uploadAssetAttachmentAction } from "@/modules/assets/actions";
import type { AssetAttachment } from "@/modules/assets/types";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  // exponent is clamped to [0, units.length - 1] above, so this index is
  // always in range — not user-controlled key access.
  // eslint-disable-next-line security/detect-object-injection
  const unit = units[exponent];
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${unit}`;
}

interface AttachmentUploaderProps {
  assetId: string;
  attachments: AssetAttachment[];
}

export function AttachmentUploader({ assetId, attachments }: AttachmentUploaderProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, startTransition] = useTransition();

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadAssetAttachmentAction(assetId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      event.target.value = "";
      // The action already revalidated this path server-side; refresh so
      // this page's Server Component re-fetches and the new attachment
      // shows up without a full navigation.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {attachments.length === 0 ? (
          <li className="text-xs text-muted-foreground">No attachments yet.</li>
        ) : (
          attachments.map((attachment) => (
            <li key={attachment.id} className="text-sm">
              <a
                href={mediaSrc(attachment.fileUrl) ?? attachment.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {attachment.fileName}
              </a>{" "}
              <span className="text-xs text-muted-foreground">{formatBytes(attachment.fileSizeBytes)}</span>
            </li>
          ))
        )}
      </ul>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attachmentFile">Add attachment</Label>
        <Input id="attachmentFile" type="file" onChange={handleFileChange} disabled={isUploading} />
        {isUploading ? <p className="text-xs text-muted-foreground">Uploading...</p> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
