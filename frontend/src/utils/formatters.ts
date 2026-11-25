/**
 * Formatting helpers with Sri Lanka (Asia/Colombo) timezone awareness and
 * historical CSV edge-case support.
 */

export function formatLkr(value: number, decimals = 2): string {
  return value.toLocaleString("en-LK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDeltaRs(delta: number): string {
  const abs = Math.abs(delta);
  const formatted = Number.isInteger(abs)
    ? abs.toLocaleString("en-LK")
    : abs.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (delta > 0) return `+Rs ${formatted}`;
  if (delta < 0) return `-Rs ${formatted}`;
  return "No change";
}

export function formatIsoToDisplayDate(isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function formatColomboTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return isoTimestamp;

  const datePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);

  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);

  return `${datePart} · ${timePart} SLST`;
}

export function parseCsvDateInfo(dateLabel: string): { isoDate: string; year: number } {
  const match = dateLabel.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) {
    return { isoDate: dateLabel, year: 0 };
  }
  const [, day, month, yearStr] = match;
  return {
    isoDate: `${yearStr}-${month}-${day}`,
    year: Number.parseInt(yearStr, 10),
  };
}

export function parseHistoricalCell(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const direct = Number(trimmed);
  if (Number.isFinite(direct)) return direct;
  // Handle historical archive typo like "53.9.00" -> 53.9
  const parts = trimmed.split(".");
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    const recovered = Number(`${parts[0]}.${parts[1]}${parts[2]}`);
    if (Number.isFinite(recovered)) return recovered;
  }
  return null;
}

export function formatArchiveCell(raw: string, numeric: number | null): string {
  if (!raw.trim()) return "—";
  if (numeric === null) return raw.trim();
  if (Number.isInteger(numeric)) return String(numeric);
  // Show clean decimals without artifacts (e.g. 9.85, 12.5, 53.9)
  return String(Number(numeric.toFixed(2)));
}

export function matchesDateQuery(dateLabel: string, isoDate: string, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const normalizedLabel = dateLabel.toLowerCase();
  const dashDate = normalizedLabel.replace(/\./g, "-");
  return (
    normalizedLabel.includes(q) ||
    dashDate.includes(q) ||
    isoDate.toLowerCase().includes(q)
  );
}
