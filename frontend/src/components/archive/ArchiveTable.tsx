import { ArrowDown, ArrowUp } from "lucide-react";
import type { ArchiveProductMeta, ArchiveRow } from "../../types/fuel";
import { formatArchiveCell } from "../../utils/formatters";

export type SortDirection = "desc" | "asc";

interface ArchiveTableProps {
  rows: ArchiveRow[];
  visibleProducts: ArchiveProductMeta[];
  highlightedProduct: string | null;
  sortDirection: SortDirection;
  onToggleSort: () => void;
  currentPage: number;
  pageSize: number;
  totalEntries: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  if (currentPage > 3) pages.push("ellipsis");
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }
  if (currentPage < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

export function ArchiveTable({
  rows,
  visibleProducts,
  highlightedProduct,
  sortDirection,
  onToggleSort,
  currentPage,
  pageSize,
  totalEntries,
  onPageChange,
  onPageSizeChange,
}: ArchiveTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = totalEntries === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, totalEntries);
  const pageNumbers = getPageNumbers(safePage, totalPages);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="w-full overflow-x-auto">
        <table
          id="fuel-archive-table"
          className="w-full border-collapse text-left text-sm"
        >
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900 font-heading text-xs font-bold uppercase tracking-wider text-white dark:bg-slate-950">
              <th
                scope="col"
                className="sticky left-0 z-20 bg-slate-900 py-3.5 px-5 font-semibold text-slate-200 whitespace-nowrap shadow-[2px_0_6px_-2px_rgba(0,0,0,0.25)] dark:bg-slate-950"
              >
                <button
                  type="button"
                  onClick={onToggleSort}
                  title={`Sort by Date (${sortDirection === "desc" ? "newest first" : "oldest first"})`}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-left uppercase tracking-wider text-slate-200 transition-colors hover:text-white focus:outline-none focus-visible:underline"
                >
                  <span>Date</span>
                  {sortDirection === "desc" ? (
                    <ArrowDown className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                  )}
                </button>
              </th>

              {visibleProducts.map((prod) => {
                const isFocused = highlightedProduct === prod.csv_column;
                return (
                  <th
                    key={prod.csv_column}
                    scope="col"
                    title={`${prod.full_name} (${prod.category})`}
                    className={`py-3.5 px-4 text-right font-semibold whitespace-nowrap transition-colors ${
                      isFocused
                        ? "bg-sky-950/70 text-white"
                        : "text-slate-200"
                    }`}
                  >
                    <span className="cursor-help border-b border-dotted border-slate-500/60 pb-0.5">
                      {prod.code}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-sm text-slate-800 dark:divide-slate-800 dark:text-slate-200">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleProducts.length + 1}
                  className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  No historical price revisions match your current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`group transition-colors duration-150 ${
                    row.isLatest
                      ? "bg-sky-50/45 hover:bg-sky-50/75 dark:bg-sky-950/25 dark:hover:bg-sky-950/40"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <td
                    className={`sticky left-0 z-10 py-3.5 px-5 font-heading font-bold whitespace-nowrap shadow-[2px_0_6px_-2px_rgba(15,23,42,0.06)] transition-colors ${
                      row.isLatest
                        ? "bg-[#f4f9fd] text-slate-900 group-hover:bg-[#eaf4fb] dark:bg-[#0e1b2b] dark:text-white dark:group-hover:bg-[#132438]"
                        : "bg-white text-slate-900 group-hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:group-hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">{row.dateLabel}</span>
                      {row.isLatest && (
                        <span className="rounded bg-brand-primary px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wider text-white whitespace-nowrap">
                          Latest
                        </span>
                      )}
                    </div>
                  </td>

                  {visibleProducts.map((prod) => {
                    const formatted = formatArchiveCell(
                      row.rawValues[prod.csv_column] ?? "",
                      row.numericValues[prod.csv_column] ?? null
                    );
                    const isFocused = highlightedProduct === prod.csv_column;
                    return (
                      <td
                        key={prod.csv_column}
                        className={`tabular-nums py-3.5 px-4 text-right font-medium whitespace-nowrap ${
                          formatted === "—"
                            ? "text-slate-400 dark:text-slate-600"
                            : isFocused
                            ? "bg-sky-50/45 font-bold text-slate-900 dark:bg-sky-950/25 dark:text-white"
                            : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-200 bg-slate-50 px-5 py-4 text-xs font-medium text-slate-600 sm:flex-row dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <p className="tabular-nums whitespace-nowrap">
            Showing <span className="font-bold text-slate-900 dark:text-white">{startIndex}</span> to{" "}
            <span className="font-bold text-slate-900 dark:text-white">{endIndex}</span> of{" "}
            <span className="font-bold text-slate-900 dark:text-white">{totalEntries}</span> entries
          </p>

          <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span>Rows:</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="tabular-nums cursor-pointer rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:border-brand-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        <nav aria-label="Archive pagination" className="inline-flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="cursor-pointer rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:disabled:text-slate-600"
          >
            Previous
          </button>

          {pageNumbers.map((item, idx) =>
            item === "ellipsis" ? (
              <span key={`e-${idx}`} className="px-2 text-slate-400 dark:text-slate-600">
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === safePage ? "page" : undefined}
                className={`tabular-nums cursor-pointer rounded border px-3 py-1.5 text-xs font-bold transition-colors ${
                  item === safePage
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-gray-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="cursor-pointer rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:disabled:text-slate-600"
          >
            Next
          </button>
        </nav>
      </div>
    </div>
  );
}
