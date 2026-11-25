import { useState } from "react";
import { ArrowRight, ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import type { UiStrings } from "../../i18n/strings";
import type { LanguageCode, RoutePage } from "../../types/fuel";
import type { ThemeMode } from "../../hooks/useTheme";

interface NavbarProps {
  activePage: RoutePage;
  onNavigate: (page: RoutePage) => void;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenAbout: () => void;
  strings: UiStrings;
}

export function Navbar({
  activePage,
  onNavigate,
  language,
  onLanguageChange,
  theme,
  onToggleTheme,
  onOpenAbout,
  strings,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: RoutePage; label: string }[] = [
    { id: "home", label: strings.nav.home },
    { id: "archive", label: strings.nav.archive },
    { id: "trends", label: strings.nav.trends },
    { id: "analysis", label: strings.nav.analysis },
    { id: "global-oil", label: strings.nav.globalOil },
  ];

  const handleSelectPage = (page: RoutePage) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand Mark */}
        <button
          type="button"
          onClick={() => handleSelectPage("home")}
          className="flex cursor-pointer items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-md py-1"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-red text-white shadow-sm ring-4 ring-red-50 dark:ring-red-950/60">
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-base sm:text-xl font-bold leading-none tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              CeylonOctane Analytics
            </span>
            <span className="mt-1 text-[10px] sm:text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-400 uppercase whitespace-nowrap">
              {strings.nav.portalSubtitle}
            </span>
          </div>
        </button>

        {/* Center Navigation Links (Desktop) */}
        <nav aria-label="Primary navigation" className="hidden xl:flex items-center gap-5">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPage(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`relative cursor-pointer py-2 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-sm ${
                  isActive
                    ? "text-brand-red font-bold dark:text-red-400"
                    : "text-slate-700 hover:text-brand-red dark:text-slate-300 dark:hover:text-red-400"
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full bg-brand-red dark:bg-red-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Language Selector */}
          <div className="relative hidden sm:block">
            <select
              aria-label="Select Language"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
              className="appearance-none cursor-pointer rounded border border-gray-300 bg-white pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-gray-400 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
            >
              <option value="en">English</option>
              <option value="si">සිංහල (Sinhala)</option>
              <option value="ta">தமிழ் (Tamil)</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              aria-hidden="true"
            />
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-gray-300 bg-white text-slate-600 shadow-xs transition-colors duration-150 hover:border-gray-400 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* About the Portal CTA */}
          <button
            type="button"
            onClick={onOpenAbout}
            className="hidden sm:inline-flex cursor-pointer items-center gap-2 rounded bg-brand-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm whitespace-nowrap transition-colors duration-150 hover:bg-brand-red-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            <span>{strings.nav.aboutPortal}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            className="inline-flex xl:hidden h-8 w-8 cursor-pointer items-center justify-center rounded border border-gray-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-gray-200 bg-white px-4 py-4 xl:hidden dark:border-slate-800 dark:bg-slate-900">
          <nav aria-label="Mobile navigation" className="flex flex-col space-y-1">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectPage(item.id)}
                  className={`flex items-center justify-between rounded-md px-3 py-2.5 text-left text-xs font-bold tracking-wider uppercase transition-colors ${
                    isActive
                      ? "bg-red-50 text-brand-red dark:bg-red-950/50 dark:text-red-400"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-brand-red" />}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-slate-800">
            <select
              aria-label="Select Language"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
              className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="en">English</option>
              <option value="si">සිංහල (Sinhala)</option>
              <option value="ta">தமிழ் (Tamil)</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAbout();
              }}
              className="inline-flex items-center gap-1.5 rounded bg-brand-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white whitespace-nowrap"
            >
              <span>{strings.nav.aboutPortal}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
