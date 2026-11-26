import type { RefObject } from 'react';
import { CheckCircle2, KeyRound, Moon, Sun } from 'lucide-react';
import type { Translations } from '../i18n';
import type { KalodataLimitSettings, KalodataStatus, Language, Theme } from '../types';
import { LanguageSwitch } from './LanguageSwitch';

export type ActiveTab = 'discover' | 'rank_board' | 'search_history' | 'studio' | 'history';

interface TopBarProps {
  activeTab: ActiveTab;
  onNavigate: (tab: 'discover' | 'rank_board' | 'search_history' | 'history') => void;
  language: Language;
  onToggleLanguage: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  searchHistoryCount: number;
  savedCount: number;
  kalodataStatus: KalodataStatus;
  kalodataLimits: KalodataLimitSettings;
  isKalodataPanelOpen: boolean;
  onToggleKalodataPanel: () => void;
  headerRef?: RefObject<HTMLElement | null>;
  isHidden?: boolean;
  onRevealHeader?: () => void;
  studioReturnTab?: 'discover' | 'rank_board' | 'history';
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
  searchHistoryCount,
  savedCount,
  kalodataStatus,
  kalodataLimits,
  isKalodataPanelOpen,
  onToggleKalodataPanel,
  headerRef,
  isHidden = false,
  onRevealHeader,
  studioReturnTab = 'discover',
  t,
}: TopBarProps) {
  const isDiscoverActive =
    activeTab === 'discover' || (activeTab === 'studio' && studioReturnTab === 'discover');
  const isRankBoardActive =
    activeTab === 'rank_board' || (activeTab === 'studio' && studioReturnTab === 'rank_board');
  const isSearchHistoryActive = activeTab === 'search_history';
  const isHistoryActive =
    activeTab === 'history' || (activeTab === 'studio' && studioReturnTab === 'history');
  const hasLimit =
    kalodataLimits.maxSpendCredits !== null || kalodataLimits.minBalanceReserve !== null;

  return (
    <header
      ref={headerRef}
      onFocusCapture={() => {
        if (isHidden) onRevealHeader?.();
      }}
      className={`sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/90 bg-[#F8FAFC]/95 dark:bg-[#0B1117]/95 backdrop-blur-md transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
        isHidden ? '-translate-y-full pointer-events-none' : 'translate-y-0'
      }`}
    >
      {/* Row 1: Brand (+ Desktop Nav on lg+) + Right Utility Controls */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-15 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
        <div className="flex items-center gap-4 lg:gap-6 min-w-0">
          <button
            type="button"
            onClick={() => onNavigate('discover')}
            className="font-display text-[15px] sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-md px-1 -ml-1 cursor-pointer"
          >
            SiamVisual
          </button>

          {/* Desktop Inline Navigation (lg+ only so tablet 640-1023px never overlaps right utility buttons) */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-5 xl:gap-6">
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
              onClick={() => onNavigate('rank_board')}
              className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-sm ${
                isRankBoardActive
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.nav.rankBoard}
              {isRankBoardActive && (
                <span className="absolute inset-x-0 -bottom-[11px] h-[2px] bg-teal-600 dark:bg-teal-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('search_history')}
              className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-sm ${
                isSearchHistoryActive
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{t.nav.searchHistory}</span>
              {searchHistoryCount > 0 && (
                <span className="ml-1 text-xs font-mono-num text-slate-400 dark:text-slate-500">
                  ({searchHistoryCount})
                </span>
              )}
              {isSearchHistoryActive && (
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
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleKalodataPanel}
            aria-expanded={isKalodataPanelOpen}
            className={`h-9 px-2 sm:px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1 sm:gap-1.5 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
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
                <span className="font-mono-num font-semibold max-w-[78px] sm:max-w-none truncate">
                  {kalodataStatus.balance?.available !== null &&
                  kalodataStatus.balance?.available !== undefined
                    ? `${formatCompactCredits(kalodataStatus.balance.available)} ${t.nav.creditsShort}`
                    : 'OK'}
                </span>
                {hasLimit && (
                  <span className="hidden xl:inline text-[11px] text-teal-700 dark:text-teal-400 font-medium">
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

          <LanguageSwitch language={language} onToggle={onToggleLanguage} />

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

      {/* Row 2 (Mobile & Tablet <1024px): Clean Dedicated 4-Tab Row with 44px touch targets */}
      <nav
        aria-label="Mobile and tablet navigation"
        className="lg:hidden border-t border-slate-200/70 dark:border-slate-800/80"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-4">
          <button
            type="button"
            onClick={() => onNavigate('discover')}
            title={t.nav.discover}
            className={`relative h-11 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
              isDiscoverActive
                ? 'text-teal-700 dark:text-teal-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="truncate">{t.nav.discover}</span>
            {isDiscoverActive && (
              <span className="absolute inset-x-2.5 sm:inset-x-5 bottom-0 h-[2px] bg-teal-600 dark:bg-teal-400 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('rank_board')}
            title={t.nav.rankBoard}
            className={`relative h-11 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
              isRankBoardActive
                ? 'text-teal-700 dark:text-teal-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="truncate">{t.nav.rankBoard}</span>
            {isRankBoardActive && (
              <span className="absolute inset-x-2.5 sm:inset-x-5 bottom-0 h-[2px] bg-teal-600 dark:bg-teal-400 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('search_history')}
            title={t.nav.searchHistory}
            className={`relative h-11 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-0.5 sm:gap-1 transition-colors cursor-pointer ${
              isSearchHistoryActive
                ? 'text-teal-700 dark:text-teal-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="truncate">{t.nav.searchHistory}</span>
            {searchHistoryCount > 0 && (
              <span className="font-mono-num text-[10px] sm:text-[11px] opacity-75 shrink-0">
                ({searchHistoryCount})
              </span>
            )}
            {isSearchHistoryActive && (
              <span className="absolute inset-x-2.5 sm:inset-x-5 bottom-0 h-[2px] bg-teal-600 dark:bg-teal-400 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('history')}
            title={t.nav.history}
            className={`relative h-11 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-0.5 sm:gap-1 transition-colors cursor-pointer ${
              isHistoryActive
                ? 'text-teal-700 dark:text-teal-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="truncate">{t.nav.history}</span>
            {savedCount > 0 && (
              <span className="font-mono-num text-[10px] sm:text-[11px] opacity-75 shrink-0">
                ({savedCount})
              </span>
            )}
            {isHistoryActive && (
              <span className="absolute inset-x-2.5 sm:inset-x-5 bottom-0 h-[2px] bg-teal-600 dark:bg-teal-400 rounded-full" />
            )}
          </button>
        </div>
      </nav>
    </header>
  );
}
