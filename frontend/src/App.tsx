import { useEffect, useState } from "react";
import { Footer } from "./components/layout/Footer";
import { AboutPortalModal, ContactModal } from "./components/layout/InfoModals";
import { Navbar } from "./components/layout/Navbar";
import { useArchiveData, useCurrentRates, useTrendsKpis } from "./hooks/useFuelData";
import { useTheme } from "./hooks/useTheme";
import { getStrings } from "./i18n/strings";
import { AnalysisPage } from "./pages/AnalysisPage";
import { ArchivePage } from "./pages/ArchivePage";
import { HomePage } from "./pages/HomePage";
import { TrendsPage } from "./pages/TrendsPage";
import type { LanguageCode, RoutePage } from "./types/fuel";

function parseHashRoute(): RoutePage {
  if (typeof window === "undefined") return "home";
  const clean = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (clean === "archive" || clean === "historical-archive") return "archive";
  if (clean === "trends") return "trends";
  if (clean === "analysis") return "analysis";
  return "home";
}

export function App() {
  const [activePage, setActivePage] = useState<RoutePage>(parseHashRoute);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const strings = getStrings(language);

  const currentRatesState = useCurrentRates();
  const archiveState = useArchiveData();
  const trendsState = useTrendsKpis();

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
        onOpenContact={() => setContactOpen(true)}
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
      </main>

      <Footer onOpenAbout={() => setAboutOpen(true)} strings={strings} />

      <AboutPortalModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        pipelineStatus={currentRatesState.pipelineStatus}
      />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}

export default App;
