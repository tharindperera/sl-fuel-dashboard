# CPC Fuel Trends — Analytics & Pricing Portal

A fully automated, zero-maintenance dashboard that tracks **Sri Lankan fuel prices** published by [CEYPETCO](https://ceypetco.gov.lk) and **global crude oil benchmarks** sourced from the U.S. Energy Information Administration (EIA) via FRED. A daily GitHub Actions pipeline scrapes, reconciles, and commits the data; a Vite + React frontend reads the static JSON files and renders five production-grade pages — no backend server required.

> **Live Site →** Deployed automatically to GitHub Pages on every `main` push and after each data pipeline run.

---

## Table of Contents

- [Features](#features)
- [Pages](#pages)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Data Pipeline](#data-pipeline)
  - [Domestic Fuel Price Pipeline](#domestic-fuel-price-pipeline)
  - [Global Crude Oil Pipeline](#global-crude-oil-pipeline)
- [Data Files Reference](#data-files-reference)
- [Frontend](#frontend)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Local Development](#local-development)
- [Testing](#testing)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Features

- **Fully Automated Data Collection** — Two independent GitHub Actions pipelines (domestic + global) fetch, validate, reconcile, and commit data on schedule with zero manual intervention.
- **Zero Client-Side External Requests** — The browser reads only local static JSON files committed to the repo. No third-party API calls from the user's browser.
- **5 Dashboard Pages** — Home, Historical Archive, Trends, Analysis, and Global Crude Oil.
- **Light & Dark Mode** — Working theme toggle with balanced contrast across all pages.
- **Trilingual UI** — English, Sinhala (සිංහල), and Tamil (தமிழ்) language selector.
- **Responsive Design** — Clean layouts from 390px mobile through 1440px+ desktop.
- **Tabular Numerals** — `font-variant-numeric: tabular-nums` on every price, date, counter, and table column for vertical digit alignment.
- **Interactive Charts** — Custom SVG charts for domestic trends and [TradingView Lightweight Charts™](https://www.tradingview.com/lightweight-charts/) for global commodity series.
- **CSV Export** — One-click export from every table and chart view.
- **17 Unit Tests** — Covering CSV parsing, KPI math, aggregator logic, anomaly detection, and global oil pipeline.

---

## Pages

| # | Page | Route | Description |
|---|------|-------|-------------|
| 1 | **Home** | `#/` | Current CEYPETCO retail rates with live status badges, category cards, and pipeline metadata. |
| 2 | **Historical Archive** | `#/archive` | Full 185-row searchable/filterable/sortable price table from 1990, plus collapsible **Monthly** (441 months) and **Annual** (37 years) aggregator modules each with their own hidden-by-default interactive price chart. |
| 3 | **Trends** | `#/trends` | Interactive multi-fuel price chart with Rs. Values / % Change toggle, Line / Area view, fuel type multi-select, period presets, and chart data export. |
| 4 | **Analysis** | `#/analysis` | Statistical analysis and comparison dashboards built from the same `trends_kpis.json` pipeline data. |
| 5 | **Global Crude Oil** | `#/global-oil` | Brent Crude benchmark page with 5-card KPI strip, interactive TradingView chart (1D–ALL timeframes for 5 commodities), benchmark profile & specifications sheet, and cross-commodity comparison table with heatmap % change cells. |

---

## Architecture

```
┌───────────────────────────────────┐
│       GitHub Actions (cron)       │
│  update-fuel-prices.yml  (daily)  │
│  update-global-oil.yml   (6-hr)  │
└──────────────┬────────────────────┘
               │ scrape + compute
               ▼
┌──────────────────────────────────┐
│    data/*.json  +  CSV (repo)    │
│  Committed to main branch        │
└──────────────┬───────────────────┘
               │ triggers
               ▼
┌──────────────────────────────────┐
│   deploy-pages.yml               │
│   npm ci → npm run build → Pages │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│   GitHub Pages (static hosting)  │
│   frontend/dist/                 │
│   ├── index.html                 │
│   ├── data/*.json                │
│   └── assets/                    │
└──────────────────────────────────┘
```

---

## Project Structure

```
sl-fuel-dashboard/
├── .github/workflows/
│   ├── update-fuel-prices.yml      # Daily CEYPETCO scraper + KPI pipeline
│   ├── update-global-oil.yml       # 6-hourly FRED/EIA global oil pipeline
│   └── deploy-pages.yml            # Build & deploy frontend to GitHub Pages
│
├── scripts/                        # Python data pipeline modules
│   ├── config.py                   # Domestic pipeline paths, constants, fuel grades
│   ├── fetcher.py                  # CEYPETCO API & HTML scraper with retry logic
│   ├── reconciler.py               # CSV dedup, merge, and atomic write
│   ├── kpis.py                     # KPI JSON generators (current_rates, archive_meta, trends_kpis, aggregators)
│   ├── aggregators.py              # Monthly & annual time-weighted price aggregation with rollover rules
│   ├── update_fuel_prices.py       # CLI entrypoint for domestic pipeline (--verbose, --rebuild-kpis, --dry-run)
│   ├── oil_config.py               # Global oil paths, commodity specs, FRED/EIA URLs, anomaly thresholds
│   ├── update_global_oil.py        # FRED CSV fetcher, EIA supplement, EMA trend outlook, commodity metrics
│   └── generate_oil_ai_summary.py  # Anomaly detection + optional Gemini AI steep-move summary
│
├── tests/                          # Python unit tests
│   ├── test_pipeline.py            # CSV parsing, KPI math, reconciliation, idempotency (10 tests)
│   ├── test_aggregators.py         # Monthly/annual aggregation with rollover rules (3 tests)
│   └── test_global_oil.py          # FRED parsing, anomaly detection, build outputs (4 tests)
│
├── data/                           # Auto-generated static JSON files (committed by CI)
│   ├── current_rates.json          # Active CEYPETCO retail tariffs per fuel grade
│   ├── archive_meta.json           # Historical archive metadata (total records, available years)
│   ├── trends_kpis.json            # Per-grade price series, deltas, and trend statistics
│   ├── monthly_aggregated.json     # 441 months of time-weighted average prices (1990–present)
│   ├── annual_aggregated.json      # 37 years of annual price aggregates (1990–present)
│   ├── pipeline_status.json        # Last pipeline run metadata and source health
│   ├── global_oil_kpis.json        # Brent/WTI/NG/Gasoline/Heating Oil KPIs & comparison table
│   ├── brent_history.json          # Full daily series for all 5 commodities (compact JSON)
│   ├── brent_intraday.json         # Optional Twelve Data hourly points (empty when API key unset)
│   └── oil_ai_summary.json         # AI-generated steep-move intelligence summary
│
├── cpc_petroleum_prices_original.csv   # Master historical CSV (185 rows, 9 fuel grades, 1990–2026)
├── requirements.txt                    # Python dependencies (requests, beautifulsoup4, tzdata, pytest)
│
├── frontend/                       # React + Vite + Tailwind CSS v4 frontend
│   ├── package.json
│   ├── vite.config.ts              # Custom plugin syncs repo-root data/ into dev server & dist/
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/favicon.svg
│   └── src/
│       ├── main.tsx                # React DOM entry
│       ├── App.tsx                 # Router, page switching, global state orchestration
│       ├── index.css               # Tailwind v4 imports + custom font and theme tokens
│       │
│       ├── pages/
│       │   ├── HomePage.tsx        # Page 1: Current market rates
│       │   ├── ArchivePage.tsx     # Page 2: Historical price archive + aggregator modules
│       │   ├── TrendsPage.tsx      # Page 3: Interactive price trends
│       │   ├── AnalysisPage.tsx    # Page 4: Statistical analysis
│       │   └── GlobalOilPage.tsx   # Page 5: Global crude oil benchmarks
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Navbar.tsx      # Responsive navbar with page links, language, theme toggle
│       │   │   ├── Footer.tsx      # Site-wide footer with attribution and About link
│       │   │   └── InfoModals.tsx  # About the Portal modal
│       │   ├── home/
│       │   │   ├── RateCard.tsx    # Individual fuel rate card with delta badge
│       │   │   └── SkeletonGrid.tsx# Loading skeleton placeholders
│       │   ├── archive/
│       │   │   ├── ArchiveHero.tsx # Archive page header with metadata KPIs
│       │   │   ├── ArchiveFilters.tsx  # Year, fuel grade, sort, and search filters
│       │   │   ├── ArchiveTable.tsx    # Responsive price history table with sticky date column
│       │   │   ├── AggregatedPriceViews.tsx  # Collapsible monthly & annual aggregator accordions
│       │   │   └── AggregatedPriceChart.tsx  # Interactive SVG chart for aggregated data
│       │   ├── trends/
│       │   │   └── PriceChart.tsx  # Multi-fuel interactive SVG chart with filters & export
│       │   └── oil/
│       │       ├── OilChartCard.tsx           # TradingView Lightweight Charts wrapper
│       │       ├── BenchmarkSpecsSheet.tsx    # Brent specs, ATH/ATL, attribution
│       │       └── CommodityComparisonTable.tsx  # 5-commodity heatmap comparison table
│       │
│       ├── hooks/
│       │   ├── useFuelData.ts      # Data fetching hooks (useCurrentRates, useArchiveData, etc.)
│       │   └── useTheme.ts         # Light/dark theme state with localStorage persistence
│       │
│       ├── types/
│       │   ├── fuel.ts             # TypeScript interfaces for domestic fuel data
│       │   └── oil.ts              # TypeScript interfaces for global oil data
│       │
│       ├── utils/
│       │   ├── dataLoader.ts       # Fetch wrappers, CSV parser, export helpers
│       │   ├── formatters.ts       # LKR formatting, date display, timezone helpers
│       │   └── gradeMeta.ts        # Visual config (color, label, badge classes) per fuel grade
│       │
│       └── i18n/
│           └── strings.ts          # UI strings for English, Sinhala, and Tamil
│
└── .gitignore
```

---

## Data Pipeline

### Domestic Fuel Price Pipeline

**Schedule:** Daily at 11:30 PM Sri Lanka time (18:00 UTC) via `update-fuel-prices.yml`.

**Pipeline flow:**
1. **Scrape** CEYPETCO's JSON API (`/marketing-sales/`) and HTML historical archive (`/marketing-sales/historical-prices/`) with exponential-backoff retries.
2. **Reconcile** new revisions against the existing `cpc_petroleum_prices_original.csv` — deduplicates by date, merges API and historical sources, preserves chronological descending order.
3. **Generate KPI JSONs:**
   - `current_rates.json` — Active retail prices per grade with deltas and effective dates.
   - `archive_meta.json` — Record count, year range, available years.
   - `trends_kpis.json` — Per-grade time series with day-over-day, month-over-month, and YoY statistics.
   - `pipeline_status.json` — Last run timestamp, source health, warnings.
4. **Aggregate** (via `aggregators.py`):
   - `monthly_aggregated.json` — Time-weighted daily averages respecting the **end-of-month cutoff rule** (revisions in the final 2 days of a month roll to the 1st of the next month), multi-revision averaging, and continuous carry-forward for zero-change months.
   - `annual_aggregated.json` — Annual mean/min/max prices, YoY% change, revision counts.
5. **Commit & push** only if data actually changed.

**9 Tracked Fuel Grades:**

| Code | Full Name |
|------|-----------|
| LP 95 | Lanka Petrol 95 Octane Euro 4 |
| LP 92 | Lanka Petrol 92 Octane |
| LAD | Lanka Auto Diesel |
| LSD | Lanka Super Diesel |
| LK | Lanka Kerosene |
| LIK | Lanka Industrial Kerosene |
| FUR. 800 | Furnace Oil 800 |
| FUR 1500 (H) | Furnace Oil 1500 Sec (High) |
| FUR 1500 (L) | Furnace Oil 1500 Sec (Low) |

### Global Crude Oil Pipeline

**Schedule:** Every 6 hours + daily at 11:30 PM SL time via `update-global-oil.yml`.

**Pipeline flow:**
1. **Fetch** historical daily CSV series from [FRED](https://fred.stlouisfed.org) for 5 commodities:
   - `DCOILBRENTEU` — Brent Crude (primary benchmark)
   - `DCOILWTICO` — WTI Crude
   - `DHHNGSP` — Natural Gas (Henry Hub)
   - `DGASUSGULF` — Gasoline (RBOB)
   - `DHOILNYH` — Heating Oil
2. **Merge** optional EIA API v2 supplement (if `EIA_API_KEY` secret is set) for the latest observations.
3. **Compute** per-commodity: daily change, 30-day %, 52-week %, all-time high/low, historical range.
4. **Calculate** EMA(20/50) statistical trend outlook for Brent with transparent methodology documentation.
5. **Detect anomalies** — Flag steep daily surges (≥2.5%) or 5-day drops (≤−5.0%).
6. **Optionally generate** AI-powered steep-move intelligence summary via Gemini API (falls back to deterministic summary).
7. **Fetch optional intraday** quotes via Twelve Data API (1-hour bars for the 1D chart view).
8. **Write** `global_oil_kpis.json`, `brent_history.json`, `brent_intraday.json`, and `oil_ai_summary.json`.

**Data Sources & Licensing:**
- FRED / U.S. EIA — Public domain, free, no API key required for CSV endpoints.
- EIA API v2 — Free with optional API key (via `EIA_API_KEY` GitHub Secret).
- Twelve Data — Optional free-tier key (via `TWELVEDATA_API_KEY` GitHub Secret) for intraday quotes.
- Gemini API — Optional (via `GEMINI_API_KEY` GitHub Secret) for AI summary generation.

---

## Data Files Reference

| File | Updated By | Description |
|------|-----------|-------------|
| `cpc_petroleum_prices_original.csv` | Domestic pipeline | Master CSV with all historical revisions (DD.MM.YYYY format, 9 grade columns). |
| `data/current_rates.json` | Domestic pipeline | Active retail prices, deltas, effective dates, categorized by White Oil / Industrial / Furnace. |
| `data/archive_meta.json` | Domestic pipeline | Total record count, first/latest record dates, list of available years. |
| `data/trends_kpis.json` | Domestic pipeline | Complete per-grade price series arrays with computed trend analytics. |
| `data/monthly_aggregated.json` | Domestic pipeline | 441 months of time-weighted average prices with rollover rules applied. |
| `data/annual_aggregated.json` | Domestic pipeline | 37 years of annual aggregate statistics (avg, min, max, YoY%). |
| `data/pipeline_status.json` | Domestic pipeline | Last run timestamp, mode, source health, CSV row count, warnings. |
| `data/global_oil_kpis.json` | Global oil pipeline | Brent KPIs, trend outlook, 5-commodity comparison table with heatmap metrics. |
| `data/brent_history.json` | Global oil pipeline | Full daily series for all 5 commodities (compact JSON for chart rendering). |
| `data/brent_intraday.json` | Global oil pipeline | Optional Twelve Data hourly points (empty payload when API key is unset). |
| `data/oil_ai_summary.json` | Global oil pipeline | AI/deterministic steep-move intelligence summary with driver tags and source links. |

---

## Frontend

Built with **React 19**, **TypeScript 5.8**, **Vite 6**, and **Tailwind CSS v4**.

### Key Design Decisions

- **Static-only architecture** — The frontend fetches data from co-located `data/*.json` files using `fetch()` with `cache: "no-cache"`. No API server, no database, no authentication.
- **Custom Vite plugin** (`syncFuelPipelineData`) — During development, serves the repo-root `data/` directory and CSV directly. During production builds, copies all JSON/CSV files into `dist/` so GitHub Pages has everything in one artifact.
- **Hash-based routing** — `#/archive`, `#/trends`, `#/global-oil`, etc. Compatible with static hosting (no server-side rewrites needed).
- **TradingView Lightweight Charts** — Used for the Global Oil page's interactive chart (Apache 2.0 licensed).
- **Lucide React** — Icon library for consistent, tree-shakeable SVG icons.

---

## GitHub Actions Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **Update CEYPETCO Fuel Prices** | `update-fuel-prices.yml` | Daily 18:00 UTC + manual | Scrape, reconcile, generate KPIs, commit data. |
| **Update Global Crude Oil Data** | `update-global-oil.yml` | Every 6h + daily 18:00 UTC + manual | Fetch FRED/EIA series, compute metrics, commit data. |
| **Deploy Dashboard** | `deploy-pages.yml` | On push to `main` (frontend/data paths) + after either data workflow completes | Build Vite bundle, upload to GitHub Pages. |

All workflows include concurrency guards to prevent parallel runs, and only commit when data has actually changed.

---

## Local Development

### Prerequisites

- **Python 3.12+** — For the data pipeline and tests.
- **Node.js 22+** and **npm** — For the frontend build.

### Setup

```bash
# Clone the repository
git clone https://github.com/tharindperera/sl-fuel-dashboard.git
cd sl-fuel-dashboard

# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Run the data pipeline locally

```bash
# Full pipeline run (fetches from CEYPETCO, writes CSV + JSONs)
python -m scripts.update_fuel_prices --verbose

# Rebuild KPIs from existing CSV without scraping
python -m scripts.update_fuel_prices --rebuild-kpis --verbose

# Dry run (validate without writing files)
python -m scripts.update_fuel_prices --dry-run --verbose

# Global oil pipeline (requires internet for FRED)
python -m scripts.update_global_oil --verbose
```

### Run the frontend dev server

```bash
cd frontend
npm run dev
```

The Vite dev server automatically serves the repo-root `data/*.json` files via the custom `syncFuelPipelineData` plugin — no need to copy files manually.

### Production build

```bash
cd frontend
npm run build     # tsc -b && vite build → outputs to frontend/dist/
npm run preview   # Preview the production build locally
```

---

## Testing

```bash
# Run all 17 unit tests
python -m unittest discover -s tests -v

# Or with pytest
python -m pytest -v
```

**Test Coverage:**

| Test File | Tests | Covers |
|-----------|-------|--------|
| `test_pipeline.py` | 10 | CSV parsing, HTML fallback scraper, price validation, KPI math, reconciliation dedup, carry-forward logic, atomic CSV writes, dry-run safety. |
| `test_aggregators.py` | 3 | End-of-month cutoff rules, multi-revision time-weighted averaging, carry-forward for zero-change months, real 2026 CSV rollover verification, annual aggregation math. |
| `test_global_oil.py` | 4 | FRED CSV parsing (dots, sort, insufficient points), anomaly detection (surge/drop/normal), full KPI build output validation, RSS headline parsing. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4 |
| **Charts** | TradingView Lightweight Charts (global oil), Custom SVG (domestic trends/aggregators) |
| **Icons** | Lucide React |
| **Data Pipeline** | Python 3.12, `requests`, `beautifulsoup4` |
| **Testing** | `unittest` / `pytest` |
| **CI/CD** | GitHub Actions |
| **Hosting** | GitHub Pages (static) |
| **Data Sources** | CEYPETCO (domestic), FRED/EIA (global), Twelve Data (optional intraday), Gemini API (optional AI summary) |

---

## License

This project is provided as-is for educational and informational purposes. All domestic fuel price data is sourced from [CEYPETCO](https://ceypetco.gov.lk) (Ceylon Petroleum Corporation). Global commodity data is sourced from the [U.S. Energy Information Administration](https://www.eia.gov/) via [FRED](https://fred.stlouisfed.org/) (public domain). Interactive charts powered by [TradingView Lightweight Charts™](https://www.tradingview.com/lightweight-charts/) (Apache 2.0).
