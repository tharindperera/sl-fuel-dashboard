import { ArrowDown, ArrowUp } from "lucide-react";
import type { CommodityComparisonRow } from "../../types/oil";

interface CommodityComparisonTableProps {
  rows: CommodityComparisonRow[];
  selectedId: string;
  onSelectCommodity: (id: string) => void;
  indexSyncLabel: string;
}

const DOT_COLORS: Record<string, string> = {
  wti: "bg-brand-red",
  brent: "bg-[#0055ff]",
  natgas: "bg-amber-500",
  gasoline: "bg-slate-500",
  heating_oil: "bg-emerald-600",
};

function heatmapClass(pct: number): string {
  if (pct >= 15) return "bg-slate-900 text-white dark:bg-blue-600 dark:text-white";
  if (pct > 0) return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (pct <= -15) return "bg-brand-red text-white";
  if (pct < 0) return "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function CommodityComparisonTable({
  rows,
  selectedId,
  onSelectCommodity,
  indexSyncLabel,
}: CommodityComparisonTableProps) {
  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col justify-between gap-2 border-b border-gray-200 pb-4 sm:flex-row sm:items-center dark:border-slate-800">
        <div>
          <h2 className="font-heading text-xl font-extrabold tracking-tight text-slate-900 uppercase dark:text-white">
            Global Energy Commodities Comparison
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Click any commodity row to switch the interactive chart above.
          </p>
        </div>

        <span className="tabular-nums self-start rounded border border-gray-200 bg-slate-100 px-2.5 py-1 font-heading text-[11px] font-bold text-slate-600 whitespace-nowrap sm:self-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {indexSyncLabel}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-gray-200 font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="py-3 px-4">Commodity</th>
              <th className="py-3 px-4 text-right">Price</th>
              <th className="py-3 px-4 text-right">Change</th>
              <th className="py-3 px-4 text-right">Day %</th>
              <th className="py-3 px-4 text-right">Month %</th>
              <th className="py-3 px-4 text-right">Year %</th>
              <th className="py-3 px-4 text-center">Updated</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 font-heading dark:divide-slate-800">
            {rows.map((row) => {
              const isSelected = row.id === selectedId;
              const isUp = row.change >= 0;
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectCommodity(row.id)}
                  data-commodity-row={row.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50/60 hover:bg-blue-50 dark:bg-blue-950/25 dark:hover:bg-blue-950/40"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap dark:text-white">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-2 w-2 rounded-full ${DOT_COLORS[row.id] ?? "bg-slate-500"}`}
                      />
                      <span>{row.name}</span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        ({row.unit})
                      </span>
                    </div>
                  </td>

                  <td
                    className={`tabular-nums py-3.5 px-4 text-right font-extrabold whitespace-nowrap ${
                      isSelected
                        ? "text-[#0055ff] dark:text-blue-400"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {row.price.toFixed(row.decimals)}
                  </td>

                  <td
                    className={`tabular-nums py-3.5 px-4 text-right font-bold whitespace-nowrap ${
                      isUp
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-brand-red dark:text-red-400"
                    }`}
                  >
                    <span className="inline-flex items-center justify-end gap-0.5">
                      {isUp ? (
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>{Math.abs(row.change).toFixed(row.decimals)}</span>
                    </span>
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-right whitespace-nowrap">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-bold ${heatmapClass(
                        row.day_pct
                      )}`}
                    >
                      {row.day_pct >= 0 ? "+" : ""}
                      {row.day_pct.toFixed(2)}%
                    </span>
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-right whitespace-nowrap">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-bold ${heatmapClass(
                        row.month_pct
                      )}`}
                    >
                      {row.month_pct >= 0 ? "+" : ""}
                      {row.month_pct.toFixed(2)}%
                    </span>
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-right whitespace-nowrap">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-bold ${heatmapClass(
                        row.year_pct
                      )}`}
                    >
                      {row.year_pct >= 0 ? "+" : ""}
                      {row.year_pct.toFixed(2)}%
                    </span>
                  </td>

                  <td className="tabular-nums py-3.5 px-4 text-center font-mono text-xs text-slate-500 whitespace-nowrap dark:text-slate-400">
                    {row.latest_date}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
