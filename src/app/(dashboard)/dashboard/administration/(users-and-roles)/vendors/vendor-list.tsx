"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVendorAction, updateVendorAction } from "@/modules/vendors/actions";
import type { VendorFormState, VendorSummary } from "@/modules/vendors/types";

const initial: VendorFormState = { error: null };

function Fields({ vendor }: { vendor?: VendorSummary }) {
  return (
    <>
      <Input name="name" defaultValue={vendor?.name} placeholder="Vendor name" required />
      <Input name="companyName" defaultValue={vendor?.companyName ?? ""} placeholder="Company" />
      <Input name="contactName" defaultValue={vendor?.contactName ?? ""} placeholder="Contact" />
      <Input name="email" type="email" defaultValue={vendor?.email ?? ""} placeholder="Email" />
      <Input name="phone" defaultValue={vendor?.phone ?? ""} placeholder="Phone" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={vendor?.isActive ?? true} />
        Active
      </label>
    </>
  );
}

export function VendorList({ vendors }: { vendors: VendorSummary[] }) {
  const [state, setState] = useState<VendorFormState>(initial);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <form
        action={(formData) =>
          startTransition(async () => setState(await createVendorAction(initial, formData)))
        }
        className="grid grid-cols-1 gap-2 rounded-lg border p-4 sm:grid-cols-2"
      >
        <p className="sm:col-span-2 text-sm font-medium">New vendor</p>
        <Fields />
        {state.error ? <p className="sm:col-span-2 text-sm text-destructive">{state.error}</p> : null}
        <Button type="submit" disabled={isPending} className="self-start">
          Add vendor
        </Button>
      </form>
      <ul className="flex flex-col gap-3">
        {vendors.map((vendor) => (
          <li key={vendor.id} className="rounded-lg border p-4">
            <form
              action={(formData) =>
                startTransition(async () => setState(await updateVendorAction(vendor.id, initial, formData)))
              }
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              <p className="sm:col-span-2 text-sm font-medium">{vendor.name}</p>
              <Fields vendor={vendor} />
              <Button type="submit" variant="outline" disabled={isPending} className="self-start">
                Save
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
