"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { archiveAssetAction, restoreAssetAction } from "@/modules/assets/actions";

export function AssetStatusActions({
  assetId,
  archived,
  deleted,
}: {
  assetId: string;
  archived: boolean;
  deleted: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {deleted ? (
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => run(() => restoreAssetAction(assetId))}>
          Restore asset
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => run(() => archiveAssetAction(assetId, !archived))}
        >
          {archived ? "Unarchive" : "Archive"}
        </Button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
