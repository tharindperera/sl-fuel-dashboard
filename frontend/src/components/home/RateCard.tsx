import { ArrowDownRight, ArrowUpRight, Clock, Minus } from "lucide-react";
import type { CurrentRateProduct } from "../../types/fuel";
import { formatDeltaRs, formatIsoToDisplayDate, formatLkr } from "../../utils/formatters";

interface RateCardProps {
  product: CurrentRateProduct;
}

export function RateCard({ product }: RateCardProps) {
  const indexLabel = String(product.display_order).padStart(2, "0");
  const displayDate = formatIsoToDisplayDate(product.effective_from_date);
  const deltaText = formatDeltaRs(product.delta_lkr);

  const deltaStyle =
    product.change_direction === "up"
      ? "bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60"
      : product.change_direction === "down"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60"
      : "bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

  return (
    <article className="brand-top-border flex flex-col justify-between border border-gray-200 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div>
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="uppercase tracking-wider text-brand-primary dark:text-sky-400">
            {product.category}
          </span>
          <span className="tabular-nums font-mono text-slate-400 dark:text-slate-500">
            {indexLabel}
          </span>
        </div>

        <h3 className="mt-4 font-heading text-xl font-bold leading-snug text-slate-900 dark:text-white">
          {product.full_name}
        </h3>
      </div>

      <div className="mt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-4 dark:border-slate-800">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Rs</span>
            <span className="tabular-nums font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {formatLkr(product.price_lkr)}
            </span>
            <span className="ml-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-400 whitespace-nowrap">
              {product.unit}
            </span>
          </div>

          <span
            title={`Previous revision: Rs ${formatLkr(product.previous_price_lkr)} (${product.delta_pct > 0 ? "+" : ""}${product.delta_pct}%)`}
            className={`tabular-nums inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${deltaStyle}`}
          >
            {product.change_direction === "up" && <ArrowUpRight className="h-3 w-3" aria-hidden="true" />}
            {product.change_direction === "down" && <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
            {product.change_direction === "unchanged" && <Minus className="h-3 w-3" aria-hidden="true" />}
            <span>{deltaText}</span>
          </span>
        </div>

        <div className="mt-3 flex items-center text-xs text-slate-600 dark:text-slate-400">
          <Clock
            className="mr-1.5 h-3.5 w-3.5 shrink-0 text-brand-primary dark:text-sky-400"
            aria-hidden="true"
          />
          <span className="tabular-nums">
            Effective from{" "}
            <strong className="font-bold text-slate-900 dark:text-slate-100">{displayDate}</strong>{" "}
            at{" "}
            <strong className="font-bold text-slate-900 dark:text-slate-100">
              {product.effective_from_time}
            </strong>
          </span>
        </div>
      </div>
    </article>
  );
}
