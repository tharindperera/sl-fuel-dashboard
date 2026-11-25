"""Anomaly detection, public RSS headline gathering, and Gemini/fallback intelligence report generator."""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Sequence

import requests

from scripts.oil_config import (
    BRENT_HISTORY_JSON,
    DATA_DIR,
    GLOBAL_OIL_KPIS_JSON,
    OIL_AI_SUMMARY_JSON,
    OIL_RSS_FEEDS,
    SL_TZ,
    SURGE_5D_PCT_THRESHOLD,
    SURGE_DAILY_PCT_THRESHOLD,
    USER_AGENT,
    UTC_TZ,
)
from scripts.update_global_oil import PricePoint, _write_json_atomic

logger = logging.getLogger("oil_ai_summary")


@dataclass(frozen=True)
class AnomalyAnalysis:
    """Computed short-term price move metrics and steep-move alert classification."""

    alert_level: str  # "normal" | "surge" | "drop"
    daily_change_pct: float
    change_5d_pct: float
    z_score_30d: float
    latest_price: float
    latest_date: str


def detect_brent_anomaly(points: list[PricePoint]) -> AnomalyAnalysis:
    """Compute 1D %, 5D %, and rolling 30-trading-day z-score for Brent Crude."""
    if len(points) < 6:
        raise ValueError("Need at least 6 observations to compute 5-day move and anomaly state")

    latest = points[-1]
    prev_1d = points[-2]
    prev_5d = points[-6]

    daily_pct = ((latest.value - prev_1d.value) / prev_1d.value) * 100.0
    change_5d_pct = ((latest.value - prev_5d.value) / prev_5d.value) * 100.0

    # Rolling 30-trading-day daily % returns prior to latest day (or including window)
    window = points[-32:]
    returns = [
        ((window[i].value - window[i - 1].value) / window[i - 1].value) * 100.0
        for i in range(1, len(window))
    ]
    prior_returns = returns[:-1] if len(returns) > 1 else returns
    mean_ret = sum(prior_returns) / len(prior_returns)
    variance = sum((r - mean_ret) ** 2 for r in prior_returns) / max(1, len(prior_returns) - 1)
    std_ret = math.sqrt(variance)
    z_score = (daily_pct - mean_ret) / std_ret if std_ret > 1e-6 else 0.0

    if daily_pct >= SURGE_DAILY_PCT_THRESHOLD or change_5d_pct >= SURGE_5D_PCT_THRESHOLD:
        alert_level = "surge"
    elif daily_pct <= -SURGE_DAILY_PCT_THRESHOLD or change_5d_pct <= -SURGE_5D_PCT_THRESHOLD:
        alert_level = "drop"
    else:
        alert_level = "normal"

    return AnomalyAnalysis(
        alert_level=alert_level,
        daily_change_pct=round(daily_pct, 2),
        change_5d_pct=round(change_5d_pct, 2),
        z_score_30d=round(z_score, 2),
        latest_price=round(latest.value, 2),
        latest_date=latest.time,
    )


def parse_rss_items(xml_text: str, limit: int = 4) -> list[dict[str, str]]:
    """Extract clean headline titles and links from an RSS/Atom XML document."""
    root = ET.fromstring(xml_text)
    results: list[dict[str, str]] = []
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not title or not link or link.endswith("id="):
            continue
        results.append({"title": title, "url": link})
        if len(results) >= limit:
            break
    return results


def fetch_public_oil_headlines(max_items: int = 5) -> list[dict[str, str]]:
    """Fetch recent public RSS headlines (titles + links only) without scraping article bodies."""
    collected: list[dict[str, str]] = []
    seen_titles: set[str] = set()
    oil_keywords = ("oil", "brent", "crude", "opec", "refin", "energy", "diesel", "gas", "petroleum", "tanker")

    with requests.Session() as session:
        for feed_name, feed_url in OIL_RSS_FEEDS:
            try:
                resp = session.get(
                    feed_url,
                    timeout=15,
                    headers={"User-Agent": USER_AGENT},
                )
                resp.raise_for_status()
                for item in parse_rss_items(resp.text, limit=8):
                    low = item["title"].lower()
                    if not any(k in low for k in oil_keywords):
                        continue
                    if low not in seen_titles:
                        seen_titles.add(low)
                        collected.append(item)
                    if len(collected) >= max_items:
                        return collected
            except Exception as exc:
                logger.warning("RSS fetch failed for %s: %s", feed_name, exc)
    return collected


def build_deterministic_summary(
    anomaly: AnomalyAnalysis,
    kpis: dict[str, Any],
    sources: list[dict[str, str]],
    *,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Generate a clean, data-driven fallback report when GEMINI_API_KEY is unavailable or fails."""
    utc_now = now_utc or datetime.now(UTC_TZ)
    sl_now = utc_now.astimezone(SL_TZ)

    monthly_pct = float(kpis.get("monthly_change_pct", 0.0))
    yearly_pct = float(kpis.get("yearly_change_pct", 0.0))
    wti_row = next(
        (r for r in kpis.get("comparison_table", []) if r.get("id") == "wti"),
        None,
    )
    wti_price = wti_row["price"] if wti_row else None

    if anomaly.alert_level == "surge":
        headline = f"Brent Crude Surges {anomaly.daily_change_pct:+.2f}% on Supply-Risk Momentum"
        move_desc = (
            f"Brent crude posted a steep upward move to ${anomaly.latest_price:.2f}/bbl as of "
            f"{anomaly.latest_date}, rising {anomaly.daily_change_pct:+.2f}% on the day and "
            f"{anomaly.change_5d_pct:+.2f}% over the past five trading sessions "
            f"(30-day return z-score: {anomaly.z_score_30d:+.2f})."
        )
        tags = ["STEEP SURGE ALERT", "BRENT BENCHMARK", "SUPPLY RISK", "SL IMPORT PARITY"]
    elif anomaly.alert_level == "drop":
        headline = f"Brent Crude Retreats {anomaly.daily_change_pct:+.2f}% Amid Demand & Supply Shifts"
        move_desc = (
            f"Brent crude recorded a sharp pullback to ${anomaly.latest_price:.2f}/bbl on "
            f"{anomaly.latest_date}, moving {anomaly.daily_change_pct:+.2f}% on the day and "
            f"{anomaly.change_5d_pct:+.2f}% over five trading sessions "
            f"(30-day return z-score: {anomaly.z_score_30d:+.2f})."
        )
        tags = ["STEEP DROP ALERT", "BRENT BENCHMARK", "DEMAND OUTLOOK", "SL IMPORT PARITY"]
    else:
        direction = "edged higher" if anomaly.daily_change_pct >= 0 else "eased"
        headline = f"Brent Crude Holds Near ${anomaly.latest_price:.2f}/bbl in Orderly Trading"
        move_desc = (
            f"Brent crude {direction} to ${anomaly.latest_price:.2f}/bbl in the latest verified "
            f"EIA/FRED session ({anomaly.latest_date}), representing a {anomaly.daily_change_pct:+.2f}% "
            f"daily change and {anomaly.change_5d_pct:+.2f}% five-session trajectory."
        )
        tags = ["BRENT BENCHMARK", "EIA / FRED SPOT", "WTI SPREAD", "SL IMPORT PARITY"]

    spread_clause = (
        f" U.S. WTI crude settled at ${wti_price:.2f}/bbl, keeping the Brent-WTI spread at "
        f"${anomaly.latest_price - wti_price:.2f}/bbl."
        if wti_price is not None
        else ""
    )
    p2 = (
        f"Across broader horizons, Brent stands {monthly_pct:+.2f}% over the past 30 days and "
        f"{yearly_pct:+.2f}% over the past 52 weeks.{spread_clause} Recent market headlines point "
        f"to ongoing trader focus on OPEC+ production discipline, inventory balances, and maritime "
        f"supply routes."
    )
    p3 = (
        "For Sri Lanka's domestic fuel pricing formula, sustained movements in seaborne crude "
        "benchmarks directly influence Singapore Platts refined product assessments, landed CIF "
        "import costs, and subsequent monthly CEYPETCO retail tariff reviews."
    )

    return {
        "alert_level": anomaly.alert_level,
        "daily_change_pct": anomaly.daily_change_pct,
        "change_5d_pct": anomaly.change_5d_pct,
        "z_score_30d": anomaly.z_score_30d,
        "latest_price": anomaly.latest_price,
        "latest_date": anomaly.latest_date,
        "headline": headline,
        "paragraphs": [move_desc, p2, p3],
        "driver_tags": tags,
        "sources": sources,
        "generation_mode": "deterministic",
        "generated_at_utc": utc_now.isoformat(),
        "generated_at_sl": sl_now.isoformat(),
    }


def synthesize_with_gemini(
    anomaly: AnomalyAnalysis,
    kpis: dict[str, Any],
    sources: list[dict[str, str]],
    api_key: str,
    *,
    now_utc: datetime | None = None,
) -> dict[str, Any] | None:
    """Call Gemini API to synthesize an original Commodity Intelligence Report JSON."""
    utc_now = now_utc or datetime.now(UTC_TZ)
    sl_now = utc_now.astimezone(SL_TZ)

    headline_list = "\n".join(f"- {s['title']}" for s in sources) or "- No external headlines available."
    prompt = (
        "You are an energy market analyst writing an original, concise Commodity Intelligence Report "
        "for a Sri Lankan fuel pricing dashboard.\n"
        "Return ONLY valid JSON with keys: `headline` (string, <= 12 words), "
        "`paragraphs` (array of 3 concise factual paragraphs: paragraph 1 on Brent's latest price & move, "
        "paragraph 2 on supply/geopolitical/inventory drivers inferred from the headline topics below without "
        "copying sentences verbatim, paragraph 3 on relevance to Sri Lankan fuel import benchmarks / CEYPETCO), "
        "and `driver_tags` (array of 3 to 4 short uppercase tags like `OPEC+ SUPPLY`, `US INVENTORIES`).\n\n"
        f"Data:\n"
        f"- Latest Brent price: ${anomaly.latest_price:.2f}/bbl on {anomaly.latest_date}\n"
        f"- 1D change: {anomaly.daily_change_pct:+.2f}%\n"
        f"- 5D change: {anomaly.change_5d_pct:+.2f}%\n"
        f"- 30D z-score: {anomaly.z_score_30d:+.2f}\n"
        f"- Alert level: {anomaly.alert_level}\n"
        f"- 30D change: {kpis.get('monthly_change_pct')}%, 52W change: {kpis.get('yearly_change_pct')}%\n"
        f"Recent public RSS headline topics (do not quote verbatim):\n{headline_list}\n"
    )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json",
        },
    }

    try:
        resp = requests.post(url, json=payload, timeout=25)
        resp.raise_for_status()
        candidates = resp.json().get("candidates") or []
        raw_text = candidates[0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw_text)

        headline = str(parsed.get("headline") or "").strip()
        paragraphs = [str(p).strip() for p in (parsed.get("paragraphs") or []) if str(p).strip()]
        tags = [str(t).strip().upper() for t in (parsed.get("driver_tags") or []) if str(t).strip()]
        if not headline or len(paragraphs) < 2 or not tags:
            return None

        return {
            "alert_level": anomaly.alert_level,
            "daily_change_pct": anomaly.daily_change_pct,
            "change_5d_pct": anomaly.change_5d_pct,
            "z_score_30d": anomaly.z_score_30d,
            "latest_price": anomaly.latest_price,
            "latest_date": anomaly.latest_date,
            "headline": headline,
            "paragraphs": paragraphs[:3],
            "driver_tags": tags[:4],
            "sources": sources,
            "generation_mode": "gemini",
            "generated_at_utc": utc_now.isoformat(),
            "generated_at_sl": sl_now.isoformat(),
        }
    except Exception as exc:
        logger.warning("Gemini API synthesis failed; falling back to deterministic summary: %s", exc)
        return None


def run_summary_generation(*, dry_run: bool = False, data_dir: Path = DATA_DIR) -> int:
    kpis_path = data_dir / GLOBAL_OIL_KPIS_JSON.name
    hist_path = data_dir / BRENT_HISTORY_JSON.name

    if not kpis_path.exists() or not hist_path.exists():
        logger.error("Missing global_oil_kpis.json or brent_history.json; run update_global_oil first.")
        return 1

    kpis = json.loads(kpis_path.read_text(encoding="utf-8"))
    hist = json.loads(hist_path.read_text(encoding="utf-8"))
    brent_points = [
        PricePoint(time=item["time"], value=float(item["value"]))
        for item in hist["series"]["brent"]
    ]

    anomaly = detect_brent_anomaly(brent_points)
    sources = fetch_public_oil_headlines(max_items=5)
    now_utc = datetime.now(UTC_TZ)

    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    summary = None
    if gemini_key:
        summary = synthesize_with_gemini(anomaly, kpis, sources, gemini_key, now_utc=now_utc)
    if summary is None:
        summary = build_deterministic_summary(anomaly, kpis, sources, now_utc=now_utc)

    if dry_run:
        logger.info(
            "[DRY RUN] Alert=%s, mode=%s, headline=%r, sources=%d",
            summary["alert_level"],
            summary["generation_mode"],
            summary["headline"],
            len(sources),
        )
        return 0

    _write_json_atomic(data_dir / OIL_AI_SUMMARY_JSON.name, summary, compact=False)
    logger.info(
        "Wrote oil_ai_summary.json (alert=%s, mode=%s)",
        summary["alert_level"],
        summary["generation_mode"],
    )
    return 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Brent Crude anomaly & intelligence summary.")
    parser.add_argument("--dry-run", action="store_true", help="Compute summary without writing disk.")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging.")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    return run_summary_generation(dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
