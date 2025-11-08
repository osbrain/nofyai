'use client';

import { useTranslations } from '@/lib/i18n-context';

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="mt-16 border-t border-border bg-white">
      <div className="w-full px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-text-secondary text-sm">
              {t.footer.description}
            </p>
            <p className="text-text-tertiary text-xs mt-1">
              {t.footer.riskWarning}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <a href="" target="_blank" rel="noopener noreferrer" className="text-sm text-text-secondary hover:text-primary transition-colors">
              {t.nav.github}
            </a>
            <a href="#" className="text-sm text-text-secondary hover:text-primary transition-colors">
              {t.nav.documentation}
            </a>
            <a href="/api" className="text-sm text-text-secondary hover:text-primary transition-colors">
              {t.nav.api}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
