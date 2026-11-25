export function HomeSkeletonGrid() {
  return (
    <div aria-busy="true" aria-label="Loading current fuel rates" className="space-y-10">
      <div className="flex flex-col justify-between gap-6 border-b border-gray-200/80 pb-10 md:flex-row md:items-start dark:border-slate-800">
        <div className="space-y-3">
          <div className="h-10 w-72 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-5 w-96 max-w-full animate-pulse rounded bg-slate-200/70 dark:bg-slate-800/70" />
        </div>
        <div className="h-16 w-64 animate-pulse rounded border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="brand-top-border h-52 animate-pulse border border-gray-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex justify-between">
              <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-6 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="mt-5 h-6 w-48 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-10 h-10 w-36 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArchiveSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading historical archive" className="space-y-8">
      <div className="h-52 animate-pulse rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      <div className="h-96 animate-pulse rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}
