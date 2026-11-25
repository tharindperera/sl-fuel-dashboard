"""CLI entrypoint for the daily CPC Fuel Trends scraper, CSV reconciler, and KPI generator."""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Sequence

from scripts.config import (
    ARCHIVE_META_JSON,
    CSV_DATE_COLUMN,
    CSV_HEADER,
    CSV_PATH,
    CURRENT_RATES_JSON,
    DATA_DIR,
    FUEL_PRICES_API_URL,
    HISTORICAL_PRICES_API_URL,
    PIPELINE_STATUS_JSON,
    SL_TZ,
    TRENDS_KPIS_JSON,
    UTC_TZ,
)
from scripts.fetcher import FetchError, fetch_ceypetco_sources, parse_csv_date_label
from scripts.kpis import (
    build_pipeline_status_payload,
    generate_all_kpis,
    write_pipeline_status,
)
from scripts.reconciler import (
    ValidationError,
    load_csv_rows,
    reconcile_updates,
    write_csv_atomic,
)

logger = logging.getLogger("cpc_pipeline")


def configure_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


def _format_diff_preview(
    previous_latest: dict[str, str],
    added_rows: list[dict[str, str]],
) -> str:
    """Create a readable diff summary for --dry-run and logging."""
    if not added_rows:
        return (
            f"No price updates detected. Latest CSV revision remains "
            f"{previous_latest[CSV_DATE_COLUMN]}."
        )

    lines = [
        f"Detected {len(added_rows)} new revision(s) (previous latest: {previous_latest[CSV_DATE_COLUMN]}):"
    ]
    newest = added_rows[0]
    for row in reversed(added_rows):
        lines.append(f"  + Row {row[CSV_DATE_COLUMN]}: " + ", ".join(f"{c}={row[c]}" for c in CSV_HEADER[1:]))

    lines.append(f"Grade deltas ({previous_latest[CSV_DATE_COLUMN]} -> {newest[CSV_DATE_COLUMN]}):")
    for col in CSV_HEADER[1:]:
        old_val = previous_latest[col]
        new_val = newest[col]
        marker = "CHANGED" if old_val != new_val else "carried"
        lines.append(f"  - {col:16s}: {old_val:>6s} -> {new_val:>6s} ({marker})")
    return "\n".join(lines)


def _kpis_missing(data_dir: Path) -> bool:
    return not all(
        (data_dir / p.name).exists()
        for p in (CURRENT_RATES_JSON, ARCHIVE_META_JSON, TRENDS_KPIS_JSON)
    )


def run_pipeline(
    *,
    dry_run: bool = False,
    rebuild_kpis: bool = False,
    csv_path: Path = CSV_PATH,
    data_dir: Path = DATA_DIR,
) -> int:
    """Execute the pipeline and return a process exit code (0 = success, 1 = failure)."""
    now_sl = datetime.now(SL_TZ)
    now_utc = now_sl.astimezone(UTC_TZ)

    try:
        existing_rows = load_csv_rows(csv_path)
    except ValidationError as exc:
        logger.error("Failed to load existing CSV %s: %s", csv_path, exc)
        return 1

    latest_csv_iso = parse_csv_date_label(existing_rows[0][CSV_DATE_COLUMN]).isoformat()

    if rebuild_kpis:
        logger.info("Rebuilding dashboard KPI JSON files from %s (%d rows)...", csv_path, len(existing_rows))
        kpis = generate_all_kpis(
            existing_rows,
            data_dir=data_dir,
            now_sl=now_sl,
            now_utc=now_utc,
            write_files=not dry_run,
        )
        status_payload = build_pipeline_status_payload(
            now_sl=now_sl,
            now_utc=now_utc,
            mode="dry-run-rebuild-kpis" if dry_run else "rebuild-kpis",
            fuel_api_status={"url": FUEL_PRICES_API_URL, "status": "skipped", "http_status": None, "records_count": None, "error": None},
            historical_api_status={"url": HISTORICAL_PRICES_API_URL, "status": "skipped", "http_status": None, "records_count": None, "fuel_records_count": None, "error": None},
            update_applied=False,
            new_revisions_added=[],
            total_csv_rows=len(existing_rows),
            latest_revision_date=kpis["archive_meta"]["latest_record_date"],
            warnings=[],
        )
        if not dry_run:
            write_pipeline_status(status_payload, data_dir / PIPELINE_STATUS_JSON.name)
            logger.info("Rebuilt KPIs and pipeline_status.json in %s", data_dir)
        else:
            logger.info("[DRY RUN] Validated KPI rebuild (%d revisions); no files written.", len(existing_rows))
        return 0

    try:
        fetch_result = fetch_ceypetco_sources()
    except FetchError as exc:
        logger.error("Scrape failed; preserving existing CSV and KPIs untouched: %s", exc)
        return 1

    try:
        reconciliation = reconcile_updates(
            existing_rows=existing_rows,
            historical_rows=fetch_result.historical_rows,
            current_quotes=fetch_result.current_quotes,
        )
    except ValidationError as exc:
        logger.error("Validation failed; preserving existing CSV and KPIs untouched: %s", exc)
        return 1

    all_warnings = list(fetch_result.warnings) + list(reconciliation.warnings)
    for w in all_warnings:
        logger.warning("%s", w)

    diff_summary = _format_diff_preview(existing_rows[0], reconciliation.added_rows)
    print(diff_summary)

    # Validate KPI generation in-memory even during --dry-run before touching disk.
    kpis = generate_all_kpis(
        reconciliation.updated_rows,
        data_dir=data_dir,
        current_quotes=fetch_result.current_quotes,
        now_sl=now_sl,
        now_utc=now_utc,
        write_files=False,
    )
    new_dates = [r[CSV_DATE_COLUMN] for r in reconciliation.added_rows]
    latest_iso = kpis["archive_meta"]["latest_record_date"]

    if dry_run:
        logger.info("[DRY RUN] Validation succeeded (%d total rows). No files modified.", len(reconciliation.updated_rows))
        return 0

    need_kpi_write = reconciliation.update_detected or _kpis_missing(data_dir)
    if reconciliation.update_detected:
        write_csv_atomic(csv_path, reconciliation.updated_rows)
        logger.info("Updated %s with %d new row(s); total rows: %d", csv_path, len(reconciliation.added_rows), len(reconciliation.updated_rows))

    if need_kpi_write:
        generate_all_kpis(
            reconciliation.updated_rows,
            data_dir=data_dir,
            current_quotes=fetch_result.current_quotes,
            now_sl=now_sl,
            now_utc=now_utc,
            write_files=True,
        )
        logger.info("Wrote KPI JSON files to %s", data_dir)
    else:
        logger.info("No CSV update detected and KPI JSONs already exist; skipping CSV/KPI file writes.")

    status_payload = build_pipeline_status_payload(
        now_sl=now_sl,
        now_utc=now_utc,
        mode="update",
        fuel_api_status=fetch_result.fuel_api_status,
        historical_api_status=fetch_result.historical_api_status,
        update_applied=reconciliation.update_detected,
        new_revisions_added=new_dates,
        total_csv_rows=len(reconciliation.updated_rows),
        latest_revision_date=latest_iso if need_kpi_write else latest_csv_iso,
        warnings=all_warnings,
    )
    write_pipeline_status(status_payload, data_dir / PIPELINE_STATUS_JSON.name)
    return 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="CPC Fuel Trends automated scraper, CSV reconciler, and KPI generator."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch, parse, reconcile, and validate without writing any files.",
    )
    parser.add_argument(
        "--rebuild-kpis",
        action="store_true",
        help="Rebuild all JSON KPI files from the existing CSV without scraping.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug logging.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    configure_logging(verbose=args.verbose)
    return run_pipeline(dry_run=args.dry_run, rebuild_kpis=args.rebuild_kpis)


if __name__ == "__main__":
    sys.exit(main())
