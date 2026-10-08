import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Barcode, Calendar, Info, LayoutGrid, Lock, LogIn, MapPin } from "lucide-react";
import { BrandLogo, TagXLogo } from "@/components/layout/brand-logo";
import { companyShellStyle } from "@/lib/color";
import { companyPageMetadata } from "@/lib/company-metadata";
import { mediaSrc } from "@/lib/media-url";
import { getPublicAssetForTag, getTagPageViewer } from "@/modules/assets/actions";
import { getAuditTagContext } from "@/modules/audits/actions";
import type { PublicAsset, TagPageViewer } from "@/modules/assets/types";
import { PublicAssetReportForm } from "./report-form";
import { AuditTagVerifyForm } from "./audit-verify-form";

interface TagPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const asset = await getPublicAssetForTag(params.id);
  return companyPageMetadata(asset?.company ?? null, "Asset tag");
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(name: string): string {
  const value = name.toLowerCase();
  if (value.includes("active")) return "bg-emerald-50 text-emerald-700";
  if (value.includes("maint")) return "bg-violet-50 text-violet-700";
  if (value.includes("missing")) return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

function statusDot(name: string): string {
  const value = name.toLowerCase();
  if (value.includes("active")) return "bg-emerald-500";
  if (value.includes("maint")) return "bg-violet-500";
  if (value.includes("missing")) return "bg-sky-500";
  return "bg-slate-400";
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <div className="text-sm font-medium text-slate-800">{children}</div>
      </div>
    </div>
  );
}

function ViewerCard({ asset, viewer }: { asset: PublicAsset; viewer: TagPageViewer }) {
  if (viewer.kind === "member" && viewer.canOpenAsset) {
    return (
      <VerifyShell
        title="Full asset record"
        body="Ownership, history, documents, and maintenance are available in your workspace."
        href={`/assets/${asset.id}`}
        label="Open in TagX"
      />
    );
  }

  if (viewer.kind === "member") {
    return (
      <VerifyShell
        title="Verify this asset"
        body="You are signed in. Continue on the floor to record this scan."
        href="/floor/audits"
        label="Walk an audit"
      />
    );
  }

  if (viewer.kind === "other") {
    return (
      <VerifyShell
        title="Different workspace"
        body="This tag belongs to another company. Your own dashboard is still available."
        href="/dashboard"
        label="Go to your dashboard"
      />
    );
  }

  if (viewer.kind === "superadmin") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Signed in as a platform admin. This tag page is read-only and does not open the company workspace.
      </section>
    );
  }

  return (
    <VerifyShell
      title="Verify this asset"
      body="Sign in to view full details, ownership, history and more."
      href={`/${asset.company.slug}/login?next=${encodeURIComponent(`/tag/${asset.id}`)}`}
      label="Sign in to verify"
    />
  );
}

function VerifyShell({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href: string;
  label: string;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
          <Lock className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{body}</p>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        <LogIn className="size-4" />
        {label}
      </Link>
    </section>
  );
}

export default async function PublicAssetTagPage({ params }: TagPageProps) {
  const asset = await getPublicAssetForTag(params.id);

  if (!asset) {
    notFound();
  }

  const viewer = await getTagPageViewer(asset.company.id);
  const auditContext = viewer.kind === "member" ? await getAuditTagContext(asset.id) : null;
  const image = mediaSrc(asset.imageUrl);
  const chips = [asset.categoryName, ...asset.tags].filter((chip): chip is string => Boolean(chip));
  const signedIn = viewer.kind === "member" || viewer.kind === "other" || viewer.kind === "superadmin";

  return (
    <main
      className="min-h-dvh bg-[#F4F7FB] text-slate-900"
      style={companyShellStyle(asset.company.primaryColor, asset.company.secondaryColor)}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {asset.company.logoUrl ? (
              <BrandLogo
                src={asset.company.logoUrl}
                alt={`${asset.company.name} logo`}
                size={40}
                fallback={false}
                className="h-10 w-auto max-w-[12rem]"
              />
            ) : (
              <p className="truncate text-base font-semibold text-[hsl(var(--brand-primary))]">{asset.company.name}</p>
            )}
          </div>
          <p className="inline-flex items-center gap-1.5 text-sm text-slate-500">
            <Info className="size-4" />
            Asset information
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex gap-4">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="size-28 shrink-0 rounded-xl object-cover sm:size-36" />
            ) : (
              <span className="grid size-28 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs text-slate-400 sm:size-36">
                No photo
              </span>
            )}
            <div className="min-w-0">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(asset.statusName)}`}>
                <span className={`size-1.5 rounded-full ${statusDot(asset.statusName)}`} />
                {asset.statusName}
              </span>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{asset.name}</h1>
              <p className="text-sm text-slate-500">{asset.assetCode}</p>
              {chips.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {chips.map((chip, index) => (
                    <li key={`${chip}-${index}`} className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                      {chip}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
            <Fact icon={<Barcode className="size-4" />} label="Asset ID">
              {asset.assetCode}
            </Fact>
            <Fact icon={<LayoutGrid className="size-4" />} label="Category">
              {asset.categoryName ?? "—"}
            </Fact>
            <Fact icon={<MapPin className="size-4" />} label="Location">
              {asset.locationName ?? "—"}
            </Fact>
            <Fact icon={<Calendar className="size-4" />} label="Status">
              <span className="inline-flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full ${statusDot(asset.statusName)}`} />
                {asset.statusName}
              </span>
            </Fact>
            {signedIn ? (
              <>
                <Fact icon={<LayoutGrid className="size-4" />} label="Condition">
                  {asset.condition ? formatLabel(asset.condition) : "—"}
                </Fact>
                <Fact icon={<Barcode className="size-4" />} label="Serial number">
                  {asset.serialNumber ?? "—"}
                </Fact>
                {asset.brand ? (
                  <Fact icon={<LayoutGrid className="size-4" />} label="Brand">
                    {asset.brand}
                  </Fact>
                ) : null}
                {asset.model ? (
                  <Fact icon={<LayoutGrid className="size-4" />} label="Model">
                    {asset.model}
                  </Fact>
                ) : null}
                {asset.customFields.map((field) => (
                  <Fact key={field.label} icon={<LayoutGrid className="size-4" />} label={field.label}>
                    {field.value}
                  </Fact>
                ))}
              </>
            ) : null}
          </dl>
          {signedIn && asset.description ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{asset.description}</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Submit a report</h2>
              <p className="text-sm text-slate-500">
                Found a problem with this asset? Send a note to the team. No account needed.
              </p>
            </div>
          </div>
          <PublicAssetReportForm assetId={asset.id} />
        </section>

        {auditContext ? <AuditTagVerifyForm context={auditContext} /> : null}

        <ViewerCard asset={asset} viewer={viewer} />

        <footer className="flex flex-col items-center gap-1 pt-2 text-center">
          <p className="text-xs text-slate-400">Powered by</p>
          <TagXLogo size={28} className="h-7 w-auto max-w-[9rem]" />
          <p className="text-xs text-slate-400">Asset Management Made Simple</p>
        </footer>
      </div>
    </main>
  );
}
