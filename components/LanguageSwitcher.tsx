'use client';

import { useLocale } from '@/lib/i18n-context';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-1.5 bg-background-secondary rounded-lg p-1">
      <button
        onClick={() => setLocale('zh-CN')}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          locale === 'zh-CN'
            ? 'bg-primary text-white shadow-sm'
            : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
        }`}
        aria-label="Switch to Chinese"
      >
        中文
      </button>
      <button
        onClick={() => setLocale('en-US')}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          locale === 'en-US'
            ? 'bg-primary text-white shadow-sm'
            : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
        }`}
        aria-label="Switch to English"
      >
        EN
      </button>
    </div>
  );
}
