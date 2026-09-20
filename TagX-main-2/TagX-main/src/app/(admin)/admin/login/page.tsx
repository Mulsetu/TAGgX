import type { Metadata } from "next";
import { TagXLogo } from "@/components/layout/brand-logo";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Platform admin sign in" };

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3">
        <TagXLogo size={220} className="h-40 w-40" />
        <p className="text-sm text-muted-foreground">Platform administrator sign in</p>
      </div>
      <AdminLoginForm />
    </main>
  );
}
