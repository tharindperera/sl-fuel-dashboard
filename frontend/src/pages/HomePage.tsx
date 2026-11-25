import { AlertCircle, RefreshCw } from "lucide-react";
import type { UiStrings } from "../i18n/strings";
import type { CurrentRatesData } from "../types/fuel";
import { formatColomboTimestamp } from "../utils/formatters";
import { RateCard } from "../components/home/RateCard";
import { HomeSkeletonGrid } from "../components/home/SkeletonGrid";

interface HomePageProps {
  data: CurrentRatesData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  strings: UiStrings;
}

export function HomePage({ data, loading, error, onRetry, strings }: HomePageProps) {
  if (loading) {
    return <HomeSkeletonGrid />;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-8 text-center shadow-xs dark:border-red-900/60 dark:bg-slate-900">
        <AlertCircle className="mx-auto h-10 w-10 text-brand-red" />
        <h2 className="mt-3 font-heading text-xl font-bold text-slate-900 dark:text-white">
          Unable to load current fuel rates
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {error ?? "Data file is currently unavailable."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded bg-brand-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-red-hover"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const whiteOil = [...(data.categories["White Oil"] ?? [])].sort(
    (a, b) => a.display_order - b.display_order
  );
  const blackOil = [...(data.categories["Black Oil"] ?? [])].sort(
    (a, b) => a.display_order - b.display_order
  );

  return (
    <div className="space-y-10">
      {/* Top Headline & Live Status Card */}
      <section className="flex flex-col justify-between gap-6 border-b border-gray-200/80 pb-9 md:flex-row md:items-start dark:border-slate-800">
        <div>
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {strings.home.title}
          </h1>
          <p className="mt-2.5 text-base font-medium text-slate-500 dark:text-slate-400">
            {strings.home.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3.5 self-start rounded border border-gray-200 bg-white px-5 py-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <div className="text-left">
            <p className="text-xs font-bold leading-tight text-slate-900 dark:text-white">
              {strings.home.liveStatusTitle}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {data.active_period_label}
            </p>
            <p className="tabular-nums mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Synced {formatColomboTimestamp(data.last_checked_sl)}
            </p>
          </div>
        </div>
      </section>

      {/* Section 01: White Oil */}
      <section aria-labelledby="category-white-oil">
        <div className="mb-6 flex items-center gap-3">
          <span className="tabular-nums inline-flex items-center justify-center bg-slate-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-slate-800 dark:border dark:border-slate-700">
            01
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-red dark:text-red-400">
              {strings.home.productCategoryEyebrow}
            </p>
            <h2
              id="category-white-oil"
              className="font-heading text-2xl font-bold leading-snug text-slate-900 dark:text-white"
            >
              White Oil
            </h2>
          </div>
        </div>

        <div
          aria-label="White Oil Fuel Rates"
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {whiteOil.map((product) => (
            <RateCard key={product.code} product={product} />
          ))}
        </div>
      </section>

      {/* Section 02: Black Oil / Furnace Oil (rendered only if present in data) */}
      {blackOil.length > 0 && (
        <section aria-labelledby="category-black-oil" className="pt-2">
          <div className="mb-6 flex items-center gap-3">
            <span className="tabular-nums inline-flex items-center justify-center bg-slate-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-slate-800 dark:border dark:border-slate-700">
              02
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-red dark:text-red-400">
                INDUSTRIAL &amp; MARINE FUEL
              </p>
              <h2
                id="category-black-oil"
                className="font-heading text-2xl font-bold leading-snug text-slate-900 dark:text-white"
              >
                Black Oil
              </h2>
            </div>
          </div>

          <div
            aria-label="Black Oil Fuel Rates"
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {blackOil.map((product) => (
              <RateCard key={product.code} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
