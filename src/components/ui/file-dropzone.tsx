"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  id: string;
  name: string;
  /** Same syntax as the input's accept attribute: ".csv", "image/*", "application/pdf". */
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  capture?: "environment" | "user";
  /** One line under the prompt, e.g. "PDF or image, up to 10 MB". */
  hint?: string;
  maxBytes?: number;
  compact?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesAccept(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .some((token) =>
      token.startsWith(".")
        ? name.endsWith(token)
        : token.endsWith("/*")
          ? file.type.startsWith(token.slice(0, -1))
          : file.type === token,
    );
}

/**
 * Drop-in replacement for a bare <input type="file">: a click-or-drop area
 * that turns into a file card (thumbnail for images) with Change / Remove.
 * The real input stays in the form, so the surrounding action reads it as
 * before. Type and size checks are for quick feedback only — the server
 * re-validates every upload.
 */
export function FileDropzone({ id, name, accept, required, disabled, capture, hint, maxBytes, compact }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Clear the card when the surrounding form is reset (e.g. after a successful upload).
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setFile(null);
      setPreviewUrl(null);
      setError(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setFile(null);
    setPreviewUrl(null);
  }

  function pick(files: FileList | null) {
    const next = files?.[0];
    if (!next) return;
    if (!matchesAccept(next, accept)) {
      setError("This file type isn't supported here.");
      clear();
      return;
    }
    if (maxBytes && next.size > maxBytes) {
      setError(`This file is larger than ${formatBytes(maxBytes)}.`);
      clear();
      return;
    }
    // Dropped files don't land in the input on their own; put them there so the form submits them.
    if (inputRef.current && inputRef.current.files !== files) {
      inputRef.current.files = files;
    }
    setError(null);
    setFile(next);
    setPreviewUrl(next.type.startsWith("image/") ? URL.createObjectURL(next) : null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        disabled={disabled}
        capture={capture}
        onChange={(event) => pick(event.target.files)}
        className="sr-only"
      />

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
          ) : (
            <span className="grid size-12 shrink-0 place-items-center rounded-md bg-slate-100">
              <FileText className="size-5 text-slate-500" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" />
              <span className="hidden sm:inline">Change</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={clear}
              className="text-destructive hover:text-destructive"
              aria-label={`Remove ${file.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files);
          }}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            compact ? "px-3 py-2.5" : "flex-col px-4 py-5",
            dragging ? "border-[hsl(var(--brand-primary))] bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          <UploadCloud className={cn("text-slate-400", compact ? "size-4" : "size-6")} />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-slate-700">
              {capture ? "Take a photo or choose a file" : "Click to upload or drag and drop"}
            </span>
            {hint && !compact ? <span className="text-xs text-slate-500">{hint}</span> : null}
          </span>
        </button>
      )}

      {hint && compact && !file ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
