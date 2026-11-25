"""Unit tests for monthly and annual fuel price aggregation rules."""

from __future__ import annotations

import unittest
from datetime import date, datetime

from scripts.aggregators import (
    apply_end_of_month_cutoff,
    build_annual_aggregated_payload,
    build_monthly_aggregated_payload,
)
from scripts.config import CSV_PATH, FUEL_PRODUCTS, SL_TZ, UTC_TZ
from scripts.kpis import parse_revisions_chronological
from scripts.reconciler import load_csv_rows


def _make_row(date_str: str, lp95: str, lp92: str = "300") -> dict[str, str]:
    row = {p.csv_column: lp92 for p in FUEL_PRODUCTS}
    row["Date"] = date_str
    row["LP 95"] = lp95
    return row


class TestMonthlyAndAnnualAggregators(unittest.TestCase):
    def test_end_of_month_cutoff_rules(self) -> None:
        # 31-day months: 30th and 31st roll to next month
        self.assertEqual(apply_end_of_month_cutoff(date(2026, 5, 31)), date(2026, 6, 1))
        self.assertEqual(apply_end_of_month_cutoff(date(2026, 8, 30)), date(2026, 9, 1))
        self.assertEqual(apply_end_of_month_cutoff(date(2026, 8, 31)), date(2026, 9, 1))
        self.assertEqual(apply_end_of_month_cutoff(date(2026, 12, 31)), date(2027, 1, 1))
        # 30-day months: 29th and 30th roll to next month
        self.assertEqual(apply_end_of_month_cutoff(date(2026, 6, 30)), date(2026, 7, 1))
        self.assertEqual(apply_end_of_month_cutoff(date(2026, 6, 29)), date(2026, 7, 1))
        # Feb non-leap & leap: final 2 days roll
        self.assertEqual(apply_end_of_month_cutoff(date(2026, 2, 28)), date(2026, 3, 1))
        self.assertEqual(apply_end_of_month_cutoff(date(2024, 2, 29)), date(2024, 3, 1))
        self.assertEqual(apply_end_of_month_cutoff(date(2024, 2, 28)), date(2024, 3, 1))
        # Start/mid month stays in same month
        self.assertEqual(apply_end_of_month_cutoff(date(2026, 10, 1)), date(2026, 10, 1))
        self.assertEqual(apply_end_of_month_cutoff(date(2026, 11, 2)), date(2026, 11, 2))
        self.assertEqual(apply_end_of_month_cutoff(date(2026, 5, 29)), date(2026, 5, 29))

    def test_monthly_rollover_averaging_carry_forward_and_annual(self) -> None:
        # Descending CSV rows (newest first):
        # - 01.05.2026: LP95=450 (start of May)
        # - 31.03.2026: LP95=400 (rolls to 01.04.2026 -> April!)
        # - 16.03.2026: LP95=360 (mid-March: Mar 1..15 at 300 [15d], Mar 16..31 at 360 [16d])
        # - 01.01.2026: LP95=300 (Jan & Feb carry forward 300 continuously)
        # - 01.12.2025: LP95=280 (prior year baseline)
        rows = [
            _make_row("01.05.2026", "450"),
            _make_row("31.03.2026", "400"),
            _make_row("16.03.2026", "360"),
            _make_row("01.01.2026", "300"),
            _make_row("01.12.2025", "280"),
        ]
        revisions = parse_revisions_chronological(rows)
        now_sl = datetime(2026, 6, 10, 12, 0, tzinfo=SL_TZ)
        now_utc = now_sl.astimezone(UTC_TZ)

        monthly = build_monthly_aggregated_payload(revisions, now_sl=now_sl, now_utc=now_utc)
        by_month = {m["month"]: m for m in monthly["months"]}

        # Continuous months from 2025-12 through 2026-06 (7 months)
        self.assertEqual(monthly["total_months"], 7)

        # Feb 2026: zero revisions, carried forward 300.0
        self.assertEqual(by_month["2026-02"]["prices"]["LP 95"], 300.0)
        self.assertEqual(by_month["2026-02"]["revisions_in_month"], 0)

        # Mar 2026: 15 days @ 300 + 16 days @ 360 = (4500 + 5760) / 31 = 330.97
        # 31.03.2026 rolled into April, so only 16.03.2026 is attributed to March!
        self.assertEqual(by_month["2026-03"]["revisions_in_month"], 1)
        self.assertEqual(by_month["2026-03"]["prices"]["LP 95"], 330.97)
        self.assertEqual(by_month["2026-03"]["simple_avg"]["LP 95"], 330.0)

        # Apr 2026: 31.03.2026 rolled to 01.04.2026 -> 400.0 for all 30 days
        self.assertEqual(by_month["2026-04"]["revisions_in_month"], 1)
        self.assertEqual(by_month["2026-04"]["prices"]["LP 95"], 400.0)

        # Jun 2026: current partial month carried forward 450.0
        self.assertTrue(by_month["2026-06"]["is_partial_month"])
        self.assertFalse(by_month["2026-05"]["is_partial_month"])
        self.assertEqual(by_month["2026-06"]["prices"]["LP 95"], 450.0)

        # Annual aggregation
        annual = build_annual_aggregated_payload(monthly, now_sl=now_sl, now_utc=now_utc)
        by_year = {y["year"]: y for y in annual["years"]}
        self.assertEqual(by_year[2025]["months_covered"], 1)
        self.assertEqual(by_year[2025]["grades"]["LP 95"]["avg_price"], 280.0)
        self.assertTrue(by_year[2026]["is_ytd"])
        self.assertEqual(by_year[2026]["months_covered"], 6)
        self.assertEqual(by_year[2026]["revisions_in_year"], 4)
        # Mean of Jan(300), Feb(300), Mar(330.97), Apr(400), May(450), Jun(450) = 371.83
        self.assertEqual(by_year[2026]["grades"]["LP 95"]["avg_price"], 371.83)
        self.assertEqual(by_year[2026]["grades"]["LP 95"]["min_price"], 300.0)
        self.assertEqual(by_year[2026]["grades"]["LP 95"]["max_price"], 450.0)
        self.assertEqual(by_year[2026]["grades"]["LP 95"]["yoy_pct_change"], 32.8)

    def test_real_csv_end_of_month_rollovers_2026(self) -> None:
        rows = load_csv_rows(CSV_PATH)
        revisions = parse_revisions_chronological(rows)
        now_sl = datetime(2026, 11, 25, 15, 0, tzinfo=SL_TZ)
        now_utc = now_sl.astimezone(UTC_TZ)

        monthly = build_monthly_aggregated_payload(revisions, now_sl=now_sl, now_utc=now_utc)
        by_month = {m["month"]: m for m in monthly["months"]}

        # 31.05.2026 (LP92=434) rolled to 2026-06; 30.06.2026 (LP92=414) rolled to 2026-07;
        # 31.08.2026 (LP92=399) rolled to 2026-09!
        self.assertEqual(by_month["2026-06"]["prices"]["LP 92"], 434.0)
        self.assertEqual(by_month["2026-07"]["prices"]["LP 92"], 414.0)
        self.assertEqual(by_month["2026-09"]["prices"]["LP 92"], 399.0)
        self.assertEqual(by_month["2026-10"]["prices"]["LP 92"], 414.0)
        self.assertTrue(by_month["2026-11"]["is_partial_month"])


if __name__ == "__main__":
    unittest.main()
