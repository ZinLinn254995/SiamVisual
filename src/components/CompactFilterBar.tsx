import { Check, Link2, Search, SlidersHorizontal } from 'lucide-react';
import type { Translations } from '../i18n';
import type { SearchPageSizeOption } from '../lib/discoveryFilterEngine';
import type { KalodataCategoryItem, Language } from '../types';

interface CompactFilterBarProps {
  isVisible: boolean;
  isHeaderHidden: boolean;
  headerHeight: number;
  headerSafeTop?: number;
  categories: KalodataCategoryItem[];
  selectedCateIds: string[];
  categoryMatchCounts: Map<string, number>;
  language: Language;
  query: string;
  searchPageSize: SearchPageSizeOption;
  isSearching: boolean;
  isSingleLinkValid: boolean;
  isLinkOrId: boolean;
  leanSearchCost?: number;
  isOffline?: boolean;
  t: Translations;
  onToggleCategory: (cateId: string) => void;
  onOpenSearchDrawer: () => void;
}

export function CompactFilterBar({
  isVisible,
  isHeaderHidden,
  headerHeight,
  headerSafeTop = 0,
  categories,
  selectedCateIds,
  categoryMatchCounts,
  language,
  query,
  searchPageSize,
  isSearching,
  isSingleLinkValid,
  isLinkOrId,
  leanSearchCost = 0.2,
  isOffline = false,
  t,
  onToggleCategory,
  onOpenSearchDrawer,
}: CompactFilterBarProps) {
  // Synchronize Y offset edge-to-edge with TopBar while avoiding double safe-area gap:
  // - Scrolling down in results: sits flush at y=0 with pt-[env(safe-area-inset-top)] clearing notch
  // - Header revealed: docks underneath TopBar (z-29 behind TopBar z-30) so safe-area sits behind TopBar
  const dockedY = Math.max(0, headerHeight - headerSafeTop);
  const translateY = isVisible ? (isHeaderHidden ? 0 : dockedY) : dockedY;

  return (
    <div
      aria-hidden={!isVisible}
      style={{ transform: `translate3d(0, ${translateY}px, 0)` }}
      className={`fixed top-0 inset-x-0 z-[29] pt-[env(safe-area-inset-top)] h-[calc(52px+env(safe-area-inset-top))] mobile-landscape-compact-bar border-b border-slate-200/85 dark:border-slate-800/90 bg-[#F8FAFC]/95 dark:bg-[#0B1117]/95 backdrop-blur-md transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
        isVisible
          ? 'opacity-100 pointer-events-auto shadow-[0_4px_16px_-10px_rgba(15,23,42,0.16)] dark:shadow-[0_4px_16px_-10px_rgba(0,0,0,0.45)]'
          : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Main Compact Single Row: Horizontally Scrollable Category Filters + Bottom Drawer Search Trigger */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-full flex items-center gap-2 sm:gap-3">
        {/* Compact Scrollable Category Strip */}
        <div
          className={`relative flex-1 min-w-0 transition-opacity duration-150 ${
            isLinkOrId ? 'opacity-45 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain py-1 pl-0.5 pr-6">
            {categories.map((cat) => {
              const isAll = !cat.id;
              const isSelected = isAll
                ? selectedCateIds.length === 0
                : selectedCateIds.includes(cat.id);
              const matchCount = categoryMatchCounts.get(cat.id) ?? 0;

              return (
                <button
                  key={cat.id || 'all'}
                  type="button"
                  tabIndex={isVisible ? 0 : -1}
                  aria-pressed={isSelected}
                  onClick={() => onToggleCategory(cat.id)}
                  className={`h-9 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                      : 'bg-white dark:bg-[#131B24] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {!isAll && isSelected && <Check className="w-3 h-3 shrink-0" />}
                  <span>{cat.label[language]}</span>
                  {matchCount > 0 && (
                    <span
                      className={`font-mono-num text-[10px] ${
                        isSelected
                          ? 'text-white/75 dark:text-slate-950/70'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {matchCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Right edge scroll fade cue */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#F8FAFC] dark:from-[#0B1117] to-transparent"
          />
        </div>

        {categories.length > 0 && (
          <span
            aria-hidden="true"
            className="h-5 w-px bg-slate-200/90 dark:bg-slate-800 shrink-0"
          />
        )}

        {/* Primary Search Trigger -> Opens Bottom Search & Filter Drawer */}
        <div className="flex items-center gap-1.5 shrink-0">
          {query.trim() && (
            <button
              type="button"
              tabIndex={isVisible ? 0 : -1}
              onClick={onOpenSearchDrawer}
              className="hidden md:inline-flex h-9 px-2.5 rounded-lg border border-teal-300/80 dark:border-teal-800 bg-teal-50/75 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 text-xs font-medium items-center gap-1.5 max-w-[140px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {isLinkOrId ? (
                <Link2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{query.trim()}</span>
            </button>
          )}

          <button
            type="button"
            tabIndex={isVisible ? 0 : -1}
            disabled={isSearching || isOffline}
            onClick={onOpenSearchDrawer}
            className="h-9 px-3 sm:px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-150 whitespace-nowrap shrink-0 disabled:opacity-55 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {isSingleLinkValid ? (
              <Link2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Search className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {isSearching
                ? t.search.searchingButton
                : isSingleLinkValid
                  ? t.search.searchSingleButton
                  : t.search.searchButton}
            </span>
            {!isSearching && (
              <span className="font-mono-num tabular-nums text-[10.5px] opacity-85">
                ~{leanSearchCost}cr
              </span>
            )}
            {!isSearching && !isSingleLinkValid && (
              <span className="hidden lg:inline font-mono-num tabular-nums text-[11px] opacity-85">
                ({searchPageSize})
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
