import { notFound, redirect } from "next/navigation";
import Link from "next/link";
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
import { DeleteAssetButton } from "../delete-asset-button";

interface AssetDetailPageProps {
  params: { id: string };
}

function locationLabel(path: string | null): string {
  return path?.trim() ? path : "Unassigned";
}

function LocationHistory({ moves }: { moves: AssetLocationMove[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium">Movement history</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Paths are stored when the asset moves, so past locations stay readable after a rename or
        delete.
      </p>
      <div className="overflow-x-auto rounded-lg border">
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
          <p className="text-sm text-muted-foreground">{asset.assetCode}</p>
          {asset.deletedAt ? (
            <p className="mt-1 text-sm text-destructive">This asset is in the recycle bin.</p>
          ) : asset.archivedAt ? (
            <p className="mt-1 text-sm text-muted-foreground">This asset is archived.</p>
          ) : null}
          {asset.parentAssetName ? (
            <p className="mt-1 text-xs text-muted-foreground">Parent: {asset.parentAssetName}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {canEdit ? (
            <AssetStatusActions assetId={asset.id} archived={Boolean(asset.archivedAt)} deleted={Boolean(asset.deletedAt)} />
          ) : null}
          {canDelete && !asset.deletedAt ? <DeleteAssetButton assetId={asset.id} assetName={asset.name} /> : null}
        </div>
      </div>

      {mediaSrc(asset.imageUrl) ? (
        // Proxied through /api/media so a private R2 bucket still renders.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaSrc(asset.imageUrl) ?? ""}
          alt={asset.name}
          className="h-40 w-40 rounded-md border object-cover"
        />
      ) : null}

      <AssetForm mode="edit" asset={asset} options={options} />

      {canDocuments && missingDocs.length > 0 ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Missing required documents</p>
          <ul className="mt-2 list-disc pl-5">
            {missingDocs.map((doc) => (
              <li key={doc.key}>{doc.name}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">Dispose is blocked until these are uploaded.</p>
        </section>
      ) : null}

      {canHandover || canTransfer || canDispose ? (
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
        />
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-medium">Asset timeline</h2>
        <ul className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
          {timeline.length === 0 ? (
            <li className="text-muted-foreground">No custody events yet.</li>
          ) : (
            timeline.map((event) => (
              <li key={event.id}>
                <span className="font-medium">{event.summary}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString("en-IN")}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      {canDocuments ? (
      <section>
        <h2 className="mb-3 text-sm font-medium">Attachments</h2>
        <AttachmentUploader
          assetId={asset.id}
          attachments={attachments}
          documentTypes={documentTypes}
          canEdit={canEdit}
        />
      </section>
      ) : null}

      {children.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium">Child assets</h2>
          <ul className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
            {children.map((child) => (
              <li key={child.id}>
                <Link href={`/assets/${child.id}`} className="hover:underline">
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canQr ? (
      <section>
        <p className="mb-3 text-sm font-medium">QR tag</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Scanning this code opens a public read-only page — not this editor.
        </p>
        <QrTag assetId={asset.id} assetCode={asset.assetCode} generated={Boolean(asset.qrGeneratedAt)} />
      </section>
      ) : null}

      <LocationHistory moves={locationHistory} />
    </div>
  );
}
