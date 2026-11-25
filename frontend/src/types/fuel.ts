export type FuelCategory = "White Oil" | "Black Oil";
export type ChangeDirection = "up" | "down" | "unchanged";
export type RoutePage = "home" | "archive" | "trends" | "analysis" | "global-oil";
export type LanguageCode = "en" | "si" | "ta";

export interface CurrentRateProduct {
  display_order: number;
  code: string;
  csv_column: string;
  full_name: string;
  category: FuelCategory;
  price_lkr: number;
  unit: string;
  effective_from_date: string; // YYYY-MM-DD
  effective_from_time: string; // HH:mm
  previous_price_lkr: number;
  delta_lkr: number;
  delta_pct: number;
  change_direction: ChangeDirection;
}

export interface CurrentRatesData {
  last_checked_sl: string;
  last_checked_utc: string;
  latest_revision_date: string;
  active_period_label: string;
  categories: {
    "White Oil": CurrentRateProduct[];
    "Black Oil": CurrentRateProduct[];
  };
}

export interface ArchiveProductMeta {
  code: string;
  csv_column: string;
  full_name: string;
  category: FuelCategory;
  segment: string;
}

export interface ArchiveMetaData {
  first_record_year: number;
  first_record_date: string;
  latest_record_date: string;
  total_records: number;
  available_years: number[];
  products: ArchiveProductMeta[];
}

export interface PipelineStatusData {
  last_run_sl: string;
  last_run_utc: string;
  mode: string;
  update_applied: boolean;
  new_revisions_added: string[];
  total_csv_rows: number;
  latest_revision_date: string;
  warnings: string[];
}

export interface ArchiveRow {
  id: string;
  index: number; // 0 = newest row in original CSV order
  dateLabel: string; // e.g. "02.11.2026" or "17.10.2022 (9.00 PM)"
  isoDate: string; // e.g. "2026-11-02"
  year: number;
  isLatest: boolean;
  rawValues: Record<string, string>; // keyed by csv_column
  numericValues: Record<string, number | null>; // keyed by csv_column
}

export type TariffStatus = "increased" | "decreased" | "no_change";

export interface LatestTariffEntry {
  code: string;
  full_name: string;
  category: FuelCategory;
  is_core_retail: boolean;
  price_lkr: number;
  previous_price_lkr: number;
  delta_lkr: number;
  delta_pct: number;
  status: TariffStatus;
  last_changed_date: string;
  days_since_last_change: number;
}

export interface AllTimeHighEntry {
  price_lkr: number;
  dates: string[];
  latest_date: string;
}

export interface AllTimeLowEntry {
  price_lkr: number;
  date: string;
  dates: string[];
}

export interface GradeSummaryStats {
  price_changes_last_12_months: number;
  ytd_change_lkr: number;
  ytd_change_pct: number;
  ytd_baseline_date: string;
  ytd_baseline_price_lkr: number;
  yoy_change_lkr: number;
  yoy_change_pct: number;
  yoy_baseline_date: string;
  yoy_baseline_price_lkr: number;
  min_12m_lkr: number;
  max_12m_lkr: number;
  avg_12m_lkr: number;
}

export interface ChartSeriesPoint {
  date: string; // YYYY-MM-DD
  date_label: string;
  prices: Record<string, number | null>;
  pct_change: Record<string, number | null>;
}

export interface TrendsKpisData {
  active_tracking_count: number;
  core_retail_codes: string[];
  all_grades_count: number;
  latest_revision_date: string;
  latest_tariffs: Record<string, LatestTariffEntry>;
  all_time_high: Record<string, AllTimeHighEntry>;
  all_time_low: Record<string, AllTimeLowEntry>;
  summary_stats: {
    revisions_last_12_months: number;
    grades: Record<string, GradeSummaryStats>;
  };
  chart_series: ChartSeriesPoint[];
}

export interface MonthlyAggregatedRow {
  month: string; // YYYY-MM
  label: string; // e.g. "Nov 2026"
  year: number;
  month_num: number;
  prices: Record<string, number | null>;
  simple_avg: Record<string, number | null>;
  mom_pct_change: Record<string, number | null>;
  revisions_in_month: number;
  is_partial_month: boolean;
}

export interface MonthlyAggregatedData {
  generated_at_sl: string;
  generated_at_utc: string;
  latest_revision_date: string;
  total_months: number;
  available_years: number[];
  products: ArchiveProductMeta[];
  months: MonthlyAggregatedRow[];
}

export interface AnnualGradeMetrics {
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  yoy_pct_change: number | null;
}

export interface AnnualAggregatedRow {
  year: number;
  months_covered: number;
  revisions_in_year: number;
  is_ytd: boolean;
  grades: Record<string, AnnualGradeMetrics>;
}

export interface AnnualAggregatedData {
  generated_at_sl: string;
  generated_at_utc: string;
  latest_revision_date: string;
  total_years: number;
  products: ArchiveProductMeta[];
  years: AnnualAggregatedRow[];
}

