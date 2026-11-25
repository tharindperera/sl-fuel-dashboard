"""Unit tests covering parsing, reconciliation, carry-forward, idempotency, validation, and KPI math."""

from __future__ import annotations

import copy
import json
import shutil
import tempfile
import time
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch

from scripts.config import CSV_HEADER, CSV_PATH, SL_TZ, UTC_TZ
from scripts.fetcher import (
    CurrentRateQuote,
    FetchError,
    parse_fuel_prices_payload,
    parse_historical_prices_payload,
    parse_marketing_sales_html_fallback,
    validate_price,
)
from scripts.kpis import (
    generate_all_kpis,
    parse_revisions_chronological,
)
from scripts.reconciler import (
    ValidationError,
    load_csv_rows,
    reconcile_updates,
    write_csv_atomic,
)
from scripts.update_fuel_prices import run_pipeline

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def _load_fixture_json(name: str) -> dict:
    with (FIXTURES_DIR / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


class TestParsing(unittest.TestCase):
    def test_parse_fuel_prices_payload(self) -> None:
        payload = _load_fixture_json("fuel_prices_active.json")
        quotes, warnings = parse_fuel_prices_payload(payload)
        self.assertEqual(len(quotes), 9)
        self.assertEqual(warnings, [])
        self.assertEqual(quotes["LP 92"].price, 424.0)
        self.assertEqual(quotes["LP 92"].effective_date, date(2026, 11, 2))
        self.assertEqual(quotes["LP 92"].effective_time, "00:00")
        self.assertEqual(quotes["LK"].effective_date, date(2026, 5, 30))
        self.assertEqual(quotes["FUR. 800"].category, "Black Oil")
        self.assertEqual(quotes["FUR 1500 (H)"].csv_column, "FUR 1500 (High)")
        self.assertEqual(quotes["FUR 1500 (L)"].csv_column, "FUR. 1500 (Low)")

    def test_parse_historical_prices_payload(self) -> None:
        payload = _load_fixture_json("historical_prices_active.json")
        rows = parse_historical_prices_payload(payload)
        self.assertEqual(len(rows), 185)
        self.assertEqual(rows[0].date_label, "02.11.2026")
        self.assertEqual(rows[0].parsed_date, date(2026, 11, 2))
        self.assertEqual(rows[0].values_by_csv_col["LP 95"], "490")
        self.assertEqual(rows[-1].date_label, "01.03.1990")

    def test_parse_sample_marketing_sales_html_fallback(self) -> None:
        html = (FIXTURES_DIR / "sample_marketing_sales.html").read_text(encoding="utf-8")
        quotes = parse_marketing_sales_html_fallback(html)
        self.assertEqual(len(quotes), 6)
        self.assertEqual(quotes["LAD"].price, 397.0)
        self.assertEqual(quotes["LAD"].effective_date, date(2026, 11, 2))
        self.assertEqual(quotes["LK"].effective_date, date(2026, 5, 30))
        self.assertEqual(quotes["LIK"].effective_date, date(2026, 7, 1))

    def test_validate_price_rejects_invalid_values(self) -> None:
        for bad in (0, -10, "0", "-5.5", "abc", None, True, 999999):
            with self.subTest(bad=bad):
                with self.assertRaises(FetchError):
                    validate_price(bad, "test")


class TestReconciliationAndIdempotency(unittest.TestCase):
    def setUp(self) -> None:
        self.existing_rows = load_csv_rows(CSV_PATH)
        self.fuel_payload = _load_fixture_json("fuel_prices_active.json")
        self.hist_payload = _load_fixture_json("historical_prices_active.json")

    def test_reconcile_ignores_stale_black_oil_and_adds_new_historical_row(self) -> None:
        quotes, _ = parse_fuel_prices_payload(self.fuel_payload)
        hist_rows = parse_historical_prices_payload(self.hist_payload)

        # Subset starting from 01.10.2026 so 02.11.2026 is guaranteed to be newer
        base_rows = [
            r for r in self.existing_rows if r["Date"] != "02.11.2026"
        ]
        res = reconcile_updates(base_rows, hist_rows, quotes)

        self.assertTrue(res.update_detected)
        self.assertEqual(len(res.added_rows), 1)
        self.assertEqual(res.added_rows[0]["Date"], "02.11.2026")
        # Stale Black Oil cards (332 on 2026-04-01) must NOT overwrite 322!
        self.assertEqual(res.added_rows[0]["FUR. 800"], "322")
        self.assertEqual(res.added_rows[0]["FUR 1500 (High)"], "322")
        self.assertEqual(res.added_rows[0]["FUR. 1500 (Low)"], "322")
        self.assertTrue(any("Black Oil" in w or "FUR." in w for w in res.warnings))

    def test_carry_forward_when_marketing_sales_updates_before_historical(self) -> None:
        quotes, _ = parse_fuel_prices_payload(self.fuel_payload)
        hist_rows = parse_historical_prices_payload(self.hist_payload)

        # Simulate marketing-sales publishing a new LP 92 & LAD price on 2026-11-25
        # before historical-prices updates.
        future_quotes = dict(quotes)
        future_quotes["LP 92"] = CurrentRateQuote(
            code="LP 92",
            csv_column="LP 92",
            full_name="Lanka Petrol 92 Octane",
            api_product_name="Lanka Petrol 92 Octane",
            category="White Oil",
            price=430.0,
            effective_date=date(2026, 11, 25),
            effective_time="00:00",
        )
        future_quotes["LAD"] = CurrentRateQuote(
            code="LAD",
            csv_column="LAD",
            full_name="Lanka Auto Diesel",
            api_product_name="Lanka Auto Diesel",
            category="White Oil",
            price=402.0,
            effective_date=date(2026, 11, 25),
            effective_time="00:00",
        )

        # First reconcile against historical up to 02.11.2026
        res_first = reconcile_updates(self.existing_rows, hist_rows, quotes)
        res_second = reconcile_updates(res_first.updated_rows, hist_rows, future_quotes)

        self.assertTrue(res_second.update_detected)
        newest = res_second.updated_rows[0]
        self.assertEqual(newest["Date"], "25.11.2026")
        self.assertEqual(newest["LP 92"], "430")
        self.assertEqual(newest["LAD"], "402")
        # Unchanged grades carried forward with zero blank cells (and Black Oil remains 322)
        self.assertEqual(newest["LP 95"], "490")
        self.assertEqual(newest["LK"], "285")
        self.assertEqual(newest["LIK"], "382")
        self.assertEqual(newest["FUR. 800"], "322")
        for col in CSV_HEADER[1:]:
            self.assertNotEqual(newest[col], "")

        # Idempotency: re-running with identical data adds zero rows
        res_repeat = reconcile_updates(res_second.updated_rows, hist_rows, future_quotes)
        self.assertFalse(res_repeat.update_detected)
        self.assertEqual(len(res_repeat.updated_rows), len(res_second.updated_rows))

    def test_atomic_csv_write_preserves_quoting_and_crlf(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_csv = Path(tmpdir) / "test.csv"
            sample_rows = self.existing_rows[:5]
            write_csv_atomic(tmp_csv, sample_rows)
            raw = tmp_csv.read_bytes()
            self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))
            self.assertEqual(raw.count(b"\r\n"), 6)
            self.assertTrue(raw.startswith(b'"Date","LP 95"'))
            reloaded = load_csv_rows(tmp_csv)
            self.assertEqual(reloaded, sample_rows)


class TestKpiMathAndPipelineModes(unittest.TestCase):
    def test_kpi_math_deltas_and_all_time_highs(self) -> None:
        # Synthetic 3-row descending dataset to verify exact KPI math
        rows = [
            {
                "Date": "01.03.2026",
                "LP 95": "500",
                "LP 92": "400",
                "LAD": "350",
                "LSD": "450",
                "LK": "280",
                "LIK": "300",
                "FUR. 800": "310",
                "FUR 1500 (High)": "310",
                "FUR. 1500 (Low)": "310",
            },
            {
                "Date": "01.01.2026",
                "LP 95": "550",
                "LP 92": "400",
                "LAD": "300",
                "LSD": "450",
                "LK": "280",
                "LIK": "300",
                "FUR. 800": "310",
                "FUR 1500 (High)": "310",
                "FUR. 1500 (Low)": "310",
            },
            {
                "Date": "01.12.2025",
                "LP 95": "550",
                "LP 92": "420",
                "LAD": "300",
                "LSD": "450",
                "LK": "250",
                "LIK": "300",
                "FUR. 800": "310",
                "FUR 1500 (High)": "",
                "FUR. 1500 (Low)": "310",
            },
        ]
        now_sl = datetime(2026, 3, 2, 12, 0, tzinfo=SL_TZ)
        now_utc = now_sl.astimezone(UTC_TZ)
        kpis = generate_all_kpis(rows, now_sl=now_sl, now_utc=now_utc, write_files=False)

        trends = kpis["trends_kpis"]
        self.assertEqual(trends["active_tracking_count"], 5)
        self.assertEqual(trends["latest_revision_date"], "2026-03-01")

        # LP 95 dropped 550 -> 500 (-50, -9.09%), all-time high tied on 2025-12-01 & 2026-01-01
        lp95 = trends["latest_tariffs"]["LP 95"]
        self.assertEqual(lp95["delta_lkr"], -50.0)
        self.assertEqual(lp95["delta_pct"], -9.09)
        self.assertEqual(lp95["status"], "decreased")
        self.assertEqual(lp95["last_changed_date"], "2026-03-01")
        self.assertEqual(lp95["days_since_last_change"], 0)
        self.assertEqual(trends["all_time_high"]["LP 95"]["price_lkr"], 550.0)
        self.assertEqual(
            trends["all_time_high"]["LP 95"]["dates"],
            ["2025-12-01", "2026-01-01"],
        )

        # LK stayed 280 from 2026-01-01 -> 2026-03-01 (no_change, 59 days since 2026-01-01)
        lk = trends["latest_tariffs"]["LK"]
        self.assertEqual(lk["status"], "no_change")
        self.assertEqual(lk["last_changed_date"], "2026-01-01")
        self.assertEqual(lk["days_since_last_change"], 59)

        # FUR 1500 (H) skips blank cell on 2025-12-01
        self.assertEqual(trends["all_time_low"]["FUR 1500 (H)"]["price_lkr"], 310.0)

        # Chart series chronological order oldest -> newest
        series = trends["chart_series"]
        self.assertEqual([s["date"] for s in series], ["2025-12-01", "2026-01-01", "2026-03-01"])
        self.assertIsNone(series[0]["pct_change"]["LP 95"])
        self.assertEqual(series[2]["pct_change"]["LP 95"], -9.09)

    def test_real_csv_kpis_and_dry_run_safety(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            tmp_csv = tmp_path / "cpc.csv"
            tmp_data = tmp_path / "data"
            shutil.copy2(CSV_PATH, tmp_csv)
            original_bytes = tmp_csv.read_bytes()

            # Dry-run should not write any files even on failure or success
            with patch("scripts.update_fuel_prices.fetch_ceypetco_sources", side_effect=FetchError("network down")):
                code = run_pipeline(dry_run=False, csv_path=tmp_csv, data_dir=tmp_data)
            self.assertEqual(code, 1)
            self.assertEqual(tmp_csv.read_bytes(), original_bytes)
            self.assertFalse(tmp_data.exists())

            # Rebuild KPIs offline
            code = run_pipeline(rebuild_kpis=True, csv_path=tmp_csv, data_dir=tmp_data)
            self.assertEqual(code, 0)
            self.assertTrue((tmp_data / "current_rates.json").exists())
            self.assertTrue((tmp_data / "archive_meta.json").exists())
            self.assertTrue((tmp_data / "trends_kpis.json").exists())
            self.assertTrue((tmp_data / "pipeline_status.json").exists())

            archive_meta = json.loads((tmp_data / "archive_meta.json").read_text(encoding="utf-8"))
            self.assertEqual(archive_meta["first_record_year"], 1990)
            self.assertEqual(archive_meta["available_years"][-1], 1990)
            self.assertEqual(len(archive_meta["products"]), 9)

    def test_unchanged_csv_run_refreshes_sync_timestamps(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            tmp_csv = tmp_path / "cpc.csv"
            tmp_data = tmp_path / "data"
            shutil.copy2(CSV_PATH, tmp_csv)

            # Seed initial KPIs & status
            self.assertEqual(run_pipeline(rebuild_kpis=True, csv_path=tmp_csv, data_dir=tmp_data), 0)
            first_status = json.loads((tmp_data / "pipeline_status.json").read_text(encoding="utf-8"))
            first_rates = json.loads((tmp_data / "current_rates.json").read_text(encoding="utf-8"))
            time.sleep(0.01)

            quotes, warnings = parse_fuel_prices_payload(_load_fixture_json("fuel_prices_active.json"))
            hist_rows = parse_historical_prices_payload(_load_fixture_json("historical_prices_active.json"))
            from scripts.fetcher import SourceFetchResult

            mock_result = SourceFetchResult(
                current_quotes=quotes,
                historical_rows=hist_rows,
                fuel_api_status={"url": "mock", "status": "ok", "http_status": 200, "records_count": 9, "error": None},
                historical_api_status={"url": "mock", "status": "ok", "http_status": 200, "records_count": 226, "fuel_records_count": 185, "error": None},
                warnings=warnings,
            )

            with patch("scripts.update_fuel_prices.fetch_ceypetco_sources", return_value=mock_result):
                code = run_pipeline(dry_run=False, csv_path=tmp_csv, data_dir=tmp_data)

            self.assertEqual(code, 0)
            second_status = json.loads((tmp_data / "pipeline_status.json").read_text(encoding="utf-8"))
            second_rates = json.loads((tmp_data / "current_rates.json").read_text(encoding="utf-8"))
            self.assertEqual(second_status["mode"], "update")
            self.assertFalse(second_status["update_applied"])
            self.assertGreater(second_status["last_run_utc"], first_status["last_run_utc"])
            self.assertGreater(second_rates["last_checked_utc"], first_rates["last_checked_utc"])


if __name__ == "__main__":
    unittest.main()
