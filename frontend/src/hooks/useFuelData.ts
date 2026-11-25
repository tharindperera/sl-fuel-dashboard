import { useCallback, useEffect, useState } from "react";
import type {
  AnnualAggregatedData,
  ArchiveMetaData,
  ArchiveRow,
  CurrentRatesData,
  MonthlyAggregatedData,
  PipelineStatusData,
  TrendsKpisData,
} from "../types/fuel";
import type {
  BrentIntradayData,
  CommodityHistoryData,
  GlobalOilKpisData,
  OilAiSummaryData,
} from "../types/oil";
import {
  fetchAggregatedArchives,
  fetchArchiveBundle,
  fetchCurrentRates,
  fetchGlobalOilBundle,
  fetchPipelineStatus,
  fetchTrendsKpis,
} from "../utils/dataLoader";

export function useCurrentRates() {
  const [data, setData] = useState<CurrentRatesData | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rates, status] = await Promise.all([
        fetchCurrentRates(),
        fetchPipelineStatus().catch(() => null),
      ]);
      setData(rates);
      setPipelineStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load current fuel rates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, pipelineStatus, loading, error, reload: load };
}

export function useArchiveData() {
  const [meta, setMeta] = useState<ArchiveMetaData | null>(null);
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyAggregatedData | null>(null);
  const [annual, setAnnual] = useState<AnnualAggregatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bundle, aggregated] = await Promise.all([
        fetchArchiveBundle(),
        fetchAggregatedArchives().catch(() => null),
      ]);
      setMeta(bundle.meta);
      setRows(bundle.rows);
      if (aggregated) {
        setMonthly(aggregated.monthly);
        setAnnual(aggregated.annual);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load historical price archive.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { meta, rows, monthly, annual, loading, error, reload: load };
}

export function useTrendsKpis() {
  const [data, setData] = useState<TrendsKpisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const kpis = await fetchTrendsKpis();
      setData(kpis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load trends & KPI analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

export function useGlobalOilData() {
  const [kpis, setKpis] = useState<GlobalOilKpisData | null>(null);
  const [history, setHistory] = useState<CommodityHistoryData | null>(null);
  const [aiSummary, setAiSummary] = useState<OilAiSummaryData | null>(null);
  const [intraday, setIntraday] = useState<BrentIntradayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bundle = await fetchGlobalOilBundle();
      setKpis(bundle.kpis);
      setHistory(bundle.history);
      setAiSummary(bundle.aiSummary);
      setIntraday(bundle.intraday);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load global crude oil benchmarks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { kpis, history, aiSummary, intraday, loading, error, reload: load };
}
