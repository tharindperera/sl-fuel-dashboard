import { useEffect } from "react";
import { Clock, Database, ShieldCheck, X } from "lucide-react";
import type { PipelineStatusData } from "../../types/fuel";
import { formatColomboTimestamp } from "../../utils/formatters";

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}

function ModalShell({ open, onClose, title, eyebrow, children }: ModalShellProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-brand-primary" />
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-slate-800">
          <div>
            <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-brand-primary dark:text-sky-400">
              {eyebrow}
            </p>
            <h2
              id="modal-heading"
              className="mt-1 font-heading text-xl font-bold text-slate-900 dark:text-white"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="cursor-pointer rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AboutPortalModal({
  open,
  onClose,
  pipelineStatus,
}: {
  open: boolean;
  onClose: () => void;
  pipelineStatus: PipelineStatusData | null;
}) {
  return (
    <ModalShell open={open} onClose={onClose} eyebrow="DATA GOVERNANCE" title="About CeylonOctane Analytics">
      <div className="space-y-4">
        <p>
          <strong>CeylonOctane Analytics</strong> is an automated public pricing monitor tracking Sri
          Lankan retail and industrial fuel tariffs published by the{" "}
          <strong>Ceylon Petroleum Corporation (CEYPETCO)</strong>.
        </p>

        <div className="space-y-2.5 rounded-lg border border-gray-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-start gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary dark:text-sky-400" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                Automated Daily Sync
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                GitHub Actions scrapes CEYPETCO daily at <strong>11:50 PM Sri Lanka Time (UTC+05:30)</strong>,
                reconciles new revisions, carries forward unchanged grades, and republishes KPI files.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary dark:text-sky-400" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                Historical Coverage
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Tracks all 9 fuel grades (White Oil &amp; Black Oil) dating back to March 1990
                {pipelineStatus ? ` (${pipelineStatus.total_csv_rows} verified revisions)` : ""}.
              </p>
            </div>
          </div>
          {pipelineStatus && (
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                  Last Pipeline Check
                </p>
                <p className="tabular-nums text-xs text-slate-600 dark:text-slate-300">
                  {formatColomboTimestamp(pipelineStatus.last_run_sl)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-3.5 text-xs text-slate-500 space-y-1.5 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          <p className="font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Data &amp; Open-Source Attributions
          </p>
          <p>
            • Global energy series: U.S. Energy Information Administration (EIA) via FRED, Federal
            Reserve Bank of St. Louis (public domain).
          </p>
          <p>
            • Interactive financial charts powered by{" "}
            <a
              href="https://www.tradingview.com/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-primary hover:underline dark:text-sky-400"
            >
              TradingView Lightweight Charts™
            </a>{" "}
            (Apache License 2.0).
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
