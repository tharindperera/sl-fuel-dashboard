"""Configuration, product mappings, and constants for the CPC Fuel Trends pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT_DIR / "cpc_petroleum_prices_original.csv"
DATA_DIR = ROOT_DIR / "data"

CURRENT_RATES_JSON = DATA_DIR / "current_rates.json"
ARCHIVE_META_JSON = DATA_DIR / "archive_meta.json"
TRENDS_KPIS_JSON = DATA_DIR / "trends_kpis.json"
MONTHLY_AGGREGATED_JSON = DATA_DIR / "monthly_aggregated.json"
ANNUAL_AGGREGATED_JSON = DATA_DIR / "annual_aggregated.json"
PIPELINE_STATUS_JSON = DATA_DIR / "pipeline_status.json"

SL_TZ = ZoneInfo("Asia/Colombo")
UTC_TZ = ZoneInfo("UTC")

# Public SPA pages and their underlying CEYPETCO JSON endpoints.
MARKETING_SALES_PAGE_URL = "https://ceypetco.gov.lk/marketing-sales/"
HISTORICAL_PRICES_PAGE_URL = "https://ceypetco.gov.lk/marketing-sales/historical-prices"

FUEL_PRICES_API_URL = "https://api.ceypetco.gov.lk/api/admin/fuel-prices/active?limit=100"
HISTORICAL_PRICES_API_URL = "https://api.ceypetco.gov.lk/api/admin/historical-prices/active"

REQUEST_TIMEOUT_SECONDS = 25
MAX_RETRIES = 3
BACKOFF_BASE_SECONDS = 1.5
USER_AGENT = "CPCFuelTrendsBot/1.0 (+https://github.com/sl-fuel-dashboard)"

# Sanity bounds for Sri Lankan fuel prices (LKR per litre) to catch HTML/API corruption.
MIN_VALID_PRICE_LKR = 1.0
MAX_VALID_PRICE_LKR = 100_000.0

CSV_DATE_COLUMN = "Date"
CSV_HEADER = [
    "Date",
    "LP 95",
    "LP 92",
    "LAD",
    "LSD",
    "LK",
    "LIK",
    "FUR. 800",
    "FUR 1500 (High)",
    "FUR. 1500 (Low)",
]

CORE_RETAIL_CODES = ("LP 92", "LP 95", "LAD", "LSD", "LK")


@dataclass(frozen=True)
class FuelProductSpec:
    """Metadata and mapping rules for one tracked fuel grade."""

    code: str
    csv_column: str
    full_name: str
    category: str
    segment: str
    display_order: int
    is_core_retail: bool
    api_product_aliases: tuple[str, ...]


FUEL_PRODUCTS: tuple[FuelProductSpec, ...] = (
    FuelProductSpec(
        code="LP 95",
        csv_column="LP 95",
        full_name="Lanka Petrol 95 Octane Euro 4",
        category="White Oil",
        segment="Retail",
        display_order=1,
        is_core_retail=True,
        api_product_aliases=(
            "lanka petrol 95 octane euro 4",
            "petrol 95 euro 4",
            "lanka petrol 95",
        ),
    ),
    FuelProductSpec(
        code="LP 92",
        csv_column="LP 92",
        full_name="Lanka Petrol 92 Octane",
        category="White Oil",
        segment="Retail",
        display_order=2,
        is_core_retail=True,
        api_product_aliases=(
            "lanka petrol 92 octane",
            "petrol 92",
        ),
    ),
    FuelProductSpec(
        code="LAD",
        csv_column="LAD",
        full_name="Lanka Auto Diesel",
        category="White Oil",
        segment="Retail",
        display_order=3,
        is_core_retail=True,
        api_product_aliases=(
            "lanka auto diesel",
            "auto diesel",
        ),
    ),
    FuelProductSpec(
        code="LSD",
        csv_column="LSD",
        full_name="Lanka Super Diesel 4 Star Euro 4",
        category="White Oil",
        segment="Retail",
        display_order=4,
        is_core_retail=True,
        api_product_aliases=(
            "lanka super diesel 4 star euro 4",
            "super diesel euro 4",
            "lanka super diesel",
        ),
    ),
    FuelProductSpec(
        code="LK",
        csv_column="LK",
        full_name="Lanka Kerosene",
        category="White Oil",
        segment="Retail",
        display_order=5,
        is_core_retail=True,
        api_product_aliases=(
            "lanka kerosene",
            "kerosene",
        ),
    ),
    FuelProductSpec(
        code="LIK",
        csv_column="LIK",
        full_name="Lanka Industrial Kerosene",
        category="White Oil",
        segment="Industrial",
        display_order=6,
        is_core_retail=False,
        api_product_aliases=(
            "lanka industrial kerosene",
            "industrial kerosene",
        ),
    ),
    FuelProductSpec(
        code="FUR. 800",
        csv_column="FUR. 800",
        full_name="Furnace Oil 800",
        category="Black Oil",
        segment="Industrial",
        display_order=1,
        is_core_retail=False,
        api_product_aliases=(
            "lanka fuel oil super",
            "furnace oil 800",
            "fuel oil super",
            "fur. 800",
        ),
    ),
    FuelProductSpec(
        code="FUR 1500 (H)",
        csv_column="FUR 1500 (High)",
        full_name="Furnace Oil 1500 High Sulphur",
        category="Black Oil",
        segment="Industrial",
        display_order=2,
        is_core_retail=False,
        api_product_aliases=(
            "lanka fuel oil 1500 sec. · high sulphur",
            "lanka fuel oil 1500 sec. - high sulphur",
            "lanka fuel oil 1500 sec high sulphur",
            "furnace oil 1500 high sulphur",
            "fuel oil 1500 · high sulphur",
            "fur 1500 (high)",
        ),
    ),
    FuelProductSpec(
        code="FUR 1500 (L)",
        csv_column="FUR. 1500 (Low)",
        full_name="Furnace Oil 1500 Low Sulphur",
        category="Black Oil",
        segment="Industrial",
        display_order=3,
        is_core_retail=False,
        api_product_aliases=(
            "lanka fuel oil 1500 sec. · low sulphur",
            "lanka fuel oil 1500 sec. - low sulphur",
            "lanka fuel oil 1500 sec low sulphur",
            "furnace oil 1500 low sulphur",
            "fuel oil 1500 · low sulphur",
            "fur. 1500 (low)",
        ),
    ),
)

PRODUCTS_BY_CODE = {p.code: p for p in FUEL_PRODUCTS}
PRODUCTS_BY_CSV_COL = {p.csv_column: p for p in FUEL_PRODUCTS}


def normalize_product_name(name: str) -> str:
    """Normalize whitespace and punctuation for resilient API product matching."""
    cleaned = " ".join(name.strip().lower().split())
    return cleaned


ALIAS_TO_PRODUCT: dict[str, FuelProductSpec] = {
    normalize_product_name(alias): spec
    for spec in FUEL_PRODUCTS
    for alias in spec.api_product_aliases
}
