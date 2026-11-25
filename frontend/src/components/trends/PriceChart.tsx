import { useId, useMemo, useState } from "react";
import { AreaChart, Download, LineChart, Percent, Banknote } from "lucide-react";
import type { ChartSeriesPoint } from "../../types/fuel";
import { exportChartSeriesToCsv } from "../../utils/dataLoader";
import { ALL_GRADE_CODES, getGradeVisual } from "../../utils/gradeMeta";

interface PriceChartProps {
  series: ChartSeriesPoint[];
  coreRetailCodes: string[];
  latestRevisionDate: string;
}

type ChartMetric = "val" | "pct";
type ChartView = "line" | "area";

function subtractMonthsIso(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - months, d));
  return dt.toISOString().slice(0, 10);
}

function buildNiceTicks(minVal: number, maxVal: number, count = 6): number[] {
  if (minVal === maxVal) {
    const pad = Math.max(Math.abs(minVal) * 0.1, 10);
    minVal -= pad;
    maxVal += pad;
  }
  const span = maxVal - minVal;
  const rawStep = span / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  let niceStep = mag;
  if (norm > 5) niceStep = 10 * mag;
  else if (norm > 2) niceStep = 5 * mag;
  else if (norm > 1) niceStep = 2 * mag;

  const start = Math.floor(minVal / niceStep) * niceStep;
  const end = Math.ceil(maxVal / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = start; v <= end + niceStep * 0.001; v += niceStep) {
    ticks.push(Number(v.toFixed(2)));
  }
  return ticks;
}

export function PriceChart({ series, coreRetailCodes, latestRevisionDate }: PriceChartProps) {
  const uid = useId().replace(/:/g, "");
  const defaultStart = useMemo(() => subtractMonthsIso(latestRevisionDate, 12), [latestRevisionDate]);

  const [metric, setMetric] = useState<ChartMetric>("val");
  const [view, setView] = useState<ChartView>("line");
  const [fuelScope, setFuelScope] = useState<string>("core");
  const [rangePreset, setRangePreset] = useState<string>("12m");
  const [draftStart, setDraftStart] = useState<string>(defaultStart);
  const [draftEnd, setDraftEnd] = useState<string>(latestRevisionDate);
  const [appliedStart, setAppliedStart] = useState<string>(defaultStart);
  const [appliedEnd, setAppliedEnd] = useState<string>(latestRevisionDate);
  const [hiddenCodes, setHiddenCodes] = useState<Record<string, boolean>>({});
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const pt of series) {
      years.add(pt.date.slice(0, 4));
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [series]);

  const scopeCodes = useMemo(() => {
    if (fuelScope === "core") return coreRetailCodes;
    if (fuelScope === "all") return [...ALL_GRADE_CODES];
    return [fuelScope];
  }, [fuelScope, coreRetailCodes]);

  const visibleCodes = useMemo(
    () => scopeCodes.filter((code) => !hiddenCodes[code]),
    [scopeCodes, hiddenCodes]
  );

  const filteredPoints = useMemo(
    () =>
      series.filter((pt) => {
        if (appliedStart && pt.date < appliedStart) return false;
        if (appliedEnd && pt.date > appliedEnd) return false;
        return true;
      }),
    [series, appliedStart, appliedEnd]
  );

  const handlePresetChange = (preset: string) => {
    setRangePreset(preset);
    let nextStart = series[0]?.date ?? "1990-03-01";
    let nextEnd = latestRevisionDate;

    if (preset === "12m") {
      nextStart = subtractMonthsIso(latestRevisionDate, 12);
    } else if (preset === "24m") {
      nextStart = subtractMonthsIso(latestRevisionDate, 24);
    } else if (preset === "5y") {
      nextStart = subtractMonthsIso(latestRevisionDate, 60);
    } else if (/^\d{4}$/.test(preset)) {
      nextStart = `${preset}-01-01`;
      nextEnd = `${preset}-12-31`;
    }

    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    setAppliedStart(nextStart);
    setAppliedEnd(nextEnd);
    setHoverIdx(null);
  };

  const handleApplyDates = () => {
    setRangePreset("custom");
    setAppliedStart(draftStart);
    setAppliedEnd(draftEnd);
    setHoverIdx(null);
  };

  const handleReset = () => {
    setFuelScope("core");
    setRangePreset("12m");
    setDraftStart(defaultStart);
    setDraftEnd(latestRevisionDate);
    setAppliedStart(defaultStart);
    setAppliedEnd(latestRevisionDate);
    setHiddenCodes({});
    setHoverIdx(null);
  };

  const toggleSeriesCode = (code: string) => {
    setHiddenCodes((prev) => {
      const next = { ...prev, [code]: !prev[code] };
      const remaining = scopeCodes.filter((c) => !next[c]);
      if (remaining.length === 0) return prev; // Keep at least one series visible
      return next;
    });
  };

  // SVG layout math
  const svgWidth = 900;
  const svgHeight = 320;
  const padLeft = 58;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 34;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const { yMin, yMax, yTicks } = useMemo(() => {
    const vals: number[] = [];
    for (const pt of filteredPoints) {
      const map = metric === "val" ? pt.prices : pt.pct_change;
      for (const code of visibleCodes) {
        const v = map[code];
        if (v !== null && v !== undefined && Number.isFinite(v)) {
          vals.push(v);
        }
      }
    }
    if (vals.length === 0) {
      return { yMin: 0, yMax: 100, yTicks: [0, 25, 50, 75, 100] };
    }
    let minV = Math.min(...vals);
    let maxV = Math.max(...vals);
    if (metric === "pct") {
      minV = Math.min(minV, 0);
      maxV = Math.max(maxV, 0);
    }
    const ticks = buildNiceTicks(minV, maxV, 6);
    return { yMin: ticks[0], yMax: ticks[ticks.length - 1], yTicks: ticks };
  }, [filteredPoints, visibleCodes, metric]);

  const xForIndex = (idx: number): number => {
    if (filteredPoints.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (filteredPoints.length - 1)) * plotW;
  };

  const yForValue = (val: number): number => {
    if (yMax === yMin) return padTop + plotH / 2;
    const ratio = (val - yMin) / (yMax - yMin);
    return padTop + plotH - ratio * plotH;
  };

  const zeroY = metric === "pct" ? yForValue(0) : padTop + plotH;

  const xTickIndices = useMemo(() => {
    const n = filteredPoints.length;
    if (n === 0) return [];
    if (n <= 8) return Array.from({ length: n }, (_, i) => i);
    const maxLabels = 8;
    const indices = new Set<number>([0, n - 1]);
    for (let i = 1; i < maxLabels - 1; i += 1) {
      indices.add(Math.round((i / (maxLabels - 1)) * (n - 1)));
    }
    return Array.from(indices).sort((a, b) => a - b);
  }, [filteredPoints.length]);

  const activePoint =
    hoverIdx !== null && filteredPoints[hoverIdx] ? filteredPoints[hoverIdx] : null;

  const handleSvgPointerMove = (clientX: number, rect: DOMRect) => {
    if (filteredPoints.length === 0) return;
    const relX = ((clientX - rect.left) / rect.width) * svgWidth;
    const clamped = Math.max(padLeft, Math.min(padLeft + plotW, relX));
    const ratio = (clamped - padLeft) / plotW;
    const idx =
      filteredPoints.length === 1
        ? 0
        : Math.round(ratio * (filteredPoints.length - 1));
    setHoverIdx(Math.max(0, Math.min(filteredPoints.length - 1, idx)));
  };

  return (
    <section className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-slate-900">
      {/* Header & Controls */}
      <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-center dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
            Price Chart
          </h2>
          <span className="tabular-nums rounded-full border border-gray-200 bg-slate-100 px-3 py-0.5 font-heading text-xs font-bold text-slate-700 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {filteredPoints.length} {filteredPoints.length === 1 ? "revision" : "revisions"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metric Toggle */}
          <div
            role="group"
            aria-label="Chart metric"
            className="inline-flex items-center rounded-lg border border-gray-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800"
          >
            <button
              type="button"
              id="toggle-val-btn"
              onClick={() => setMetric("val")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                metric === "val"
                  ? "border border-gray-200 bg-white text-slate-900 shadow-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Rs. Values</span>
            </button>
            <button
              type="button"
              id="toggle-pct-btn"
              onClick={() => setMetric("pct")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                metric === "pct"
                  ? "border border-gray-200 bg-white text-slate-900 shadow-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Percent className="h-3.5 w-3.5" aria-hidden="true" />
              <span>% Change</span>
            </button>
          </div>

          {/* Line / Area Toggle */}
          <div
            role="group"
            aria-label="Chart style"
            className="inline-flex items-center rounded-lg border border-gray-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800"
          >
            <button
              type="button"
              id="toggle-line-btn"
              onClick={() => setView("line")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                view === "line"
                  ? "border border-gray-200 bg-white text-slate-900 shadow-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Line</span>
            </button>
            <button
              type="button"
              id="toggle-area-btn"
              onClick={() => setView("area")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                view === "area"
                  ? "border border-gray-200 bg-white text-slate-900 shadow-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <AreaChart className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Area</span>
            </button>
          </div>

          {/* Export Chart Data */}
          <button
            type="button"
            id="export-chart-btn"
            onClick={() =>
              exportChartSeriesToCsv(
                filteredPoints,
                visibleCodes,
                metric,
                `cpc_fuel_chart_${metric}_${appliedStart || "start"}_to_${appliedEnd || "end"}.csv`
              )
            }
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-700 shadow-xs whitespace-nowrap transition-colors hover:border-gray-400 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5 text-brand-red dark:text-red-400" aria-hidden="true" />
            <span>Export Chart Data</span>
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="grid grid-cols-1 items-end gap-4 rounded-xl border border-gray-200 bg-slate-50/80 p-4 md:grid-cols-12 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="space-y-1 md:col-span-3">
          <label
            htmlFor="chart-fuel-type"
            className="block font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Fuel Type
          </label>
          <select
            id="chart-fuel-type"
            value={fuelScope}
            onChange={(e) => {
              setFuelScope(e.target.value);
              setHiddenCodes({});
            }}
            className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 font-heading text-xs font-semibold text-slate-800 shadow-xs focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="core">Core Retail (5 Grades)</option>
            <option value="all">All Fuel Grades (9)</option>
            {ALL_GRADE_CODES.map((code) => (
              <option key={code} value={code}>
                {code} — {getGradeVisual(code).shortLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 md:col-span-3">
          <label
            htmlFor="chart-year-range"
            className="block font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Timeframe / Year
          </label>
          <select
            id="chart-year-range"
            value={rangePreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="tabular-nums w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 font-heading text-xs font-semibold text-slate-800 shadow-xs focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="12m">Last 12 Months</option>
            <option value="24m">Last 24 Months</option>
            <option value="5y">Last 5 Years</option>
            <option value="all">All Years (1990–Present)</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                Year {yr}
              </option>
            ))}
            {rangePreset === "custom" && <option value="custom">Custom Date Range</option>}
          </select>
        </div>

        <div className="space-y-1 md:col-span-2">
          <label
            htmlFor="chart-start-date"
            className="block font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Start Date
          </label>
          <input
            id="chart-start-date"
            type="date"
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
            className="tabular-nums w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-heading text-xs font-semibold text-slate-800 shadow-xs focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label
            htmlFor="chart-end-date"
            className="block font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            End Date
          </label>
          <input
            id="chart-end-date"
            type="date"
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
            className="tabular-nums w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-heading text-xs font-semibold text-slate-800 shadow-xs focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2 md:col-span-2">
          <button
            type="button"
            onClick={handleApplyDates}
            className="flex-1 cursor-pointer rounded-lg bg-brand-red px-3 py-2 text-center font-heading text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-brand-red-hover"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 font-heading text-xs font-semibold uppercase tracking-wider text-slate-700 shadow-xs transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Interactive Legend Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 border-y border-gray-100 py-2.5 dark:border-slate-800">
        {scopeCodes.map((code) => {
          const vis = getGradeVisual(code);
          const isHidden = Boolean(hiddenCodes[code]);
          return (
            <button
              key={code}
              type="button"
              onClick={() => toggleSeriesCode(code)}
              aria-pressed={!isHidden}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                isHidden
                  ? "bg-slate-100 text-slate-400 opacity-60 dark:bg-slate-800 dark:text-slate-500"
                  : `${vis.badgeBgClass} ${vis.badgeTextClass}`
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: isHidden ? "#94a3b8" : vis.color }}
              />
              <span>{vis.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Interactive SVG Chart */}
      {filteredPoints.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-slate-50 py-16 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
          No revision points found in the selected date window. Click <strong>Reset</strong> to
          restore the default 12-month view.
        </div>
      ) : (
        <div className="relative rounded-xl border border-gray-200 bg-slate-50/50 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-950/50">
          {/* Hover Tooltip Card */}
          {activePoint && (
            <div
              className={`pointer-events-none z-20 mb-3 rounded-xl border border-slate-700/80 bg-slate-900/95 p-3.5 text-white shadow-lg sm:absolute sm:top-6 sm:mb-0 sm:w-56 ${
                hoverIdx !== null && hoverIdx > filteredPoints.length * 0.55
                  ? "sm:left-16"
                  : "sm:right-6"
              }`}
            >
              <div className="mb-2 flex items-center justify-between border-b border-slate-700 pb-1.5">
                <span className="tabular-nums font-mono text-[11px] font-bold uppercase text-amber-400">
                  {activePoint.date} Revision
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="space-y-1 text-xs font-mono">
                {visibleCodes.map((code) => {
                  const vis = getGradeVisual(code);
                  const val =
                    metric === "val" ? activePoint.prices[code] : activePoint.pct_change[code];
                  return (
                    <div key={code} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-slate-200">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: vis.color }}
                        />
                        <span>{vis.shortLabel}:</span>
                      </span>
                      <span className="tabular-nums font-bold text-white">
                        {val === null || val === undefined
                          ? "—"
                          : metric === "val"
                          ? `Rs. ${val}`
                          : `${val > 0 ? "+" : ""}${val}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              role="img"
              aria-label="Sri Lanka Fuel Price Trend Chart"
              className="h-[290px] w-full min-w-[620px] select-none sm:h-[360px]"
              onMouseMove={(e) => handleSvgPointerMove(e.clientX, e.currentTarget.getBoundingClientRect())}
              onMouseLeave={() => setHoverIdx(null)}
              onTouchMove={(e) => {
                if (e.touches[0]) {
                  handleSvgPointerMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());
                }
              }}
            >
              <defs>
                {visibleCodes.map((code) => {
                  const vis = getGradeVisual(code);
                  const safeCode = code.replace(/[^a-zA-Z0-9]/g, "");
                  return (
                    <linearGradient
                      key={code}
                      id={`grad-${uid}-${safeCode}`}
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={vis.color} stopOpacity="0.28" />
                      <stop offset="100%" stopColor={vis.color} stopOpacity="0.02" />
                    </linearGradient>
                  );
                })}
              </defs>

              {/* Y-Axis Gridlines & Labels */}
              {yTicks.map((tick) => {
                const y = yForValue(tick);
                const isZero = metric === "pct" && tick === 0;
                return (
                  <g key={tick}>
                    <line
                      x1={padLeft}
                      x2={padLeft + plotW}
                      y1={y}
                      y2={y}
                      stroke={isZero ? "#64748b" : "#cbd5e1"}
                      strokeOpacity={isZero ? 0.65 : 0.45}
                      strokeDasharray={isZero ? undefined : "4 4"}
                      strokeWidth={isZero ? 1.4 : 1}
                    />
                    <text
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                    >
                      {metric === "val" ? `${tick}` : `${tick > 0 ? "+" : ""}${tick}%`}
                    </text>
                  </g>
                );
              })}

              {/* Y-Axis Unit Title */}
              <text
                x={14}
                y={padTop + plotH / 2}
                textAnchor="middle"
                transform={`rotate(-90 14 ${padTop + plotH / 2})`}
                className="fill-slate-400 font-heading text-[10px] font-bold uppercase tracking-widest"
              >
                {metric === "val" ? "Price (Rs.)" : "Revision % Change"}
              </text>

              {/* X-Axis Labels */}
              {xTickIndices.map((idx) => {
                const pt = filteredPoints[idx];
                const x = xForIndex(idx);
                return (
                  <text
                    key={`${idx}-${pt.date}`}
                    x={x}
                    y={svgHeight - 10}
                    textAnchor={
                      idx === 0 ? "start" : idx === filteredPoints.length - 1 ? "end" : "middle"
                    }
                    className={`font-mono text-[10px] ${
                      hoverIdx === idx
                        ? "fill-brand-red font-bold dark:fill-red-400"
                        : "fill-slate-500 dark:fill-slate-400"
                    }`}
                  >
                    {pt.date}
                  </text>
                );
              })}

              {/* Hover Guide Line */}
              {hoverIdx !== null && filteredPoints[hoverIdx] && (
                <line
                  x1={xForIndex(hoverIdx)}
                  x2={xForIndex(hoverIdx)}
                  y1={padTop}
                  y2={padTop + plotH}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              )}

              {/* Area Fills & Series Curves */}
              {visibleCodes.map((code) => {
                const vis = getGradeVisual(code);
                const safeCode = code.replace(/[^a-zA-Z0-9]/g, "");
                const segments: { x: number; y: number }[][] = [];
                let currentSeg: { x: number; y: number }[] = [];

                filteredPoints.forEach((pt, idx) => {
                  const val = metric === "val" ? pt.prices[code] : pt.pct_change[code];
                  if (val === null || val === undefined || !Number.isFinite(val)) {
                    if (currentSeg.length > 0) {
                      segments.push(currentSeg);
                      currentSeg = [];
                    }
                    return;
                  }
                  currentSeg.push({ x: xForIndex(idx), y: yForValue(val) });
                });
                if (currentSeg.length > 0) segments.push(currentSeg);

                return (
                  <g key={code}>
                    {view === "area" &&
                      segments.map((seg, sIdx) => {
                        if (seg.length < 2) return null;
                        const lineD = seg
                          .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                          .join(" ");
                        const areaD = `${lineD} L${seg[seg.length - 1].x.toFixed(1)},${zeroY.toFixed(
                          1
                        )} L${seg[0].x.toFixed(1)},${zeroY.toFixed(1)} Z`;
                        return (
                          <path
                            key={`area-${sIdx}`}
                            d={areaD}
                            fill={`url(#grad-${uid}-${safeCode})`}
                          />
                        );
                      })}

                    {segments.map((seg, sIdx) => {
                      if (seg.length === 1) {
                        return (
                          <circle
                            key={`dot-${sIdx}`}
                            cx={seg[0].x}
                            cy={seg[0].y}
                            r={4}
                            fill={vis.color}
                          />
                        );
                      }
                      const d = seg
                        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                        .join(" ");
                      return (
                        <path
                          key={`line-${sIdx}`}
                          d={d}
                          fill="none"
                          stroke={vis.color}
                          strokeWidth={2.75}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      );
                    })}

                    {/* Highlighted Hover Point */}
                    {hoverIdx !== null &&
                      filteredPoints[hoverIdx] &&
                      (() => {
                        const pt = filteredPoints[hoverIdx];
                        const val = metric === "val" ? pt.prices[code] : pt.pct_change[code];
                        if (val === null || val === undefined) return null;
                        return (
                          <circle
                            cx={xForIndex(hoverIdx)}
                            cy={yForValue(val)}
                            r={5}
                            fill={vis.color}
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        );
                      })()}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </section>
  );
}
