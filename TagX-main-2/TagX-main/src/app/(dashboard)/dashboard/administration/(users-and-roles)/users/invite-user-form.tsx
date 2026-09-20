"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { inviteCompanyUserAction } from "@/modules/users/actions";
import type { InviteUserFormState } from "@/modules/users/types";
import type { RoleSummary } from "@/modules/roles/types";

const initialState: InviteUserFormState = { error: null };

export function InviteUserForm({ roles }: { roles: RoleSummary[] }) {
  const router = useRouter();
  const [state, setState] = useState<InviteUserFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await inviteCompanyUserAction(initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  if (state.inviteUrl) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Invite sent</p>
        <p className="text-sm text-muted-foreground">
          Setup link for the new member (dev mode — no email was sent):
        </p>
        <a href={state.inviteUrl} className="break-all rounded-md bg-muted px-2 py-1.5 text-xs hover:underline">
          {state.inviteUrl}
        </a>
        <Button variant="outline" size="sm" onClick={() => setState(initialState)}>
          Invite another
        </Button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Invite by email</Label>
        <Input id="email" name="email" type="email" required placeholder="teammate@example.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="roleId">Role</Label>
        <NativeSelect id="roleId" name="roleId" required defaultValue="">
          <option value="" disabled>
            Select a role
          </option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Sending..." : "Send invite"}
      </Button>
      {state.error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
