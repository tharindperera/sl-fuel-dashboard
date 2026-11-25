import { Database, History } from "lucide-react";
import type { UiStrings } from "../../i18n/strings";
import type { ArchiveMetaData } from "../../types/fuel";

interface ArchiveHeroProps {
  meta: ArchiveMetaData;
  strings: UiStrings;
}

export function ArchiveHero({ meta, strings }: ArchiveHeroProps) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-lg border border-gray-200/90 bg-white p-6 shadow-sm sm:p-9 dark:border-slate-800 dark:bg-slate-900">
      <div className="absolute top-0 left-0 h-full w-1.5 bg-brand-red" aria-hidden="true" />

      <div className="flex flex-col justify-between gap-8 pl-2 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3.5 inline-flex items-center gap-2 rounded border border-red-100 bg-red-50 px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider text-brand-red whitespace-nowrap dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-red dark:bg-red-400" />
            <span>{strings.archive.badge}</span>
          </div>

          <h1 className="font-heading text-3xl sm:text-5xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
            {strings.archive.title}
          </h1>

          <p className="mt-3.5 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
            {strings.archive.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-stretch gap-4 self-start lg:self-center shrink-0">
          <div className="min-w-[155px] rounded-lg border border-gray-200 bg-slate-50 p-5 shadow-xs sm:p-6 dark:border-slate-800 dark:bg-slate-800/70">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap dark:text-slate-400">
              <History className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>{strings.archive.firstRecord}</span>
            </div>
            <div className="tabular-nums font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-red dark:text-red-400">
              {meta.first_record_year}
            </div>
            <div className="mt-1.5 text-xs font-medium text-slate-500 whitespace-nowrap dark:text-slate-400">
              {strings.archive.firstRecordNote}
            </div>
          </div>

          <div className="min-w-[155px] rounded-lg border border-gray-200 bg-slate-50 p-5 shadow-xs sm:p-6 dark:border-slate-800 dark:bg-slate-800/70">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap dark:text-slate-400">
              <Database className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>{strings.archive.datasetSize}</span>
            </div>
            <div className="tabular-nums font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-red dark:text-red-400">
              {meta.total_records}
            </div>
            <div className="mt-1.5 text-xs font-medium text-slate-500 whitespace-nowrap dark:text-slate-400">
              {strings.archive.datasetSizeNote}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
