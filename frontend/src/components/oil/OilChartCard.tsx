import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import {
  Activity,
  Camera,
  Download,
  LineChart,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
} from "lucide-react";
import type { ThemeMode } from "../../hooks/useTheme";
import type {
  BrentIntradayData,
  CommodityComparisonRow,
  OilHistoryPoint,
} from "../../types/oil";
import { exportOilSeriesToCsv } from "../../utils/dataLoader";

export type OilTimeframe = "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y" | "10Y" | "25Y" | "ALL";
type ChartStyleMode = "area" | "line";

interface OilChartCardProps {
  commodities: CommodityComparisonRow[];
  selectedId: string;
  onSelectCommodity: (id: string) => void;
  seriesMap: Record<string, OilHistoryPoint[]>;
  intraday: BrentIntradayData | null;
  theme: ThemeMode;
}

const TIMEFRAMES: OilTimeframe[] = ["1D", "1W", "1M", "6M", "1Y", "5Y", "10Y", "25Y", "ALL"];

function computeCutoffIso(latestIso: string, tf: OilTimeframe): string | null {
  if (tf === "ALL") return null;
  const [y, m, d] = latestIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  switch (tf) {
    case "1W":
      dt.setUTCDate(dt.getUTCDate() - 7);
      break;
    case "1M":
      dt.setUTCMonth(dt.getUTCMonth() - 1);
      break;
    case "6M":
      dt.setUTCMonth(dt.getUTCMonth() - 6);
      break;
    case "1Y":
      dt.setUTCFullYear(dt.getUTCFullYear() - 1);
      break;
    case "5Y":
      dt.setUTCFullYear(dt.getUTCFullYear() - 5);
      break;
    case "10Y":
      dt.setUTCFullYear(dt.getUTCFullYear() - 10);
      break;
    case "25Y":
      dt.setUTCFullYear(dt.getUTCFullYear() - 25);
      break;
    default:
      return null;
  }
  return dt.toISOString().slice(0, 10);
}

export function OilChartCard({
  commodities,
  selectedId,
  onSelectCommodity,
  seriesMap,
  intraday,
  theme,
}: OilChartCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  const [timeframe, setTimeframe] = useState<OilTimeframe>("10Y");
  const [chartStyle, setChartStyle] = useState<ChartStyleMode>("area");
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{
    date: string;
    value: number;
    pctVsStart: number;
  } | null>(null);

  const activeMeta = useMemo(
    () => commodities.find((c) => c.id === selectedId) ?? commodities[0],
    [commodities, selectedId]
  );

  const hasIntraday = Boolean(
    selectedId === "brent" && intraday?.enabled && (intraday.points?.length ?? 0) > 1
  );

  const effectiveTimeframe: OilTimeframe =
    timeframe === "1D" && !hasIntraday ? "10Y" : timeframe;

  const fullPoints = useMemo(() => seriesMap[selectedId] ?? [], [seriesMap, selectedId]);

  const visiblePoints = useMemo(() => {
    if (effectiveTimeframe === "1D" && hasIntraday && intraday) {
      return intraday.points.map((pt) => ({
        time: pt.time as unknown as Time,
        displayDate: new Date(pt.time * 1000).toISOString().slice(0, 16).replace("T", " "),
        value: pt.value,
      }));
    }
    if (fullPoints.length === 0) return [];
    const latestIso = fullPoints[fullPoints.length - 1].time;
    const cutoff = computeCutoffIso(latestIso, effectiveTimeframe);
    const sliced = cutoff ? fullPoints.filter((p) => p.time >= cutoff) : fullPoints;
    return sliced.map((p) => ({
      time: p.time as Time,
      displayDate: p.time,
      value: p.value,
    }));
  }, [fullPoints, effectiveTimeframe, hasIntraday, intraday]);

  const rangeStats = useMemo(() => {
    if (visiblePoints.length < 2) {
      return { delta: 0, pct: 0, startValue: activeMeta?.price ?? 0, peak: null };
    }
    const first = visiblePoints[0].value;
    const last = visiblePoints[visiblePoints.length - 1].value;
    const delta = last - first;
    const pct = first !== 0 ? (delta / first) * 100 : 0;

    let peak = visiblePoints[0];
    for (const pt of visiblePoints) {
      if (pt.value > peak.value) peak = pt;
    }

    return { delta, pct, startValue: first, peak };
  }, [visiblePoints, activeMeta]);

  const matchingCommodities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return commodities;
    return commodities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
    );
  }, [commodities, searchQuery]);

  // Create and maintain Lightweight Charts instance
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isDark = theme === "dark";
    const chart = createChart(container, {
      width: container.clientWidth,
      height: isFullscreen ? Math.max(460, window.innerHeight - 230) : 390,
      layout: {
        attributionLogo: true,
        background: { type: ColorType.Solid, color: isDark ? "#0b141d" : "#fafbfc" },
        textColor: isDark ? "#94a3b8" : "#475569",
        fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      },
      grid: {
        vertLines: { color: isDark ? "#1e293b" : "#e2e8f0", style: LineStyle.Dotted },
        horzLines: { color: isDark ? "#1e293b" : "#e2e8f0", style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: isDark ? "#1e293b" : "#cbd5e1",
      },
      timeScale: {
        borderColor: isDark ? "#1e293b" : "#cbd5e1",
        timeVisible: effectiveTimeframe === "1D",
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: "#94a3b8",
          style: LineStyle.Dashed,
          labelBackgroundColor: isDark ? "#1e293b" : "#0f172a",
        },
        horzLine: {
          color: "#94a3b8",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0055ff",
        },
      },
    });

    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          chart.applyOptions({ width: Math.floor(entry.contentRect.width) });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      markersRef.current = null;
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [isFullscreen, effectiveTimeframe]);

  // Synchronize theme dynamically without recreating chart data unnecessarily
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const isDark = theme === "dark";
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#0b141d" : "#fafbfc" },
        textColor: isDark ? "#94a3b8" : "#475569",
      },
      grid: {
        vertLines: { color: isDark ? "#1e293b" : "#e2e8f0" },
        horzLines: { color: isDark ? "#1e293b" : "#e2e8f0" },
      },
      rightPriceScale: {
        borderColor: isDark ? "#1e293b" : "#cbd5e1",
      },
      timeScale: {
        borderColor: isDark ? "#1e293b" : "#cbd5e1",
      },
    });
  }, [theme]);

  // Populate series, benchmark price line, visible peak marker, and crosshair readout
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || visiblePoints.length === 0 || !activeMeta) return;

    if (seriesRef.current) {
      if (markersRef.current) {
        markersRef.current.detach();
        markersRef.current = null;
      }
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    const commonOpts = {
      priceFormat: {
        type: "price" as const,
        precision: activeMeta.decimals,
        minMove: Number((10 ** -activeMeta.decimals).toFixed(activeMeta.decimals)),
      },
      lastValueVisible: false,
      priceLineVisible: false,
    };

    const series =
      chartStyle === "area"
        ? chart.addSeries(AreaSeries, {
            ...commonOpts,
            lineColor: "#0055ff",
            lineWidth: 2,
            topColor: "rgba(0, 85, 255, 0.34)",
            bottomColor: "rgba(0, 85, 255, 0.02)",
          })
        : chart.addSeries(LineSeries, {
            ...commonOpts,
            color: "#0055ff",
            lineWidth: 2,
          });

    series.setData(visiblePoints.map((pt) => ({ time: pt.time, value: pt.value })));
    seriesRef.current = series;

    // Dashed horizontal current-benchmark price line + pinned right-axis pill
    const currentVal = visiblePoints[visiblePoints.length - 1].value;
    series.createPriceLine({
      price: currentVal,
      color: "#0055ff",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "",
    });

    // Peak marker inside visible range
    if (rangeStats.peak) {
      const peakMarker: SeriesMarker<Time> = {
        time: rangeStats.peak.time,
        position: "aboveBar",
        color: "#C8102E",
        shape: "circle",
        text: `${rangeStats.peak.value.toFixed(activeMeta.decimals)} High`,
      };
      markersRef.current = createSeriesMarkers(series, [peakMarker]);
    }

    chart.timeScale().fitContent();

    const lookupByTime = new Map<string, { date: string; value: number }>();
    for (const pt of visiblePoints) {
      lookupByTime.set(String(pt.time), { date: pt.displayDate, value: pt.value });
    }

    const onCrosshairMove = (param: { time?: Time }) => {
      if (!param.time) {
        setHoverInfo(null);
        return;
      }
      const hit = lookupByTime.get(String(param.time));
      if (!hit) {
        setHoverInfo(null);
        return;
      }
      const pctVsStart =
        rangeStats.startValue !== 0
          ? ((hit.value - rangeStats.startValue) / rangeStats.startValue) * 100
          : 0;
      setHoverInfo({
        date: hit.date,
        value: hit.value,
        pctVsStart,
      });
    };

    chart.subscribeCrosshairMove(onCrosshairMove);
    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
    };
  }, [visiblePoints, chartStyle, activeMeta, rangeStats]);

  const handleExportPng = () => {
    const chart = chartRef.current;
    if (!chart || !activeMeta) return;
    const canvas = chart.takeScreenshot();
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `cpc_${activeMeta.id}_${effectiveTimeframe.toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCsv = () => {
    if (!activeMeta) return;
    const exportPts = visiblePoints.map((pt) => ({
      time: pt.displayDate,
      value: pt.value,
    }));
    exportOilSeriesToCsv(
      exportPts,
      activeMeta.name,
      activeMeta.unit,
      `cpc_${activeMeta.id}_${effectiveTimeframe.toLowerCase()}.csv`
    );
  };

  const handleResetZoom = () => {
    chartRef.current?.timeScale().fitContent();
  };

  if (!activeMeta) return null;

  const isPositiveRange = rangeStats.delta >= 0;

  return (
    <section
      id="oil-chart-section"
      className={`${
        isFullscreen
          ? "fixed inset-4 z-50 overflow-y-auto shadow-2xl"
          : "relative"
      } space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-slate-900`}
    >
      {/* Top Asset Title & Action Controls */}
      <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-4 lg:flex-row lg:items-center dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-heading text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 uppercase dark:text-white">
              {activeMeta.name} ({activeMeta.unit})
            </h2>
            <span className="tabular-nums font-heading text-lg sm:text-xl font-bold text-[#0055ff] dark:text-blue-400">
              {activeMeta.price.toFixed(activeMeta.decimals)}
            </span>
            <span
              className={`tabular-nums font-heading text-xs sm:text-sm font-bold ${
                isPositiveRange
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-brand-red dark:text-red-400"
              }`}
            >
              {isPositiveRange ? "+" : ""}
              {rangeStats.delta.toFixed(activeMeta.decimals)} ({isPositiveRange ? "+" : ""}
              {rangeStats.pct.toFixed(2)}%) {effectiveTimeframe}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Interactive U.S. EIA / FRED spot series • Scroll to zoom, drag to pan across{" "}
            {fullPoints.length.toLocaleString()} sessions
          </p>
        </div>

        {/* Commodity Search/Switcher & Export Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Search commodity"
              value={searchQuery}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDropdownOpen(true);
              }}
              placeholder="Switch commodity..."
              className="w-44 rounded-lg border border-gray-300 bg-slate-50 py-1.5 pr-3 pl-8 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-brand-red focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {dropdownOpen && (
              <div className="absolute left-0 z-30 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {matchingCommodities.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">No matching benchmarks</p>
                ) : (
                  matchingCommodities.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => {
                        onSelectCommodity(c.id);
                        setSearchQuery("");
                        setDropdownOpen(false);
                      }}
                      className={`flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        c.id === selectedId
                          ? "font-bold text-[#0055ff] dark:text-blue-400"
                          : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className="tabular-nums font-mono text-[11px] text-slate-400">
                        {c.price.toFixed(c.decimals)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div
            role="group"
            aria-label="Chart series style"
            className="inline-flex rounded-lg border border-gray-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => setChartStyle("area")}
              className={`inline-flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 font-heading text-xs font-bold whitespace-nowrap ${
                chartStyle === "area"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Area</span>
            </button>
            <button
              type="button"
              onClick={() => setChartStyle("line")}
              className={`inline-flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 font-heading text-xs font-bold whitespace-nowrap ${
                chartStyle === "line"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Line</span>
            </button>
          </div>

          <button
            type="button"
            id="oil-export-csv-btn"
            onClick={handleExportCsv}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 font-heading text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5 text-brand-red dark:text-red-400" aria-hidden="true" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            id="oil-export-png-btn"
            onClick={handleExportPng}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 font-heading text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Camera className="h-3.5 w-3.5 text-[#0055ff] dark:text-blue-400" aria-hidden="true" />
            <span>PNG</span>
          </button>

          <button
            type="button"
            id="oil-reset-zoom-btn"
            onClick={handleResetZoom}
            title="Reset Zoom"
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 font-heading text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Zoom</span>
          </button>

          <button
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen chart"}
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white p-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Timeframe Pills & Live Crosshair Readout */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-slate-800">
        <div role="group" aria-label="Chart timeframe" className="flex flex-wrap items-center gap-1">
          {TIMEFRAMES.map((tf) => {
            const disabled = tf === "1D" && !hasIntraday;
            const isActive = effectiveTimeframe === tf;
            return (
              <button
                key={tf}
                type="button"
                disabled={disabled}
                data-oil-timeframe={tf}
                title={
                  disabled ? "1D intraday view activates when intraday feed is configured" : tf
                }
                onClick={() => setTimeframe(tf)}
                className={`cursor-pointer rounded px-2.5 py-1 font-heading text-xs font-bold whitespace-nowrap transition-colors ${
                  disabled
                    ? "cursor-not-allowed text-slate-300 dark:text-slate-700"
                    : isActive
                    ? "bg-slate-900 text-white dark:bg-brand-red"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                {tf}
              </button>
            );
          })}
        </div>

        <div className="tabular-nums flex items-center gap-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
          {hoverInfo ? (
            <span className="rounded border border-gray-200 bg-slate-50 px-2.5 py-1 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              {hoverInfo.date}: ${hoverInfo.value.toFixed(activeMeta.decimals)} (
              {hoverInfo.pctVsStart >= 0 ? "+" : ""}
              {hoverInfo.pctVsStart.toFixed(2)}% vs start)
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <span className="inline-block h-0.5 w-3 border-b border-dashed border-[#0055ff]" />
              <span>
                Benchmark: {activeMeta.price.toFixed(activeMeta.decimals)} {activeMeta.unit}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Lightweight Charts Canvas Host */}
      <div className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-slate-800">
        {hoverInfo && (
          <div className="pointer-events-none absolute top-3 left-3 z-20 rounded-lg border border-slate-700/80 bg-slate-900/90 px-3 py-2 text-xs font-mono text-white shadow-md">
            <div className="text-[10px] font-bold uppercase text-amber-400">{hoverInfo.date}</div>
            <div className="tabular-nums mt-0.5 flex items-baseline gap-2">
              <span className="font-bold">
                ${hoverInfo.value.toFixed(activeMeta.decimals)}
              </span>
              <span
                className={
                  hoverInfo.pctVsStart >= 0 ? "text-emerald-400" : "text-red-400"
                }
              >
                {hoverInfo.pctVsStart >= 0 ? "+" : ""}
                {hoverInfo.pctVsStart.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>
    </section>
  );
}
