import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { AttachmentUploader } from "@/components/assets/attachment-uploader";
import { QrTag } from "@/components/assets/qr-tag";
import { mediaSrc } from "@/lib/media-url";
import { assertPermission, requirePermission } from "@/lib/permissions/has-permission";
import {
  getAssetAttachmentsForDetail,
  getAssetDetail,
  getAssetFormOptionsForForm,
  getAssetLocationHistoryForDetail,
  getChildAssetsForDetail,
  getDocumentTypesForForm,
  getMissingRequiredDocumentsForAsset,
  shouldRedirectAssetToTag,
} from "@/modules/assets/actions";
import { getStatusesForAdmin } from "@/modules/statuses/actions";
import { getLifecycleEventsForAsset, getPendingAcknowledgement, getPendingTransferForAsset } from "@/modules/custody/actions";
import { assertModule, requireModule } from "@/lib/permissions/features";
import { CustodyPanel } from "../custody-panel";
import { AssetStatusActions } from "../asset-status-actions";
import type { AssetLocationMove } from "@/modules/assets/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssetForm } from "../asset-form";
import { AssetDetailTabs, type AssetDetailTab } from "../asset-detail-tabs";
import { DeleteAssetButton } from "../delete-asset-button";

interface AssetDetailPageProps {
  params: { id: string };
}

function locationLabel(path: string | null): string {
  return path?.trim() ? path : "Unassigned";
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function money(value: number | null): string | null {
  if (value === null) return null;
  return value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function FactGroup({ title, rows }: { title: string; rows: Array<{ label: string; value: ReactNode } | null> }) {
  const visible = rows.filter((row): row is { label: string; value: ReactNode } => row !== null && row.value !== null && row.value !== "");
  if (visible.length === 0) return null;
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <dl className="mt-2 divide-y divide-slate-100">
        {visible.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-2 text-sm">
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="text-right font-medium text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function LocationHistory({ moves }: { moves: AssetLocationMove[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-slate-800">Movement</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {moves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No location changes recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              moves.map((move) => (
                <TableRow key={move.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(move.movedAt).toLocaleString("en-US")}
                  </TableCell>
                  <TableCell>{locationLabel(move.fromLocationPath)}</TableCell>
                  <TableCell>{locationLabel(move.toLocationPath)}</TableCell>
                  <TableCell className="text-muted-foreground">{move.movedByName ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  await assertModule("assets");
  await assertPermission("assets", "view");
  const asset = await getAssetDetail(params.id);

  if (!asset) {
    notFound();
  }

  if (await shouldRedirectAssetToTag(asset.companyId)) {
    redirect(`/tag/${asset.id}`);
  }

  const [
    options,
    attachments,
    canDelete,
    locationHistory,
    timeline,
    pending,
    documentTypes,
    statuses,
    missingDocs,
    children,
    pendingTransfer,
    canEdit,
    canHandover,
    canTransfer,
    canDispose,
    canDocuments,
    canQr,
  ] = await Promise.all([
    getAssetFormOptionsForForm(asset.id),
    getAssetAttachmentsForDetail(asset.id),
    requirePermission("assets", "delete"),
    getAssetLocationHistoryForDetail(asset.id),
    getLifecycleEventsForAsset(asset.id),
    getPendingAcknowledgement(asset.id),
    getDocumentTypesForForm(),
    getStatusesForAdmin(),
    getMissingRequiredDocumentsForAsset(asset.id),
    getChildAssetsForDetail(asset.id),
    getPendingTransferForAsset(asset.id),
    requirePermission("assets", "edit"),
    requireModule("handover"),
    requireModule("transfers"),
    requireModule("disposal"),
    requireModule("documents"),
    requireModule("qr"),
  ]);
  const finalStatuses = statuses.filter((status) => status.isFinal).map((status) => ({ id: status.id, name: status.name }));
  const image = mediaSrc(asset.imageUrl);
  const showActions = canHandover || canTransfer || canDispose;

  const tabs: AssetDetailTab[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <FactGroup
              title="Identity"
              rows={[
                { label: "Status", value: asset.statusName },
                { label: "Category", value: asset.categoryName },
                { label: "Condition", value: asset.condition ? labelize(asset.condition) : null },
                { label: "Brand", value: asset.brand },
                { label: "Model", value: asset.model },
                { label: "Serial", value: asset.serialNumber },
                { label: "Department", value: asset.department },
                { label: "Criticality", value: asset.criticality ? labelize(asset.criticality) : null },
              ]}
            />
            <FactGroup
              title="Place"
              rows={[
                { label: "Location", value: asset.locationName },
                { label: "Assigned to", value: asset.allottedToName ?? "Unassigned" },
                { label: "Since", value: asset.allotmentDate ? formatWhen(asset.allotmentDate) : null },
                asset.parentAssetId
                  ? {
                      label: "Parent",
                      value: (
                        <Link href={`/assets/${asset.parentAssetId}`} className="text-[hsl(var(--brand-primary))] hover:underline">
                          {asset.parentAssetName ?? "Parent asset"}
                        </Link>
                      ),
                    }
                  : null,
                asset.linkedAssetId
                  ? {
                      label: "Linked",
                      value: (
                        <Link href={`/assets/${asset.linkedAssetId}`} className="text-[hsl(var(--brand-primary))] hover:underline">
                          {asset.linkedAssetName ?? "Linked asset"}
                        </Link>
                      ),
                    }
                  : null,
              ]}
            />
            <FactGroup
              title="Purchase"
              rows={[
                { label: "Vendor", value: asset.vendor },
                { label: "Purchased", value: asset.purchaseDate ? formatWhen(asset.purchaseDate) : null },
                { label: "Price", value: money(asset.purchasePrice) },
                { label: "Book value", value: money(asset.currentBookValue) },
                { label: "Warranty until", value: asset.warrantyEndDate ? formatWhen(asset.warrantyEndDate) : null },
                { label: "AMC until", value: asset.amcEndDate ? formatWhen(asset.amcEndDate) : null },
                { label: "Insurance until", value: asset.insuranceExpiryDate ? formatWhen(asset.insuranceExpiryDate) : null },
                { label: "Ownership", value: asset.ownershipType === "partner" ? asset.partnerName ?? "Partner" : null },
              ]}
            />
          </div>
          {asset.description ? <p className="max-w-3xl text-sm leading-6 text-slate-600">{asset.description}</p> : null}
          {asset.notes ? <p className="max-w-3xl text-sm leading-6 text-slate-500">{asset.notes}</p> : null}
          {asset.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {asset.tags.map((tag) => (
                <li key={tag} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
          {children.length > 0 ? (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Child assets</h2>
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {children.map((child) => (
                  <li key={child.id}>
                    <Link href={`/assets/${child.id}`} className="rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50">
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {canQr ? (
            <div className="border-t border-slate-100 pt-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">QR tag</h2>
              <p className="mb-3 mt-1 text-xs text-slate-500">Scanning opens the public page, not this editor.</p>
              <QrTag assetId={asset.id} assetCode={asset.assetCode} generated={Boolean(asset.qrGeneratedAt)} />
            </div>
          ) : null}
        </div>
      ),
    },
  ];

  if (canEdit) {
    tabs.push({
      id: "edit",
      label: "Edit",
      content: <AssetForm mode="edit" asset={asset} options={options} />,
    });
  }

  tabs.push({
    id: "activity",
    label: "Activity",
    content: (
      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-medium text-slate-800">Timeline</h2>
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {timeline.length === 0 ? (
              <li className="py-2 text-slate-500">No custody events yet.</li>
            ) : (
              timeline.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="font-medium text-slate-800">{event.summary}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatWhen(event.createdAt)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <LocationHistory moves={locationHistory} />
      </div>
    ),
  });

  if (canDocuments) {
    tabs.push({
      id: "documents",
      label: attachments.length > 0 ? `Documents (${attachments.length})` : "Documents",
      content: (
        <div className="flex flex-col gap-4">
          {missingDocs.length > 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Missing before disposal: {missingDocs.map((doc) => doc.name).join(", ")}.
            </p>
          ) : null}
          <AttachmentUploader
            assetId={asset.id}
            attachments={attachments}
            documentTypes={documentTypes}
            canEdit={canEdit}
          />
        </div>
      ),
    });
  }

  if (showActions) {
    tabs.push({
      id: "actions",
      label: "Actions",
      content: (
        <CustodyPanel
          assetId={asset.id}
          users={options.users}
          locations={options.locations}
          conditions={options.conditions}
          pendingHandoverId={pending?.id ?? null}
          pendingTransfer={canTransfer ? pendingTransfer : null}
          finalStatuses={canDispose ? finalStatuses : []}
          showHandover={canHandover}
          showTransfer={canTransfer}
          showDispose={canDispose}
          disposalMethods={options.disposalMethods}
          assignedToName={asset.allottedToName}
          assignedSince={asset.allotmentDate ? formatWhen(asset.allotmentDate) : null}
        />
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-[10px] font-medium text-slate-400">
              IMG
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{asset.name}</h1>
            <p className="text-sm text-slate-500">
              {asset.assetCode}
              {asset.categoryName ? ` · ${asset.categoryName}` : ""}
              {asset.locationName ? ` · ${asset.locationName}` : ""}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium">{asset.statusName}</span>
              <span className="text-slate-400"> · </span>
              {asset.allottedToName ?? "Unassigned"}
            </p>
            {asset.deletedAt ? (
              <p className="mt-1 text-sm text-destructive">In the recycle bin.</p>
            ) : asset.archivedAt ? (
              <p className="mt-1 text-sm text-slate-500">Archived.</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <AssetStatusActions assetId={asset.id} archived={Boolean(asset.archivedAt)} deleted={Boolean(asset.deletedAt)} />
          ) : null}
          {canDelete && !asset.deletedAt ? <DeleteAssetButton assetId={asset.id} assetName={asset.name} /> : null}
        </div>
      </section>

      <AssetDetailTabs tabs={tabs} />
    </div>
  );
}
