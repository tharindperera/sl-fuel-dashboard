export interface GradeVisualConfig {
  code: string;
  shortLabel: string;
  color: string;
  badgeBgClass: string;
  badgeTextClass: string;
  topBorderClass: string;
  dotClass: string;
}

export const GRADE_VISUALS: Record<string, GradeVisualConfig> = {
  "LP 92": {
    code: "LP 92",
    shortLabel: "Petrol 92",
    color: "#0055ff",
    badgeBgClass: "bg-blue-50 dark:bg-blue-950/50",
    badgeTextClass: "text-[#0055ff] dark:text-blue-400",
    topBorderClass: "border-t-[#0055ff]",
    dotClass: "bg-[#0055ff]",
  },
  "LP 95": {
    code: "LP 95",
    shortLabel: "Petrol 95",
    color: "#C8102E",
    badgeBgClass: "bg-red-50 dark:bg-red-950/50",
    badgeTextClass: "text-[#C8102E] dark:text-red-400",
    topBorderClass: "border-t-[#C8102E]",
    dotClass: "bg-[#C8102E]",
  },
  LAD: {
    code: "LAD",
    shortLabel: "Auto Diesel",
    color: "#107c41",
    badgeBgClass: "bg-emerald-50 dark:bg-emerald-950/50",
    badgeTextClass: "text-[#107c41] dark:text-emerald-400",
    topBorderClass: "border-t-[#107c41]",
    dotClass: "bg-[#107c41]",
  },
  LSD: {
    code: "LSD",
    shortLabel: "Super Diesel",
    color: "#7c3aed",
    badgeBgClass: "bg-purple-50 dark:bg-purple-950/50",
    badgeTextClass: "text-[#7c3aed] dark:text-purple-400",
    topBorderClass: "border-t-[#7c3aed]",
    dotClass: "bg-[#7c3aed]",
  },
  LK: {
    code: "LK",
    shortLabel: "Kerosene",
    color: "#ea580c",
    badgeBgClass: "bg-amber-50 dark:bg-amber-950/50",
    badgeTextClass: "text-[#ea580c] dark:text-amber-400",
    topBorderClass: "border-t-[#ea580c]",
    dotClass: "bg-[#ea580c]",
  },
  LIK: {
    code: "LIK",
    shortLabel: "Ind. Kerosene",
    color: "#0891b2",
    badgeBgClass: "bg-cyan-50 dark:bg-cyan-950/50",
    badgeTextClass: "text-[#0891b2] dark:text-cyan-400",
    topBorderClass: "border-t-[#0891b2]",
    dotClass: "bg-[#0891b2]",
  },
  "FUR. 800": {
    code: "FUR. 800",
    shortLabel: "Furnace 800",
    color: "#475569",
    badgeBgClass: "bg-slate-100 dark:bg-slate-800",
    badgeTextClass: "text-slate-700 dark:text-slate-300",
    topBorderClass: "border-t-slate-600",
    dotClass: "bg-slate-600",
  },
  "FUR 1500 (H)": {
    code: "FUR 1500 (H)",
    shortLabel: "Furnace 1500 (H)",
    color: "#be185d",
    badgeBgClass: "bg-pink-50 dark:bg-pink-950/50",
    badgeTextClass: "text-[#be185d] dark:text-pink-400",
    topBorderClass: "border-t-[#be185d]",
    dotClass: "bg-[#be185d]",
  },
  "FUR 1500 (L)": {
    code: "FUR 1500 (L)",
    shortLabel: "Furnace 1500 (L)",
    color: "#65a30d",
    badgeBgClass: "bg-lime-50 dark:bg-lime-950/50",
    badgeTextClass: "text-[#65a30d] dark:text-lime-400",
    topBorderClass: "border-t-[#65a30d]",
    dotClass: "bg-[#65a30d]",
  },
};

export const ALL_GRADE_CODES = [
  "LP 92",
  "LP 95",
  "LAD",
  "LSD",
  "LK",
  "LIK",
  "FUR. 800",
  "FUR 1500 (H)",
  "FUR 1500 (L)",
] as const;

export function getGradeVisual(code: string): GradeVisualConfig {
  return (
    GRADE_VISUALS[code] ?? {
      code,
      shortLabel: code,
      color: "#64748b",
      badgeBgClass: "bg-slate-100 dark:bg-slate-800",
      badgeTextClass: "text-slate-700 dark:text-slate-300",
      topBorderClass: "border-t-slate-500",
      dotClass: "bg-slate-500",
    }
  );
}
