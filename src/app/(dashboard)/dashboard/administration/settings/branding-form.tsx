"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ImageUp, LayoutDashboard, Mail, Package, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { companyShellStyle, parseHexColor } from "@/lib/color";
import { mediaSrc } from "@/lib/media-url";
import { updateCompanyBrandingAction } from "@/modules/companies/actions";
import type { CompanyBranding, UpdateCompanyBrandingState } from "@/modules/companies/types";

const initialState: UpdateCompanyBrandingState = { error: null };

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ColorField({
  id,
  name,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const valid = parseHexColor(value) !== null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value.trim() : "#000000"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
        />
        <Input
          id={id}
          name={name}
          placeholder="TagX default"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono uppercase"
          maxLength={7}
        />
        {value ? (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")} aria-label={`Reset ${label} to default`}>
            <RotateCcw className="size-4" />
          </Button>
        ) : null}
      </div>
      <p className={`text-xs ${value && !valid ? "text-destructive" : "text-slate-500"}`}>
        {value && !valid ? "Use a hex colour like #0F766E." : hint}
      </p>
    </div>
  );
}

/** Mini sidebar + page + login card, themed with the exact styles the app uses. */
function BrandPreview({ name, logo, primary, secondary }: { name: string; logo: string | null; primary: string; secondary: string }) {
  const style = companyShellStyle(parseHexColor(primary) ? primary : null, parseHexColor(secondary) ? secondary : null);
  const mark = logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" className="size-7 rounded-md bg-white object-contain" />
  ) : (
    <span className="grid size-7 place-items-center rounded-md bg-white/90 text-xs font-bold text-slate-700">
      {(name.trim()[0] ?? "T").toUpperCase()}
    </span>
  );

  return (
    <div className="company-shell flex flex-col gap-3" style={style}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Live preview</p>
      <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-[#F4F7FB] shadow-sm">
        <div className="flex w-28 shrink-0 flex-col gap-1 bg-sidebar p-2 text-sidebar-foreground">
          <div className="mb-2 flex items-center gap-1.5 px-1">
            {mark}
            <span className="truncate text-[11px] font-semibold">{name || "Company"}</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-md bg-sidebar-primary px-2 py-1.5 text-[11px] text-sidebar-primary-foreground">
            <LayoutDashboard className="size-3" /> Dashboard
          </span>
          <span className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] opacity-80">
            <Package className="size-3" /> Assets
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
          <span className="text-xs font-semibold text-[hsl(var(--brand-primary))]">Dashboard</span>
          <div className="grid grid-cols-2 gap-1.5">
            <span className="h-8 rounded-md border border-slate-200 bg-white" />
            <span className="h-8 rounded-md border border-slate-200 bg-white" />
          </div>
          <span className="self-start rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
            Add asset
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 p-4">
        <div className="flex w-full max-w-[13rem] flex-col items-center gap-2 rounded-lg bg-white p-3 shadow-sm">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-8 w-8 object-contain" />
          ) : null}
          <span className="text-xs font-semibold text-[hsl(var(--brand-primary))]">{name || "Company"}</span>
          <span className="h-5 w-full rounded border border-slate-200" />
          <span className="w-full rounded bg-primary py-1 text-center text-[10px] font-medium text-primary-foreground">
            Sign in
          </span>
        </div>
        <span className="text-[10px] text-slate-500">Sign-in page</span>
      </div>
    </div>
  );
}

export function BrandingForm({ company }: { company: CompanyBranding }) {
  const router = useRouter();
  const [state, setState] = useState<UpdateCompanyBrandingState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(company.name);
  const [primary, setPrimary] = useState(company.primaryColor ?? "");
  const [secondary, setSecondary] = useState(company.secondaryColor ?? "");
  const [logoPreview, setLogoPreview] = useState<string | null>(mediaSrc(company.logoUrl));
  const [copied, setCopied] = useState(false);
  const loginPath = `/${company.slug}/login`;

  useEffect(() => {
    setLogoPreview(mediaSrc(company.logoUrl));
  }, [company.logoUrl]);

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateCompanyBrandingAction(initialState, formData);
      setState(result);
      if (!result.error) router.refresh();
    });
  }

  async function copyLoginUrl() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${loginPath}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid max-w-5xl items-start gap-4 @4xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-4">
        <Section title="Company identity" description="Your name and logo appear in the sidebar, on the sign-in page and in emails.">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Company name</Label>
            <Input id="name" name="name" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {logoPreview ? (
                  // Plain <img>: blob previews and R2 URLs both render here; next/image can't host-check blob: URLs.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Current logo" className="size-14 object-contain" />
                ) : (
                  <ImageUp className="size-5 text-slate-400" />
                )}
              </span>
              <div className="flex flex-col gap-1">
                <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <ImageUp className="size-4" />
                  {logoPreview ? "Replace logo" : "Upload logo"}
                  <input
                    name="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setLogoPreview(file ? URL.createObjectURL(file) : mediaSrc(company.logoUrl));
                    }}
                  />
                </label>
                <span className="text-xs text-slate-500">Square PNG, JPG or WebP works best.</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workspace-url">Sign-in link for your team</Label>
            <div className="flex gap-2">
              <Input id="workspace-url" value={loginPath} readOnly className="font-mono text-slate-600" />
              <Button type="button" variant="outline" onClick={() => void copyLoginUrl()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">Fixed for this workspace — share it so people land on your branded sign-in page.</p>
          </div>
        </Section>

        <Section title="Brand colours" description="Leave a colour empty to use the TagX default. Check the preview for contrast.">
          <div className="grid gap-4 @md:grid-cols-2">
            <ColorField id="primaryColor" name="primaryColor" label="Primary" hint="Sidebar and headings." value={primary} onChange={setPrimary} />
            <ColorField id="secondaryColor" name="secondaryColor" label="Accent" hint="Buttons and highlights." value={secondary} onChange={setSecondary} />
          </div>
        </Section>

        <Section title="Contact details" description="Printed in the footer of every email your workspace sends, and on invoices.">
          <div className="grid gap-4 @md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactEmail" className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-slate-400" /> Email
              </Label>
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={company.contactEmail ?? ""} maxLength={320} placeholder="assets@company.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactPhone">Phone</Label>
              <Input id="contactPhone" name="contactPhone" defaultValue={company.contactPhone ?? ""} maxLength={40} placeholder="+91 …" />
            </div>
            <div className="flex flex-col gap-1.5 @md:col-span-2">
              <Label htmlFor="contactAddress">Address</Label>
              <Input id="contactAddress" name="contactAddress" defaultValue={company.contactAddress ?? ""} maxLength={500} />
            </div>
          </div>
        </Section>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-[#F4F7FB]/95 px-1 py-3 backdrop-blur">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save branding"}
          </Button>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state.success ? <p className="text-sm text-emerald-600">Saved — refresh other tabs to see it.</p> : null}
        </div>
      </div>

      <aside className="@4xl:sticky @4xl:top-20">
        <BrandPreview name={name} logo={logoPreview} primary={primary} secondary={secondary} />
      </aside>
    </form>
  );
}
