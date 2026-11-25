"""CSV loading, reconciliation across CEYPETCO sources, validation, and atomic persistence."""

from __future__ import annotations

import csv
import os
import re
import tempfile
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from scripts.config import (
    CSV_DATE_COLUMN,
    CSV_HEADER,
    FUEL_PRODUCTS,
    MAX_VALID_PRICE_LKR,
    MIN_VALID_PRICE_LKR,
)
from scripts.fetcher import CurrentRateQuote, HistoricalFuelRow, parse_csv_date_label


class ValidationError(ValueError):
    """Raised when CSV data or reconciled updates fail integrity checks."""


@dataclass(frozen=True)
class ReconciliationResult:
    """Outcome of reconciling existing CSV rows against live CEYPETCO data."""

    updated_rows: list[dict[str, str]]
    added_rows: list[dict[str, str]]
    warnings: list[str]

    @property
    def update_detected(self) -> bool:
        return len(self.added_rows) > 0


def format_price_for_csv(value: float) -> str:
    """Format a numeric price matching the existing CSV convention (no trailing .0)."""
    dec = Decimal(str(value)).normalize()
    if dec == dec.to_integral():
        return str(int(dec))
    text = format(dec, "f").rstrip("0").rstrip(".")
    return text


def parse_historical_numeric(raw_value: str, context: str = "") -> float | None:
    """Parse a CSV price cell into float, handling blank pre-2015 cells and '53.9.00' typos."""
    text = (raw_value or "").strip()
    if text == "":
        return None
    try:
        val = float(text)
    except ValueError:
        # Handle known historical typo like "53.9.00" -> 53.900
        parts = text.split(".")
        if len(parts) == 3 and all(p.isdigit() for p in parts):
            val = float(f"{parts[0]}.{parts[1]}{parts[2]}")
        else:
            raise ValidationError(f"Unparseable numeric cell {raw_value!r} ({context})")
    if val <= 0:
        raise ValidationError(f"Non-positive price {val} ({context})")
    return val


def load_csv_rows(csv_path: Path) -> list[dict[str, str]]:
    """Read the existing CPC CSV file and verify its exact schema."""
    if not csv_path.exists():
        raise ValidationError(f"CSV file not found: {csv_path}")

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        try:
            header = next(reader)
        except StopIteration as exc:
            raise ValidationError("CSV file is empty") from exc

        if header != CSV_HEADER:
            raise ValidationError(
                f"CSV header mismatch: got {header!r}, expected {CSV_HEADER!r}"
            )

        rows: list[dict[str, str]] = []
        for idx, raw_row in enumerate(reader, start=2):
            if len(raw_row) != len(CSV_HEADER):
                raise ValidationError(
                    f"CSV row {idx} has {len(raw_row)} columns, expected {len(CSV_HEADER)}"
                )
            row = dict(zip(CSV_HEADER, raw_row))
            parse_csv_date_label(row[CSV_DATE_COLUMN])
            rows.append(row)

    if not rows:
        raise ValidationError("CSV contains header only and zero data rows")
    return rows


def _prices_equal(a_str: str, b_val: float | str) -> bool:
    """Compare a CSV price string against a float or string numerically."""
    a_num = parse_historical_numeric(a_str)
    b_num = parse_historical_numeric(str(b_val)) if not isinstance(b_val, (int, float)) else float(b_val)
    if a_num is None or b_num is None:
        return a_num is b_num
    return abs(a_num - b_num) < 1e-6


def _row_matches_prices(row_a: dict[str, str], row_b: dict[str, str]) -> bool:
    """Return True if all 9 fuel grade columns match numerically."""
    return all(_prices_equal(row_a[col], row_b[col]) for col in CSV_HEADER[1:])


def _validate_new_row(row: dict[str, str]) -> None:
    """Strictly validate that a newly created CSV row has all 9 valid positive prices."""
    parse_csv_date_label(row[CSV_DATE_COLUMN])
    for col in CSV_HEADER[1:]:
        raw = row.get(col, "").strip()
        if raw == "":
            raise ValidationError(f"New row {row[CSV_DATE_COLUMN]} has blank price for {col}")
        try:
            dec = Decimal(raw)
        except InvalidOperation as exc:
            raise ValidationError(
                f"New row {row[CSV_DATE_COLUMN]} has non-numeric {col}={raw!r}"
            ) from exc
        num = float(dec)
        if num < MIN_VALID_PRICE_LKR or num > MAX_VALID_PRICE_LKR:
            raise ValidationError(
                f"New row {row[CSV_DATE_COLUMN]} price out of bounds for {col}: {num}"
            )


def reconcile_updates(
    existing_rows: list[dict[str, str]],
    historical_rows: list[HistoricalFuelRow],
    current_quotes: dict[str, CurrentRateQuote],
) -> ReconciliationResult:
    """
    Reconcile existing CSV rows with both CEYPETCO APIs:
    1. Prepend any newer complete rows from historical-prices/active (oldest-new to newest-new).
    2. If marketing-sales/fuel-prices/active has a revision strictly newer than the latest row
       (or newer price changes not yet in historical-prices), build a complete row carrying
       forward unchanged grades from the most recent known row.
    3. Guard against stale cards (e.g. Black Oil cards whose effectiveDate predates the latest
       historical revision) and enforce strict idempotency.
    """
    if not existing_rows:
        raise ValidationError("Cannot reconcile against empty existing CSV rows")

    warnings: list[str] = []
    added_rows: list[dict[str, str]] = []

    latest_csv_row = existing_rows[0]
    latest_csv_date = parse_csv_date_label(latest_csv_row[CSV_DATE_COLUMN])

    # Build a set of existing (date_label, price_signature) for idempotency on same-day entries.
    existing_signatures = {
        (
            row[CSV_DATE_COLUMN],
            tuple(parse_historical_numeric(row[col]) for col in CSV_HEADER[1:]),
        )
        for row in existing_rows
    }
    existing_dates = {parse_csv_date_label(row[CSV_DATE_COLUMN]) for row in existing_rows}

    # Step 1: Collect historical rows newer than (or missing same-date additional entry for) latest_csv_date.
    candidate_hist_rows: list[HistoricalFuelRow] = []
    for h_row in historical_rows:
        if h_row.parsed_date > latest_csv_date:
            candidate_hist_rows.append(h_row)
        elif h_row.parsed_date == latest_csv_date:
            sig = (
                h_row.date_label,
                tuple(parse_historical_numeric(h_row.values_by_csv_col[col]) for col in CSV_HEADER[1:]),
            )
            if sig not in existing_signatures and not _row_matches_prices(
                {**h_row.values_by_csv_col, CSV_DATE_COLUMN: h_row.date_label},
                latest_csv_row,
            ):
                candidate_hist_rows.append(h_row)
        else:
            # historical_rows is sorted descending by sort_key; stop once older than latest_csv_date.
            break

    # Apply candidate historical rows from oldest-new to newest-new so sort order stays descending.
    working_rows = list(existing_rows)
    for h_row in reversed(candidate_hist_rows):
        new_row = {CSV_DATE_COLUMN: h_row.date_label}
        for col in CSV_HEADER[1:]:
            val = h_row.values_by_csv_col.get(col, "").strip()
            if val == "":
                # Carry forward from latest known row if archive omitted an active product.
                val = working_rows[0][col]
                warnings.append(
                    f"Carried forward {col}={val} into historical row {h_row.date_label}"
                )
            new_row[col] = val

        _validate_new_row(new_row)
        working_rows.insert(0, new_row)
        added_rows.insert(0, new_row)
        existing_dates.add(h_row.parsed_date)

    # Step 2: Reconcile against marketing-sales (`fuel-prices/active`) for newly published retail updates.
    current_latest_row = working_rows[0]
    current_latest_date = parse_csv_date_label(current_latest_row[CSV_DATE_COLUMN])

    newer_quotes: list[CurrentRateQuote] = []
    stale_mismatches: list[str] = []

    for spec in FUEL_PRODUCTS:
        quote = current_quotes.get(spec.code)
        if quote is None:
            continue

        csv_price_matches = _prices_equal(current_latest_row[spec.csv_column], quote.price)
        if quote.effective_date > current_latest_date:
            newer_quotes.append(quote)
        elif quote.effective_date == current_latest_date and not csv_price_matches:
            # Same-day revision published on marketing-sales before historical-prices updated.
            newer_quotes.append(quote)
        elif quote.effective_date < current_latest_date and not csv_price_matches:
            # Known CEYPETCO CMS behavior: e.g. Black Oil cards on fuel-prices/active left at
            # an older effectiveDate (2026-04-01) while historical-prices updated later (322).
            stale_mismatches.append(
                f"{spec.code}: fuel-prices API shows {quote.price} (effective {quote.effective_date}), "
                f"ignored because historical/CSV has {current_latest_row[spec.csv_column]} "
                f"(latest revision {current_latest_date})"
            )

    warnings.extend(stale_mismatches)

    if newer_quotes:
        target_date = max(q.effective_date for q in newer_quotes)
        date_str = target_date.strftime("%d.%m.%Y")
        if target_date in existing_dates and target_date == current_latest_date:
            # Same-date intraday update not yet in historical-prices: label uniquely with time if available.
            max_time = max(
                (q.effective_time for q in newer_quotes if q.effective_date == target_date),
                default="00:00",
            )
            date_str = f"{date_str} ({max_time})" if max_time != "00:00" else f"{date_str} (Updated)"

        new_row = {CSV_DATE_COLUMN: date_str}
        # Start by carrying forward all 9 grades from the latest confirmed row.
        for col in CSV_HEADER[1:]:
            new_row[col] = current_latest_row[col]

        # Apply only quotes whose effective_date >= target_date or == current_latest_date (changed).
        for quote in newer_quotes:
            new_row[quote.csv_column] = format_price_for_csv(quote.price)

        _validate_new_row(new_row)

        # Idempotency guard: only prepend if prices differ or date_str isn't already the top row.
        if not (
            new_row[CSV_DATE_COLUMN] == current_latest_row[CSV_DATE_COLUMN]
            and _row_matches_prices(new_row, current_latest_row)
        ):
            working_rows.insert(0, new_row)
            added_rows.insert(0, new_row)

    # Final integrity verification: row count never shrinks and latest row has all 9 valid prices.
    if len(working_rows) < len(existing_rows):
        raise ValidationError("Row count decreased during reconciliation")
    _validate_new_row(working_rows[0])

    return ReconciliationResult(
        updated_rows=working_rows,
        added_rows=added_rows,
        warnings=warnings,
    )


def write_csv_atomic(csv_path: Path, rows: list[dict[str, str]]) -> None:
    """Write CSV atomically preserving exact quoting (QUOTE_ALL) and CRLF line endings."""
    if not rows:
        raise ValidationError("Refusing to write empty CSV")

    csv_path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=".cpc_tmp_", suffix=".csv", dir=str(csv_path.parent)
    )
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(
                handle,
                quoting=csv.QUOTE_ALL,
                lineterminator="\r\n",
            )
            writer.writerow(CSV_HEADER)
            for row in rows:
                writer.writerow([row[col] for col in CSV_HEADER])
        os.replace(tmp_path, csv_path)
    except Exception:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise
