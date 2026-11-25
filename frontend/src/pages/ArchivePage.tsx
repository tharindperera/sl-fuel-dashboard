import { useMemo, useState } from "react";
import { AlertCircle, Download, RefreshCw } from "lucide-react";
import type { UiStrings } from "../i18n/strings";
import type { ArchiveMetaData, ArchiveRow } from "../types/fuel";
import { exportRowsToCsv } from "../utils/dataLoader";
import { matchesDateQuery } from "../utils/formatters";
import { ArchiveFilters } from "../components/archive/ArchiveFilters";
import { ArchiveHero } from "../components/archive/ArchiveHero";
import { ArchiveTable, type SortDirection } from "../components/archive/ArchiveTable";
import { ArchiveSkeleton } from "../components/home/SkeletonGrid";

interface ArchivePageProps {
  meta: ArchiveMetaData | null;
  rows: ArchiveRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  strings: UiStrings;
}

export function ArchivePage({ meta, rows, loading, error, onRetry, strings }: ArchivePageProps) {
  const [dateQuery, setDateQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState("all");
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (selectedYear !== "all" && String(row.year) !== selectedYear) {
        return false;
      }
      if (!matchesDateQuery(row.dateLabel, row.isoDate, dateQuery)) {
        return false;
      }
      return true;
    });

    if (sortDirection === "asc") {
      return [...filtered].reverse();
    }
    return filtered;
  }, [rows, selectedYear, dateQuery, sortDirection]);

  const visibleProducts = useMemo(() => {
    if (!meta) return [];
    if (selectedProduct === "all" || showAllColumns) {
      return meta.products;
    }
    return meta.products.filter((p) => p.csv_column === selectedProduct);
  }, [meta, selectedProduct, showAllColumns]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  if (loading) {
    return <ArchiveSkeleton />;
  }

  if (error || !meta) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-8 text-center shadow-xs dark:border-red-900/60 dark:bg-slate-900">
        <AlertCircle className="mx-auto h-10 w-10 text-brand-red" />
        <h2 className="mt-3 font-heading text-xl font-bold text-slate-900 dark:text-white">
          Unable to load historical price archive
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {error ?? "Archive dataset is currently unavailable."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded bg-brand-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-red-hover"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const hasActiveFilters =
    dateQuery.trim() !== "" || selectedYear !== "all" || selectedProduct !== "all";

  const handleDateChange = (val: string) => {
    setDateQuery(val);
    setCurrentPage(1);
  };

  const handleYearChange = (val: string) => {
    setSelectedYear(val);
    setCurrentPage(1);
  };

  const handleProductChange = (val: string) => {
    setSelectedProduct(val);
    setShowAllColumns(false);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setDateQuery("");
    setSelectedYear("all");
    setSelectedProduct("all");
    setShowAllColumns(false);
    setCurrentPage(1);
  };

  const handleExportCsv = () => {
    const cols = visibleProducts.map((p) => ({ csvColumn: p.csv_column, label: p.code }));
    const suffix = hasActiveFilters ? "filtered" : "full";
    exportRowsToCsv(
      filteredRows,
      cols,
      `cpc_fuel_prices_${suffix}_${meta.latest_record_date}.csv`
    );
  };

  return (
    <div>
      <ArchiveHero meta={meta} strings={strings} />

      <section className="rounded-lg border border-gray-200/90 bg-white p-5 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        {/* Archive Section Header */}
        <div className="mb-6 flex flex-col justify-between gap-5 rounded-lg border border-gray-200 bg-slate-50/80 p-5 sm:flex-row sm:items-center sm:p-6 dark:border-slate-800 dark:bg-slate-800/50">
          <div>
            <div className="mb-2 inline-flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-red" />
              <span className="font-heading text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {strings.archive.sectionEyebrow}
              </span>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {strings.archive.sectionTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {strings.archive.sectionSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-center shrink-0">
            <span
              id="entries-badge"
              className="tabular-nums inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3.5 py-2 font-heading text-xs font-bold uppercase tracking-wider text-slate-800 shadow-xs whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                {filteredRows.length} {filteredRows.length === 1 ? "entry" : "entries"}
              </span>
            </span>

            <button
              type="button"
              id="export-data-btn"
              onClick={handleExportCsv}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-gray-300 bg-white px-3.5 py-2 font-heading text-xs font-bold uppercase tracking-wider text-slate-700 shadow-xs whitespace-nowrap transition-colors hover:border-gray-400 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5 text-brand-red dark:text-red-400" aria-hidden="true" />
              <span>{strings.archive.exportCsv}</span>
            </button>
          </div>
        </div>

        <ArchiveFilters
          dateQuery={dateQuery}
          onDateQueryChange={handleDateChange}
          selectedYear={selectedYear}
          onYearChange={handleYearChange}
          availableYears={meta.available_years}
          selectedProduct={selectedProduct}
          onProductChange={handleProductChange}
          products={meta.products}
          showAllColumns={showAllColumns}
          onToggleShowAllColumns={() => setShowAllColumns((prev) => !prev)}
          hasActiveFilters={hasActiveFilters}
          onReset={handleReset}
        />

        <ArchiveTable
          rows={paginatedRows}
          visibleProducts={visibleProducts}
          highlightedProduct={selectedProduct === "all" ? null : selectedProduct}
          sortDirection={sortDirection}
          onToggleSort={() => {
            setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
            setCurrentPage(1);
          }}
          currentPage={currentPage}
          pageSize={pageSize}
          totalEntries={filteredRows.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </section>
    </div>
  );
}
