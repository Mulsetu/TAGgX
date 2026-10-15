// Shown the instant "Add Asset" is clicked, while the form's options load.
// Shaped like the form so the page doesn't jump from a list skeleton.
export default function NewAssetLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="h-24 max-w-3xl animate-pulse rounded-xl bg-muted" />
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
