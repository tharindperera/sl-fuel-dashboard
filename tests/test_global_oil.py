"""Unit tests for global crude oil FRED parsing, KPIs, anomaly detection, and fallback AI summary."""

from __future__ import annotations

import unittest
from datetime import datetime

from scripts.generate_oil_ai_summary import (
    build_deterministic_summary,
    detect_brent_anomaly,
    parse_rss_items,
)
from scripts.oil_config import UTC_TZ
from scripts.update_global_oil import (
    OilFetchError,
    PricePoint,
    build_global_oil_outputs,
    merge_provisional_points,
    parse_fred_csv,
    parse_oilprice_payload,
    parse_yahoo_chart_payload,
)


class TestGlobalOilPipeline(unittest.TestCase):
    def test_parse_fred_csv_skips_missing_dots_and_sorts(self) -> None:
        sample = (
            "observation_date,DCOILBRENTEU\n"
            "2026-11-14,90.50\n"
            "2026-11-15,.\n"
            "2026-11-13,89.10\n"
            "2026-11-16,-5.0\n"
        )
        pts = parse_fred_csv(sample, "DCOILBRENTEU")
        self.assertEqual([p.time for p in pts], ["2026-11-13", "2026-11-14"])
        self.assertEqual([p.value for p in pts], [89.10, 90.50])

    def test_parse_fred_csv_rejects_insufficient_points(self) -> None:
        with self.assertRaises(OilFetchError):
            parse_fred_csv("observation_date,DCOILBRENTEU\n2026-11-14,.\n", "DCOILBRENTEU")

    def test_anomaly_detection_surge_drop_and_normal(self) -> None:
        base = [PricePoint(time=f"2026-10-{i:02d}", value=80.0 + (i % 3) * 0.2) for i in range(1, 32)]

        # Normal move (+0.5%)
        normal_pts = base + [PricePoint(time="2026-11-01", value=base[-1].value * 1.005)]
        normal = detect_brent_anomaly(normal_pts)
        self.assertEqual(normal.alert_level, "normal")

        # Steep daily surge (+3.5%)
        surge_pts = base + [PricePoint(time="2026-11-01", value=base[-1].value * 1.035)]
        surge = detect_brent_anomaly(surge_pts)
        self.assertEqual(surge.alert_level, "surge")
        self.assertGreaterEqual(surge.daily_change_pct, 2.5)

        # Steep 5-day drop (-6.0% across 5 sessions even if final day is -1.5%)
        drop_base = base[:-4] + [
            PricePoint(time="2026-10-28", value=79.0),
            PricePoint(time="2026-10-29", value=78.0),
            PricePoint(time="2026-10-30", value=77.0),
            PricePoint(time="2026-10-31", value=76.0),
            PricePoint(time="2026-11-01", value=74.8),
        ]
        drop = detect_brent_anomaly(drop_base)
        self.assertEqual(drop.alert_level, "drop")
        self.assertLessEqual(drop.change_5d_pct, -5.0)

    def test_build_outputs_and_fallback_summary(self) -> None:
        from datetime import date, timedelta

        start = date(2025, 1, 1)
        brent = [PricePoint(time=(start + timedelta(days=i)).isoformat(), value=75.0 + (i % 10) * 0.4) for i in range(400)]
        brent[-1] = PricePoint(time=brent[-1].time, value=82.50)

        series_map = {
            "brent": brent,
            "wti": [PricePoint(time=p.time, value=p.value - 3.5) for p in brent],
            "natgas": [PricePoint(time=p.time, value=3.2) for p in brent],
            "gasoline": [PricePoint(time=p.time, value=2.45) for p in brent],
            "heating_oil": [PricePoint(time=p.time, value=3.55) for p in brent],
        }
        now_utc = datetime(2026, 11, 25, 9, 0, tzinfo=UTC_TZ)
        kpis, history = build_global_oil_outputs(series_map, now_utc=now_utc)

        self.assertEqual(kpis["actual_price"], 82.5)
        self.assertEqual(kpis["unit"], "USD / BBL")
        self.assertEqual(len(kpis["comparison_table"]), 5)
        self.assertTrue(any(r["is_primary"] and r["id"] == "brent" for r in kpis["comparison_table"]))
        self.assertIn("projected_price", kpis["trend_outlook"])
        self.assertEqual(len(history["series"]["brent"]), 400)

        anomaly = detect_brent_anomaly(brent)
        summary = build_deterministic_summary(
            anomaly,
            kpis,
            [{"title": "Brent Steady on Inventory Data", "url": "https://example.com/1"}],
            now_utc=now_utc,
        )
        self.assertEqual(summary["generation_mode"], "deterministic")
        self.assertEqual(len(summary["paragraphs"]), 3)
        self.assertGreaterEqual(len(summary["driver_tags"]), 3)

    def test_parse_rss_items(self) -> None:
        rss = """<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel>
          <item><title>EIA Crude Stock Report</title><link>https://www.eia.gov/1</link></item>
          <item><title>Brent Supply Update</title><link>https://www.eia.gov/2</link></item>
        </channel></rss>"""
        items = parse_rss_items(rss, limit=5)
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["title"], "EIA Crude Stock Report")

    def test_parse_yahoo_chart_payload_extracts_bars_and_live_quote(self) -> None:
        # 2026-11-25 05:00 UTC (= 00:00 EST) and 2026-11-26 05:00 UTC, plus live quote on 2026-11-27 04:20 UTC
        ts_nov25 = int(datetime(2026, 11, 25, 5, 0, tzinfo=UTC_TZ).timestamp())
        ts_nov26 = int(datetime(2026, 11, 26, 5, 0, tzinfo=UTC_TZ).timestamp())
        ts_live27 = int(datetime(2026, 11, 27, 4, 20, tzinfo=UTC_TZ).timestamp())
        payload = {
            "chart": {
                "result": [
                    {
                        "meta": {
                            "currency": "USD",
                            "exchangeTimezoneName": "America/New_York",
                            "regularMarketPrice": 96.52,
                            "regularMarketTime": ts_live27,
                        },
                        "timestamp": [ts_nov25, ts_nov26],
                        "indicators": {"quote": [{"close": [94.61, 96.57]}]},
                    }
                ]
            }
        }
        pts = parse_yahoo_chart_payload(payload, decimals=2)
        self.assertEqual([(p.time, p.value) for p in pts], [
            ("2026-11-25", 94.61),
            ("2026-11-26", 96.57),
            ("2026-11-27", 96.52),
        ])

        non_usd = {
            "chart": {"result": [{"meta": {"currency": "EUR"}, "timestamp": [ts_nov25], "indicators": {"quote": [{"close": [90.0]}]}}]}
        }
        self.assertEqual(parse_yahoo_chart_payload(non_usd), [])

    def test_parse_oilprice_payload_demo_and_single(self) -> None:
        demo_payload = {
            "status": "success",
            "data": {
                "prices": [
                    {"code": "WTI_USD", "price": 84.10, "currency": "USD", "updated_at": "2026-11-26T18:00:00Z"},
                    {"code": "BRENT_CRUDE_USD", "price": 96.57, "currency": "USD", "updated_at": "2026-11-26T18:00:00Z"},
                ]
            },
        }
        brent = parse_oilprice_payload(demo_payload, "BRENT_CRUDE_USD", decimals=2)
        self.assertEqual(brent, PricePoint(time="2026-11-26", value=96.57))

        single_payload = {
            "status": "success",
            "data": {"code": "WTI_USD", "price": 84.55, "currency": "USD", "updated_at": "2026-11-27T03:00:00Z"},
        }
        wti = parse_oilprice_payload(single_payload, "WTI_USD", decimals=2)
        self.assertEqual(wti, PricePoint(time="2026-11-27", value=84.55))

    def test_merge_provisional_points_and_official_reconciliation(self) -> None:
        official_lagging = [
            PricePoint(time="2026-11-23", value=91.20),
            PricePoint(time="2026-11-24", value=91.80),
        ]
        market_pts = [
            PricePoint(time="2026-11-24", value=93.00),  # Must NOT overwrite official Nov 24
            PricePoint(time="2026-11-25", value=94.61),  # Appended interim
            PricePoint(time="2026-11-26", value=96.57),  # Appended interim
            PricePoint(time="2026-11-27", value=999.0),  # Rejected outlier (> 1.6x)
        ]
        merged = merge_provisional_points(official_lagging, market_pts, decimals=2)
        self.assertEqual(
            [(p.time, p.value) for p in merged],
            [
                ("2026-11-23", 91.20),
                ("2026-11-24", 91.80),
                ("2026-11-25", 94.61),
                ("2026-11-26", 96.57),
            ],
        )

        # Simulate FRED/EIA catching up later through Nov 27 (skipping Nov 26 Thanksgiving):
        # All dates <= 2026-11-27 automatically reconcile to official values with zero duplicate/stale interim rows.
        official_caught_up = [
            PricePoint(time="2026-11-23", value=91.20),
            PricePoint(time="2026-11-24", value=91.80),
            PricePoint(time="2026-11-25", value=94.15),
            PricePoint(time="2026-11-27", value=95.88),
        ]
        reconciled = merge_provisional_points(official_caught_up, market_pts[:-1], decimals=2)
        self.assertEqual(reconciled, official_caught_up)

    def test_build_outputs_with_provisional_metadata(self) -> None:
        from datetime import date, timedelta

        start = date(2025, 10, 1)
        base = [PricePoint(time=(start + timedelta(days=i)).isoformat(), value=80.0 + (i % 5)) for i in range(420)]
        series_map = {
            "brent": base,
            "wti": [PricePoint(time=p.time, value=p.value - 4.0) for p in base],
            "natgas": [PricePoint(time=p.time, value=3.2) for p in base],
            "gasoline": [PricePoint(time=p.time, value=2.4) for p in base],
            "heating_oil": [PricePoint(time=p.time, value=3.5) for p in base],
        }
        official_latest = base[-3].time
        kpis, history = build_global_oil_outputs(
            series_map,
            now_utc=datetime(2026, 11, 27, 4, 0, tzinfo=UTC_TZ),
            official_latest_dates={cid: official_latest for cid in series_map},
            provisional_sources={"brent": "Market Futures (ICE/NYMEX via Yahoo Finance)"},
        )
        self.assertTrue(kpis["has_provisional_data"])
        self.assertEqual(kpis["official_latest_date"], official_latest)
        self.assertEqual(kpis["latest_observation_date"], base[-1].time)
        self.assertEqual(kpis["provisional_source"], "Market Futures (ICE/NYMEX via Yahoo Finance)")
        brent_row = next(r for r in kpis["comparison_table"] if r["id"] == "brent")
        self.assertTrue(brent_row["is_provisional"])
        wti_row = next(r for r in kpis["comparison_table"] if r["id"] == "wti")
        self.assertTrue(wti_row["is_provisional"])
        self.assertIsNone(wti_row["provisional_source"])
        self.assertEqual(history["official_latest_dates"]["brent"], official_latest)


if __name__ == "__main__":
    unittest.main()
