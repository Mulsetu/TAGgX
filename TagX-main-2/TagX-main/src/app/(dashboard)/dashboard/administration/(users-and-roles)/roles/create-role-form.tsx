"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRoleAction } from "@/modules/roles/actions";
import type { RoleFormState } from "@/modules/roles/types";

const initialState: RoleFormState = { error: null };

export function CreateRoleForm() {
  const router = useRouter();
  const [state, setState] = useState<RoleFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createRoleAction(initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="roleName">New role</Label>
        <Input id="roleName" name="name" placeholder="e.g. Technician" required maxLength={100} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="roleDescription">Description</Label>
        <Input id="roleDescription" name="description" placeholder="Optional" maxLength={500} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create role"}
      </Button>
      {state.error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
