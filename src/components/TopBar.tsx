import { CheckCircle2, KeyRound, Moon, Sun } from 'lucide-react';
import type { Translations } from '../i18n';
import type { KalodataLimitSettings, KalodataStatus, Language, Theme } from '../types';

export type ActiveTab = 'discover' | 'studio' | 'history';

interface TopBarProps {
  activeTab: ActiveTab;
  onNavigate: (tab: 'discover' | 'history') => void;
  language: Language;
  onToggleLanguage: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  savedCount: number;
  kalodataStatus: KalodataStatus;
  kalodataLimits: KalodataLimitSettings;
  isKalodataPanelOpen: boolean;
  onToggleKalodataPanel: () => void;
  t: Translations;
}

function formatCompactCredits(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString()
    : n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function TopBar({
  activeTab,
  onNavigate,
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
  savedCount,
  kalodataStatus,
  kalodataLimits,
  isKalodataPanelOpen,
  onToggleKalodataPanel,
  t,
}: TopBarProps) {
  const isDiscoverActive = activeTab === 'discover' || activeTab === 'studio';
  const isHistoryActive = activeTab === 'history';
  const hasLimit =
    kalodataLimits.maxSpendCredits !== null || kalodataLimits.minBalanceReserve !== null;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/90 bg-[#F8FAFC]/95 dark:bg-[#0B1117]/95 backdrop-blur-md">
      {/* Row 1: Brand (+ Desktop Nav) + Right Utility Controls */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-15 flex items-center justify-between gap-2 sm:gap-6">
        <div className="flex items-center gap-6 min-w-0">
          <button
            type="button"
            onClick={() => onNavigate('discover')}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-md px-1 -ml-1 cursor-pointer"
          >
            SiamVisual
          </button>

          {/* Tablet / Desktop Inline Navigation */}
          <nav aria-label="Main navigation" className="hidden sm:flex items-center gap-6">
            <button
              type="button"
              onClick={() => onNavigate('discover')}
              className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-sm ${
                isDiscoverActive
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.nav.discover}
              {isDiscoverActive && (
                <span className="absolute inset-x-0 -bottom-[11px] h-[2px] bg-teal-600 dark:bg-teal-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('history')}
              className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-sm ${
                isHistoryActive
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{t.nav.history}</span>
              {savedCount > 0 && (
                <span className="ml-1 text-xs font-mono-num text-slate-400 dark:text-slate-500">
                  ({savedCount})
                </span>
              )}
              {isHistoryActive && (
                <span className="absolute inset-x-0 -bottom-[11px] h-[2px] bg-teal-600 dark:bg-teal-400" />
              )}
            </button>
          </nav>
        </div>

        {/* Utility Controls (guaranteed zero overlap on 320px+ mobile) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleKalodataPanel}
            aria-expanded={isKalodataPanelOpen}
            className={`h-9 px-2.5 sm:px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              isKalodataPanelOpen
                ? 'border-teal-600 dark:border-teal-400 bg-teal-50/70 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200'
                : kalodataStatus.connected
                  ? 'border-slate-200 dark:border-slate-700/90 bg-white dark:bg-[#131B24] text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600'
                  : 'border-amber-300 dark:border-amber-700/70 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 hover:border-amber-400'
            }`}
          >
            {kalodataStatus.connected ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-mono-num font-semibold">
                  {kalodataStatus.balance?.available !== null &&
                  kalodataStatus.balance?.available !== undefined
                    ? `${formatCompactCredits(kalodataStatus.balance.available)} ${t.nav.creditsShort}`
                    : 'OK'}
                </span>
                {hasLimit && (
                  <span className="hidden md:inline text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                    · Limit
                  </span>
                )}
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{t.nav.connectApiShort}</span>
                <span className="sm:hidden">API</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleLanguage}
            aria-label={language === 'my' ? 'Switch to English' : 'မြန်မာဘာသာသို့ ပြောင်းမယ်'}
            className="h-9 px-2.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#131B24] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {language === 'my' ? 'EN' : 'မြန်မာ'}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? t.nav.toggleThemeLight : t.nav.toggleThemeDark}
            title={theme === 'dark' ? t.nav.toggleThemeLight : t.nav.toggleThemeDark}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#131B24] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Row 2 (Mobile Only): Clean Dedicated Tab Row so buttons NEVER overlap */}
      <nav
        aria-label="Mobile navigation"
        className="sm:hidden border-t border-slate-200/70 dark:border-slate-800/80 grid grid-cols-2"
      >
        <button
          type="button"
          onClick={() => onNavigate('discover')}
          className={`relative h-10 text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
            isDiscoverActive
              ? 'text-teal-700 dark:text-teal-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>{t.nav.discover}</span>
          {isDiscoverActive && (
            <span className="absolute inset-x-4 bottom-0 h-[2px] bg-teal-600 dark:bg-teal-400 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onNavigate('history')}
          className={`relative h-10 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
            isHistoryActive
              ? 'text-teal-700 dark:text-teal-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>{t.nav.history}</span>
          {savedCount > 0 && (
            <span className="font-mono-num text-[11px] opacity-75">({savedCount})</span>
          )}
          {isHistoryActive && (
            <span className="absolute inset-x-4 bottom-0 h-[2px] bg-teal-600 dark:bg-teal-400 rounded-full" />
          )}
        </button>
      </nav>
    </header>
  );
}
