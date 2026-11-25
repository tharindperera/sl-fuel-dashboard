import { useEffect, useState } from "react";
import { Footer } from "./components/layout/Footer";
import { AboutPortalModal } from "./components/layout/InfoModals";
import { Navbar } from "./components/layout/Navbar";
import {
  useArchiveData,
  useCurrentRates,
  useGlobalOilData,
  useTrendsKpis,
} from "./hooks/useFuelData";
import { useTheme } from "./hooks/useTheme";
import { getStrings } from "./i18n/strings";
import { AnalysisPage } from "./pages/AnalysisPage";
import { ArchivePage } from "./pages/ArchivePage";
import { GlobalOilPage } from "./pages/GlobalOilPage";
import { HomePage } from "./pages/HomePage";
import { TrendsPage } from "./pages/TrendsPage";
import type { LanguageCode, RoutePage } from "./types/fuel";

function parseHashRoute(): RoutePage {
  if (typeof window === "undefined") return "home";
  const clean = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (clean === "archive" || clean === "historical-archive") return "archive";
  if (clean === "trends") return "trends";
  if (clean === "analysis") return "analysis";
  if (
    clean === "global-oil" ||
    clean === "global-crude-oil" ||
    clean === "global-crude-oil-price"
  ) {
    return "global-oil";
  }
  return "home";
}

export function App() {
  const [activePage, setActivePage] = useState<RoutePage>(parseHashRoute);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [aboutOpen, setAboutOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const strings = getStrings(language);

  const currentRatesState = useCurrentRates();
  const archiveState = useArchiveData();
  const trendsState = useTrendsKpis();
  const globalOilState = useGlobalOilData();

  useEffect(() => {
    const onHashChange = () => setActivePage(parseHashRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleNavigate = (page: RoutePage) => {
    setActivePage(page);
    const nextHash = page === "home" ? "#/" : `#/${page}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex min-h-screen flex-col justify-between">
      <Navbar
        activePage={activePage}
        onNavigate={handleNavigate}
        language={language}
        onLanguageChange={setLanguage}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenAbout={() => setAboutOpen(true)}
        strings={strings}
      />

      <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {activePage === "home" && (
          <HomePage
            data={currentRatesState.data}
            loading={currentRatesState.loading}
            error={currentRatesState.error}
            onRetry={currentRatesState.reload}
            strings={strings}
          />
        )}

        {activePage === "archive" && (
          <ArchivePage
            meta={archiveState.meta}
            rows={archiveState.rows}
            monthly={archiveState.monthly}
            annual={archiveState.annual}
            loading={archiveState.loading}
            error={archiveState.error}
            onRetry={archiveState.reload}
            strings={strings}
          />
        )}

        {activePage === "trends" && (
          <TrendsPage
            data={trendsState.data}
            loading={trendsState.loading}
            error={trendsState.error}
            onRetry={trendsState.reload}
          />
        )}

        {activePage === "analysis" && (
          <AnalysisPage
            data={trendsState.data}
            loading={trendsState.loading}
            error={trendsState.error}
            onRetry={trendsState.reload}
          />
        )}

        {activePage === "global-oil" && (
          <GlobalOilPage
            kpis={globalOilState.kpis}
            history={globalOilState.history}
            aiSummary={globalOilState.aiSummary}
            intraday={globalOilState.intraday}
            loading={globalOilState.loading}
            error={globalOilState.error}
            onRetry={globalOilState.reload}
            theme={theme}
          />
        )}
      </main>

      <Footer onOpenAbout={() => setAboutOpen(true)} strings={strings} />

      <AboutPortalModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        pipelineStatus={currentRatesState.pipelineStatus}
      />
    </div>
  );
}

export default App;
