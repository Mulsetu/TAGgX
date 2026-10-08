import Link from "next/link";
import { PendingSubmitButton } from "@/components/auth/pending-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveWorkspaceLogin } from "@/modules/companies/actions";

const WORKSPACE_ERRORS: Record<string, string> = {
  slug: "Enter your workspace URL, like acme.",
  missing: "We couldn't find that workspace.",
  rate: "Try again later.",
};

export function WorkspaceLoginForm({ defaultSlug, errorCode }: { defaultSlug: string; errorCode?: string }) {
  const error = errorCode ? WORKSPACE_ERRORS[errorCode] : undefined;

  return (
    <form action={resolveWorkspaceLogin} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workspace-slug">Workspace URL</Label>
        <div className="flex items-center gap-0 overflow-hidden rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
          <span className="shrink-0 border-r bg-muted/60 px-3 py-2 text-sm text-muted-foreground">/</span>
          <Input
            id="workspace-slug"
            name="slug"
            defaultValue={defaultSlug}
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
      <PendingSubmitButton idle="Continue to sign in" pending="Opening workspace..." className="w-full" />
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
