"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { externalImageLink, mediaSrc } from "@/lib/media-url";
import { cn } from "@/lib/utils";
import { MAX_FILE_SIZE_BYTES } from "@/modules/storage/types";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_MB = Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024));

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
 *
 * The type/size checks below are only for quick feedback; the server
 * re-validates every upload.
 */
export function ImageUploadField({ defaultValue }: ImageUploadFieldProps) {
  const existingLink = externalImageLink(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(mediaSrc(defaultValue) ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [existingUrl, setExistingUrl] = useState(defaultValue ?? "");
  const [link, setLink] = useState(existingLink);
  const [showLink, setShowLink] = useState(Boolean(existingLink));
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Blob URLs are only valid for this tab's lifetime — release the old one
  // whenever it's replaced or the field unmounts, so it doesn't leak.
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function clearFile() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setFileName(null);
  }

  function pickFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Choose a JPG, PNG, WebP or GIF image.");
      clearFile();
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`That image is larger than ${MAX_MB} MB.`);
      clearFile();
      return;
    }
    // Dropped files don't land in the input on their own; put them there so the form submits them.
    if (inputRef.current && inputRef.current.files !== files) {
      inputRef.current.files = files;
    }
    setError(null);
    setFileName(file.name);
    setLink("");
    setPreviewUrl(URL.createObjectURL(file));
  }

  function remove() {
    clearFile();
    setExistingUrl("");
    setLink("");
    setPreviewUrl(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="image">Image</Label>
      <input
        ref={inputRef}
        id="image"
        name="image"
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={(event) => pickFile(event.target.files)}
        className="sr-only"
      />

      {previewUrl ? (
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-3">
          {/* Plain <img>: blob: preview URLs aren't a host next/image can validate. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Asset preview" className="size-20 shrink-0 rounded-md border object-cover" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="truncate text-sm text-slate-700">
              {fileName ?? (link ? "Image from link" : "Current image")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <Upload className="size-4" />
                Replace
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={remove} className="text-destructive hover:text-destructive">
                <Trash2 className="size-4" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pickFile(event.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dragging ? "border-[hsl(var(--brand-primary))] bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          <ImagePlus className="size-6 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Click to upload or drag and drop</span>
          <span className="text-xs text-slate-500">JPG, PNG, WebP or GIF, up to {MAX_MB} MB</span>
        </button>
      )}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {showLink ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="imageLink" className="text-xs font-normal text-slate-600">
            Google Drive link
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
              if (next.trim()) {
                clearFile();
              }
              setPreviewUrl(mediaSrc(next.trim()) ?? (existingLink ? null : mediaSrc(existingUrl)) ?? null);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowLink(true)}
          className="inline-flex items-center gap-1 self-start text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          <Link2 className="size-3.5" />
          Or use a Google Drive link
        </button>
      )}

      {/* Passes the *existing* image through unchanged when no new file is picked; emptied by Remove. */}
      <input type="hidden" name="imageUrl" value={existingUrl} />
    </div>
  );
}
