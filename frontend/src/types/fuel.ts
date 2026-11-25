export type FuelCategory = "White Oil" | "Black Oil";
export type ChangeDirection = "up" | "down" | "unchanged";
export type RoutePage = "home" | "archive" | "trends" | "analysis";
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
