"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRgb, parseHexColor } from "@/lib/color";
import { mediaSrc } from "@/lib/media-url";
import { updateCompanyBrandingAction } from "@/modules/companies/actions";
import type { UpdateCompanyBrandingState } from "@/modules/companies/types";
import type { CompanyBranding } from "@/modules/companies/types";

const initialState: UpdateCompanyBrandingState = { error: null };

function ColorField({
  id,
  name,
  label,
  placeholder,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}) {
  const [hex, setHex] = useState(defaultValue);
  const rgb = parseHexColor(hex);
  const pickerValue = rgb ? hex.trim() : "#000000";

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={pickerValue}
          onChange={(event) => setHex(event.target.value.toUpperCase())}
          className="h-9 w-9 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <Input
          id={id}
          name={name}
          placeholder={placeholder}
          value={hex}
          onChange={(event) => setHex(event.target.value)}
          className="font-mono"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          aria-hidden
          className="size-4 shrink-0 rounded-sm border"
          style={{ backgroundColor: rgb ? hex : "transparent" }}
        />
        <span>{rgb ? formatRgb(rgb) : "No color set"}</span>
      </div>
    </div>
  );
}

export function BrandingForm({ company }: { company: CompanyBranding }) {
  const router = useRouter();
  const [state, setState] = useState<UpdateCompanyBrandingState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [logoPreview, setLogoPreview] = useState<string | null>(mediaSrc(company.logoUrl));

  useEffect(() => {
    setLogoPreview(mediaSrc(company.logoUrl));
  }, [company.logoUrl]);

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateCompanyBrandingAction(initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex max-w-lg flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Company name</Label>
        <Input id="name" name="name" required maxLength={200} defaultValue={company.name} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workspace-url">Workspace login</Label>
        <Input id="workspace-url" value={`/${company.slug}/login`} readOnly disabled />
        <p className="text-xs text-muted-foreground">
          Unique to this company. Logo and colors below appear on that page.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="logo">Logo</Label>
        {logoPreview ? (
          // Plain <img>: local blob previews and R2 URLs both need to
          // render here; next/image can't host-check blob: URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoPreview} alt="Current logo" className="h-12 w-12 rounded-md border object-contain" />
        ) : null}
        <Input
          id="logo"
          name="logo"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              setLogoPreview(mediaSrc(company.logoUrl));
              return;
            }
            setLogoPreview(URL.createObjectURL(file));
          }}
        />
        <p className="text-xs text-muted-foreground">Leave empty to keep the current logo.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contactEmail">Contact email</Label>
        <Input id="contactEmail" name="contactEmail" type="email" defaultValue={company.contactEmail ?? ""} maxLength={320} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contactPhone">Contact phone</Label>
        <Input id="contactPhone" name="contactPhone" defaultValue={company.contactPhone ?? ""} maxLength={40} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contactAddress">Contact address</Label>
        <Input id="contactAddress" name="contactAddress" defaultValue={company.contactAddress ?? ""} maxLength={500} />
      </div>

      <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
        <ColorField
          key={`primary-${company.primaryColor ?? ""}`}
          id="primaryColor"
          name="primaryColor"
          label="Primary color"
          placeholder="#4F46E5"
          defaultValue={company.primaryColor ?? ""}
        />
        <ColorField
          key={`secondary-${company.secondaryColor ?? ""}`}
          id="secondaryColor"
          name="secondaryColor"
          label="Secondary color"
          placeholder="#111827"
          defaultValue={company.secondaryColor ?? ""}
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="text-sm text-emerald-600">Settings saved.</p> : null}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
