import type { LanguageCode } from "../types/fuel";

export interface UiStrings {
  nav: {
    home: string;
    archive: string;
    trends: string;
    analysis: string;
    globalOil: string;
    aboutPortal: string;
    portalSubtitle: string;
  };
  home: {
    title: string;
    subtitle: string;
    liveStatusTitle: string;
    productCategoryEyebrow: string;
  };
  archive: {
    badge: string;
    title: string;
    subtitle: string;
    firstRecord: string;
    firstRecordNote: string;
    datasetSize: string;
    datasetSizeNote: string;
    sectionEyebrow: string;
    sectionTitle: string;
    sectionSubtitle: string;
    exportCsv: string;
  };
  footer: {
    tagline: string;
    aboutPortal: string;
    copyright: string;
  };
}

const EN_STRINGS: UiStrings = {
  nav: {
    home: "HOME",
    archive: "HISTORICAL PRICE ARCHIVE",
    trends: "TRENDS",
    analysis: "ANALYSIS",
    globalOil: "GLOBAL CRUDE OIL PRICE",
    aboutPortal: "ABOUT THE PORTAL",
    portalSubtitle: "Analytics & Pricing Portal",
  },
  home: {
    title: "Current market rates",
    subtitle: "Current rates for retail and industrial fuel products",
    liveStatusTitle: "Current pricing",
    productCategoryEyebrow: "PRODUCT CATEGORY",
  },
  archive: {
    badge: "PRICE HISTORY",
    title: "Explore the historical price archive",
    subtitle:
      "Browse CPC Fuel Trends' published fuel prices from 1990 onward. Use the filters to find a date or focus on one fuel product.",
    firstRecord: "FIRST RECORD",
    firstRecordNote: "Earliest fuel record",
    datasetSize: "DATASET SIZE",
    datasetSizeNote: "Fuel price records",
    sectionEyebrow: "FUEL PRICES ARCHIVE",
    sectionTitle: "Historical fuel prices",
    sectionSubtitle: "Published price figures in Sri Lankan rupees.",
    exportCsv: "EXPORT CSV",
  },
  footer: {
    tagline:
      "Delivering dependable fuel analytics, market rate tracking, and historical price intelligence.",
    aboutPortal: "ABOUT THE PORTAL",
    copyright: "© 2026 CPC Fuel Trends. All rights reserved.",
  },
};

// Structured localization map ready for full Sinhala & Tamil translations in a future pass.
const DICTIONARY: Record<LanguageCode, UiStrings> = {
  en: EN_STRINGS,
  si: {
    ...EN_STRINGS,
    nav: {
      ...EN_STRINGS.nav,
      home: "මුල් පිටුව",
      archive: "ඓතිහාසික මිල ලේඛනය",
      trends: "ප්‍රවණතා",
      analysis: "විශ්ලේෂණය",
      globalOil: "ගෝලීය බොරතෙල් මිල",
      aboutPortal: "පෝටලය ගැන",
    },
    home: {
      ...EN_STRINGS.home,
      title: "වත්මන් වෙළඳපොළ මිල ගණන්",
      subtitle: "සිල්ලර සහ කාර්මික ඉන්ධන නිෂ්පාදන සඳහා වත්මන් මිල ගණන්",
    },
  },
  ta: {
    ...EN_STRINGS,
    nav: {
      ...EN_STRINGS.nav,
      home: "முகப்பு",
      archive: "வரலாற்று விலை ஆவணம்",
      trends: "போக்குகள்",
      analysis: "பகுப்பாய்வு",
      globalOil: "உலகளாவிய கச்சா எண்ணெய் விலை",
      aboutPortal: "போர்டல் பற்றி",
    },
    home: {
      ...EN_STRINGS.home,
      title: "தற்போதைய சந்தை விலைகள்",
      subtitle: "சில்லறை மற்றும் தொழில்துறை எரிபொருள் பொருட்களுக்கான தற்போதைய விலைகள்",
    },
  },
};

export function getStrings(lang: LanguageCode): UiStrings {
  return DICTIONARY[lang] ?? EN_STRINGS;
}
