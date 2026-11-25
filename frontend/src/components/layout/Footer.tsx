import { ArrowRight } from "lucide-react";
import type { UiStrings } from "../../i18n/strings";

interface FooterProps {
  onOpenAbout: () => void;
  strings: UiStrings;
}

export function Footer({ onOpenAbout, strings }: FooterProps) {
  return (
    <footer className="border-t border-sky-800 bg-brand-primary text-white">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="space-y-4 border-b border-sky-600/60 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-xs">
              <img
                src="./logo.png"
                alt="CeylonOctane Analytics logo"
                className="h-9 w-9 object-contain object-bottom"
              />
            </div>
            <span className="font-heading text-xl font-bold tracking-tight text-white">
              CeylonOctane Analytics
            </span>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-sky-100">{strings.footer.tagline}</p>
          <button
            type="button"
            onClick={onOpenAbout}
            className="inline-flex cursor-pointer items-center gap-1.5 pt-1 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:text-sky-100 focus:outline-none focus-visible:underline"
          >
            <span>{strings.footer.aboutPortal}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 text-xs text-sky-100/90 sm:flex-row sm:items-center sm:justify-between">
          <p>{strings.footer.copyright}</p>
          <p className="text-sky-200/90">Data sourced from Ceylon Petroleum Corporation (CEYPETCO)</p>
        </div>
      </div>
    </footer>
  );
}
