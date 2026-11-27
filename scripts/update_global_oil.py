"""Fetch global energy benchmarks from public FRED/EIA endpoints and build dashboard JSONs."""

from __future__ import annotations

import argparse
import csv
import io
import json
import logging
import math
import os
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Sequence
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import requests

from scripts.oil_config import (
    BACKOFF_BASE_SECONDS,
    BRENT_HISTORY_JSON,
    BRENT_INTRADAY_JSON,
    COMMODITIES,
    COMMODITIES_BY_ID,
    DATA_DIR,
    EIA_SPOT_API_URL,
    FRED_CSV_BASE_URL,
    GLOBAL_OIL_KPIS_JSON,
    MARKET_USER_AGENT,
    MAX_RETRIES,
    OILPRICE_DEMO_URL,
    OILPRICE_LATEST_URL,
    PROVISIONAL_RATIO_MAX,
    PROVISIONAL_RATIO_MIN,
    REQUEST_TIMEOUT_SECONDS,
    SL_TZ,
    USER_AGENT,
    UTC_TZ,
    YAHOO_CHART_HOSTS,
    YAHOO_CHART_URL_TEMPLATE,
    CommoditySpec,
)

logger = logging.getLogger("global_oil_pipeline")


class OilFetchError(RuntimeError):
    """Raised when a required global commodity series cannot be retrieved or parsed."""


@dataclass(frozen=True)
class PricePoint:
    """One chronological daily observation."""

    time: str  # YYYY-MM-DD
    value: float


def _write_json_atomic(path: Path, payload: dict[str, Any], *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=".oil_tmp_", suffix=".json", dir=str(path.parent))
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            if compact:
                json.dump(payload, handle, separators=(",", ":"), ensure_ascii=False)
            else:
                json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(tmp_path, path)
    except Exception:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise


def _request_with_retries(
    session: requests.Session,
    url: str,
    *,
    timeout: int = REQUEST_TIMEOUT_SECONDS,
    max_retries: int = MAX_RETRIES,
) -> requests.Response:
    last_exc: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = session.get(
                url,
                timeout=timeout,
                headers={"User-Agent": USER_AGENT},
            )
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            last_exc = exc
            logger.warning("Attempt %d/%d failed for %s: %s", attempt, max_retries, url, exc)
            if attempt < max_retries:
                time.sleep(BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)))
    raise OilFetchError(f"Failed fetching {url} after {max_retries} attempts: {last_exc}")


def parse_fred_csv(csv_text: str, series_id: str) -> list[PricePoint]:
    """Parse a FRED `observation_date,VALUE` CSV string, skipping holiday `.` rows."""
    text = (csv_text or "").strip()
    if not text:
        raise OilFetchError(f"Empty CSV payload for {series_id}")

    reader = csv.reader(io.StringIO(text))
    try:
        header = next(reader)
    except StopIteration as exc:
        raise OilFetchError(f"Missing CSV header for {series_id}") from exc

    if len(header) < 2:
        raise OilFetchError(f"Unexpected CSV header for {series_id}: {header!r}")

    points: list[PricePoint] = []
    for row in reader:
        if len(row) < 2:
            continue
        obs_date = row[0].strip()
        raw_val = row[1].strip()
        if not obs_date or raw_val in ("", "."):
            continue
        try:
            datetime.strptime(obs_date, "%Y-%m-%d")
            val = float(raw_val)
        except ValueError:
            continue
        # Reject NaN/Inf or negative quotes on spot benchmarks (except WTI Apr 2020 futures; spot stays >0)
        if not (val == val) or val <= 0:
            continue
        points.append(PricePoint(time=obs_date, value=val))

    if len(points) < 2:
        raise OilFetchError(f"Insufficient valid points parsed for {series_id}: {len(points)}")

    points.sort(key=lambda p: p.time)
    return points


def _merge_eia_supplement(
    points: list[PricePoint],
    spec: CommoditySpec,
    session: requests.Session,
    eia_api_key: str | None,
) -> list[PricePoint]:
    """Optionally merge newer daily observations from the official U.S. EIA API v2."""
    if not eia_api_key or not spec.eia_series_id:
        return points

    url = EIA_SPOT_API_URL.format(api_key=eia_api_key, eia_series=spec.eia_series_id)
    try:
        resp = _request_with_retries(session, url, timeout=20, max_retries=2)
        rows = resp.json().get("response", {}).get("data", [])
        by_date = {p.time: p.value for p in points}
        added = 0
        for item in rows:
            period = str(item.get("period") or "").strip()
            raw_v = item.get("value")
            if not period or raw_v is None:
                continue
            val = float(raw_v)
            if val > 0 and period not in by_date:
                by_date[period] = val
                added += 1
        if added:
            logger.info("Merged %d newer EIA points for %s", added, spec.id)
        return [PricePoint(time=t, value=by_date[t]) for t in sorted(by_date.keys())]
    except Exception as exc:
        logger.warning("Optional EIA supplement skipped for %s: %s", spec.id, exc)
        return points


def _safe_zoneinfo(name: str | None) -> Any:
    """Resolve an IANA timezone name with UTC fallback."""
    if not name:
        return UTC_TZ
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return UTC_TZ


def parse_yahoo_chart_payload(
    payload: dict[str, Any],
    *,
    decimals: int = 3,
) -> list[PricePoint]:
    """
    Parse daily closing bars and the active session quote from a Yahoo Finance
    v8 chart payload, mapping timestamps cleanly to YYYY-MM-DD trading dates.
    """
    results = (payload.get("chart") or {}).get("result") or []
    if not isinstance(results, list) or not results:
        return []

    node = results[0] or {}
    meta = node.get("meta") or {}
    currency = meta.get("currency")
    if currency and str(currency).strip().upper() != "USD":
        return []

    bar_tz = _safe_zoneinfo(meta.get("exchangeTimezoneName"))
    timestamps = node.get("timestamp") or []
    quotes = ((node.get("indicators") or {}).get("quote") or [{}])[0] or {}
    closes = quotes.get("close") or []

    by_date: dict[str, float] = {}
    for ts, raw_close in zip(timestamps, closes):
        if ts is None or raw_close is None:
            continue
        try:
            ts_int = int(ts)
            val = float(raw_close)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(val) or val <= 0:
            continue
        obs_date = datetime.fromtimestamp(ts_int, tz=bar_tz).date().isoformat()
        by_date[obs_date] = round(val, decimals)

    # Also capture latest live quote in UTC so Asian/London daytime trading updates
    # reflect the current date ahead of New York market close without bleeding into Sat.
    live_price = meta.get("regularMarketPrice")
    live_ts = meta.get("regularMarketTime")
    if live_price is not None and live_ts is not None:
        try:
            val = float(live_price)
            ts_int = int(live_ts)
            if math.isfinite(val) and val > 0:
                live_date = datetime.fromtimestamp(ts_int, tz=UTC_TZ).date().isoformat()
                if not by_date or live_date >= max(by_date.keys()):
                    by_date[live_date] = round(val, decimals)
        except (TypeError, ValueError):
            pass

    return [PricePoint(time=t, value=by_date[t]) for t in sorted(by_date.keys())]


def parse_oilprice_payload(
    payload: dict[str, Any],
    target_code: str,
    *,
    decimals: int = 3,
) -> PricePoint | None:
    """Parse a matching USD commodity quote from OilPriceAPI demo or latest JSON."""
    data = payload.get("data")
    if isinstance(data, dict) and isinstance(data.get("prices"), list):
        candidates = data["prices"]
    elif isinstance(data, dict):
        candidates = [data]
    else:
        return None

    target_upper = target_code.strip().upper()
    for item in candidates:
        if not isinstance(item, dict):
            continue
        if str(item.get("code") or "").strip().upper() != target_upper:
            continue
        currency = item.get("currency")
        if currency and str(currency).strip().upper() != "USD":
            continue
        raw_price = item.get("price")
        raw_dt = str(item.get("updated_at") or item.get("created_at") or "").strip()
        if raw_price is None or len(raw_dt) < 10:
            continue
        date_str = raw_dt[:10]
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
            val = float(raw_price)
        except ValueError:
            continue
        if math.isfinite(val) and val > 0:
            return PricePoint(time=date_str, value=round(val, decimals))
    return None


def merge_provisional_points(
    official_points: list[PricePoint],
    market_points: list[PricePoint],
    *,
    decimals: int,
) -> list[PricePoint]:
    """
    Append interim market quotes ONLY for dates strictly newer than the latest
    authoritative FRED/EIA date. Whenever FRED/EIA catches up, any date <=
    official_latest_date is automatically superseded by the official series.
    """
    if not official_points:
        raise ValueError("official_points must contain at least one observation")

    official_latest = official_points[-1].time
    ref_price = official_points[-1].value
    min_ok = ref_price * PROVISIONAL_RATIO_MIN
    max_ok = ref_price * PROVISIONAL_RATIO_MAX

    supplements: dict[str, float] = {}
    for pt in market_points:
        if pt.time <= official_latest:
            continue
        if not math.isfinite(pt.value) or not (min_ok <= pt.value <= max_ok):
            logger.warning(
                "Skipping out-of-range interim quote %s=%.4f vs official %.4f",
                pt.time,
                pt.value,
                ref_price,
            )
            continue
        supplements[pt.time] = round(pt.value, decimals)

    if not supplements:
        return list(official_points)

    merged = list(official_points)
    for dt_str in sorted(supplements.keys()):
        merged.append(PricePoint(time=dt_str, value=supplements[dt_str]))
    return merged


def _fetch_yahoo_market_points(session: requests.Session, spec: CommoditySpec) -> list[PricePoint]:
    """Fetch 1M daily + live market quotes from Yahoo Chart v8 with host fallback."""
    if not spec.yahoo_symbol:
        return []
    for host in YAHOO_CHART_HOSTS:
        url = YAHOO_CHART_URL_TEMPLATE.format(host=host, symbol=spec.yahoo_symbol)
        try:
            resp = session.get(
                url,
                timeout=12,
                headers={
                    "User-Agent": MARKET_USER_AGENT,
                    "Accept": "application/json",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
            resp.raise_for_status()
            pts = parse_yahoo_chart_payload(resp.json(), decimals=spec.decimals)
            if pts:
                return pts
        except Exception as exc:
            logger.warning("Yahoo chart host %s skipped for %s: %s", host, spec.id, exc)
            time.sleep(0.35)
    return []


def load_existing_series_points(history_path: Path) -> dict[str, list[PricePoint]]:
    """Load previously synced series points from disk so prior interim days persist across runs."""
    if not history_path.exists():
        return {}
    try:
        raw = json.loads(history_path.read_text(encoding="utf-8"))
        raw_series = raw.get("series") or {}
        if not isinstance(raw_series, dict):
            return {}
        loaded: dict[str, list[PricePoint]] = {}
        for cid, items in raw_series.items():
            if not isinstance(items, list):
                continue
            pts: list[PricePoint] = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                t = str(item.get("time") or "").strip()
                v = item.get("value")
                if not t or v is None:
                    continue
                try:
                    val = float(v)
                except (TypeError, ValueError):
                    continue
                if math.isfinite(val) and val > 0:
                    pts.append(PricePoint(time=t, value=val))
            if pts:
                loaded[cid] = pts
        return loaded
    except Exception as exc:
        logger.warning("Unable to read existing %s for interim carry-forward: %s", history_path.name, exc)
        return {}


def _fetch_oilprice_fallback(
    session: requests.Session,
    spec: CommoditySpec,
    demo_payload_cache: dict[str, Any] | None,
) -> tuple[PricePoint | None, dict[str, Any] | None]:
    """Fetch fallback quote from OilPriceAPI (keyed if set, else 1-call cached demo)."""
    if not spec.oilprice_code:
        return None, demo_payload_cache

    api_key = os.environ.get("OILPRICEAPI_KEY", "").strip()
    if api_key:
        try:
            url = OILPRICE_LATEST_URL.format(code=spec.oilprice_code)
            resp = session.get(
                url,
                timeout=12,
                headers={
                    "User-Agent": USER_AGENT,
                    "Authorization": f"Token {api_key}",
                },
            )
            resp.raise_for_status()
            return parse_oilprice_payload(
                resp.json(), spec.oilprice_code, decimals=spec.decimals
            ), demo_payload_cache
        except Exception as exc:
            logger.warning("OilPriceAPI keyed fetch skipped for %s: %s", spec.id, exc)
            return None, demo_payload_cache

    if demo_payload_cache is None:
        try:
            resp = session.get(OILPRICE_DEMO_URL, timeout=12, headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
            demo_payload_cache = resp.json()
        except Exception as exc:
            logger.warning("OilPriceAPI demo fallback skipped: %s", exc)
            return None, {}

    if not demo_payload_cache:
        return None, demo_payload_cache

    return parse_oilprice_payload(
        demo_payload_cache, spec.oilprice_code, decimals=spec.decimals
    ), demo_payload_cache


def _compute_ema(values: list[float], span: int) -> float:
    """Compute exponential moving average for the tail of a chronological series."""
    alpha = 2.0 / (span + 1.0)
    ema = values[0]
    for v in values[1:]:
        ema = alpha * v + (1.0 - alpha) * ema
    return ema


def compute_trend_outlook(points: list[PricePoint], decimals: int = 2) -> dict[str, Any]:
    """
    Compute a transparent EMA(20/50) statistical trend outlook estimate.
    Not a third-party forecast—purely a documented quantitative trend signal.
    """
    tail = [p.value for p in points[-120:]]
    latest = tail[-1]
    ema20 = _compute_ema(tail, 20)
    ema50 = _compute_ema(tail, 50)
    # 5-day momentum slope blended with EMA20/EMA50 spread
    slope_5d = (tail[-1] - tail[max(0, len(tail) - 6)]) / max(1, min(5, len(tail) - 1))
    projected = max(1.0, ema20 + (ema20 - ema50) * 0.35 + slope_5d * 0.5)

    return {
        "projected_price": round(projected, decimals),
        "ema_20": round(ema20, decimals),
        "ema_50": round(ema50, decimals),
        "signal": "bullish" if ema20 >= ema50 else "bearish",
        "label": "TREND OUTLOOK",
        "badge": "MODEL ESTIMATE",
        "subtitle": "EMA(20/50) Statistical Estimate",
        "methodology": (
            "Quantitative estimate derived from 20-day vs 50-day Exponential Moving Averages "
            "and 5-day price slope over U.S. EIA/FRED historical spot series."
        ),
        "reference_current": round(latest, decimals),
    }


def _find_point_on_or_before(points: list[PricePoint], target_date: date) -> PricePoint:
    target_str = target_date.isoformat()
    candidate = points[0]
    for pt in points:
        if pt.time <= target_str:
            candidate = pt
        else:
            break
    return candidate


def _pct_change(current: float, base: float) -> float:
    if base == 0:
        return 0.0
    return round(((current - base) / base) * 100.0, 2)


def compute_commodity_metrics(
    spec: CommoditySpec,
    points: list[PricePoint],
    updated_label: str,
    *,
    official_latest_date: str | None = None,
    provisional_source: str | None = None,
) -> dict[str, Any]:
    """Compute KPI metrics and comparison row fields for a single commodity."""
    latest = points[-1]
    previous = points[-2]
    latest_dt = datetime.strptime(latest.time, "%Y-%m-%d").date()

    month_base = _find_point_on_or_before(points, latest_dt - timedelta(days=30))
    year_base = _find_point_on_or_before(points, latest_dt - timedelta(days=365))

    ath = max(points, key=lambda p: p.value)
    atl = min(points, key=lambda p: p.value)

    daily_change = round(latest.value - previous.value, spec.decimals)
    daily_pct = _pct_change(latest.value, previous.value)
    month_pct = _pct_change(latest.value, month_base.value)
    year_pct = _pct_change(latest.value, year_base.value)

    resolved_official = official_latest_date or latest.time
    is_provisional = latest.time > resolved_official

    return {
        "id": spec.id,
        "name": spec.name,
        "symbol": spec.symbol,
        "fred_series_id": spec.fred_series_id,
        "unit": spec.unit,
        "decimals": spec.decimals,
        "is_primary": spec.is_primary,
        "price": round(latest.value, spec.decimals),
        "previous_close": round(previous.value, spec.decimals),
        "change": daily_change,
        "day_pct": daily_pct,
        "month_pct": month_pct,
        "year_pct": year_pct,
        "all_time_high": {
            "value": round(ath.value, spec.decimals),
            "date": ath.time,
        },
        "all_time_low": {
            "value": round(atl.value, spec.decimals),
            "date": atl.time,
        },
        "first_date": points[0].time,
        "latest_date": latest.time,
        "official_latest_date": resolved_official,
        "is_provisional": is_provisional,
        "provisional_source": provisional_source if is_provisional else None,
        "historical_range": f"{points[0].time[:4]} - {latest.time[:4]}",
        "updated_label": updated_label,
    }


def fetch_optional_intraday(
    session: requests.Session,
    now_utc: datetime,
) -> dict[str, Any]:
    """
    Optional intraday quote adapter (Twelve Data). When TWELVEDATA_API_KEY is not
    configured, returns a clean empty payload so 1D stays gracefully disabled.
    """
    api_key = os.environ.get("TWELVEDATA_API_KEY", "").strip()
    if not api_key:
        return {
            "enabled": False,
            "symbol": "BRENT",
            "source": None,
            "last_updated_utc": now_utc.isoformat(),
            "points": [],
        }

    try:
        url = (
            "https://api.twelvedata.com/time_series"
            f"?symbol=BZ/USD&interval=1h&outputsize=24&apikey={api_key}"
        )
        resp = _request_with_retries(session, url, timeout=15, max_retries=2)
        values = resp.json().get("values") or []
        intraday_pts = []
        for item in reversed(values):
            dt_str = str(item.get("datetime") or "").strip()
            close_val = item.get("close")
            if not dt_str or close_val is None:
                continue
            ts = int(datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=UTC_TZ).timestamp())
            intraday_pts.append({"time": ts, "value": round(float(close_val), 3)})
        return {
            "enabled": len(intraday_pts) > 1,
            "symbol": "BRENT",
            "source": "Twelve Data",
            "last_updated_utc": now_utc.isoformat(),
            "points": intraday_pts,
        }
    except Exception as exc:
        logger.warning("Optional intraday fetch skipped: %s", exc)
        return {
            "enabled": False,
            "symbol": "BRENT",
            "source": None,
            "last_updated_utc": now_utc.isoformat(),
            "points": [],
        }


def build_global_oil_outputs(
    series_map: dict[str, list[PricePoint]],
    *,
    now_utc: datetime | None = None,
    official_latest_dates: dict[str, str] | None = None,
    provisional_sources: dict[str, str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build `global_oil_kpis.json` and `brent_history.json` payloads from parsed series."""
    utc_now = now_utc or datetime.now(UTC_TZ)
    sl_now = utc_now.astimezone(SL_TZ)
    updated_hhmm = utc_now.strftime("%H:%M")

    brent_spec = COMMODITIES_BY_ID["brent"]
    brent_points = series_map["brent"]
    brent_official_date = (official_latest_dates or {}).get("brent")
    brent_prov_source = (provisional_sources or {}).get("brent")
    brent_metrics = compute_commodity_metrics(
        brent_spec,
        brent_points,
        updated_hhmm,
        official_latest_date=brent_official_date,
        provisional_source=brent_prov_source,
    )
    trend_outlook = compute_trend_outlook(brent_points, decimals=brent_spec.decimals)

    comparison_table = [
        compute_commodity_metrics(
            spec,
            series_map[spec.id],
            updated_hhmm,
            official_latest_date=(official_latest_dates or {}).get(spec.id),
            provisional_source=(provisional_sources or {}).get(spec.id),
        )
        for spec in COMMODITIES
    ]

    active_sources = [
        row["provisional_source"]
        for row in comparison_table
        if row.get("is_provisional") and row.get("provisional_source")
    ]
    resolved_official_dates = {
        spec.id: (official_latest_dates or {}).get(spec.id, series_map[spec.id][-1].time)
        for spec in COMMODITIES
    }

    kpis_payload = {
        "actual_price": brent_metrics["price"],
        "previous_close": brent_metrics["previous_close"],
        "daily_change": brent_metrics["change"],
        "daily_change_pct": brent_metrics["day_pct"],
        "monthly_change_pct": brent_metrics["month_pct"],
        "yearly_change_pct": brent_metrics["year_pct"],
        "all_time_high": brent_metrics["all_time_high"],
        "all_time_low": brent_metrics["all_time_low"],
        "historical_range": brent_metrics["historical_range"],
        "latest_observation_date": brent_metrics["latest_date"],
        "official_latest_date": brent_metrics["official_latest_date"],
        "has_provisional_data": bool(active_sources),
        "provisional_source": active_sources[0] if active_sources else None,
        "unit": brent_spec.unit,
        "frequency": "DAILY",
        "benchmark_label": "ICE BRENT / EIA SPOT",
        "source_attribution": "U.S. Energy Information Administration (EIA) via FRED, Federal Reserve Bank of St. Louis",
        "last_updated_utc": utc_now.isoformat(),
        "last_updated_sl": sl_now.isoformat(),
        "index_sync_label": f"INDEX SYNC: {utc_now.strftime('%d %b %Y %H:%M').upper()} UTC",
        "trend_outlook": trend_outlook,
        "comparison_table": comparison_table,
    }

    history_payload = {
        "primary_id": "brent",
        "last_updated_utc": utc_now.isoformat(),
        "source_attribution": kpis_payload["source_attribution"],
        "official_latest_dates": resolved_official_dates,
        "series": {
            spec.id: [{"time": pt.time, "value": pt.value} for pt in series_map[spec.id]]
            for spec in COMMODITIES
        },
    }

    return kpis_payload, history_payload


def run_update(*, dry_run: bool = False, data_dir: Path = DATA_DIR) -> int:
    now_utc = datetime.now(UTC_TZ)
    eia_api_key = os.environ.get("EIA_API_KEY", "").strip() or None
    existing_series = load_existing_series_points(data_dir / BRENT_HISTORY_JSON.name)
    series_map: dict[str, list[PricePoint]] = {}
    official_latest_dates: dict[str, str] = {}
    provisional_sources: dict[str, str] = {}
    oilprice_demo_cache: dict[str, Any] | None = None

    with requests.Session() as session:
        for spec in COMMODITIES:
            url = FRED_CSV_BASE_URL.format(series_id=spec.fred_series_id)
            logger.info("Fetching %s (%s)...", spec.name, spec.fred_series_id)
            resp = _request_with_retries(session, url)
            official_points = parse_fred_csv(resp.text, spec.fred_series_id)
            official_points = _merge_eia_supplement(official_points, spec, session, eia_api_key)
            official_latest = official_points[-1].time
            official_latest_dates[spec.id] = official_latest

            # Preserve previously-synced interim dates (> official_latest) so single-day
            # fallback feeds retain multi-day continuity until official FRED/EIA catches up.
            prior_provisional = [
                pt for pt in existing_series.get(spec.id, []) if pt.time > official_latest
            ]

            yahoo_points = _fetch_yahoo_market_points(session, spec)
            has_fresh_yahoo = any(pt.time > official_latest for pt in yahoo_points)
            candidate_points = prior_provisional + yahoo_points
            source_label: str | None = (
                "Market Futures (ICE/NYMEX via Yahoo Finance)" if has_fresh_yahoo else None
            )

            if not has_fresh_yahoo and spec.oilprice_code:
                fallback_pt, oilprice_demo_cache = _fetch_oilprice_fallback(
                    session, spec, oilprice_demo_cache
                )
                if fallback_pt and fallback_pt.time > official_latest:
                    candidate_points.append(fallback_pt)
                    source_label = "OilPriceAPI Spot Feed"

            merged_points = merge_provisional_points(
                official_points, candidate_points, decimals=spec.decimals
            )
            if merged_points[-1].time > official_latest:
                provisional_sources[spec.id] = source_label or "Cached Interim Market Feed"

            series_map[spec.id] = merged_points
            logger.info(
                "Loaded %d observations for %s (official=%s, latest=%s, val=%.3f%s)",
                len(merged_points),
                spec.id,
                official_latest,
                merged_points[-1].time,
                merged_points[-1].value,
                f", provisional via {provisional_sources[spec.id]}"
                if spec.id in provisional_sources
                else "",
            )

        intraday_payload = fetch_optional_intraday(session, now_utc)

    kpis_payload, history_payload = build_global_oil_outputs(
        series_map,
        now_utc=now_utc,
        official_latest_dates=official_latest_dates,
        provisional_sources=provisional_sources,
    )

    if dry_run:
        logger.info(
            "[DRY RUN] Validated Brent %.2f (%+.2f%% 1D, %+.2f%% 1M, %+.2f%% 1Y). No files written.",
            kpis_payload["actual_price"],
            kpis_payload["daily_change_pct"],
            kpis_payload["monthly_change_pct"],
            kpis_payload["yearly_change_pct"],
        )
        return 0

    _write_json_atomic(data_dir / GLOBAL_OIL_KPIS_JSON.name, kpis_payload, compact=False)
    _write_json_atomic(data_dir / BRENT_HISTORY_JSON.name, history_payload, compact=True)
    _write_json_atomic(data_dir / BRENT_INTRADAY_JSON.name, intraday_payload, compact=False)
    logger.info("Wrote global_oil_kpis.json, brent_history.json, and brent_intraday.json to %s", data_dir)
    return 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch global energy benchmark data from FRED/EIA.")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and validate without writing JSON files.")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging.")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    try:
        return run_update(dry_run=args.dry_run)
    except OilFetchError as exc:
        logger.error("Global oil update failed; preserving existing JSON files: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
