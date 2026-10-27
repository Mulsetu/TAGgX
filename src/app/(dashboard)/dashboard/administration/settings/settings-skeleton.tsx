/**
 * Shown the instant a Settings tab is clicked. Having a loading boundary at
 * this level also lets Next.js prefetch each tab up to here, so switching
 * tabs feels immediate instead of waiting on the server render.
 * `withFrame` draws the header and tab strip for the pages (Notifications,
 * Activity) that sit outside the settings layout.
 */
export function SettingsSkeleton({ withFrame = false }: { withFrame?: boolean }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      {withFrame ? (
        <>
          <div className="flex flex-col gap-2">
            <div className="h-8 w-32 animate-pulse rounded-md bg-slate-200" />
            <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-slate-200/80" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="h-10 w-24 animate-pulse rounded-full bg-white" />
            ))}
          </div>
        </>
      ) : null}
      <div className="flex max-w-4xl flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-slate-200/80" />
        </div>
        <div className="h-40 animate-pulse rounded-xl bg-white" />
        <div className="grid gap-4 @3xl:grid-cols-2">
          <div className="h-36 animate-pulse rounded-xl bg-white" />
          <div className="h-36 animate-pulse rounded-xl bg-white" />
        </div>
      </div>
    </div>
  );
}
