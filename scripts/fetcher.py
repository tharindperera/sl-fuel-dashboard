"""HTTP fetcher and payload parsers for CEYPETCO official JSON endpoints."""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import requests
from bs4 import BeautifulSoup

from scripts.config import (
    ALIAS_TO_PRODUCT,
    BACKOFF_BASE_SECONDS,
    CSV_HEADER,
    FUEL_PRICES_API_URL,
    FUEL_PRODUCTS,
    HISTORICAL_PRICES_API_URL,
    MAX_RETRIES,
    MAX_VALID_PRICE_LKR,
    MIN_VALID_PRICE_LKR,
    REQUEST_TIMEOUT_SECONDS,
    USER_AGENT,
    normalize_product_name,
)

logger = logging.getLogger(__name__)


class FetchError(RuntimeError):
    """Raised when a remote CEYPETCO source cannot be fetched or parsed."""


@dataclass(frozen=True)
class CurrentRateQuote:
    """Normalized active product quote from CEYPETCO marketing-sales API."""

    code: str
    csv_column: str
    full_name: str
    api_product_name: str
    category: str
    price: float
    effective_date: date
    effective_time: str


@dataclass(frozen=True)
class HistoricalFuelRow:
    """Normalized fuel revision row from CEYPETCO historical-prices API."""

    date_label: str
    parsed_date: date
    sort_key: int
    note: str
    values_by_csv_col: dict[str, str]


@dataclass(frozen=True)
class SourceFetchResult:
    """Container holding fetch metadata and parsed data for both sources."""

    current_quotes: dict[str, CurrentRateQuote]
    historical_rows: list[HistoricalFuelRow]
    fuel_api_status: dict[str, Any]
    historical_api_status: dict[str, Any]
    warnings: list[str]


def validate_price(value: Any, context: str) -> float:
    """Validate and convert a price value into a positive finite float."""
    if value is None or isinstance(value, bool):
        raise FetchError(f"Missing or invalid price for {context}: {value!r}")
    try:
        numeric = float(str(value).strip())
    except ValueError as exc:
        raise FetchError(f"Non-numeric price for {context}: {value!r}") from exc
    if numeric < MIN_VALID_PRICE_LKR or numeric > MAX_VALID_PRICE_LKR:
        raise FetchError(
            f"Out-of-range price for {context}: {numeric} "
            f"(expected {MIN_VALID_PRICE_LKR}..{MAX_VALID_PRICE_LKR})"
        )
    return numeric


def parse_iso_date(raw_date: str, context: str) -> date:
    """Parse an ISO timestamp or YYYY-MM-DD date string into a calendar date."""
    text = (raw_date or "").strip()
    if not text:
        raise FetchError(f"Missing effectiveDate for {context}")
    date_part = text[:10]
    try:
        return datetime.strptime(date_part, "%Y-%m-%d").date()
    except ValueError as exc:
        raise FetchError(f"Invalid effectiveDate {raw_date!r} for {context}") from exc


def parse_csv_date_label(label: str) -> date:
    """Parse CEYPETCO archive date labels like '02.11.2026' or '17.10.2022 (9.00 PM)'."""
    match = re.match(r"^\s*(\d{2}\.\d{2}\.\d{4})", label or "")
    if not match:
        raise FetchError(f"Malformed historical date label: {label!r}")
    try:
        return datetime.strptime(match.group(1), "%d.%m.%Y").date()
    except ValueError as exc:
        raise FetchError(f"Invalid calendar date in label {label!r}") from exc


def _get_json_with_retries(
    session: requests.Session,
    url: str,
    timeout: int = REQUEST_TIMEOUT_SECONDS,
    max_retries: int = MAX_RETRIES,
) -> tuple[dict[str, Any], int]:
    """Fetch a JSON endpoint with exponential backoff on transient failures."""
    last_exc: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = session.get(
                url,
                timeout=timeout,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
            payload = resp.json()
            if not isinstance(payload, dict):
                raise FetchError(f"Expected JSON object from {url}, got {type(payload).__name__}")
            return payload, resp.status_code
        except (requests.RequestException, ValueError, FetchError) as exc:
            last_exc = exc
            logger.warning(
                "Attempt %d/%d failed for %s: %s", attempt, max_retries, url, exc
            )
            if attempt < max_retries:
                sleep_seconds = BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))
                time.sleep(sleep_seconds)
    raise FetchError(f"Failed to fetch {url} after {max_retries} attempts: {last_exc}")


def parse_fuel_prices_payload(payload: dict[str, Any]) -> tuple[dict[str, CurrentRateQuote], list[str]]:
    """Parse `/admin/fuel-prices/active` JSON payload into normalized quotes keyed by product code."""
    items = payload.get("data")
    if not isinstance(items, list) or not items:
        raise FetchError("Fuel prices API payload missing non-empty 'data' list")

    quotes: dict[str, CurrentRateQuote] = {}
    warnings: list[str] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("status", "active") != "active":
            continue
        raw_name = str(item.get("product") or "").strip()
        spec = ALIAS_TO_PRODUCT.get(normalize_product_name(raw_name))
        if spec is None:
            warnings.append(f"Unmapped product in fuel-prices API: {raw_name!r}")
            continue

        price = validate_price(item.get("price"), f"fuel-prices:{spec.code}")
        eff_date = parse_iso_date(str(item.get("effectiveDate") or ""), f"fuel-prices:{spec.code}")
        eff_time = str(item.get("effectiveTime") or "00:00").strip() or "00:00"

        quotes[spec.code] = CurrentRateQuote(
            code=spec.code,
            csv_column=spec.csv_column,
            full_name=spec.full_name,
            api_product_name=raw_name,
            category=spec.category,
            price=price,
            effective_date=eff_date,
            effective_time=eff_time,
        )

    missing_white_oil = [
        p.code for p in FUEL_PRODUCTS if p.category == "White Oil" and p.code not in quotes
    ]
    if missing_white_oil:
        raise FetchError(
            f"Fuel prices API missing required White Oil products: {missing_white_oil}"
        )

    missing_black_oil = [
        p.code for p in FUEL_PRODUCTS if p.category == "Black Oil" and p.code not in quotes
    ]
    if missing_black_oil:
        warnings.append(
            f"Fuel prices API omitted Black Oil products {missing_black_oil}; "
            "they will be carried forward from historical/CSV data."
        )

    return quotes, warnings


def parse_historical_prices_payload(payload: dict[str, Any]) -> list[HistoricalFuelRow]:
    """Parse `/admin/historical-prices/active` JSON payload into sorted fuel rows."""
    items = payload.get("data")
    if not isinstance(items, list) or not items:
        raise FetchError("Historical prices API payload missing non-empty 'data' list")

    fuel_cols = CSV_HEADER[1:]
    parsed_rows: list[HistoricalFuelRow] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("kind") != "fuel":
            continue
        if item.get("status", "active") != "active":
            continue

        date_label = str(item.get("dateLabel") or "").strip()
        values = item.get("values")
        if not isinstance(values, list) or len(values) != len(fuel_cols):
            raise FetchError(
                f"Historical row {date_label!r} has {len(values) if isinstance(values, list) else 'invalid'} "
                f"values; expected {len(fuel_cols)}"
            )

        parsed_date = parse_csv_date_label(date_label)
        sort_key = int(item.get("sortKey") or parsed_date.strftime("%Y%m%d"))
        note = str(item.get("note") or "").strip()

        values_by_col = {
            col: str(val).strip() if val is not None else ""
            for col, val in zip(fuel_cols, values)
        }
        # Validate newest historical rows (2015+) have all 9 numeric grades non-empty.
        if parsed_date >= date(2015, 1, 1):
            for col, val in values_by_col.items():
                validate_price(val, f"historical:{date_label}:{col}")

        parsed_rows.append(
            HistoricalFuelRow(
                date_label=date_label,
                parsed_date=parsed_date,
                sort_key=sort_key,
                note=note,
                values_by_csv_col=values_by_col,
            )
        )

    if not parsed_rows:
        raise FetchError("Historical prices API returned zero fuel rows")

    # Preserve API relative order for ties on sort_key while ensuring newest-first order.
    parsed_rows.sort(key=lambda r: r.sort_key, reverse=True)
    return parsed_rows


def parse_marketing_sales_html_fallback(html: str) -> dict[str, CurrentRateQuote]:
    """Parse rendered marketing-sales HTML cards (fallback/test utility for SSR or DOM snapshots)."""
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("article.fuel-price-card")
    if not cards:
        raise FetchError("No .fuel-price-card elements found in HTML")

    quotes: dict[str, CurrentRateQuote] = {}
    for card in cards:
        title_el = card.select_one("h3")
        price_el = card.select_one(".price-value b")
        eff_el = card.select_one(".price-effective")
        if not (title_el and price_el and eff_el):
            continue

        raw_name = title_el.get_text(" ", strip=True)
        spec = ALIAS_TO_PRODUCT.get(normalize_product_name(raw_name))
        if spec is None:
            continue

        price = validate_price(price_el.get_text(strip=True).replace(",", ""), f"html:{spec.code}")
        eff_text = eff_el.get_text(" ", strip=True)
        match = re.search(r"(\d{2}-\d{2}-\d{4})\s+at\s+(\d{2}:\d{2})", eff_text)
        if not match:
            raise FetchError(f"Could not parse effective date/time from {eff_text!r}")

        eff_date = datetime.strptime(match.group(1), "%d-%m-%Y").date()
        eff_time = match.group(2)
        quotes[spec.code] = CurrentRateQuote(
            code=spec.code,
            csv_column=spec.csv_column,
            full_name=spec.full_name,
            api_product_name=raw_name,
            category=spec.category,
            price=price,
            effective_date=eff_date,
            effective_time=eff_time,
        )

    if not quotes:
        raise FetchError("Parsed zero mapped fuel cards from marketing-sales HTML")
    return quotes


def fetch_ceypetco_sources(
    session: requests.Session | None = None,
) -> SourceFetchResult:
    """Fetch and parse both official CEYPETCO active-rates and historical-archive APIs."""
    own_session = session is None
    sess = session or requests.Session()
    warnings: list[str] = []

    fuel_status: dict[str, Any] = {
        "url": FUEL_PRICES_API_URL,
        "status": "error",
        "http_status": None,
        "records_count": None,
        "error": None,
    }
    hist_status: dict[str, Any] = {
        "url": HISTORICAL_PRICES_API_URL,
        "status": "error",
        "http_status": None,
        "records_count": None,
        "fuel_records_count": None,
        "error": None,
    }

    try:
        try:
            fuel_payload, fuel_http = _get_json_with_retries(sess, FUEL_PRICES_API_URL)
            fuel_status["http_status"] = fuel_http
            fuel_status["records_count"] = len(fuel_payload.get("data") or [])
            current_quotes, parse_warnings = parse_fuel_prices_payload(fuel_payload)
            fuel_status["status"] = "ok"
            warnings.extend(parse_warnings)
        except Exception as exc:
            fuel_status["error"] = str(exc)
            raise

        try:
            hist_payload, hist_http = _get_json_with_retries(sess, HISTORICAL_PRICES_API_URL)
            hist_status["http_status"] = hist_http
            hist_status["records_count"] = len(hist_payload.get("data") or [])
            historical_rows = parse_historical_prices_payload(hist_payload)
            hist_status["fuel_records_count"] = len(historical_rows)
            hist_status["status"] = "ok"
        except Exception as exc:
            hist_status["error"] = str(exc)
            raise

        return SourceFetchResult(
            current_quotes=current_quotes,
            historical_rows=historical_rows,
            fuel_api_status=fuel_status,
            historical_api_status=hist_status,
            warnings=warnings,
        )
    finally:
        if own_session:
            sess.close()
