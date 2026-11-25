import type { GlobalOilKpisData } from "../../types/oil";

interface BenchmarkSpecsSheetProps {
  kpis: GlobalOilKpisData;
}

export function BenchmarkSpecsSheet({ kpis }: BenchmarkSpecsSheetProps) {
  return (
    <section className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-gray-200 pb-4 dark:border-slate-800">
        <span className="font-heading text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Technical Data Sheet
        </span>
        <h2 className="mt-1 font-heading text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Brent Oil Benchmark Profile &amp; Specifications
        </h2>
      </div>

      <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <p>
          Brent Crude serves as the primary international pricing benchmark for seaborne light,
          sweet crude oil originating in the North Sea and traded across Europe, Africa, and Asia.
          Because Sri Lanka imports refined petroleum products and crude cargoes priced off Asian
          refined product benchmarks (Singapore Platts) that closely track Brent crude movements,
          sustained shifts in Brent directly influence domestic landed import costs and periodic
          CEYPETCO retail tariff revisions.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <strong>Public Data Attribution:</strong> {kpis.source_attribution} (public domain).
          Interactive chart powered by{" "}
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-red hover:underline dark:text-red-400"
          >
            TradingView Lightweight Charts™
          </a>{" "}
          (Apache 2.0).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-5 font-heading sm:grid-cols-3 lg:grid-cols-7 dark:border-slate-800">
        <div className="flex flex-col justify-between rounded-lg border border-gray-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Actual
          </span>
          <span className="tabular-nums mt-1.5 block text-lg font-extrabold text-slate-900 dark:text-white">
            {kpis.actual_price.toFixed(2)}
          </span>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-gray-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Previous
          </span>
          <span className="tabular-nums mt-1.5 block text-lg font-extrabold text-slate-900 dark:text-white">
            {kpis.previous_close.toFixed(2)}
          </span>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-gray-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Highest (ATH)
          </span>
          <div className="mt-1.5">
            <span className="tabular-nums block text-lg font-extrabold text-brand-red dark:text-red-400">
              {kpis.all_time_high.value.toFixed(2)}
            </span>
            <span className="tabular-nums block font-mono text-[10px] text-slate-400">
              {kpis.all_time_high.date}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-gray-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Lowest (ATL)
          </span>
          <div className="mt-1.5">
            <span className="tabular-nums block text-lg font-extrabold text-slate-900 dark:text-white">
              {kpis.all_time_low.value.toFixed(2)}
            </span>
            <span className="tabular-nums block font-mono text-[10px] text-slate-400">
              {kpis.all_time_low.date}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-gray-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Historical Range
          </span>
          <span className="tabular-nums mt-1.5 block text-base font-extrabold text-slate-900 dark:text-white">
            {kpis.historical_range}
          </span>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-gray-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Unit
          </span>
          <span className="mt-1.5 block text-base font-extrabold text-slate-900 dark:text-white">
            {kpis.unit}
          </span>
        </div>

        <div className="col-span-2 flex flex-col justify-between rounded-lg bg-slate-900 p-3.5 text-white sm:col-span-1 dark:bg-slate-950 dark:border dark:border-slate-800">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Frequency
          </span>
          <span className="mt-1.5 block text-base font-extrabold text-amber-400">
            {kpis.frequency}
          </span>
        </div>
      </div>
    </section>
  );
}
