export interface OilExtremum {
  value: number;
  date: string;
}

export interface OilTrendOutlook {
  projected_price: number;
  ema_20: number;
  ema_50: number;
  signal: "bullish" | "bearish";
  label: string;
  badge: string;
  subtitle: string;
  methodology: string;
  reference_current: number;
}

export interface CommodityComparisonRow {
  id: "wti" | "brent" | "natgas" | "gasoline" | "heating_oil";
  name: string;
  symbol: string;
  fred_series_id: string;
  unit: string;
  decimals: number;
  is_primary: boolean;
  price: number;
  previous_close: number;
  change: number;
  day_pct: number;
  month_pct: number;
  year_pct: number;
  all_time_high: OilExtremum;
  all_time_low: OilExtremum;
  first_date: string;
  latest_date: string;
  historical_range: string;
  updated_label: string;
}

export interface GlobalOilKpisData {
  actual_price: number;
  previous_close: number;
  daily_change: number;
  daily_change_pct: number;
  monthly_change_pct: number;
  yearly_change_pct: number;
  all_time_high: OilExtremum;
  all_time_low: OilExtremum;
  historical_range: string;
  latest_observation_date: string;
  unit: string;
  frequency: string;
  benchmark_label: string;
  source_attribution: string;
  last_updated_utc: string;
  last_updated_sl: string;
  index_sync_label: string;
  trend_outlook: OilTrendOutlook;
  comparison_table: CommodityComparisonRow[];
}

export interface OilHistoryPoint {
  time: string; // YYYY-MM-DD
  value: number;
}

export interface CommodityHistoryData {
  primary_id: string;
  last_updated_utc: string;
  source_attribution: string;
  series: Record<string, OilHistoryPoint[]>;
}

export interface BrentIntradayData {
  enabled: boolean;
  symbol: string;
  source: string | null;
  last_updated_utc: string;
  points: { time: number; value: number }[];
}

export interface OilAiSummaryData {
  alert_level: "normal" | "surge" | "drop";
  daily_change_pct: number;
  change_5d_pct: number;
  z_score_30d: number;
  latest_price: number;
  latest_date: string;
  headline: string;
  paragraphs: string[];
  driver_tags: string[];
  sources: { title: string; url: string }[];
  generation_mode: "gemini" | "deterministic";
  generated_at_utc: string;
  generated_at_sl: string;
}
