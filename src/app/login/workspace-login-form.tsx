"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveWorkspaceLogin } from "@/modules/companies/actions";

export function WorkspaceLoginForm({ defaultSlug }: { defaultSlug: string }) {
  const [slug, setSlug] = useState(defaultSlug);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resolveWorkspaceLogin(slug);
      if ("redirectPath" in result) {
        window.location.assign(result.redirectPath);
        return;
      }
      setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workspace-slug">Workspace URL</Label>
        <div className="flex items-center gap-0 overflow-hidden rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
          <span className="shrink-0 border-r bg-muted/60 px-3 py-2 text-sm text-muted-foreground">/</span>
          <Input
            id="workspace-slug"
            name="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            autoComplete="organization"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="acme"
            className="h-11 rounded-none border-0 shadow-none focus-visible:ring-0 md:h-11"
            required
          />
          <span className="hidden shrink-0 border-l bg-muted/60 px-3 py-2 text-sm text-muted-foreground sm:inline">
            /login
          </span>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" size="touch" disabled={isPending}>
        {isPending ? "Continuing..." : "Continue to sign in"}
      </Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="underline-offset-4 hover:underline">
          Create a workspace
        </Link>{" "}
        or{" "}
        <Link href="/demo" className="underline-offset-4 hover:underline">
          book a demo
        </Link>
        .
      </p>
    </form>
  );
}
