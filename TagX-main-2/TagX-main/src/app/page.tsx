import { BrandLogo } from "@/components/layout/brand-logo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <BrandLogo alt="TagX" size={160} className="h-40 w-40" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">TagX</h1>
        <p className="text-sm text-muted-foreground">Asset tracking and tagging platform.</p>
      </div>
    </main>
  );
}
