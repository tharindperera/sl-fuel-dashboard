import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Vote,
} from "lucide-react";
import type { OilAiSummaryData } from "../../types/oil";
import { formatColomboTimestamp } from "../../utils/formatters";

interface OilIntelligenceRowProps {
  summary: OilAiSummaryData;
}

type VoteChoice = "lower" | "higher";

const BASE_LOWER_VOTES = 312;
const BASE_HIGHER_VOTES = 288;

export function OilIntelligenceRow({ summary }: OilIntelligenceRowProps) {
  const storageKey = `cpc-oil-outlook-vote-${summary.latest_date}`;
  const [userVote, setUserVote] = useState<VoteChoice | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "lower" || saved === "higher") {
        setUserVote(saved);
      } else {
        setUserVote(null);
      }
    } catch {
      setUserVote(null);
    }
  }, [storageKey]);

  const handleVote = (choice: VoteChoice) => {
    if (userVote !== null) return;
    setUserVote(choice);
    try {
      window.localStorage.setItem(storageKey, choice);
    } catch {
      // Ignore storage errors
    }
  };

  const lowerCount = BASE_LOWER_VOTES + (userVote === "lower" ? 1 : 0);
  const higherCount = BASE_HIGHER_VOTES + (userVote === "higher" ? 1 : 0);
  const totalVotes = lowerCount + higherCount;
  const lowerPct = ((lowerCount / totalVotes) * 100).toFixed(1);
  const higherPct = (100 - Number(lowerPct)).toFixed(1);

  const isAlert = summary.alert_level === "surge" || summary.alert_level === "drop";

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left (~65%): Commodity Intelligence Report */}
      <article className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7 lg:col-span-8 dark:border-slate-800 dark:bg-slate-900">
        {isAlert && (
          <div
            role="alert"
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-xs font-bold uppercase tracking-wider ${
              summary.alert_level === "surge"
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200"
                : "border-red-300 bg-red-50 text-red-900 dark:border-red-800/70 dark:bg-red-950/40 dark:text-red-200"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {summary.alert_level === "surge"
                  ? "STEEP PRICE SURGE DETECTED"
                  : "UNEXPECTED PRICE DROP DETECTED"}
              </span>
            </span>
            <span className="tabular-nums font-mono">
              1D: {summary.daily_change_pct >= 0 ? "+" : ""}
              {summary.daily_change_pct}% · 5D: {summary.change_5d_pct >= 0 ? "+" : ""}
              {summary.change_5d_pct}%
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-slate-800">
          <div>
            <span className="inline-flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider text-brand-red dark:text-red-400">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Commodity Intelligence Report</span>
            </span>
            <h3 className="mt-1.5 font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {summary.headline}
            </h3>
          </div>

          <span className="tabular-nums rounded border border-gray-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-500 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {summary.generation_mode === "gemini" ? "AI Synthesis" : "Market Brief"} ·{" "}
            {formatColomboTimestamp(summary.generated_at_sl)}
          </span>
        </div>

        <div className="space-y-3.5 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
          {summary.paragraphs.map((para, idx) => (
            <p key={idx}>{para}</p>
          ))}
        </div>

        {/* Driver Tags */}
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-slate-800">
          {summary.driver_tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-gray-200 bg-slate-100 px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Public RSS Source Attribution Links */}
        {summary.sources.length > 0 && (
          <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-slate-800">
            <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Referenced Public Market Headlines
            </p>
            <ul className="space-y-1.5 text-xs">
              {summary.sources.map((src, idx) => (
                <li key={idx}>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-brand-red hover:underline dark:text-slate-300 dark:hover:text-red-400"
                  >
                    <span>{src.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      {/* Right (~35%): Market Outlook Voting */}
      <aside className="flex flex-col justify-between space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7 lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-slate-800">
            <span className="font-heading text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              Market Outlook Voting
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap dark:bg-slate-800 dark:text-slate-300">
              Poll Active
            </span>
          </div>

          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Community settlement sentiment for Brent Crude ({summary.latest_date} reference):
          </p>

          <div className="space-y-2">
            <div className="tabular-nums flex justify-between font-heading text-xs font-extrabold">
              <span className="inline-flex items-center gap-1 text-brand-red dark:text-red-400">
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                <span>LOWER ({lowerPct}%)</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[#0055ff] dark:text-blue-400">
                <span>HIGHER ({higherPct}%)</span>
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>

            <div className="flex h-6 w-full overflow-hidden rounded">
              <div
                style={{ width: `${lowerPct}%` }}
                className="tabular-nums flex items-center justify-center bg-brand-red font-heading text-[10px] font-bold text-white transition-all duration-300"
              >
                {lowerPct}%
              </div>
              <div
                style={{ width: `${higherPct}%` }}
                className="tabular-nums flex items-center justify-center bg-[#0055ff] font-heading text-[10px] font-bold text-white transition-all duration-300"
              >
                {higherPct}%
              </div>
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg border border-gray-100 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <div className="tabular-nums flex items-center gap-1.5 font-heading font-bold text-slate-900 dark:text-white">
              <Vote className="h-4 w-4 text-brand-red dark:text-red-400" aria-hidden="true" />
              <span>{totalVotes.toLocaleString()} Total Submissions</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {userVote
                ? `Your outlook vote (${userVote.toUpperCase()}) is recorded for this session.`
                : "Share your directional outlook for the next Brent benchmark session."}
            </p>
          </div>
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-slate-800">
          <span className="block font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Cast Your Outlook
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              id="vote-lower-btn"
              disabled={userVote !== null}
              onClick={() => handleVote("lower")}
              className={`cursor-pointer rounded-lg py-2.5 text-center font-heading text-xs font-extrabold uppercase tracking-wider whitespace-nowrap transition-colors ${
                userVote === "lower"
                  ? "bg-brand-red text-white"
                  : userVote !== null
                  ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                  : "border border-gray-200 bg-slate-100 text-slate-800 hover:bg-brand-red hover:text-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-brand-red"
              }`}
            >
              Vote Lower
            </button>
            <button
              type="button"
              id="vote-higher-btn"
              disabled={userVote !== null}
              onClick={() => handleVote("higher")}
              className={`cursor-pointer rounded-lg py-2.5 text-center font-heading text-xs font-extrabold uppercase tracking-wider whitespace-nowrap transition-colors ${
                userVote === "higher"
                  ? "bg-[#0055ff] text-white"
                  : userVote !== null
                  ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                  : "border border-gray-200 bg-slate-100 text-slate-800 hover:bg-[#0055ff] hover:text-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-[#0055ff]"
              }`}
            >
              Vote Higher
            </button>
          </div>
        </div>
      </aside>
    </section>
  );
}
