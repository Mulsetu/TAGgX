export default function AdminSectionLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 animate-pulse rounded-md bg-slate-200" />
      <div className="h-4 w-72 animate-pulse rounded-md bg-slate-200/80" />
      <div className="h-64 animate-pulse rounded-xl bg-white" />
    </div>
  );
}
