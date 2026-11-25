import type {
  ArchiveMetaData,
  ArchiveRow,
  ChartSeriesPoint,
  CurrentRatesData,
  PipelineStatusData,
  TrendsKpisData,
} from "../types/fuel";
import { parseCsvDateInfo, parseHistoricalCell } from "./formatters";

function assetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || "./";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${relativePath.replace(/^\/+/, "")}`;
}

async function fetchJson<T>(relativePath: string): Promise<T> {
  const response = await fetch(assetUrl(relativePath), { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load ${relativePath} (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

/**
 * RFC-4180 CSV line parser supporting quoted commas and escaped double quotes.
 */
function parseCsvMatrix(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  const clean = csvText.replace(/^\uFEFF/, "");

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      currentRow.push(currentField);
      currentField = "";
    } else if (ch === "\r") {
      if (clean[i + 1] === "\n") i += 1;
      currentRow.push(currentField);
      if (currentRow.length > 1 || currentRow[0] !== "") {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else if (ch === "\n") {
      currentRow.push(currentField);
      if (currentRow.length > 1 || currentRow[0] !== "") {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

export async function fetchCurrentRates(): Promise<CurrentRatesData> {
  return fetchJson<CurrentRatesData>("data/current_rates.json");
}

export async function fetchPipelineStatus(): Promise<PipelineStatusData> {
  return fetchJson<PipelineStatusData>("data/pipeline_status.json");
}

export async function fetchTrendsKpis(): Promise<TrendsKpisData> {
  return fetchJson<TrendsKpisData>("data/trends_kpis.json");
}

export function exportChartSeriesToCsv(
  points: ChartSeriesPoint[],
  codes: string[],
  metric: "val" | "pct",
  filename: string
): void {
  const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const suffix = metric === "val" ? "(LKR)" : "(% Change)";
  const header = [
    escapeCell("Date"),
    escapeCell("Revision Label"),
    ...codes.map((c) => escapeCell(`${c} ${suffix}`)),
  ].join(",");

  const lines = points.map((pt) => {
    const source = metric === "val" ? pt.prices : pt.pct_change;
    return [
      escapeCell(pt.date),
      escapeCell(pt.date_label),
      ...codes.map((c) => {
        const val = source[c];
        return escapeCell(val === null || val === undefined ? "" : String(val));
      }),
    ].join(",");
  });

  const content = [header, ...lines].join("\r\n") + "\r\n";
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function fetchArchiveBundle(): Promise<{
  meta: ArchiveMetaData;
  headers: string[];
  rows: ArchiveRow[];
}> {
  const [meta, csvResponse] = await Promise.all([
    fetchJson<ArchiveMetaData>("data/archive_meta.json"),
    fetch(assetUrl("cpc_petroleum_prices_original.csv"), { cache: "no-cache" }),
  ]);

  if (!csvResponse.ok) {
    throw new Error(`Failed to load CSV archive (HTTP ${csvResponse.status})`);
  }

  const csvText = await csvResponse.text();
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    throw new Error("CSV archive is empty");
  }

  const headers = matrix[0];
  const valueCols = headers.slice(1);

  const rows: ArchiveRow[] = matrix.slice(1).map((cells, idx) => {
    const dateLabel = cells[0] ?? "";
    const { isoDate, year } = parseCsvDateInfo(dateLabel);
    const rawValues: Record<string, string> = {};
    const numericValues: Record<string, number | null> = {};

    valueCols.forEach((col, colIdx) => {
      const raw = cells[colIdx + 1] ?? "";
      rawValues[col] = raw;
      numericValues[col] = parseHistoricalCell(raw);
    });

    return {
      id: `${idx}-${dateLabel}`,
      index: idx,
      dateLabel,
      isoDate,
      year,
      isLatest: idx === 0,
      rawValues,
      numericValues,
    };
  });

  return { meta, headers, rows };
}

export function exportRowsToCsv(
  rows: ArchiveRow[],
  columns: { csvColumn: string; label: string }[],
  filename: string
): void {
  const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const headerLine = [escapeCell("Date"), ...columns.map((c) => escapeCell(c.csvColumn))].join(",");
  const bodyLines = rows.map((row) =>
    [
      escapeCell(row.dateLabel),
      ...columns.map((c) => escapeCell(row.rawValues[c.csvColumn] ?? "")),
    ].join(",")
  );
  const content = [headerLine, ...bodyLines].join("\r\n") + "\r\n";

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
