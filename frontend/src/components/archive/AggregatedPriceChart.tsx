import { useId, useMemo, useState } from "react";
import { AreaChart, Banknote, Download, LineChart, Percent } from "lucide-react";
import { exportTabularCsv } from "../../utils/dataLoader";
import { ALL_GRADE_CODES, getGradeVisual } from "../../utils/gradeMeta";

export interface AggregatedChartPoint {
  key: string; // "2026-11" or "2026"
  label: string; // "Nov 2026" or "2026"
  prices: Record<string, number | null>;
  pctChange: Record<string, number | null>;
}

interface AggregatedPriceChartProps {
  mode: "monthly" | "annual";
  pointsChronological: AggregatedChartPoint[]; // oldest -> newest
}

type ChartMetric = "val" | "pct";
type ChartView = "line" | "area";

const CORE_RETAIL_CODES = ["LP 92", "LP 95", "LAD", "LSD", "LK"] as const;

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

export function AggregatedPriceChart({ mode, pointsChronological }: AggregatedPriceChartProps) {
  const uid = useId().replace(/:/g, "");
  const isMonthly = mode === "monthly";

  const firstKey = pointsChronological[0]?.key ?? "";
  const latestKey = pointsChronological[pointsChronological.length - 1]?.key ?? "";

  const defaultStartKey = useMemo(() => {
    if (pointsChronological.length === 0) return "";
    const count = isMonthly ? 12 : 10;
    const idx = Math.max(0, pointsChronological.length - count);
    return pointsChronological[idx].key;
  }, [pointsChronological, isMonthly]);

  const [metric, setMetric] = useState<ChartMetric>("val");
  const [view, setView] = useState<ChartView>("line");
  const [fuelTypeFilter, setFuelTypeFilter] = useState<string>("all");
  const [includeIndustrial, setIncludeIndustrial] = useState(false);
  const [preset, setPreset] = useState<string>(isMonthly ? "12m" : "10y");
  const [draftStart, setDraftStart] = useState<string>(defaultStartKey);
  const [draftEnd, setDraftEnd] = useState<string>(latestKey);
  const [appliedStart, setAppliedStart] = useState<string>(defaultStartKey);
  const [appliedEnd, setAppliedEnd] = useState<string>(latestKey);
  const [hiddenCodes, setHiddenCodes] = useState<Record<string, boolean>>({});
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const legendCodes = useMemo(() => {
    if (fuelTypeFilter !== "all") return [fuelTypeFilter];
    return includeIndustrial ? [...ALL_GRADE_CODES] : [...CORE_RETAIL_CODES];
  }, [fuelTypeFilter, includeIndustrial]);

  const visibleCodes = useMemo(
    () => legendCodes.filter((code) => !hiddenCodes[code]),
    [legendCodes, hiddenCodes]
  );

  const filteredPoints = useMemo(
    () =>
      pointsChronological.filter((pt) => {
        if (appliedStart && pt.key < appliedStart) return false;
        if (appliedEnd && pt.key > appliedEnd) return false;
        return true;
      }),
    [pointsChronological, appliedStart, appliedEnd]
  );

  const handlePresetChange = (nextPreset: string) => {
    setPreset(nextPreset);
    if (pointsChronological.length === 0) return;

    let count = pointsChronological.length;
    if (isMonthly) {
      if (nextPreset === "12m") count = 12;
      else if (nextPreset === "3y") count = 36;
      else if (nextPreset === "5y") count = 60;
      else if (nextPreset === "10y") count = 120;
    } else {
      if (nextPreset === "5y") count = 5;
      else if (nextPreset === "10y") count = 10;
      else if (nextPreset === "20y") count = 20;
    }

    const startIdx = Math.max(0, pointsChronological.length - count);
    const nextStart = pointsChronological[startIdx].key;
    const nextEnd = latestKey;
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    setAppliedStart(nextStart);
    setAppliedEnd(nextEnd);
    setHoverIdx(null);
  };

  const handleApply = () => {
    setPreset("custom");
    setAppliedStart(draftStart);
    setAppliedEnd(draftEnd);
    setHoverIdx(null);
  };

  const handleReset = () => {
    setFuelTypeFilter("all");
    setIncludeIndustrial(false);
    setPreset(isMonthly ? "12m" : "10y");
    setDraftStart(defaultStartKey);
    setDraftEnd(latestKey);
    setAppliedStart(defaultStartKey);
    setAppliedEnd(latestKey);
    setHiddenCodes({});
    setHoverIdx(null);
  };

  const toggleSeriesCode = (code: string) => {
    setHiddenCodes((prev) => {
      const next = { ...prev, [code]: !prev[code] };
      const remaining = legendCodes.filter((c) => !next[c]);
      if (remaining.length === 0) return prev;
      return next;
    });
  };

  // SVG coordinates
  const svgWidth = 880;
  const svgHeight = 300;
  const padLeft = 56;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 34;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const { yMin, yMax, yTicks } = useMemo(() => {
    const vals: number[] = [];
    for (const pt of filteredPoints) {
      const map = metric === "val" ? pt.prices : pt.pctChange;
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
      filteredPoints.length === 1 ? 0 : Math.round(ratio * (filteredPoints.length - 1));
    setHoverIdx(Math.max(0, Math.min(filteredPoints.length - 1, idx)));
  };

  const handleExportChartData = () => {
    const suffix = metric === "val" ? "(LKR Avg)" : "(% Change)";
    const headers = [isMonthly ? "Month" : "Year", ...visibleCodes.map((c) => `${c} ${suffix}`)];
    const csvRows = filteredPoints.map((pt) => {
      const map = metric === "val" ? pt.prices : pt.pctChange;
      return [
        pt.key,
        ...visibleCodes.map((c) => {
          const val = map[c];
          return val === null || val === undefined ? "" : String(val);
        }),
      ];
    });
    exportTabularCsv(
      headers,
      csvRows,
      `cpc_${mode}_chart_${metric}_${appliedStart}_to_${appliedEnd}.csv`
    );
  };

  const unitLabel = isMonthly
    ? filteredPoints.length === 1
      ? "month"
      : "months"
    : filteredPoints.length === 1
    ? "year"
    : "years";

  return (
    <div
      data-agg-chart={mode}
      className="mt-6 space-y-5 rounded-xl border border-gray-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/50"
    >
      {/* Top Bar */}
      <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-4 lg:flex-row lg:items-center dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <h4 className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white">
            Price Chart
          </h4>
          <span className="tabular-nums rounded-full border border-gray-200 bg-white px-3 py-0.5 font-heading text-xs font-bold text-slate-700 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {filteredPoints.length} {unitLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* RS. VALUES | % CHANGE */}
          <div
            role="group"
            aria-label="Chart metric"
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
          >
            <button
              type="button"
              data-metric-btn="val"
              onClick={() => setMetric("val")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                metric === "val"
                  ? "bg-slate-900 text-white shadow-xs dark:bg-brand-primary"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Rs. Values</span>
            </button>
            <button
              type="button"
              data-metric-btn="pct"
              onClick={() => setMetric("pct")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                metric === "pct"
                  ? "bg-slate-900 text-white shadow-xs dark:bg-brand-primary"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Percent className="h-3.5 w-3.5" aria-hidden="true" />
              <span>% Change</span>
            </button>
          </div>

          {/* LINE | AREA */}
          <div
            role="group"
            aria-label="Chart style"
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
          >
            <button
              type="button"
              data-view-btn="line"
              onClick={() => setView("line")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                view === "line"
                  ? "bg-slate-900 text-white shadow-xs dark:bg-brand-primary"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Line</span>
            </button>
            <button
              type="button"
              data-view-btn="area"
              onClick={() => setView("area")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                view === "area"
                  ? "bg-slate-900 text-white shadow-xs dark:bg-brand-primary"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <AreaChart className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Area</span>
            </button>
          </div>

          <button
            type="button"
            data-export-chart-btn={mode}
            onClick={handleExportChartData}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-700 shadow-xs whitespace-nowrap transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5 text-brand-primary dark:text-sky-400" aria-hidden="true" />
            <span>Export Chart Data</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 items-end gap-3.5 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-12 dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-1 md:col-span-3">
          <label
            htmlFor={`${uid}-fuel-type`}
            className="block font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Fuel Type
          </label>
          <select
            id={`${uid}-fuel-type`}
            value={fuelTypeFilter}
            onChange={(e) => {
              setFuelTypeFilter(e.target.value);
              setHiddenCodes({});
            }}
            className="w-full cursor-pointer rounded-lg border border-gray-300 bg-slate-50 px-3 py-2 font-heading text-xs font-semibold text-slate-800 focus:border-brand-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="all">All fuel types</option>
            {ALL_GRADE_CODES.map((code) => (
              <option key={code} value={code}>
                {code} — {getGradeVisual(code).shortLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 md:col-span-3">
          <label
            htmlFor={`${uid}-period-preset`}
            className="block font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Period / Year
          </label>
          <select
            id={`${uid}-period-preset`}
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full cursor-pointer rounded-lg border border-gray-300 bg-slate-50 px-3 py-2 font-heading text-xs font-semibold text-slate-800 focus:border-brand-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {isMonthly ? (
              <>
                <option value="12m">Last 12 Months</option>
                <option value="3y">Last 3 Years</option>
                <option value="5y">Last 5 Years</option>
                <option value="10y">Last 10 Years</option>
                <option value="all">All Time</option>
              </>
            ) : (
              <>
                <option value="5y">Last 5 Years</option>
                <option value="10y">Last 10 Years</option>
                <option value="20y">Last 20 Years</option>
                <option value="all">All Time</option>
              </>
            )}
            {preset === "custom" && <option value="custom">Custom Range</option>}
          </select>
        </div>

        <div className="space-y-1 md:col-span-2">
          <label
            htmlFor={`${uid}-start`}
            className="block font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Start
          </label>
          {isMonthly ? (
            <input
              id={`${uid}-start`}
              type="month"
              min={firstKey}
              max={latestKey}
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              className="tabular-nums w-full rounded-lg border border-gray-300 bg-slate-50 px-2.5 py-2 font-heading text-xs font-semibold text-slate-800 focus:border-brand-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          ) : (
            <select
              id={`${uid}-start`}
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              className="tabular-nums w-full cursor-pointer rounded-lg border border-gray-300 bg-slate-50 px-3 py-2 font-heading text-xs font-semibold text-slate-800 focus:border-brand-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {pointsChronological.map((pt) => (
                <option key={pt.key} value={pt.key}>
                  {pt.key}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-1 md:col-span-2">
          <label
            htmlFor={`${uid}-end`}
            className="block font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            End
          </label>
          {isMonthly ? (
            <input
              id={`${uid}-end`}
              type="month"
              min={firstKey}
              max={latestKey}
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="tabular-nums w-full rounded-lg border border-gray-300 bg-slate-50 px-2.5 py-2 font-heading text-xs font-semibold text-slate-800 focus:border-brand-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          ) : (
            <select
              id={`${uid}-end`}
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="tabular-nums w-full cursor-pointer rounded-lg border border-gray-300 bg-slate-50 px-3 py-2 font-heading text-xs font-semibold text-slate-800 focus:border-brand-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {pointsChronological.map((pt) => (
                <option key={pt.key} value={pt.key}>
                  {pt.key}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 md:col-span-2">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 cursor-pointer rounded-lg bg-brand-primary px-3 py-2 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-brand-primary-hover"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 font-heading text-xs font-semibold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Interactive Legend Pills + Industrial Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-gray-200/80 py-2.5 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {legendCodes.map((code) => {
            const vis = getGradeVisual(code);
            const isHidden = Boolean(hiddenCodes[code]);
            return (
              <button
                key={code}
                type="button"
                aria-pressed={!isHidden}
                onClick={() => toggleSeriesCode(code)}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                  isHidden
                    ? "bg-slate-200 text-slate-400 opacity-60 dark:bg-slate-800 dark:text-slate-500"
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

        {fuelTypeFilter === "all" && (
          <button
            type="button"
            onClick={() => setIncludeIndustrial((prev) => !prev)}
            className="cursor-pointer rounded-full border border-gray-300 bg-white px-3 py-1 font-heading text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap transition-colors hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            {includeIndustrial ? "Core 5 Retail Only" : "+ Include Industrial & Furnace"}
          </button>
        )}
      </div>

      {/* Interactive SVG Plot */}
      {filteredPoints.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-14 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No periods match the selected range. Click <strong>Reset</strong> to restore defaults.
        </div>
      ) : (
        <div className="relative rounded-xl border border-gray-200 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
          {activePoint && (
            <div
              className={`pointer-events-none z-20 mb-3 rounded-xl border border-slate-700/80 bg-slate-900/95 p-3.5 text-white shadow-lg sm:absolute sm:top-5 sm:mb-0 sm:w-56 ${
                hoverIdx !== null && hoverIdx > filteredPoints.length * 0.55
                  ? "sm:left-16"
                  : "sm:right-5"
              }`}
            >
              <div className="mb-2 flex items-center justify-between border-b border-slate-700 pb-1.5">
                <span className="tabular-nums font-mono text-[11px] font-bold uppercase text-amber-400">
                  {activePoint.label}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="space-y-1 text-xs font-mono">
                {visibleCodes.map((code) => {
                  const vis = getGradeVisual(code);
                  const val =
                    metric === "val" ? activePoint.prices[code] : activePoint.pctChange[code];
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
              aria-label={isMonthly ? "Monthly Aggregated Fuel Price Chart" : "Annual Aggregated Fuel Price Chart"}
              className="h-[270px] w-full min-w-[600px] select-none sm:h-[330px]"
              onMouseMove={(e) =>
                handleSvgPointerMove(e.clientX, e.currentTarget.getBoundingClientRect())
              }
              onMouseLeave={() => setHoverIdx(null)}
              onTouchMove={(e) => {
                if (e.touches[0]) {
                  handleSvgPointerMove(
                    e.touches[0].clientX,
                    e.currentTarget.getBoundingClientRect()
                  );
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
                      id={`agg-grad-${uid}-${safeCode}`}
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

              <text
                x={14}
                y={padTop + plotH / 2}
                textAnchor="middle"
                transform={`rotate(-90 14 ${padTop + plotH / 2})`}
                className="fill-slate-400 font-heading text-[10px] font-bold uppercase tracking-widest"
              >
                {metric === "val" ? "Avg Price (Rs.)" : "% Change"}
              </text>

              {xTickIndices.map((idx) => {
                const pt = filteredPoints[idx];
                const x = xForIndex(idx);
                return (
                  <text
                    key={`${idx}-${pt.key}`}
                    x={x}
                    y={svgHeight - 10}
                    textAnchor={
                      idx === 0 ? "start" : idx === filteredPoints.length - 1 ? "end" : "middle"
                    }
                    className={`font-mono text-[10px] ${
                      hoverIdx === idx
                        ? "fill-brand-primary font-bold dark:fill-sky-400"
                        : "fill-slate-500 dark:fill-slate-400"
                    }`}
                  >
                    {pt.label}
                  </text>
                );
              })}

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

              {visibleCodes.map((code) => {
                const vis = getGradeVisual(code);
                const safeCode = code.replace(/[^a-zA-Z0-9]/g, "");
                const segments: { x: number; y: number }[][] = [];
                let currentSeg: { x: number; y: number }[] = [];

                filteredPoints.forEach((pt, idx) => {
                  const val = metric === "val" ? pt.prices[code] : pt.pctChange[code];
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
                            fill={`url(#agg-grad-${uid}-${safeCode})`}
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

                    {hoverIdx !== null &&
                      filteredPoints[hoverIdx] &&
                      (() => {
                        const pt = filteredPoints[hoverIdx];
                        const val = metric === "val" ? pt.prices[code] : pt.pctChange[code];
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
    </div>
  );
}
