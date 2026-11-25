import { ArrowLeft, BarChart3, LineChart } from "lucide-react";
import type { RoutePage } from "../types/fuel";

interface ComingSoonPageProps {
  page: "trends" | "analysis";
  onNavigate: (page: RoutePage) => void;
}

export function ComingSoonPage({ page, onNavigate }: ComingSoonPageProps) {
  const isTrends = page === "trends";

  return (
    <section className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-8 shadow-sm sm:p-12 dark:border-slate-800 dark:bg-slate-900">
      <div className="absolute top-0 left-0 h-full w-1.5 bg-brand-red" aria-hidden="true" />

      <div className="max-w-2xl pl-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded border border-red-100 bg-red-50 px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider text-brand-red whitespace-nowrap dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-red" />
          <span>PHASE 2 ROADMAP</span>
        </div>

        <div className="flex items-center gap-3">
          {isTrends ? (
            <LineChart className="h-7 w-7 text-brand-red dark:text-red-400" aria-hidden="true" />
          ) : (
            <BarChart3 className="h-7 w-7 text-brand-red dark:text-red-400" aria-hidden="true" />
          )}
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isTrends ? "Fuel Price Trends" : "Market & Tariff Analysis"}
          </h1>
        </div>

        <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
          {isTrends
            ? "Interactive multi-grade trend charts, revision delta timelines, and all-time benchmark comparisons are scheduled for Phase 2 and already backed by pipeline KPI data."
            : "Cross-grade spread analysis, YoY/YTD volatility metrics, and revision cadence breakdowns are scheduled for Phase 2."}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="inline-flex cursor-pointer items-center gap-2 rounded bg-brand-red px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-brand-red-hover"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Current Market Rates</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("archive")}
            className="inline-flex cursor-pointer items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <span>Explore Price Archive</span>
          </button>
        </div>
      </div>
    </section>
  );
}
