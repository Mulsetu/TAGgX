import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { brandingStyle } from "@/lib/color";
import { companyPageMetadata } from "@/lib/company-metadata";
import { mediaSrc } from "@/lib/media-url";
import { Button } from "@/components/ui/button";
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

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function ViewerActions({ asset, viewer }: { asset: PublicAsset; viewer: TagPageViewer }) {
  if (viewer.kind === "member" && viewer.canOpenAsset) {
    return (
      <Button asChild size="touch">
        <Link href={`/assets/${asset.id}`}>Open in TagX</Link>
      </Button>
    );
  }

  if (viewer.kind === "member") {
    return (
      <Button asChild variant="outline" size="touch">
        <Link href="/floor/audits">Walk an audit</Link>
      </Button>
    );
  }

  if (viewer.kind === "other") {
    return (
      <Button asChild variant="outline" size="touch">
        <Link href="/dashboard">Go to your dashboard</Link>
      </Button>
    );
  }

  if (viewer.kind === "superadmin") {
    return (
      <p className="text-xs text-muted-foreground">
        Signed in as a platform admin. This tag page is read-only and does not open the company
        workspace.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Auditing on this phone? Sign in first, then scan the sticker again.
      </p>
      <Button asChild size="touch">
        <Link href={`/${asset.company.slug}/login?next=${encodeURIComponent(`/tag/${asset.id}`)}`}>
          Sign in to verify
        </Link>
      </Button>
    </div>
  );
}

export default async function PublicAssetTagPage({ params }: TagPageProps) {
  const asset = await getPublicAssetForTag(params.id);

  if (!asset) {
    notFound();
  }

  const viewer = await getTagPageViewer(asset.company.id);
  const auditContext = viewer.kind === "member" ? await getAuditTagContext(asset.id) : null;

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
      style={brandingStyle(asset.company.primaryColor, asset.company.secondaryColor)}
    >
      <header className="flex items-center gap-3">
        <BrandLogo
          src={asset.company.logoUrl}
          alt=""
          size={32}
          className={asset.company.logoUrl ? "size-8 rounded-md" : "h-8 w-auto max-w-[11rem]"}
        />
        <p className="text-sm font-medium">{asset.company.name}</p>
      </header>

      <section className="flex flex-col gap-4">
        {mediaSrc(asset.imageUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaSrc(asset.imageUrl) ?? ""}
            alt={asset.name}
            className="h-48 w-full rounded-lg border object-cover"
          />
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
          <p className="text-sm text-muted-foreground">{asset.assetCode}</p>
        </div>
        <dl className="grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2">
          <Detail label="Status" value={asset.statusName} />
          <Detail label="Category" value={asset.categoryName} />
          <Detail label="Location" value={asset.locationName} />
          <Detail label="Condition" value={asset.condition ? formatLabel(asset.condition) : null} />
          <Detail label="Brand" value={asset.brand} />
          <Detail label="Model" value={asset.model} />
          <Detail label="Serial number" value={asset.serialNumber} />
          {asset.customFields.map((field) => (
            <Detail key={field.label} label={field.label} value={field.value} />
          ))}
        </dl>
        {asset.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{asset.description}</p>
        ) : null}
      </section>

      {auditContext ? <AuditTagVerifyForm context={auditContext} /> : null}

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Submit a report</h2>
        <p className="text-xs text-muted-foreground">
          Found a problem with this asset? Send a note to the team. No account needed.
        </p>
        <PublicAssetReportForm assetId={asset.id} />
      </section>

      <section className="flex flex-col gap-2">
        <ViewerActions asset={asset} viewer={viewer} />
      </section>
    </main>
  );
}
