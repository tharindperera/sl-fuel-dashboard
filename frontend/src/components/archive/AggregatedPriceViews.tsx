import { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  Download,
  Info,
  Layers,
  LineChart,
} from "lucide-react";
import type { AnnualAggregatedData, MonthlyAggregatedData } from "../../types/fuel";
import { exportTabularCsv } from "../../utils/dataLoader";
import { AggregatedPriceChart, type AggregatedChartPoint } from "./AggregatedPriceChart";

interface AggregatedPriceViewsProps {
  monthly: MonthlyAggregatedData | null;
  annual: AnnualAggregatedData | null;
}

export function AggregatedPriceViews({ monthly, annual }: AggregatedPriceViewsProps) {
  // Both aggregators and both Price Chart blocks MUST start collapsed by default.
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [annualOpen, setAnnualOpen] = useState(false);
  const [monthlyChartOpen, setMonthlyChartOpen] = useState(false);
  const [annualChartOpen, setAnnualChartOpen] = useState(false);

  // Monthly table state
  const [monthlyYearFilter, setMonthlyYearFilter] = useState("all");
  const [monthlyProductFilter, setMonthlyProductFilter] = useState("all");
  const [monthlyShowAllCols, setMonthlyShowAllCols] = useState(false);
  const [monthlyPage, setMonthlyPage] = useState(1);

  // Annual table state
  const [annualRangeFilter, setAnnualRangeFilter] = useState("all");
  const [annualProductFilter, setAnnualProductFilter] = useState("all");
  const [annualShowAllCols, setAnnualShowAllCols] = useState(false);
  const [annualPage, setAnnualPage] = useState(1);

  const pageSize = 12;

  const filteredMonths = useMemo(() => {
    if (!monthly) return [];
    return monthly.months.filter(
      (m) => monthlyYearFilter === "all" || String(m.year) === monthlyYearFilter
    );
  }, [monthly, monthlyYearFilter]);

  const monthlyVisibleProducts = useMemo(() => {
    if (!monthly) return [];
    if (monthlyProductFilter === "all" || monthlyShowAllCols) return monthly.products;
    return monthly.products.filter((p) => p.code === monthlyProductFilter);
  }, [monthly, monthlyProductFilter, monthlyShowAllCols]);

  const paginatedMonths = useMemo(() => {
    const start = (monthlyPage - 1) * pageSize;
    return filteredMonths.slice(start, start + pageSize);
  }, [filteredMonths, monthlyPage]);

  const filteredYears = useMemo(() => {
    if (!annual) return [];
    if (annualRangeFilter === "all") return annual.years;
    if (annualRangeFilter === "10y") return annual.years.slice(0, 10);
    if (annualRangeFilter === "5y") return annual.years.slice(0, 5);
    return annual.years.filter((y) => String(y.year) === annualRangeFilter);
  }, [annual, annualRangeFilter]);

  const annualVisibleProducts = useMemo(() => {
    if (!annual) return [];
    if (annualProductFilter === "all" || annualShowAllCols) return annual.products;
    return annual.products.filter((p) => p.code === annualProductFilter);
  }, [annual, annualProductFilter, annualShowAllCols]);

  const paginatedYears = useMemo(() => {
    const start = (annualPage - 1) * pageSize;
    return filteredYears.slice(start, start + pageSize);
  }, [filteredYears, annualPage]);

  const monthlyChartPoints = useMemo<AggregatedChartPoint[]>(() => {
    if (!monthly) return [];
    return [...monthly.months].reverse().map((m) => ({
      key: m.month,
      label: m.label,
      prices: m.prices,
      pctChange: m.mom_pct_change,
    }));
  }, [monthly]);

  const annualChartPoints = useMemo<AggregatedChartPoint[]>(() => {
    if (!annual) return [];
    return [...annual.years].reverse().map((y) => {
      const prices: Record<string, number | null> = {};
      const pctChange: Record<string, number | null> = {};
      for (const prod of annual.products) {
        const g = y.grades[prod.code];
        prices[prod.code] = g ? g.avg_price : null;
        pctChange[prod.code] = g ? g.yoy_pct_change : null;
      }
      return {
        key: String(y.year),
        label: String(y.year),
        prices,
        pctChange,
      };
    });
  }, [annual]);

  if (!monthly && !annual) return null;

  const monthlyTotalPages = Math.max(1, Math.ceil(filteredMonths.length / pageSize));
  const annualTotalPages = Math.max(1, Math.ceil(filteredYears.length / pageSize));

  const handleExportMonthlyCsv = () => {
    if (!monthly) return;
    const headers = [
      "Month",
      "Label",
      "Revisions",
      ...monthlyVisibleProducts.map((p) => p.csv_column),
    ];
    const rows = filteredMonths.map((m) => [
      m.month,
      m.label,
      String(m.revisions_in_month),
      ...monthlyVisibleProducts.map((p) => {
        const v = m.prices[p.code];
        return v === null || v === undefined ? "" : v.toFixed(2);
      }),
    ]);
    exportTabularCsv(
      headers,
      rows,
      `cpc_monthly_aggregated_${monthlyYearFilter}_${monthly.latest_revision_date}.csv`
    );
  };

  const handleExportAnnualCsv = () => {
    if (!annual) return;
    const headers = [
      "Year",
      "Months Covered",
      "Revisions",
      ...annualVisibleProducts.map((p) => `${p.csv_column} (Avg)`),
    ];
    const rows = filteredYears.map((y) => [
      String(y.year),
      String(y.months_covered),
      String(y.revisions_in_year),
      ...annualVisibleProducts.map((p) => {
        const v = y.grades[p.code]?.avg_price;
        return v === null || v === undefined ? "" : v.toFixed(2);
      }),
    ]);
    exportTabularCsv(
      headers,
      rows,
      `cpc_annual_aggregated_${annualRangeFilter}_${annual.latest_revision_date}.csv`
    );
  };

  return (
    <section
      aria-labelledby="aggregated-views-heading"
      className="mt-8 space-y-4"
    >
      <div className="flex items-center gap-2.5 px-1">
        <span className="h-2.5 w-2.5 rounded-sm bg-brand-red" />
        <h2
          id="aggregated-views-heading"
          className="font-heading text-sm font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400"
        >
          Aggregated Price Views
        </h2>
      </div>

      {/* 1. Monthly Price Aggregator (Collapsed by Default) */}
      {monthly && (
        <div className="overflow-hidden rounded-lg border border-gray-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            id="monthly-aggregator-toggle"
            aria-expanded={monthlyOpen}
            onClick={() => setMonthlyOpen((prev) => !prev)}
            className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/80 sm:px-7 sm:py-5 dark:hover:bg-slate-800/50"
          >
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-brand-red dark:bg-red-950/50 dark:text-red-400">
                <CalendarRange className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Monthly Price Aggregator
                </h3>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Time-weighted monthly averages with end-of-month rollover logic
                </p>
              </div>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded border border-gray-200 bg-slate-50 px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <span>{monthlyOpen ? "Collapse" : "Expand"}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  monthlyOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </span>
          </button>

          {monthlyOpen && (
            <div
              id="monthly-aggregator-panel"
              className="border-t border-gray-200 p-5 sm:p-7 dark:border-slate-800"
            >
              {/* Methodology Info Pill */}
              <div
                title="Revisions in the final 2 days of a month roll to the 1st of the next month. Multi-revision months are weighted by days held, and zero-revision months carry forward."
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-relaxed text-slate-700 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-slate-300"
              >
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0055ff] dark:text-blue-400" />
                <span>
                  <strong>Methodology:</strong> End-of-month revisions (final 2 days, e.g.{" "}
                  <code className="font-mono">31.05.2026</code>,{" "}
                  <code className="font-mono">30.06.2026</code>) roll forward to the 1st of the next
                  month; months with multiple active tariffs are time-weighted by days held;
                  unchanged months carry forward continuously.
                </span>
              </div>

              {/* Controls & Export Bar */}
              <div className="mb-5 flex flex-col justify-between gap-4 rounded-lg border border-gray-200 bg-slate-50/80 p-4 lg:flex-row lg:items-center dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    aria-label="Filter monthly year"
                    value={monthlyYearFilter}
                    onChange={(e) => {
                      setMonthlyYearFilter(e.target.value);
                      setMonthlyPage(1);
                    }}
                    className="tabular-nums cursor-pointer rounded border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="all">All years</option>
                    {monthly.available_years.map((yr) => (
                      <option key={yr} value={String(yr)}>
                        {yr}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter monthly product"
                    value={monthlyProductFilter}
                    onChange={(e) => {
                      setMonthlyProductFilter(e.target.value);
                      setMonthlyShowAllCols(false);
                    }}
                    className="cursor-pointer rounded border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="all">All products</option>
                    {monthly.products.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} — {p.full_name}
                      </option>
                    ))}
                  </select>

                  {monthlyProductFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setMonthlyShowAllCols((prev) => !prev)}
                      className="cursor-pointer rounded border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {monthlyShowAllCols ? "Focus selected" : "Show all columns"}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    id="monthly-count-badge"
                    className="tabular-nums inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>
                      {filteredMonths.length}{" "}
                      {filteredMonths.length === 1 ? "month" : "months"}
                    </span>
                  </span>

                  <button
                    type="button"
                    id="monthly-export-csv-btn"
                    onClick={handleExportMonthlyCsv}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download
                      className="h-3.5 w-3.5 text-brand-red dark:text-red-400"
                      aria-hidden="true"
                    />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    id="monthly-toggle-chart-btn"
                    onClick={() => setMonthlyChartOpen((prev) => !prev)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-3.5 py-1.5 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                      monthlyChartOpen
                        ? "bg-slate-900 text-white dark:bg-brand-red"
                        : "border border-brand-red/30 bg-red-50 text-brand-red hover:bg-brand-red hover:text-white dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-brand-red dark:hover:text-white"
                    }`}
                  >
                    <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{monthlyChartOpen ? "Hide Price Chart" : "Show Price Chart"}</span>
                  </button>
                </div>
              </div>

              {/* Monthly Table */}
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-800">
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900 font-heading text-xs font-bold uppercase tracking-wider text-slate-200 dark:bg-slate-950">
                        <th className="sticky left-0 z-20 bg-slate-900 py-3 px-4 whitespace-nowrap dark:bg-slate-950">
                          Month
                        </th>
                        {monthlyVisibleProducts.map((p) => (
                          <th
                            key={p.code}
                            title={p.full_name}
                            className="py-3 px-4 text-right whitespace-nowrap"
                          >
                            {p.code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {paginatedMonths.map((row) => (
                        <tr
                          key={row.month}
                          className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="sticky left-0 z-10 bg-white py-3 px-4 font-heading font-bold text-slate-900 whitespace-nowrap shadow-[2px_0_6px_-2px_rgba(15,23,42,0.06)] group-hover:bg-slate-50 dark:bg-slate-900 dark:text-white dark:group-hover:bg-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums">{row.label}</span>
                              {row.is_partial_month && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 whitespace-nowrap dark:bg-amber-950/60 dark:text-amber-300">
                                  Partial
                                </span>
                              )}
                              {row.revisions_in_month > 1 && (
                                <span
                                  title={`${row.revisions_in_month} revisions in ${row.label}; time-weighted daily average shown.`}
                                  className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#0055ff] whitespace-nowrap dark:bg-blue-950/50 dark:text-blue-300"
                                >
                                  {row.revisions_in_month} rev
                                </span>
                              )}
                            </div>
                          </td>
                          {monthlyVisibleProducts.map((p) => {
                            const val = row.prices[p.code];
                            const simpleVal = row.simple_avg[p.code];
                            const mom = row.mom_pct_change[p.code];
                            return (
                              <td
                                key={p.code}
                                title={
                                  val !== null && simpleVal !== null && val !== simpleVal
                                    ? `Simple avg: Rs. ${simpleVal.toFixed(2)}${
                                        mom !== null ? ` | MoM: ${mom > 0 ? "+" : ""}${mom}%` : ""
                                      }`
                                    : mom !== null
                                    ? `MoM: ${mom > 0 ? "+" : ""}${mom}%`
                                    : undefined
                                }
                                className="tabular-nums py-3 px-4 text-right font-medium text-slate-900 whitespace-nowrap dark:text-slate-100"
                              >
                                {val === null || val === undefined ? (
                                  <span className="text-slate-400 dark:text-slate-600">—</span>
                                ) : Number.isInteger(val) ? (
                                  val
                                ) : (
                                  val.toFixed(2)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <span className="tabular-nums whitespace-nowrap">
                    Page <strong className="text-slate-900 dark:text-white">{monthlyPage}</strong> of{" "}
                    <strong className="text-slate-900 dark:text-white">{monthlyTotalPages}</strong>{" "}
                    ({filteredMonths.length} months)
                  </span>
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={monthlyPage <= 1}
                      onClick={() => setMonthlyPage((p) => Math.max(1, p - 1))}
                      className="cursor-pointer rounded border border-gray-300 bg-white px-2.5 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={monthlyPage >= monthlyTotalPages}
                      onClick={() => setMonthlyPage((p) => Math.min(monthlyTotalPages, p + 1))}
                      className="cursor-pointer rounded border border-gray-300 bg-white px-2.5 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              {/* Hidden-Until-Clicked Monthly Price Chart */}
              {monthlyChartOpen && (
                <AggregatedPriceChart mode="monthly" pointsChronological={monthlyChartPoints} />
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Annual Price Aggregator (Collapsed by Default) */}
      {annual && (
        <div className="overflow-hidden rounded-lg border border-gray-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            id="annual-aggregator-toggle"
            aria-expanded={annualOpen}
            onClick={() => setAnnualOpen((prev) => !prev)}
            className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/80 sm:px-7 sm:py-5 dark:hover:bg-slate-800/50"
          >
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                <Layers className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Annual Price Aggregator
                </h3>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Calendar-year averages, YoY trends, and revision counts
                </p>
              </div>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded border border-gray-200 bg-slate-50 px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <span>{annualOpen ? "Collapse" : "Expand"}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  annualOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </span>
          </button>

          {annualOpen && (
            <div
              id="annual-aggregator-panel"
              className="border-t border-gray-200 p-5 sm:p-7 dark:border-slate-800"
            >
              {/* Methodology Info Pill */}
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-relaxed text-slate-700 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-slate-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0055ff] dark:text-blue-400" />
                <span>
                  <strong>Methodology:</strong> Mean of the calendar year&apos;s continuous monthly
                  tariffs across all 9 fuel grades. Hover any cell for yearly Min / Max / YoY %
                  change; current incomplete calendar years carry a <code className="font-mono">YTD</code> badge.
                </span>
              </div>

              {/* Controls & Export Bar */}
              <div className="mb-5 flex flex-col justify-between gap-4 rounded-lg border border-gray-200 bg-slate-50/80 p-4 lg:flex-row lg:items-center dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    aria-label="Filter annual range"
                    value={annualRangeFilter}
                    onChange={(e) => {
                      setAnnualRangeFilter(e.target.value);
                      setAnnualPage(1);
                    }}
                    className="tabular-nums cursor-pointer rounded border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="all">All years</option>
                    <option value="10y">Last 10 Years</option>
                    <option value="5y">Last 5 Years</option>
                    {annual.years.map((y) => (
                      <option key={y.year} value={String(y.year)}>
                        {y.year}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter annual product"
                    value={annualProductFilter}
                    onChange={(e) => {
                      setAnnualProductFilter(e.target.value);
                      setAnnualShowAllCols(false);
                    }}
                    className="cursor-pointer rounded border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-brand-red focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="all">All products</option>
                    {annual.products.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} — {p.full_name}
                      </option>
                    ))}
                  </select>

                  {annualProductFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setAnnualShowAllCols((prev) => !prev)}
                      className="cursor-pointer rounded border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {annualShowAllCols ? "Focus selected" : "Show all columns"}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    id="annual-count-badge"
                    className="tabular-nums inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>
                      {filteredYears.length} {filteredYears.length === 1 ? "year" : "years"}
                    </span>
                  </span>

                  <button
                    type="button"
                    id="annual-export-csv-btn"
                    onClick={handleExportAnnualCsv}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download
                      className="h-3.5 w-3.5 text-brand-red dark:text-red-400"
                      aria-hidden="true"
                    />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    id="annual-toggle-chart-btn"
                    onClick={() => setAnnualChartOpen((prev) => !prev)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-3.5 py-1.5 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                      annualChartOpen
                        ? "bg-slate-900 text-white dark:bg-brand-red"
                        : "border border-brand-red/30 bg-red-50 text-brand-red hover:bg-brand-red hover:text-white dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-brand-red dark:hover:text-white"
                    }`}
                  >
                    <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{annualChartOpen ? "Hide Price Chart" : "Show Price Chart"}</span>
                  </button>
                </div>
              </div>

              {/* Annual Table */}
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-800">
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900 font-heading text-xs font-bold uppercase tracking-wider text-slate-200 dark:bg-slate-950">
                        <th className="sticky left-0 z-20 bg-slate-900 py-3 px-4 whitespace-nowrap dark:bg-slate-950">
                          Year
                        </th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Revs</th>
                        {annualVisibleProducts.map((p) => (
                          <th
                            key={p.code}
                            title={`${p.full_name} (Annual Average Rs.)`}
                            className="py-3 px-4 text-right whitespace-nowrap"
                          >
                            {p.code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {paginatedYears.map((row) => (
                        <tr
                          key={row.year}
                          className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="sticky left-0 z-10 bg-white py-3 px-4 font-heading font-bold text-slate-900 whitespace-nowrap shadow-[2px_0_6px_-2px_rgba(15,23,42,0.06)] group-hover:bg-slate-50 dark:bg-slate-900 dark:text-white dark:group-hover:bg-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums">{row.year}</span>
                              {row.is_ytd && (
                                <span className="rounded bg-brand-red px-1.5 py-0.5 text-[10px] font-bold uppercase text-white whitespace-nowrap">
                                  YTD
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="tabular-nums py-3 px-3 text-right font-mono text-xs text-slate-500 whitespace-nowrap dark:text-slate-400">
                            {row.revisions_in_year}
                          </td>
                          {annualVisibleProducts.map((p) => {
                            const g = row.grades[p.code];
                            const avg = g?.avg_price;
                            return (
                              <td
                                key={p.code}
                                title={
                                  g && avg !== null
                                    ? `Min: ${g.min_price} | Max: ${g.max_price}${
                                        g.yoy_pct_change !== null
                                          ? ` | YoY: ${g.yoy_pct_change > 0 ? "+" : ""}${
                                              g.yoy_pct_change
                                            }%`
                                          : ""
                                      }`
                                    : undefined
                                }
                                className="tabular-nums py-3 px-4 text-right font-medium text-slate-900 whitespace-nowrap dark:text-slate-100"
                              >
                                {avg === null || avg === undefined ? (
                                  <span className="text-slate-400 dark:text-slate-600">—</span>
                                ) : Number.isInteger(avg) ? (
                                  avg
                                ) : (
                                  avg.toFixed(2)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <span className="tabular-nums whitespace-nowrap">
                    Page <strong className="text-slate-900 dark:text-white">{annualPage}</strong> of{" "}
                    <strong className="text-slate-900 dark:text-white">{annualTotalPages}</strong> (
                    {filteredYears.length} years)
                  </span>
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={annualPage <= 1}
                      onClick={() => setAnnualPage((p) => Math.max(1, p - 1))}
                      className="cursor-pointer rounded border border-gray-300 bg-white px-2.5 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={annualPage >= annualTotalPages}
                      onClick={() => setAnnualPage((p) => Math.min(annualTotalPages, p + 1))}
                      className="cursor-pointer rounded border border-gray-300 bg-white px-2.5 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              {/* Hidden-Until-Clicked Annual Price Chart */}
              {annualChartOpen && (
                <AggregatedPriceChart mode="annual" pointsChronological={annualChartPoints} />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
