"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Send } from "lucide-react";
import { submitPublicAssetReportAction } from "@/modules/assets/actions";
import type { PublicAssetReportState } from "@/modules/assets/types";

const initialState: PublicAssetReportState = { error: null };
const MESSAGE_LIMIT = 500;

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[hsl(var(--brand-primary))] focus:ring-2 focus:ring-[hsl(var(--brand-primary)/0.15)]";

function FieldLabel({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline gap-1 text-sm font-medium text-slate-800">
      {children}
      {hint}
    </label>
  );
}

const Required = () => (
  <span className="text-rose-500" aria-hidden="true">
    *
  </span>
);

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
    // Container query, not a viewport breakpoint: this card is narrow inside the
    // tag page's column even on a wide screen, so the two-up row only appears
    // when the card itself has room.
    <form action={handleSubmit} className="@container flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <FieldLabel htmlFor="report-name" hint={<Required />}>
            Your name
          </FieldLabel>
          <input
            id="report-name"
            name="name"
            required
            maxLength={200}
            autoComplete="name"
            placeholder="Enter your name"
            className={`h-11 ${INPUT_CLASS}`}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <FieldLabel htmlFor="report-email" hint={<span className="font-normal text-slate-400">(optional)</span>}>
            Email
          </FieldLabel>
          <input
            id="report-email"
            name="email"
            type="email"
            maxLength={320}
            autoComplete="email"
            placeholder="Enter your email"
            className={`h-11 ${INPUT_CLASS}`}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="report-message" hint={<Required />}>
          What happened?
        </FieldLabel>
        <textarea
          id="report-message"
          name="message"
          required
          maxLength={MESSAGE_LIMIT}
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, MESSAGE_LIMIT))}
          placeholder="Describe the issue..."
          aria-describedby="report-message-count"
          className={`min-h-28 resize-y py-2.5 ${INPUT_CLASS}`}
        />
        <p id="report-message-count" className="self-end text-xs text-slate-400">
          {message.length}/{MESSAGE_LIMIT}
        </p>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--brand-primary))] text-sm font-semibold text-[hsl(var(--sidebar-foreground))] hover:opacity-90 disabled:opacity-60"
      >
        <Send className="size-4" />
        {isPending ? "Submitting..." : "Submit report"}
      </button>
    </form>
  );
}
