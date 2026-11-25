"""Monthly and annual fuel price aggregators with end-of-month rollover and time-weighting."""

from __future__ import annotations

import calendar
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from scripts.config import FUEL_PRODUCTS


@dataclass(frozen=True)
class EffectiveRevision:
    """Revision normalized to its effective tariff attribution date."""

    raw_date: date
    effective_date: date
    prices: dict[str, float | None]


def apply_end_of_month_cutoff(d: date) -> date:
    """
    Attribute revisions occurring in the final 2 days of a calendar month
    (e.g. 30th/31st of a 31-day month, 29th/30th of a 30-day month, or
    28th/29th of Feb) to the 1st of the next calendar month.
    """
    days_in_month = calendar.monthrange(d.year, d.month)[1]
    if d.day >= days_in_month - 1:
        if d.month == 12:
            return date(d.year + 1, 1, 1)
        return date(d.year, d.month + 1, 1)
    return d


def _next_month(ym: tuple[int, int]) -> tuple[int, int]:
    y, m = ym
    return (y + 1, 1) if m == 12 else (y, m + 1)


def _pct_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or previous == 0:
        return None
    return round(((current - previous) / previous) * 100.0, 2)


def build_monthly_aggregated_payload(
    revisions: list[Any],  # list[ParsedRevision] chronological oldest -> newest
    *,
    now_sl: datetime,
    now_utc: datetime,
) -> dict[str, Any]:
    """
    Build `data/monthly_aggregated.json`:
    - End-of-month revisions roll over to the 1st of the next month.
    - Multiple prices active within the same calendar month are time-weighted by days held.
    - Zero-revision months carry forward the most recent active prices continuously.
    """
    if not revisions:
        raise ValueError("Cannot build monthly aggregation from empty revisions")

    effective_revs: list[EffectiveRevision] = []
    raw_revisions_by_year: dict[int, int] = defaultdict(int)

    for rev in revisions:
        eff_date = apply_end_of_month_cutoff(rev.parsed_date)
        raw_revisions_by_year[rev.parsed_date.year] += 1
        effective_revs.append(
            EffectiveRevision(
                raw_date=rev.parsed_date,
                effective_date=eff_date,
                prices=rev.prices,
            )
        )

    # Sort chronologically by effective_date (preserving archive order on exact ties)
    indexed_revs = sorted(
        enumerate(effective_revs),
        key=lambda pair: (pair[1].effective_date, pair[0]),
    )
    ordered_revs = [pair[1] for pair in indexed_revs]

    # Count revisions attributed to each (year, month) and group same-month events
    revs_by_ym: dict[tuple[int, int], list[EffectiveRevision]] = defaultdict(list)
    for rev in ordered_revs:
        revs_by_ym[(rev.effective_date.year, rev.effective_date.month)].append(rev)

    # Collapse multiple revisions on the exact same effective_date (later wins on that day)
    daily_regime_by_date: dict[date, dict[str, float | None]] = {}
    for rev in ordered_revs:
        daily_regime_by_date[rev.effective_date] = rev.prices

    first_eff = ordered_revs[0].effective_date
    latest_eff = ordered_revs[-1].effective_date
    current_sl_date = now_sl.date()
    end_ref = max(latest_eff, current_sl_date)

    start_ym = (first_eff.year, first_eff.month)
    end_ym = (end_ref.year, end_ref.month)
    current_ym = (current_sl_date.year, current_sl_date.month)

    chronological_months: list[dict[str, Any]] = []
    active_prices: dict[str, float | None] = {p.code: None for p in FUEL_PRODUCTS}
    prev_month_prices: dict[str, float | None] | None = None

    ym = start_ym
    while ym <= end_ym:
        y, m = ym
        days_in_month = calendar.monthrange(y, m)[1]
        month_start = date(y, m, 1)
        month_end = date(y, m, days_in_month)

        # Effective start for day-weighting (handles partial initial month like mid-month start)
        weight_start = max(month_start, first_eff) if ym == start_ym else month_start

        # Collect regime changes inside [weight_start, month_end]
        in_month_dates = sorted(
            d for d in daily_regime_by_date.keys() if weight_start <= d <= month_end
        )

        # Build intervals [(interval_start, interval_end_inclusive, prices_dict)]
        intervals: list[tuple[date, date, dict[str, float | None]]] = []
        if not in_month_dates:
            intervals.append((weight_start, month_end, active_prices))
        else:
            first_change = in_month_dates[0]
            if first_change > weight_start and any(v is not None for v in active_prices.values()):
                intervals.append((weight_start, first_change - timedelta(days=1), active_prices))

            for idx, change_dt in enumerate(in_month_dates):
                next_dt = (
                    in_month_dates[idx + 1] - timedelta(days=1)
                    if idx + 1 < len(in_month_dates)
                    else month_end
                )
                intervals.append((change_dt, next_dt, daily_regime_by_date[change_dt]))

            # Update active carried-forward price at end of month
            active_prices = dict(daily_regime_by_date[in_month_dates[-1]])

        # Compute time-weighted average and simple average across active regimes in the month
        month_prices: dict[str, float | None] = {}
        simple_avg_prices: dict[str, float | None] = {}
        mom_pct: dict[str, float | None] = {}

        for spec in FUEL_PRODUCTS:
            code = spec.code
            weighted_sum = 0.0
            total_days = 0
            regime_vals: list[float] = []

            for iv_start, iv_end, iv_prices in intervals:
                val = iv_prices.get(code)
                if val is None:
                    continue
                days_held = (iv_end - iv_start).days + 1
                if days_held > 0:
                    weighted_sum += val * days_held
                    total_days += days_held
                    regime_vals.append(val)

            if total_days > 0:
                avg_val = round(weighted_sum / total_days, 2)
                s_avg_val = round(sum(regime_vals) / len(regime_vals), 2)
            else:
                avg_val = None
                s_avg_val = None

            month_prices[code] = avg_val
            simple_avg_prices[code] = s_avg_val
            mom_pct[code] = (
                _pct_change(avg_val, prev_month_prices.get(code))
                if prev_month_prices is not None
                else None
            )

        revs_count = len(revs_by_ym.get(ym, []))
        chronological_months.append(
            {
                "month": f"{y:04d}-{m:02d}",
                "label": month_start.strftime("%b %Y"),
                "year": y,
                "month_num": m,
                "prices": month_prices,
                "simple_avg": simple_avg_prices,
                "mom_pct_change": mom_pct,
                "revisions_in_month": revs_count,
                "is_partial_month": ym == current_ym,
            }
        )

        prev_month_prices = month_prices
        ym = _next_month(ym)

    months_desc = list(reversed(chronological_months))
    available_years = sorted({m["year"] for m in chronological_months}, reverse=True)

    return {
        "generated_at_sl": now_sl.isoformat(),
        "generated_at_utc": now_utc.isoformat(),
        "latest_revision_date": revisions[-1].iso_date,
        "total_months": len(months_desc),
        "available_years": available_years,
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
        "months": months_desc,
        "_raw_revisions_by_year": dict(raw_revisions_by_year),
    }


def build_annual_aggregated_payload(
    monthly_payload: dict[str, Any],
    *,
    now_sl: datetime,
    now_utc: datetime,
) -> dict[str, Any]:
    """Build `data/annual_aggregated.json` from the continuous monthly aggregated series."""
    months_asc = list(reversed(monthly_payload["months"]))
    raw_revs_by_year: dict[int, int] = monthly_payload.get("_raw_revisions_by_year", {})
    current_year = now_sl.year

    by_year: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for m_row in months_asc:
        by_year[m_row["year"]].append(m_row)

    chronological_years: list[dict[str, Any]] = []
    prev_year_avgs: dict[str, float | None] | None = None

    for yr in sorted(by_year.keys()):
        yr_months = by_year[yr]
        grades_out: dict[str, dict[str, float | None]] = {}
        current_year_avgs: dict[str, float | None] = {}

        for spec in FUEL_PRODUCTS:
            code = spec.code
            vals = [
                m["prices"][code]
                for m in yr_months
                if m["prices"].get(code) is not None
            ]
            if vals:
                avg_val = round(sum(vals) / len(vals), 2)
                min_val = round(min(vals), 2)
                max_val = round(max(vals), 2)
            else:
                avg_val = None
                min_val = None
                max_val = None

            current_year_avgs[code] = avg_val
            yoy_pct = (
                _pct_change(avg_val, prev_year_avgs.get(code))
                if prev_year_avgs is not None
                else None
            )
            grades_out[code] = {
                "avg_price": avg_val,
                "min_price": min_val,
                "max_price": max_val,
                "yoy_pct_change": yoy_pct,
            }

        chronological_years.append(
            {
                "year": yr,
                "months_covered": len(yr_months),
                "revisions_in_year": int(raw_revs_by_year.get(yr, 0)),
                "is_ytd": yr == current_year and len(yr_months) < 12,
                "grades": grades_out,
            }
        )
        prev_year_avgs = current_year_avgs

    years_desc = list(reversed(chronological_years))
    return {
        "generated_at_sl": now_sl.isoformat(),
        "generated_at_utc": now_utc.isoformat(),
        "latest_revision_date": monthly_payload["latest_revision_date"],
        "total_years": len(years_desc),
        "products": monthly_payload["products"],
        "years": years_desc,
    }
