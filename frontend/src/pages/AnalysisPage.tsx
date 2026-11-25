import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Layers,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import type { TrendsKpisData } from "../types/fuel";
import { ALL_GRADE_CODES, getGradeVisual } from "../utils/gradeMeta";
import { ArchiveSkeleton } from "../components/home/SkeletonGrid";

interface AnalysisPageProps {
  data: TrendsKpisData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

type CategoryFilter = "all" | "White Oil" | "Black Oil";

export function AnalysisPage({ data, loading, error, onRetry }: AnalysisPageProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [hoveredYear, setHoveredYear] = useState<string | null>(null);

  const analytics = useMemo(() => {
    if (!data) return null;

    const grades = ALL_GRADE_CODES.map((code) => ({
      code,
      tariff: data.latest_tariffs[code],
      stats: data.summary_stats.grades[code],
      ath: data.all_time_high[code],
      atl: data.all_time_low[code],
      vis: getGradeVisual(code),
    })).filter((g) => g.tariff && g.stats);

    const topYtdMover = [...grades].sort(
      (a, b) => Math.abs(b.stats.ytd_change_pct) - Math.abs(a.stats.ytd_change_pct)
    )[0];

    const mostRevised = [...grades].sort(
      (a, b) => b.stats.price_changes_last_12_months - a.stats.price_changes_last_12_months
    )[0];

    const lp95 = data.latest_tariffs["LP 95"];
    const lp92 = data.latest_tariffs["LP 92"];
    const lsd = data.latest_tariffs["LSD"];
    const lad = data.latest_tariffs["LAD"];

    const petrolSpread = lp95 && lp92 ? Number((lp95.price_lkr - lp92.price_lkr).toFixed(2)) : 0;
    const prevPetrolSpread =
      lp95 && lp92
        ? Number((lp95.previous_price_lkr - lp92.previous_price_lkr).toFixed(2))
        : 0;

    const dieselSpread = lsd && lad ? Number((lsd.price_lkr - lad.price_lkr).toFixed(2)) : 0;
    const prevDieselSpread =
      lsd && lad ? Number((lsd.previous_price_lkr - lad.previous_price_lkr).toFixed(2)) : 0;

    // Annual revision counts (recent 12 years from chart_series)
    const countsByYear = new Map<string, number>();
    for (const pt of data.chart_series) {
      const yr = pt.date.slice(0, 4);
      countsByYear.set(yr, (countsByYear.get(yr) ?? 0) + 1);
    }
    const yearlyCadence = Array.from(countsByYear.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([year, count]) => ({ year, count }));

    const maxAnnualRevisions = Math.max(1, ...yearlyCadence.map((y) => y.count));

    return {
      grades,
      topYtdMover,
      mostRevised,
      petrolSpread,
      petrolSpreadDelta: Number((petrolSpread - prevPetrolSpread).toFixed(2)),
      dieselSpread,
      dieselSpreadDelta: Number((dieselSpread - prevDieselSpread).toFixed(2)),
      yearlyCadence,
      maxAnnualRevisions,
    };
  }, [data]);

  if (loading) {
    return <ArchiveSkeleton />;
  }

  if (error || !data || !analytics) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-8 text-center shadow-xs dark:border-red-900/60 dark:bg-slate-900">
        <AlertCircle className="mx-auto h-10 w-10 text-red-600 dark:text-red-400" />
        <h2 className="mt-3 font-heading text-xl font-bold text-slate-900 dark:text-white">
          Unable to load tariff analysis
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {error ?? "Analytics data is currently unavailable."}
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

  const filteredGrades = analytics.grades.filter(
    (g) => categoryFilter === "all" || g.tariff.category === categoryFilter
  );

  return (
    <div className="space-y-9">
      {/* Header */}
      <section className="flex flex-col justify-between gap-6 border-b border-gray-200 pb-7 md:flex-row md:items-end dark:border-slate-800">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2 font-heading text-xs font-bold uppercase tracking-wider text-brand-primary dark:text-sky-400">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-primary dark:bg-sky-400" />
            <span>Tariff Intelligence</span>
            <span className="text-slate-400">•</span>
            <span className="font-medium text-slate-600 dark:text-slate-400">
              Comparative Market Analytics
            </span>
          </div>
          <h1 className="font-heading text-3xl sm:text-5xl font-extrabold uppercase leading-none tracking-tight text-slate-900 dark:text-white">
            Market &amp; Tariff Analysis
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Year-to-date momentum, 12-month volatility ranges, cross-grade price spreads, and
            historical extremes across all {data.all_grades_count} tracked CEYPETCO fuel grades.
          </p>
        </div>

        <div className="flex items-center gap-4 self-start rounded-xl border border-gray-200 bg-white px-5 py-3.5 shadow-xs md:self-end shrink-0 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="font-heading text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
              Latest Revision
            </p>
            <p className="tabular-nums mt-0.5 font-mono text-sm font-bold text-slate-900 whitespace-nowrap dark:text-white">
              {data.latest_revision_date}
            </p>
          </div>
          <div className="h-7 w-px bg-gray-200 dark:bg-slate-800" />
          <div>
            <p className="font-heading text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
              Coverage
            </p>
            <p className="tabular-nums mt-0.5 font-heading text-sm font-bold text-brand-primary whitespace-nowrap dark:text-sky-400">
              {data.chart_series.length} Revisions
            </p>
          </div>
        </div>
      </section>

      {/* 4 Executive Insight Cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <article className="brand-top-border rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Top YTD Mover</span>
            <TrendingUp className="h-4 w-4 text-brand-primary dark:text-sky-400" aria-hidden="true" />
          </div>
          <p className="mt-3 font-heading text-lg font-bold text-slate-900 dark:text-white">
            {analytics.topYtdMover.code} · {analytics.topYtdMover.vis.shortLabel}
          </p>
          <div className="tabular-nums mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-extrabold text-brand-primary dark:text-sky-400">
              {analytics.topYtdMover.stats.ytd_change_pct > 0 ? "+" : ""}
              {analytics.topYtdMover.stats.ytd_change_pct}%
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ({analytics.topYtdMover.stats.ytd_change_lkr > 0 ? "+" : ""}Rs.{" "}
              {analytics.topYtdMover.stats.ytd_change_lkr})
            </span>
          </div>
          <p className="tabular-nums mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            Since {analytics.topYtdMover.stats.ytd_baseline_date} (Rs.{" "}
            {analytics.topYtdMover.stats.ytd_baseline_price_lkr})
          </p>
        </article>

        <article className="brand-top-border rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Most Active (12M)</span>
            <Activity className="h-4 w-4 text-[#0055ff] dark:text-blue-400" aria-hidden="true" />
          </div>
          <p className="mt-3 font-heading text-lg font-bold text-slate-900 dark:text-white">
            {analytics.mostRevised.code} · {analytics.mostRevised.vis.shortLabel}
          </p>
          <div className="tabular-nums mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-white">
              {analytics.mostRevised.stats.price_changes_last_12_months}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              price adjustments
            </span>
          </div>
          <p className="tabular-nums mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            Out of {data.summary_stats.revisions_last_12_months} total revisions in last 12 months
          </p>
        </article>

        <article className="brand-top-border rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Octane Spread</span>
            <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <p className="mt-3 font-heading text-lg font-bold text-slate-900 dark:text-white">
            LP 95 − LP 92
          </p>
          <div className="tabular-nums mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-white">
              Rs. {analytics.petrolSpread}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {analytics.petrolSpreadDelta >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" />
              )}
              {analytics.petrolSpreadDelta >= 0 ? "+" : ""}
              {analytics.petrolSpreadDelta} vs prev
            </span>
          </div>
          <p className="tabular-nums mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            Rs. {data.latest_tariffs["LP 95"]?.price_lkr} vs Rs.{" "}
            {data.latest_tariffs["LP 92"]?.price_lkr}
          </p>
        </article>

        <article className="brand-top-border rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Diesel Spread</span>
            <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          </div>
          <p className="mt-3 font-heading text-lg font-bold text-slate-900 dark:text-white">
            LSD − LAD
          </p>
          <div className="tabular-nums mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-white">
              Rs. {analytics.dieselSpread}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {analytics.dieselSpreadDelta >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" />
              )}
              {analytics.dieselSpreadDelta >= 0 ? "+" : ""}
              {analytics.dieselSpreadDelta} vs prev
            </span>
          </div>
          <p className="tabular-nums mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            Rs. {data.latest_tariffs["LSD"]?.price_lkr} vs Rs.{" "}
            {data.latest_tariffs["LAD"]?.price_lkr}
          </p>
        </article>
      </section>

      {/* 12-Month Range Bars + Annual Revision Cadence */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 12-Month Trading Range */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3.5 dark:border-slate-800">
            <div>
              <h2 className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                12-Month Price Range &amp; Positioning
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Current tariff relative to 12-month min, average, and max (Rs. per litre).
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-0.5 bg-slate-500" /> Avg
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-primary dark:bg-sky-400" /> Current
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {analytics.grades.map(({ code, tariff, stats, vis }) => {
              const span = Math.max(1, stats.max_12m_lkr - stats.min_12m_lkr);
              const avgPct = ((stats.avg_12m_lkr - stats.min_12m_lkr) / span) * 100;
              const currPct = ((tariff.price_lkr - stats.min_12m_lkr) / span) * 100;

              return (
                <div key={code} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: vis.color }}
                      />
                      <span className="font-heading font-bold text-slate-900 dark:text-white">
                        {code}
                      </span>
                      <span className="hidden text-slate-500 sm:inline dark:text-slate-400">
                        {vis.shortLabel}
                      </span>
                    </div>
                    <div className="tabular-nums flex items-center gap-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Min {stats.min_12m_lkr}</span>
                      <span>Avg {stats.avg_12m_lkr}</span>
                      <span>Max {stats.max_12m_lkr}</span>
                      <strong className="text-slate-900 dark:text-white">
                        Now Rs. {tariff.price_lkr}
                      </strong>
                    </div>
                  </div>

                  <div className="relative h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="absolute inset-y-0 rounded-full opacity-25"
                      style={{
                        left: "0%",
                        width: "100%",
                        backgroundColor: vis.color,
                      }}
                    />
                    {/* 12M Average Marker */}
                    <div
                      title={`12M Avg: Rs. ${stats.avg_12m_lkr}`}
                      className="absolute -top-1 h-4.5 w-0.5 bg-slate-500 dark:bg-slate-300"
                      style={{ left: `${Math.min(99, Math.max(1, avgPct))}%` }}
                    />
                    {/* Current Price Dot */}
                    <div
                      title={`Current: Rs. ${tariff.price_lkr}`}
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-xs dark:border-slate-900"
                      style={{
                        left: `${Math.min(98, Math.max(2, currPct))}%`,
                        backgroundColor: vis.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Annual Revision Cadence */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-xs lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-3.5 dark:border-slate-800">
              <div>
                <h2 className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                  Annual Revision Cadence
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Official CEYPETCO tariff notifications per year (last 14 active years).
                </p>
              </div>
              {hoveredYear && (
                <span className="tabular-nums rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white dark:bg-slate-800">
                  {hoveredYear}
                </span>
              )}
            </div>

            <div className="flex h-56 items-end justify-between gap-1.5 pt-4">
              {analytics.yearlyCadence.map(({ year, count }) => {
                const heightPct = Math.max(8, (count / analytics.maxAnnualRevisions) * 100);
                const isPeak = count === analytics.maxAnnualRevisions;
                return (
                  <div
                    key={year}
                    onMouseEnter={() => setHoveredYear(`${year}: ${count} revisions`)}
                    onMouseLeave={() => setHoveredYear(null)}
                    className="group flex flex-1 flex-col items-center gap-1.5"
                  >
                    <span className="tabular-nums font-mono text-[10px] font-bold text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white">
                      {count}
                    </span>
                    <div className="flex h-40 w-full items-end">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t transition-all duration-150 ${
                          isPeak
                            ? "bg-brand-primary group-hover:bg-brand-primary-hover"
                            : "bg-slate-800 group-hover:bg-brand-primary dark:bg-slate-600 dark:group-hover:bg-sky-400"
                        }`}
                      />
                    </div>
                    <span className="tabular-nums font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      {year.slice(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Notice the 2022–2024 shift from infrequent discretionary revisions to Sri Lanka&apos;s
            monthly formula-based adjustment cadence.
          </p>
        </div>
      </section>

      {/* Full 9-Grade Performance Matrix */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 border-b border-gray-200 bg-slate-50/80 p-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-800/40">
          <div>
            <h2 className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Comprehensive Grade Performance Matrix
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              YTD, YoY, 12-month statistics, and all-time historical benchmarks across all fuel
              grades.
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter category"
            className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-1 sm:self-center dark:border-slate-700 dark:bg-slate-900"
          >
            {(["all", "White Oil", "Black Oil"] as CategoryFilter[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`cursor-pointer rounded px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                  categoryFilter === cat
                    ? "bg-slate-900 text-white dark:bg-brand-primary"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {cat === "all" ? "All (9)" : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900 font-heading text-[11px] font-bold uppercase tracking-wider text-slate-200 dark:bg-slate-950">
                <th className="sticky left-0 z-20 bg-slate-900 py-3.5 px-4 whitespace-nowrap dark:bg-slate-950">
                  Grade
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Current (Rs.)</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Last Changed</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">12M Updates</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">YTD Change</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">YoY Change</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">12M Min / Max</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">All-Time Low</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">All-Time High</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredGrades.map(({ code, tariff, stats, ath, atl, vis }) => (
                <tr
                  key={code}
                  className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <td className="sticky left-0 z-10 bg-white py-3.5 px-4 whitespace-nowrap shadow-[2px_0_6px_-2px_rgba(15,23,42,0.06)] group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: vis.color }}
                      />
                      <div>
                        <p className="font-heading font-bold text-slate-900 dark:text-white">
                          {code}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {tariff.full_name}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-right font-heading font-bold text-slate-900 whitespace-nowrap dark:text-white">
                    {tariff.price_lkr.toFixed(2)}
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-right whitespace-nowrap">
                    <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {tariff.last_changed_date}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {tariff.days_since_last_change === 0
                        ? "Latest revision"
                        : `${tariff.days_since_last_change}d ago`}
                    </p>
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-right font-semibold text-slate-800 whitespace-nowrap dark:text-slate-200">
                    {stats.price_changes_last_12_months}
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-right whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        stats.ytd_change_lkr > 0
                          ? "text-red-600 dark:text-red-400"
                          : stats.ytd_change_lkr < 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-500"
                      }`}
                    >
                      {stats.ytd_change_lkr > 0 ? "+" : ""}
                      {stats.ytd_change_lkr} ({stats.ytd_change_pct > 0 ? "+" : ""}
                      {stats.ytd_change_pct}%)
                    </span>
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-right whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        stats.yoy_change_lkr > 0
                          ? "text-red-600 dark:text-red-400"
                          : stats.yoy_change_lkr < 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-500"
                      }`}
                    >
                      {stats.yoy_change_lkr > 0 ? "+" : ""}
                      {stats.yoy_change_lkr} ({stats.yoy_change_pct > 0 ? "+" : ""}
                      {stats.yoy_change_pct}%)
                    </span>
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-right font-mono text-xs text-slate-700 whitespace-nowrap dark:text-slate-300">
                    {stats.min_12m_lkr} – {stats.max_12m_lkr}
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-right whitespace-nowrap">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Rs. {atl.price_lkr}
                    </p>
                    <p className="font-mono text-[11px] text-slate-400">{atl.date}</p>
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-right whitespace-nowrap">
                    <p className="font-semibold text-brand-primary dark:text-sky-400">
                      Rs. {ath.price_lkr}
                    </p>
                    <p className="font-mono text-[11px] text-slate-400">{ath.latest_date}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
