"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { submitLeadAction } from "@/modules/crm/actions";
import type { LeadFormState, LeadSource } from "@/modules/crm/types";

const initialState: LeadFormState = { error: null };

const ASSET_COUNT_OPTIONS = ["Under 100", "100–500", "500–1,500", "1,500–5,000", "5,000+"];

export function LeadForm({ source }: { source: LeadSource }) {
  const [state, setState] = useState<LeadFormState>(initialState);
  const [isPending, startTransition] = useTransition();
  const isDemo = source === "demo";

  function handleSubmit(formData: FormData) {
    formData.set("source", source);
    startTransition(async () => {
      const result = await submitLeadAction(initialState, formData);
      setState(result);
    });
  }

  if (state.success) {
    return (
      <div className="rounded-xl border border-[#0F6E7A]/15 bg-[#f4faf8] p-6">
        <h2 className="text-lg font-semibold text-[#07343C]">
          {isDemo ? "Demo request received" : "Inquiry received"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#07343C]/70">
          The TagX team at Mulsetu will get back to you on the email you shared. If it is urgent,
          mention that in a follow-up to founder@mulsetu.com.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" required maxLength={200} autoComplete="name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" required maxLength={254} autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" maxLength={20} autoComplete="tel" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="companyName">Company</Label>
          <Input id="companyName" name="companyName" maxLength={200} autoComplete="organization" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jobTitle">Role</Label>
          <Input id="jobTitle" name="jobTitle" maxLength={120} autoComplete="organization-title" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assetCount">Approximate assets</Label>
          <NativeSelect id="assetCount" name="assetCount" defaultValue="">
            <option value="">Not sure yet</option>
            {ASSET_COUNT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {isDemo ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="preferredDate">Preferred demo date</Label>
          <Input id="preferredDate" name="preferredDate" type="date" />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">{isDemo ? "What should we cover?" : "How can we help?"}</Label>
        <Textarea id="message" name="message" rows={5} maxLength={2000} required={!isDemo} />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="bg-[#0F6E7A] hover:bg-[#0c5c66]">
        {isPending ? "Sending…" : isDemo ? "Book the demo" : "Send inquiry"}
      </Button>
    </form>
  );
}
