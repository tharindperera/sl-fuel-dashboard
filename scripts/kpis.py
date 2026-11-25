"""Dashboard-ready JSON KPI and chart series generator."""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from scripts.config import (
    ARCHIVE_META_JSON,
    CORE_RETAIL_CODES,
    CSV_DATE_COLUMN,
    CURRENT_RATES_JSON,
    FUEL_PRODUCTS,
    PIPELINE_STATUS_JSON,
    SL_TZ,
    TRENDS_KPIS_JSON,
    UTC_TZ,
)
from scripts.fetcher import CurrentRateQuote, parse_csv_date_label
from scripts.reconciler import parse_historical_numeric


@dataclass(frozen=True)
class ParsedRevision:
    """One historical revision parsed into typed date and numeric grade prices."""

    date_label: str
    iso_date: str
    parsed_date: date
    prices: dict[str, float | None]


def _subtract_one_year(d: date) -> date:
    """Return the calendar date one year before `d`, clamping Feb 29 to Feb 28."""
    try:
        return d.replace(year=d.year - 1)
    except ValueError:
        return date(d.year - 1, 2, 28)


def _round_num(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def _pct_delta(current: float, previous: float) -> float:
    if previous == 0:
        return 0.0
    return round(((current - previous) / previous) * 100.0, 2)


def parse_revisions_chronological(rows: list[dict[str, str]]) -> list[ParsedRevision]:
    """Convert descending CSV rows into chronological (oldest -> newest) typed revisions."""
    chronological: list[ParsedRevision] = []
    # CSV is newest-first; reverse so chronological order preserves same-day intraday ordering.
    # Note: In CSV lines 59-60, line 59 is "17.10.2022" (newer) and line 60 is "17.10.2022 (9.00 PM)" (older).
    # Reversing yields line 60 before line 59, matching chronological sequence.
    for row in reversed(rows):
        label = row[CSV_DATE_COLUMN]
        parsed_date = parse_csv_date_label(label)
        prices = {
            spec.code: parse_historical_numeric(
                row[spec.csv_column], context=f"{label}:{spec.csv_column}"
            )
            for spec in FUEL_PRODUCTS
        }
        chronological.append(
            ParsedRevision(
                date_label=label,
                iso_date=parsed_date.isoformat(),
                parsed_date=parsed_date,
                prices=prices,
            )
        )
    return chronological


def _compute_last_changed_dates(
    revisions: list[ParsedRevision],
) -> dict[str, date]:
    """Find the most recent revision date on which each grade's price actually changed."""
    last_changed: dict[str, date] = {}
    prev_val: dict[str, float | None] = {}

    for rev in revisions:
        for spec in FUEL_PRODUCTS:
            val = rev.prices[spec.code]
            if val is None:
                continue
            if spec.code not in prev_val or prev_val[spec.code] is None:
                last_changed[spec.code] = rev.parsed_date
            elif abs(val - prev_val[spec.code]) > 1e-6:
                last_changed[spec.code] = rev.parsed_date
            prev_val[spec.code] = val

    return last_changed


def build_current_rates_payload(
    revisions: list[ParsedRevision],
    now_sl: datetime,
    now_utc: datetime,
    current_quotes: dict[str, CurrentRateQuote] | None = None,
) -> dict[str, Any]:
    """Build payload for `data/current_rates.json`."""
    latest = revisions[-1]
    previous = revisions[-2] if len(revisions) >= 2 else latest
    last_changed = _compute_last_changed_dates(revisions)

    categories: dict[str, list[dict[str, Any]]] = {
        "White Oil": [],
        "Black Oil": [],
    }

    for spec in FUEL_PRODUCTS:
        price = latest.prices[spec.code]
        prev_price = previous.prices[spec.code]
        if price is None:
            raise ValueError(f"Latest revision missing active price for {spec.code}")
        if prev_price is None:
            prev_price = price

        delta_lkr = _round_num(price - prev_price)
        delta_pct = _pct_delta(price, prev_price)
        if delta_lkr > 0:
            direction = "up"
        elif delta_lkr < 0:
            direction = "down"
        else:
            direction = "unchanged"

        eff_date_str = last_changed[spec.code].isoformat()
        eff_time_str = "00:00"
        if current_quotes and spec.code in current_quotes:
            quote = current_quotes[spec.code]
            if abs(quote.price - price) < 1e-6:
                eff_date_str = quote.effective_date.isoformat()
                eff_time_str = quote.effective_time

        categories[spec.category].append(
            {
                "display_order": spec.display_order,
                "code": spec.code,
                "csv_column": spec.csv_column,
                "full_name": spec.full_name,
                "category": spec.category,
                "price_lkr": _round_num(price),
                "unit": "per litre",
                "effective_from_date": eff_date_str,
                "effective_from_time": eff_time_str,
                "previous_price_lkr": _round_num(prev_price),
                "delta_lkr": delta_lkr,
                "delta_pct": delta_pct,
                "change_direction": direction,
            }
        )

    for cat_items in categories.values():
        cat_items.sort(key=lambda item: item["display_order"])

    return {
        "last_checked_sl": now_sl.isoformat(),
        "last_checked_utc": now_utc.isoformat(),
        "latest_revision_date": latest.iso_date,
        "active_period_label": f"Effective from {latest.parsed_date.strftime('%d %b %Y')}",
        "categories": categories,
    }


def build_archive_meta_payload(revisions: list[ParsedRevision]) -> dict[str, Any]:
    """Build payload for `data/archive_meta.json`."""
    first = revisions[0]
    latest = revisions[-1]
    years = sorted({rev.parsed_date.year for rev in revisions}, reverse=True)

    return {
        "first_record_year": first.parsed_date.year,
        "first_record_date": first.iso_date,
        "latest_record_date": latest.iso_date,
        "total_records": len(revisions),
        "available_years": years,
        "products": [
            {
                "code": spec.code,
                "csv_column": spec.csv_column,
                "full_name": spec.full_name,
                "category": spec.category,
                "segment": spec.segment,
            }
            for spec in FUEL_PRODUCTS
        ],
    }


def _find_baseline_revision(
    revisions: list[ParsedRevision],
    code: str,
    cutoff_date: date,
    inclusive: bool,
) -> ParsedRevision | None:
    """Find the latest revision on/before (or strictly before) `cutoff_date` with non-null price."""
    candidates = [
        rev
        for rev in revisions
        if rev.prices[code] is not None
        and (rev.parsed_date <= cutoff_date if inclusive else rev.parsed_date < cutoff_date)
    ]
    if candidates:
        return candidates[-1]
    # Fallback to earliest available revision with a price for this grade.
    for rev in revisions:
        if rev.prices[code] is not None:
            return rev
    return None


def build_trends_kpis_payload(revisions: list[ParsedRevision]) -> dict[str, Any]:
    """Build payload for `data/trends_kpis.json`."""
    latest = revisions[-1]
    previous = revisions[-2] if len(revisions) >= 2 else latest
    last_changed = _compute_last_changed_dates(revisions)

    one_year_ago = _subtract_one_year(latest.parsed_date)
    year_start = date(latest.parsed_date.year, 1, 1)
    revisions_12m = [rev for rev in revisions if rev.parsed_date >= one_year_ago]

    latest_tariffs: dict[str, dict[str, Any]] = {}
    all_time_high: dict[str, dict[str, Any]] = {}
    all_time_low: dict[str, dict[str, Any]] = {}
    summary_grades: dict[str, dict[str, Any]] = {}

    for spec in FUEL_PRODUCTS:
        code = spec.code
        curr_price = latest.prices[code]
        prev_price = previous.prices[code]
        if curr_price is None:
            raise ValueError(f"Latest revision missing price for {code}")
        if prev_price is None:
            prev_price = curr_price

        delta_lkr = _round_num(curr_price - prev_price)
        delta_pct = _pct_delta(curr_price, prev_price)
        if delta_lkr > 0:
            status = "increased"
        elif delta_lkr < 0:
            status = "decreased"
        else:
            status = "no_change"

        changed_date = last_changed[code]
        days_since = (latest.parsed_date - changed_date).days

        latest_tariffs[code] = {
            "code": code,
            "full_name": spec.full_name,
            "category": spec.category,
            "is_core_retail": spec.is_core_retail,
            "price_lkr": _round_num(curr_price),
            "previous_price_lkr": _round_num(prev_price),
            "delta_lkr": delta_lkr,
            "delta_pct": delta_pct,
            "status": status,
            "last_changed_date": changed_date.isoformat(),
            "days_since_last_change": days_since,
        }

        # All-time high & low (excluding historical pre-2015 empty cells).
        valid_points = [
            (rev.iso_date, rev.prices[code])
            for rev in revisions
            if rev.prices[code] is not None
        ]
        max_price = max(val for _, val in valid_points)
        min_price = min(val for _, val in valid_points)
        high_dates = sorted({d for d, val in valid_points if abs(val - max_price) < 1e-6})
        low_dates = sorted({d for d, val in valid_points if abs(val - min_price) < 1e-6})

        all_time_high[code] = {
            "price_lkr": _round_num(max_price),
            "dates": high_dates,
            "latest_date": high_dates[-1],
        }
        all_time_low[code] = {
            "price_lkr": _round_num(min_price),
            "date": low_dates[0],
            "dates": low_dates,
        }

        # Summary stats: YTD, YoY, 12m change count, 12m min/max/avg.
        ytd_base_rev = _find_baseline_revision(revisions, code, year_start, inclusive=False)
        yoy_base_rev = _find_baseline_revision(revisions, code, one_year_ago, inclusive=True)
        assert ytd_base_rev is not None and ytd_base_rev.prices[code] is not None
        assert yoy_base_rev is not None and yoy_base_rev.prices[code] is not None

        ytd_base_price = ytd_base_rev.prices[code]
        yoy_base_price = yoy_base_rev.prices[code]

        # Count price changes in last 12 months by comparing each 12m revision to its immediate predecessor.
        changes_12m = 0
        for idx, rev in enumerate(revisions):
            if rev.parsed_date < one_year_ago:
                continue
            val = rev.prices[code]
            if val is None:
                continue
            if idx == 0:
                continue
            prior_val = revisions[idx - 1].prices[code]
            if prior_val is not None and abs(val - prior_val) > 1e-6:
                changes_12m += 1

        vals_12m = [
            rev.prices[code]
            for rev in revisions_12m
            if rev.prices[code] is not None
        ]
        if not vals_12m:
            vals_12m = [curr_price]

        summary_grades[code] = {
            "price_changes_last_12_months": changes_12m,
            "ytd_change_lkr": _round_num(curr_price - ytd_base_price),
            "ytd_change_pct": _pct_delta(curr_price, ytd_base_price),
            "ytd_baseline_date": ytd_base_rev.iso_date,
            "ytd_baseline_price_lkr": _round_num(ytd_base_price),
            "yoy_change_lkr": _round_num(curr_price - yoy_base_price),
            "yoy_change_pct": _pct_delta(curr_price, yoy_base_price),
            "yoy_baseline_date": yoy_base_rev.iso_date,
            "yoy_baseline_price_lkr": _round_num(yoy_base_price),
            "min_12m_lkr": _round_num(min(vals_12m)),
            "max_12m_lkr": _round_num(max(vals_12m)),
            "avg_12m_lkr": _round_num(sum(vals_12m) / len(vals_12m)),
        }

    # Normalized chronological chart series with raw LKR values and revision-over-revision % changes.
    chart_series: list[dict[str, Any]] = []
    for idx, rev in enumerate(revisions):
        prices_out: dict[str, float | None] = {}
        pct_out: dict[str, float | None] = {}
        for spec in FUEL_PRODUCTS:
            code = spec.code
            val = rev.prices[code]
            prices_out[code] = _round_num(val) if val is not None else None
            if idx == 0 or val is None:
                pct_out[code] = None
            else:
                prev_val = revisions[idx - 1].prices[code]
                pct_out[code] = _pct_delta(val, prev_val) if prev_val is not None else None

        chart_series.append(
            {
                "date": rev.iso_date,
                "date_label": rev.date_label,
                "prices": prices_out,
                "pct_change": pct_out,
            }
        )

    return {
        "active_tracking_count": len(CORE_RETAIL_CODES),
        "core_retail_codes": list(CORE_RETAIL_CODES),
        "all_grades_count": len(FUEL_PRODUCTS),
        "latest_revision_date": latest.iso_date,
        "latest_tariffs": latest_tariffs,
        "all_time_high": all_time_high,
        "all_time_low": all_time_low,
        "summary_stats": {
            "revisions_last_12_months": len(revisions_12m),
            "grades": summary_grades,
        },
        "chart_series": chart_series,
    }


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    """Atomically write formatted JSON to `path`."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=".json_tmp_", suffix=".json", dir=str(path.parent))
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(tmp_path, path)
    except Exception:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise


def generate_all_kpis(
    rows: list[dict[str, str]],
    data_dir: Path | None = None,
    current_quotes: dict[str, CurrentRateQuote] | None = None,
    now_sl: datetime | None = None,
    now_utc: datetime | None = None,
    write_files: bool = True,
) -> dict[str, dict[str, Any]]:
    """Compute (and optionally write) current_rates, archive_meta, and trends_kpis JSON files."""
    sl_now = now_sl or datetime.now(SL_TZ)
    utc_now = now_utc or sl_now.astimezone(UTC_TZ)
    revisions = parse_revisions_chronological(rows)

    current_rates = build_current_rates_payload(
        revisions, now_sl=sl_now, now_utc=utc_now, current_quotes=current_quotes
    )
    archive_meta = build_archive_meta_payload(revisions)
    trends_kpis = build_trends_kpis_payload(revisions)

    if write_files:
        target_dir = data_dir or CURRENT_RATES_JSON.parent
        write_json_atomic(target_dir / CURRENT_RATES_JSON.name, current_rates)
        write_json_atomic(target_dir / ARCHIVE_META_JSON.name, archive_meta)
        write_json_atomic(target_dir / TRENDS_KPIS_JSON.name, trends_kpis)

    return {
        "current_rates": current_rates,
        "archive_meta": archive_meta,
        "trends_kpis": trends_kpis,
    }


def build_pipeline_status_payload(
    *,
    now_sl: datetime,
    now_utc: datetime,
    mode: str,
    fuel_api_status: dict[str, Any],
    historical_api_status: dict[str, Any],
    update_applied: bool,
    new_revisions_added: list[str],
    total_csv_rows: int,
    latest_revision_date: str,
    warnings: list[str],
) -> dict[str, Any]:
    """Build payload for `data/pipeline_status.json`."""
    return {
        "last_run_sl": now_sl.isoformat(),
        "last_run_utc": now_utc.isoformat(),
        "mode": mode,
        "sources": {
            "fuel_prices_api": fuel_api_status,
            "historical_prices_api": historical_api_status,
        },
        "update_applied": update_applied,
        "new_revisions_added": new_revisions_added,
        "total_csv_rows": total_csv_rows,
        "latest_revision_date": latest_revision_date,
        "warnings": warnings,
    }


def write_pipeline_status(
    payload: dict[str, Any],
    path: Path = PIPELINE_STATUS_JSON,
) -> None:
    """Persist `pipeline_status.json` atomically."""
    write_json_atomic(path, payload)
