import { useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Info, RefreshCw } from "lucide-react";
import type { ThemeMode } from "../hooks/useTheme";
import type {
  BrentIntradayData,
  CommodityHistoryData,
  GlobalOilKpisData,
} from "../types/oil";
import { ArchiveSkeleton } from "../components/home/SkeletonGrid";
import { BenchmarkSpecsSheet } from "../components/oil/BenchmarkSpecsSheet";
import { CommodityComparisonTable } from "../components/oil/CommodityComparisonTable";
import { OilChartCard } from "../components/oil/OilChartCard";
import { formatColomboTimestamp } from "../utils/formatters";

interface GlobalOilPageProps {
  kpis: GlobalOilKpisData | null;
  history: CommodityHistoryData | null;
  intraday: BrentIntradayData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  theme: ThemeMode;
}

export function GlobalOilPage({
  kpis,
  history,
  intraday,
  loading,
  error,
  onRetry,
  theme,
}: GlobalOilPageProps) {
  const [selectedCommodity, setSelectedCommodity] = useState("brent");

  if (loading) {
    return <ArchiveSkeleton />;
  }

  if (error || !kpis || !history) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-8 text-center shadow-xs dark:border-red-900/60 dark:bg-slate-900">
        <AlertCircle className="mx-auto h-10 w-10 text-red-600 dark:text-red-400" />
        <h2 className="mt-3 font-heading text-xl font-bold text-slate-900 dark:text-white">
          Unable to load Global Crude Oil benchmarks
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {error ?? "Global oil data files are currently unavailable."}
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

  const handleSelectCommodity = (id: string) => {
    setSelectedCommodity(id);
    document.getElementById("oil-chart-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-8">
      {/* Header & Metadata Badges */}
      <section className="flex flex-col justify-between gap-6 border-b-2 border-slate-900 pb-6 lg:flex-row lg:items-end dark:border-slate-700">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-2 rounded border border-gray-200 bg-slate-100 px-3 py-1 font-heading text-xs font-bold uppercase tracking-widest text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-primary dark:bg-sky-400" />
            <span>International Commodity Benchmark • Live Market Intelligence</span>
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold uppercase tracking-tight text-slate-900 dark:text-white">
            Brent Crude Oil
          </h1>

          <p className="max-w-3xl text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Global benchmark tracking, interactive historical trajectory, benchmark specifications,
            and cross-commodity pricing comparison.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 font-heading text-xs font-semibold lg:flex-col shrink-0">
          <div className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-slate-100 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/80">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Market Status
            </span>
            <span className="inline-flex items-center gap-1.5 font-bold text-brand-primary whitespace-nowrap dark:text-sky-400">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary dark:bg-sky-400" />
              ACTIVE BENCHMARK
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-slate-100 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/80">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Benchmark
            </span>
            <span className="font-bold text-slate-900 whitespace-nowrap dark:text-white">
              {kpis.benchmark_label}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-slate-100 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/80">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Currency / Unit
            </span>
            <span className="font-bold text-slate-900 whitespace-nowrap dark:text-white">
              {kpis.unit}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-slate-100 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/80">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pipeline Sync
            </span>
            <span className="tabular-nums font-bold text-slate-900 whitespace-nowrap dark:text-white">
              {formatColomboTimestamp(kpis.last_updated_sl)}
            </span>
          </div>
        </div>
      </section>

      {/* 5-Card KPI Strip */}
      <section className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Actual Benchmark
          </span>
          <div className="mt-2">
            <div className="tabular-nums font-heading text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              ${kpis.actual_price.toFixed(2)}
            </div>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              USD per barrel ({kpis.latest_observation_date})
            </span>
            {kpis.official_latest_date &&
              kpis.latest_observation_date > kpis.official_latest_date && (
                <span
                  title={`Interim quote via ${kpis.provisional_source ?? "market feed"}; official EIA/FRED series settled through ${kpis.official_latest_date}.`}
                  className="mt-1 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 font-heading text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                >
                  Market Est. • Official EIA: {kpis.official_latest_date}
                </span>
              )}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Daily Change
          </span>
          <div className="mt-2">
            <div
              className={`tabular-nums flex items-center gap-1 font-heading text-2xl lg:text-3xl font-extrabold tracking-tight ${
                kpis.daily_change >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {kpis.daily_change >= 0 ? (
                <ArrowUp className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-5 w-5" aria-hidden="true" />
              )}
              <span>
                {kpis.daily_change >= 0 ? "+" : ""}
                {kpis.daily_change.toFixed(2)}
              </span>
            </div>
            <span
              className={`tabular-nums font-heading text-xs font-bold ${
                kpis.daily_change_pct >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {kpis.daily_change_pct >= 0 ? "+" : ""}
              {kpis.daily_change_pct.toFixed(2)}% Latest Session
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Monthly
          </span>
          <div className="mt-2">
            <div
              className={`tabular-nums flex items-center gap-1 font-heading text-2xl lg:text-3xl font-extrabold tracking-tight ${
                kpis.monthly_change_pct >= 0
                  ? "text-[#0055ff] dark:text-blue-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {kpis.monthly_change_pct >= 0 ? (
                <ArrowUp className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-5 w-5" aria-hidden="true" />
              )}
              <span>
                {kpis.monthly_change_pct >= 0 ? "+" : ""}
                {kpis.monthly_change_pct.toFixed(2)}%
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Past 30 Days</span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Yearly
          </span>
          <div className="mt-2">
            <div
              className={`tabular-nums flex items-center gap-1 font-heading text-2xl lg:text-3xl font-extrabold tracking-tight ${
                kpis.yearly_change_pct >= 0
                  ? "text-[#0055ff] dark:text-blue-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {kpis.yearly_change_pct >= 0 ? (
                <ArrowUp className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-5 w-5" aria-hidden="true" />
              )}
              <span>
                {kpis.yearly_change_pct >= 0 ? "+" : ""}
                {kpis.yearly_change_pct.toFixed(2)}%
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Past 52 Weeks</span>
          </div>
        </div>

        {/* 5th Dark Highlight Card: Statistical Trend Outlook */}
        <div
          title={kpis.trend_outlook.methodology}
          className="col-span-2 flex flex-col justify-between rounded-lg bg-slate-900 p-4 text-white shadow-sm md:col-span-1 dark:border dark:border-slate-700 dark:bg-slate-950"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-amber-400">
              {kpis.trend_outlook.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-amber-400 px-1.5 py-0.5 font-heading text-[9px] font-extrabold uppercase tracking-wider text-slate-950 whitespace-nowrap">
              {kpis.trend_outlook.badge}
              <Info className="h-2.5 w-2.5" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2">
            <div className="tabular-nums font-heading text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              ${kpis.trend_outlook.projected_price.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-300">{kpis.trend_outlook.subtitle}</span>
          </div>
        </div>
      </section>

      {/* Interactive TradingView Lightweight Chart */}
      <OilChartCard
        commodities={kpis.comparison_table}
        selectedId={selectedCommodity}
        onSelectCommodity={setSelectedCommodity}
        seriesMap={history.series}
        intraday={intraday}
        theme={theme}
      />

      {/* Technical Data Sheet & Attribution */}
      <BenchmarkSpecsSheet kpis={kpis} />

      {/* Global Energy Commodities Comparison Table */}
      <CommodityComparisonTable
        rows={kpis.comparison_table}
        selectedId={selectedCommodity}
        onSelectCommodity={handleSelectCommodity}
        indexSyncLabel={kpis.index_sync_label}
      />
    </div>
  );
}
