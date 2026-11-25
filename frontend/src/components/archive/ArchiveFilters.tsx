import { Calendar, ChevronDown, Fuel, RotateCcw, Search } from "lucide-react";
import type { ArchiveProductMeta } from "../../types/fuel";

interface ArchiveFiltersProps {
  dateQuery: string;
  onDateQueryChange: (val: string) => void;
  selectedYear: string;
  onYearChange: (val: string) => void;
  availableYears: number[];
  selectedProduct: string;
  onProductChange: (val: string) => void;
  products: ArchiveProductMeta[];
  showAllColumns: boolean;
  onToggleShowAllColumns: () => void;
  hasActiveFilters: boolean;
  onReset: () => void;
}

export function ArchiveFilters({
  dateQuery,
  onDateQueryChange,
  selectedYear,
  onYearChange,
  availableYears,
  selectedProduct,
  onProductChange,
  products,
  showAllColumns,
  onToggleShowAllColumns,
  hasActiveFilters,
  onReset,
}: ArchiveFiltersProps) {
  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Find a Date */}
        <div className="flex flex-col">
          <label
            htmlFor="filter-date"
            className="mb-2 flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>Find a date</span>
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="filter-date"
              type="text"
              value={dateQuery}
              onChange={(e) => onDateQueryChange(e.target.value)}
              placeholder="e.g. 03.2026 or 2022-06-26"
              className="tabular-nums w-full rounded border border-gray-300 bg-slate-50 py-2.5 pr-4 pl-9 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
            />
          </div>
        </div>

        {/* Year Dropdown */}
        <div className="flex flex-col">
          <label
            htmlFor="filter-year"
            className="mb-2 flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>Year</span>
          </label>
          <div className="relative">
            <select
              id="filter-year"
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value)}
              className="tabular-nums w-full cursor-pointer appearance-none rounded border border-gray-300 bg-slate-50 py-2.5 pr-10 pl-4 text-sm font-medium text-slate-800 transition-colors focus:border-brand-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="all">All years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  {yr}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Product Dropdown */}
        <div className="flex flex-col">
          <label
            htmlFor="filter-product"
            className="mb-2 flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            <Fuel className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>Product</span>
          </label>
          <div className="relative">
            <select
              id="filter-product"
              value={selectedProduct}
              onChange={(e) => onProductChange(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded border border-gray-300 bg-slate-50 py-2.5 pr-10 pl-4 text-sm font-medium text-slate-800 transition-colors focus:border-brand-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="all">All products</option>
              {products.map((prod) => (
                <option key={prod.csv_column} value={prod.csv_column}>
                  {prod.code} — {prod.full_name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {(hasActiveFilters || selectedProduct !== "all") && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3.5 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {selectedProduct !== "all" && (
              <button
                type="button"
                onClick={onToggleShowAllColumns}
                className="cursor-pointer rounded border border-gray-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {showAllColumns ? "Focus selected column only" : "Show all 9 columns"}
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-700 transition-colors hover:border-brand-primary hover:text-brand-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-400 dark:hover:text-sky-400"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
