"""Configuration and commodity specifications for the Global Crude Oil pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"

GLOBAL_OIL_KPIS_JSON = DATA_DIR / "global_oil_kpis.json"
BRENT_HISTORY_JSON = DATA_DIR / "brent_history.json"
BRENT_INTRADAY_JSON = DATA_DIR / "brent_intraday.json"
OIL_AI_SUMMARY_JSON = DATA_DIR / "oil_ai_summary.json"

SL_TZ = ZoneInfo("Asia/Colombo")
UTC_TZ = ZoneInfo("UTC")

REQUEST_TIMEOUT_SECONDS = 35
MAX_RETRIES = 3
BACKOFF_BASE_SECONDS = 1.5
USER_AGENT = "CPCFuelTrendsBot/1.0 (+https://github.com/tharindperera/sl-fuel-dashboard)"

FRED_CSV_BASE_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
EIA_SPOT_API_URL = (
    "https://api.eia.gov/v2/petroleum/pri/spt/data/"
    "?api_key={api_key}&frequency=daily&data[0]=value"
    "&facets[series][]={eia_series}&sort[0][column]=period&sort[0][direction]=desc&length=30"
)

# Steep move anomaly detection thresholds for Brent Crude
SURGE_DAILY_PCT_THRESHOLD = 2.5
SURGE_5D_PCT_THRESHOLD = 5.0

# Public RSS feeds for headline context only (never scrape full article bodies)
OIL_RSS_FEEDS: tuple[tuple[str, str], ...] = (
    ("EIA Today in Energy", "https://www.eia.gov/rss/todayinenergy.xml"),
    (
        "Google News (Brent Crude)",
        "https://news.google.com/rss/search?q=%22Brent+crude%22+OR+%22crude+oil+prices%22&hl=en-US&gl=US&ceid=US:en",
    ),
    ("OilPrice.com", "https://oilprice.com/rss/main"),
)


@dataclass(frozen=True)
class CommoditySpec:
    """Definition for a tracked global energy commodity."""

    id: str
    name: str
    symbol: str
    fred_series_id: str
    eia_series_id: str | None
    unit: str
    decimals: int
    is_primary: bool = False
    description: str = ""


COMMODITIES: tuple[CommoditySpec, ...] = (
    CommoditySpec(
        id="wti",
        name="Crude Oil (WTI)",
        symbol="WTI",
        fred_series_id="DCOILWTICO",
        eia_series_id="RWTC",
        unit="USD / BBL",
        decimals=2,
        is_primary=False,
        description="West Texas Intermediate light sweet crude (Cushing, Oklahoma).",
    ),
    CommoditySpec(
        id="brent",
        name="Brent Crude",
        symbol="BRENT",
        fred_series_id="DCOILBRENTEU",
        eia_series_id="RBRTE",
        unit="USD / BBL",
        decimals=2,
        is_primary=True,
        description="North Sea Brent physical/spot benchmark (Europe & global seaborne reference).",
    ),
    CommoditySpec(
        id="natgas",
        name="Natural Gas",
        symbol="NG",
        fred_series_id="DHHNGSP",
        eia_series_id=None,
        unit="USD / MMBtu",
        decimals=2,
        is_primary=False,
        description="Henry Hub Natural Gas Spot Price.",
    ),
    CommoditySpec(
        id="gasoline",
        name="Gasoline (RBOB)",
        symbol="RBOB",
        fred_series_id="DGASUSGULF",
        eia_series_id=None,
        unit="USD / GAL",
        decimals=3,
        is_primary=False,
        description="U.S. Gulf Coast Conventional Gasoline Regular Spot Price.",
    ),
    CommoditySpec(
        id="heating_oil",
        name="Heating Oil",
        symbol="HO",
        fred_series_id="DHOILNYH",
        eia_series_id=None,
        unit="USD / GAL",
        decimals=3,
        is_primary=False,
        description="New York Harbor No. 2 Heating Oil Spot Price.",
    ),
)

COMMODITIES_BY_ID = {c.id: c for c in COMMODITIES}
