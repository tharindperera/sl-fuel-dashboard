import { useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  Flame,
  Fuel,
  Gauge,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Truck,
  Zap,
} from "lucide-react";
import type { TrendsKpisData } from "../types/fuel";
import { ALL_GRADE_CODES, getGradeVisual } from "../utils/gradeMeta";
import { PriceChart } from "../components/trends/PriceChart";
import { ArchiveSkeleton } from "../components/home/SkeletonGrid";

interface TrendsPageProps {
  data: TrendsKpisData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function getGradeIcon(code: string) {
  switch (code) {
    case "LP 95":
      return <Gauge className="h-4 w-4" aria-hidden="true" />;
    case "LAD":
      return <Truck className="h-4 w-4" aria-hidden="true" />;
    case "LSD":
      return <Zap className="h-4 w-4" aria-hidden="true" />;
    case "LK":
    case "LIK":
      return <Flame className="h-4 w-4" aria-hidden="true" />;
    default:
      return <Fuel className="h-4 w-4" aria-hidden="true" />;
  }
}

export function TrendsPage({ data, loading, error, onRetry }: TrendsPageProps) {
  const [showAllGrades, setShowAllGrades] = useState(false);

  if (loading) {
    return <ArchiveSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-8 text-center shadow-xs dark:border-red-900/60 dark:bg-slate-900">
        <AlertCircle className="mx-auto h-10 w-10 text-red-600 dark:text-red-400" />
        <h2 className="mt-3 font-heading text-xl font-bold text-slate-900 dark:text-white">
          Unable to load fuel price trends
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {error ?? "Trends KPI data is currently unavailable."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded bg-brand-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-primary-hover"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const displayedCodes = showAllGrades ? [...ALL_GRADE_CODES] : data.core_retail_codes;

  return (
    <div className="space-y-10">
      {/* Header & Metadata Strip */}
      <section className="flex flex-col justify-between gap-6 border-b border-gray-200 pb-7 md:flex-row md:items-end dark:border-slate-800">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2 font-heading text-xs font-bold uppercase tracking-wider text-brand-primary dark:text-sky-400">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-primary dark:bg-sky-400" />
            <span>National Pricing Intelligence</span>
            <span className="text-slate-400">•</span>
            <span className="font-medium text-slate-600 dark:text-slate-400">
              Real-Time Market Trajectory
            </span>
          </div>
          <h1 className="font-heading text-3xl sm:text-5xl font-extrabold uppercase leading-none tracking-tight text-slate-900 dark:text-white">
            Fuel Price Trend
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Track petrol, diesel, and kerosene price revisions in Sri Lanka with current tariffs,
            revision delta indicators, and historical benchmarks.
          </p>
        </div>

        <div className="flex items-center gap-5 self-start rounded-xl border border-gray-200 bg-white p-4 shadow-xs md:self-end shrink-0 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col">
            <span className="font-heading text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
              Active Tracking
            </span>
            <div className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="tabular-nums font-heading text-2xl font-black text-slate-900 dark:text-white">
                {showAllGrades ? data.all_grades_count : data.active_tracking_count}
              </span>
              <span className="font-heading text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Grades
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-gray-200 dark:bg-slate-800" />

          <div className="flex flex-col">
            <span className="font-heading text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
              12M Revisions
            </span>
            <span className="tabular-nums mt-1 inline-block rounded-full border border-sky-100 bg-sky-50 px-2.5 py-0.5 font-heading text-xs font-bold uppercase text-brand-primary whitespace-nowrap dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-300">
              {data.summary_stats.revisions_last_12_months} Official Updates
            </span>
          </div>
        </div>
      </section>

      {/* Latest Prices (Current Tariff) */}
      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
              Latest Prices
            </h2>
            <span className="rounded-full bg-slate-900 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white whitespace-nowrap dark:bg-slate-800 dark:border dark:border-slate-700">
              Current Tariff
            </span>
            <button
              type="button"
              onClick={() => setShowAllGrades((prev) => !prev)}
              className="cursor-pointer rounded-full border border-gray-300 bg-white px-3 py-0.5 font-heading text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {showAllGrades ? "Core 5 Retail Only" : "Show All 9 Grades"}
            </button>
          </div>

          <div className="flex items-center gap-2 font-heading text-xs text-slate-500 whitespace-nowrap dark:text-slate-400">
            <span className="font-medium">Latest revision:</span>
            <span className="tabular-nums rounded border border-gray-200 bg-white px-2.5 py-0.5 font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
              {data.latest_revision_date}
            </span>
          </div>
        </div>

        <div
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
            showAllGrades ? "lg:grid-cols-3" : "lg:grid-cols-5"
          }`}
        >
          {displayedCodes.map((code) => {
            const tariff = data.latest_tariffs[code];
            if (!tariff) return null;
            const vis = getGradeVisual(code);
            return (
              <article
                key={code}
                className={`flex flex-col justify-between rounded-xl border border-gray-200 border-t-4 ${vis.topBorderClass} bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-heading text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {vis.shortLabel}
                    </span>
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${vis.badgeBgClass} ${vis.badgeTextClass}`}
                    >
                      {getGradeIcon(code)}
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Rs.
                    </span>
                    <span className="tabular-nums font-heading text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {tariff.price_lkr}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-slate-800">
                  {tariff.status === "increased" ? (
                    <span className="tabular-nums inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 font-heading text-xs font-bold text-red-700 whitespace-nowrap dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                      <ArrowUp className="h-3 w-3" aria-hidden="true" />
                      <span>Rs. +{tariff.delta_lkr}</span>
                    </span>
                  ) : tariff.status === "decreased" ? (
                    <span className="tabular-nums inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-heading text-xs font-bold text-emerald-700 whitespace-nowrap dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <ArrowDown className="h-3 w-3" aria-hidden="true" />
                      <span>Rs. {tariff.delta_lkr}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-heading text-xs font-semibold text-slate-600 whitespace-nowrap dark:bg-slate-800 dark:text-slate-300">
                      No change
                    </span>
                  )}

                  <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap dark:text-slate-500">
                    per litre
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Interactive Price Chart */}
      <PriceChart
        series={data.chart_series}
        coreRetailCodes={data.core_retail_codes}
        latestRevisionDate={data.latest_revision_date}
      />

      {/* Highest Prices (All-Time High) */}
      <section className="rounded-2xl border border-gray-200 bg-slate-50/70 p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/80 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-primary dark:bg-sky-400" />
            <h2 className="font-heading text-base font-bold uppercase tracking-wide text-slate-900 dark:text-white">
              Highest Prices (All Time High)
            </h2>
          </div>

          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 font-heading text-[11px] font-bold uppercase tracking-widest text-slate-600 shadow-xs whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Historic Records Index
          </span>
        </div>

        <div
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
            showAllGrades ? "lg:grid-cols-3" : "lg:grid-cols-5"
          }`}
        >
          {displayedCodes.map((code) => {
            const ath = data.all_time_high[code];
            if (!ath) return null;
            const vis = getGradeVisual(code);
            return (
              <div
                key={code}
                className={`rounded-xl border border-gray-200 border-t-4 ${vis.topBorderClass} bg-white p-4 shadow-xs transition-shadow hover:shadow-sm dark:border-slate-800 dark:bg-slate-900`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    {vis.shortLabel}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: vis.color }}
                  />
                </div>
                <div className="tabular-nums mt-2 font-heading text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Rs. {ath.price_lkr}
                </div>
                <div className="tabular-nums mt-1.5 flex items-center justify-between gap-2 font-mono text-[11px] font-medium text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" aria-hidden="true" />
                    <span>{ath.latest_date}</span>
                  </span>
                  {ath.dates.length > 1 && (
                    <span
                      title={`Occurred on: ${ath.dates.join(", ")}`}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {ath.dates.length} dates
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Historical Context Notes */}
      <section className="grid grid-cols-1 gap-6 pb-2 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-2.5 font-heading text-xs font-bold uppercase">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-brand-primary dark:bg-sky-950/50 dark:text-sky-400">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="tracking-wide text-slate-900 dark:text-white">Pricing Dynamics</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Price revisions follow Sri Lanka's automated pricing formula linked to Singapore Platts
            benchmark rates, freight costs, taxes, and USD-LKR exchange parity.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-2.5 font-heading text-xs font-bold uppercase">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#0055ff] dark:bg-blue-950/50 dark:text-blue-400">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="tracking-wide text-slate-900 dark:text-white">Revision Cadence</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Retail tariffs adjust periodically via CEYPETCO notifications. Mid-2022 peak spikes
            reflect foreign exchange adjustments and global energy supply shocks.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-2.5 font-heading text-xs font-bold uppercase">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="tracking-wide text-slate-900 dark:text-white">Data Reliability</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            All tariffs and benchmarks are computed directly from verified CEYPETCO statistical
            registries updated daily at 11:50 PM SLST.
          </p>
        </div>
      </section>
    </div>
  );
}
