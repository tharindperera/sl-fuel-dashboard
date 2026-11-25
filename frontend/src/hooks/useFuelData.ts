import { useCallback, useEffect, useState } from "react";
import type { ArchiveMetaData, ArchiveRow, CurrentRatesData, PipelineStatusData } from "../types/fuel";
import { fetchArchiveBundle, fetchCurrentRates, fetchPipelineStatus } from "../utils/dataLoader";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bundle = await fetchArchiveBundle();
      setMeta(bundle.meta);
      setRows(bundle.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load historical price archive.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { meta, rows, loading, error, reload: load };
}
