"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptTransferAction,
  acknowledgeHandoverAction,
  disposeAssetAction,
  handoverAssetAction,
  rejectTransferAction,
  returnAssetAction,
  transferAssetAction,
} from "@/modules/custody/actions";
import type { CustodyFormState, PendingTransfer } from "@/modules/custody/types";
import type { AssetOption, ConditionOption } from "@/modules/assets/types";

const initial: CustodyFormState = { error: null };

// Conditions that don't need damage remarks on return.
const UNDAMAGED_CONDITIONS = new Set(["new", "good"]);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CustodyPanel({
  assetId,
  users,
  locations,
  conditions,
  pendingHandoverId,
  pendingTransfer,
  finalStatuses,
  showHandover = true,
  showTransfer = true,
  showDispose = true,
  disposalMethods = [],
  isAssigned,
  handoverAccessories = [],
  assignedToName = null,
  assignedSince = null,
}: {
  assetId: string;
  users: AssetOption[];
  locations: AssetOption[];
  conditions: ConditionOption[];
  pendingHandoverId: string | null;
  pendingTransfer: PendingTransfer | null;
  finalStatuses: AssetOption[];
  showHandover?: boolean;
  showTransfer?: boolean;
  showDispose?: boolean;
  disposalMethods?: string[];
  isAssigned: boolean;
  handoverAccessories?: string[];
  assignedToName?: string | null;
  assignedSince?: string | null;
}) {
  const [state, setState] = useState<CustodyFormState>(initial);
  const [isPending, startTransition] = useTransition();
  const [returnCondition, setReturnCondition] = useState("");
  const needsDamageRemarks = returnCondition !== "" && !UNDAMAGED_CONDITIONS.has(returnCondition);

  function run(action: (state: CustodyFormState, formData: FormData) => Promise<CustodyFormState>, formData: FormData) {
    startTransition(async () => {
      setState(await action(initial, formData));
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">Custody</h2>
      <p className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Currently assigned to: </span>
        <span className="font-medium">{assignedToName ?? "Unassigned"}</span>
        {assignedToName && assignedSince ? (
          <span className="text-muted-foreground"> · since {assignedSince}</span>
        ) : null}
      </p>
      {pendingTransfer ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Pending transfer</p>
          <p className="text-xs text-muted-foreground">
            Waiting for the receiving user to accept or reject this transfer.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setState(await acceptTransferAction(pendingTransfer.id));
                })
              }
            >
              Accept transfer
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setState(await rejectTransferAction(pendingTransfer.id));
                })
              }
            >
              Reject transfer
            </Button>
          </div>
        </div>
      ) : null}
      {showHandover && pendingHandoverId ? (
        <Button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setState(await acknowledgeHandoverAction(pendingHandoverId));
            })
          }
        >
          Acknowledge handover
        </Button>
      ) : null}
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-3">
        {showHandover && !isAssigned ? (
        <form
          action={(formData) => run(handoverAssetAction, formData)}
          className="flex flex-col gap-2 rounded-lg border p-3"
        >
          <p className="text-sm font-medium">Handover</p>
          <input type="hidden" name="assetId" value={assetId} />
          <Label htmlFor="toUserId">To</Label>
          <NativeSelect id="toUserId" name="toUserId" required>
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </NativeSelect>
          <Input name="handedOverAt" type="date" defaultValue={today()} required />
          <Textarea name="accessories" placeholder="Accessories (comma-separated)" rows={2} />
          <Textarea name="notes" placeholder="Notes" rows={2} />
          <Button type="submit" disabled={isPending} size="sm">
            Record handover
          </Button>
        </form>
        ) : null}
        {showHandover && isAssigned ? (
        <form
          action={(formData) => run(returnAssetAction, formData)}
          className="flex flex-col gap-2 rounded-lg border p-3"
        >
          <p className="text-sm font-medium">Return</p>
          <input type="hidden" name="assetId" value={assetId} />
          <Input name="returnedAt" type="date" defaultValue={today()} required />
          <NativeSelect
            name="conditionKey"
            value={returnCondition}
            onChange={(event) => setReturnCondition(event.target.value)}
          >
            <option value="">Condition</option>
            {conditions.map((condition) => (
              <option key={condition.key} value={condition.key}>
                {condition.name}
              </option>
            ))}
          </NativeSelect>
          {needsDamageRemarks ? (
            <Textarea name="damageRemarks" placeholder="Damage remarks" rows={2} />
          ) : null}
          {handoverAccessories.length > 0 ? (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-xs text-muted-foreground">Tick any missing accessories</legend>
              {handoverAccessories.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="missingAccessoryItems" value={item} />
                  {item}
                </label>
              ))}
            </fieldset>
          ) : null}
          <Textarea
            name="missingAccessories"
            placeholder={handoverAccessories.length > 0 ? "Other missing items" : "Missing accessories"}
            rows={2}
          />
          <Button type="submit" disabled={isPending} size="sm">
            Record return
          </Button>
        </form>
        ) : null}
        {showTransfer ? (
        <form
          action={(formData) => run(transferAssetAction, formData)}
          className="flex flex-col gap-2 rounded-lg border p-3"
        >
          <p className="text-sm font-medium">{isAssigned ? "Transfer" : "Move location"}</p>
          <input type="hidden" name="assetId" value={assetId} />
          {isAssigned ? (
            <NativeSelect name="toUserId">
              <option value="">Keep custodian</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <NativeSelect name="toLocationId" required={!isAssigned}>
            <option value="">Keep location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </NativeSelect>
          <Input name="transferredAt" type="date" defaultValue={today()} required />
          <Textarea name="reason" placeholder="Reason" rows={2} />
          <Button type="submit" disabled={isPending} size="sm">
            {isAssigned ? "Record transfer" : "Record move"}
          </Button>
        </form>
        ) : null}
        {showDispose && finalStatuses.length > 0 ? (
          <form
            action={(formData) => run(disposeAssetAction, formData)}
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            <p className="text-sm font-medium">Dispose</p>
            <input type="hidden" name="assetId" value={assetId} />
            <NativeSelect name="statusId" required defaultValue="">
              <option value="" disabled>
                Final status
              </option>
              {finalStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </NativeSelect>
            {disposalMethods.length > 0 ? (
              <NativeSelect name="method" defaultValue="">
                <option value="">Method (optional)</option>
                {disposalMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
            <Input name="disposedAt" type="date" defaultValue={today()} required />
            <Textarea name="reason" placeholder="Reason" rows={2} required />
            <Input name="value" type="number" min={0} step="0.01" placeholder="Recovery value (optional)" />
            <Button type="submit" disabled={isPending} size="sm">
              Record disposal
            </Button>
          </form>
        ) : null}
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-600">{state.success}</p> : null}
    </section>
  );
}
