"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { externalImageLink, mediaSrc } from "@/lib/media-url";

interface ImageUploadFieldProps {
  defaultValue?: string | null;
}

/**
 * Preview-only here (a client-side blob object URL) — the actual upload
 * to R2 happens server-side in createAssetAction/updateAssetAction, when
 * the surrounding form is actually submitted. Uploading on file-select
 * (the previous behavior) left an orphaned R2 object — and a permanently
 * inflated storage_used_bytes counter, since nothing ever decremented it
 * back — every time someone picked an image and then cancelled or
 * abandoned the form.
 */
export function ImageUploadField({ defaultValue }: ImageUploadFieldProps) {
  const existingLink = externalImageLink(defaultValue);
  const [previewUrl, setPreviewUrl] = useState<string | null>(mediaSrc(defaultValue) ?? null);
  const [link, setLink] = useState(existingLink);

  // Blob URLs are only valid for this tab's lifetime — release the old one
  // whenever it's replaced or the field unmounts, so it doesn't leak.
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="image">Image</Label>
      <Input
        id="image"
        name="image"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="imageLink">
          Drive link <span className="font-normal text-slate-400">(optional)</span>
        </Label>
        <Input
          id="imageLink"
          name="imageLink"
          type="url"
          inputMode="url"
          maxLength={2048}
          placeholder="https://drive.google.com/..."
          value={link}
          onChange={(event) => {
            const next = event.target.value;
            setLink(next);
            if (!previewUrl?.startsWith("blob:")) {
              setPreviewUrl(mediaSrc(next.trim()) ?? (existingLink ? null : mediaSrc(defaultValue)));
            }
          }}
        />
        <p className="text-xs text-slate-500">Paste a link if the photo is already in Drive. Leave it blank if you upload a file.</p>
      </div>
      {previewUrl ? (
        // Plain <img>: blob: preview URLs aren't a host next/image can
        // validate, and once it's a real R2 url this is just a preview
        // during editing, not the persisted asset image display.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Asset preview" className="h-20 w-20 rounded-md border object-cover" />
      ) : null}
      {/* Passes the *existing* image through unchanged when no new file is picked. */}
      <input type="hidden" name="imageUrl" value={defaultValue ?? ""} />
    </div>
  );
}
