import { ArrowRight } from "lucide-react";
import type { UiStrings } from "../../i18n/strings";

interface FooterProps {
  onOpenAbout: () => void;
  strings: UiStrings;
}

export function Footer({ onOpenAbout, strings }: FooterProps) {
  return (
    <footer className="border-t border-red-800 bg-brand-red text-white">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="space-y-4 border-b border-red-700/70 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-red shadow-xs">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </div>
            <span className="font-heading text-xl font-bold tracking-tight text-white">
              CeylonOctane Analytics
            </span>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-red-100">{strings.footer.tagline}</p>
          <button
            type="button"
            onClick={onOpenAbout}
            className="inline-flex cursor-pointer items-center gap-1.5 pt-1 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:text-red-100 focus:outline-none focus-visible:underline"
          >
            <span>{strings.footer.aboutPortal}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 text-xs text-red-100/90 sm:flex-row sm:items-center sm:justify-between">
          <p>{strings.footer.copyright}</p>
          <p className="text-red-200/90">Data sourced from Ceylon Petroleum Corporation (CEYPETCO)</p>
        </div>
      </div>
    </footer>
  );
}
