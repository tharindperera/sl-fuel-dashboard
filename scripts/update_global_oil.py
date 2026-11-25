"""Fetch global energy benchmarks from public FRED/EIA endpoints and build dashboard JSONs."""

from __future__ import annotations

import argparse
import csv
import io
import json
import logging
import os
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Sequence

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
    MAX_RETRIES,
    REQUEST_TIMEOUT_SECONDS,
    SL_TZ,
    USER_AGENT,
    UTC_TZ,
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
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build `global_oil_kpis.json` and `brent_history.json` payloads from parsed series."""
    utc_now = now_utc or datetime.now(UTC_TZ)
    sl_now = utc_now.astimezone(SL_TZ)
    updated_hhmm = utc_now.strftime("%H:%M")

    brent_spec = COMMODITIES_BY_ID["brent"]
    brent_points = series_map["brent"]
    brent_metrics = compute_commodity_metrics(brent_spec, brent_points, updated_hhmm)
    trend_outlook = compute_trend_outlook(brent_points, decimals=brent_spec.decimals)

    comparison_table = [
        compute_commodity_metrics(spec, series_map[spec.id], updated_hhmm)
        for spec in COMMODITIES
    ]

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
        "series": {
            spec.id: [{"time": pt.time, "value": pt.value} for pt in series_map[spec.id]]
            for spec in COMMODITIES
        },
    }

    return kpis_payload, history_payload


def run_update(*, dry_run: bool = False, data_dir: Path = DATA_DIR) -> int:
    now_utc = datetime.now(UTC_TZ)
    eia_api_key = os.environ.get("EIA_API_KEY", "").strip() or None
    series_map: dict[str, list[PricePoint]] = {}

    with requests.Session() as session:
        for spec in COMMODITIES:
            url = FRED_CSV_BASE_URL.format(series_id=spec.fred_series_id)
            logger.info("Fetching %s (%s)...", spec.name, spec.fred_series_id)
            resp = _request_with_retries(session, url)
            points = parse_fred_csv(resp.text, spec.fred_series_id)
            points = _merge_eia_supplement(points, spec, session, eia_api_key)
            series_map[spec.id] = points
            logger.info(
                "Loaded %d observations for %s (%s .. %s, latest=%.3f)",
                len(points),
                spec.id,
                points[0].time,
                points[-1].time,
                points[-1].value,
            )

        intraday_payload = fetch_optional_intraday(session, now_utc)

    kpis_payload, history_payload = build_global_oil_outputs(series_map, now_utc=now_utc)

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
