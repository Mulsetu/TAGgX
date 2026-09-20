import { notFound, redirect } from "next/navigation";
import { AttachmentUploader } from "@/components/assets/attachment-uploader";
import { QrTag } from "@/components/assets/qr-tag";
import { mediaSrc } from "@/lib/media-url";
import { requirePermission } from "@/lib/permissions/has-permission";
import {
  getAssetAttachmentsForDetail,
  getAssetDetail,
  getAssetFormOptionsForForm,
  getAssetLocationHistoryForDetail,
  shouldRedirectAssetToTag,
} from "@/modules/assets/actions";
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
  const asset = await getAssetDetail(params.id);

  if (!asset) {
    notFound();
  }

  if (await shouldRedirectAssetToTag(asset.companyId)) {
    redirect(`/tag/${asset.id}`);
  }

  const [options, attachments, canDelete, locationHistory] = await Promise.all([
    getAssetFormOptionsForForm(asset.id),
    getAssetAttachmentsForDetail(asset.id),
    requirePermission("assets", "delete"),
    getAssetLocationHistoryForDetail(asset.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
          <p className="text-sm text-muted-foreground">{asset.assetCode}</p>
        </div>
        {canDelete ? <DeleteAssetButton assetId={asset.id} assetName={asset.name} /> : null}
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

      <section>
        <h2 className="mb-3 text-sm font-medium">Attachments</h2>
        <AttachmentUploader assetId={asset.id} attachments={attachments} />
      </section>

      <section>
        <p className="mb-3 text-sm font-medium">QR tag</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Scanning this code opens a public read-only page — not this editor.
        </p>
        <QrTag assetId={asset.id} assetCode={asset.assetCode} generated={Boolean(asset.qrGeneratedAt)} />
      </section>

      <LocationHistory moves={locationHistory} />
    </div>
  );
}
