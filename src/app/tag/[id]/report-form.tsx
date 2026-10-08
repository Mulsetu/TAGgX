"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { submitPublicAssetReportAction } from "@/modules/assets/actions";
import type { PublicAssetReportState } from "@/modules/assets/types";

const initialState: PublicAssetReportState = { error: null };
const MESSAGE_LIMIT = 500;

export function PublicAssetReportForm({ assetId }: { assetId: string }) {
  const [state, setState] = useState<PublicAssetReportState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function handleSubmit(formData: FormData) {
    formData.set("assetId", assetId);
    formData.set("message", message);
    startTransition(async () => {
      const result = await submitPublicAssetReportAction(initialState, formData);
      setState(result);
    });
  }

  if (state.success) {
    return (
      <p className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
        Thanks — your report was submitted. The team that owns this asset will follow up if they need more information.
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
          Your name <span className="text-rose-500">*</span>
          <input
            id="name"
            name="name"
            required
            maxLength={200}
            autoComplete="name"
            placeholder="Enter your name"
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400 focus:border-[hsl(var(--brand-primary))]"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
          Email (optional)
          <input
            id="email"
            name="email"
            type="email"
            maxLength={320}
            autoComplete="email"
            placeholder="Enter your email"
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400 focus:border-[hsl(var(--brand-primary))]"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
        What happened? <span className="text-rose-500">*</span>
        <span className="relative block">
          <textarea
            id="message"
            name="message"
            required
            maxLength={MESSAGE_LIMIT}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, MESSAGE_LIMIT))}
            placeholder="Describe the issue..."
            className="min-h-24 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400 focus:border-[hsl(var(--brand-primary))]"
          />
          <span className="pointer-events-none absolute bottom-2 right-3 text-xs font-normal text-slate-400">
            {message.length}/{MESSAGE_LIMIT}
          </span>
        </span>
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--brand-primary))] text-sm font-semibold text-[hsl(var(--sidebar-foreground))] hover:opacity-90 disabled:opacity-60"
      >
        <Send className="size-4" />
        {isPending ? "Submitting..." : "Submit report"}
      </button>
    </form>
  );
}
