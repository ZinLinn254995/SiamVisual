import { type FormEvent, useEffect, useRef } from 'react';
import { Check, Link2, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Translations } from '../i18n';
import type { KalodataCategoryItem, Language } from '../types';

interface CompactFilterBarProps {
  isVisible: boolean;
  isHeaderHidden: boolean;
  headerHeight: number;
  categories: KalodataCategoryItem[];
  selectedCateIds: string[];
  categoryMatchCounts: Map<string, number>;
  language: Language;
  query: string;
  isCompactSearchOpen: boolean;
  isSearching: boolean;
  isSingleLinkValid: boolean;
  isLinkOrId: boolean;
  isLinkBroken: boolean;
  isShortLink: boolean;
  linkProductId: string | null;
  searchLimitWarning: string | null;
  leanSearchCost: number;
  t: Translations;
  onToggleCategory: (cateId: string) => void;
  onQueryChange: (next: string) => void;
  onToggleCompactSearch: () => void;
  onCloseCompactSearch: () => void;
  onSubmitSearch: () => void;
}

export function CompactFilterBar({
  isVisible,
  isHeaderHidden,
  headerHeight,
  categories,
  selectedCateIds,
  categoryMatchCounts,
  language,
  query,
  isCompactSearchOpen,
  isSearching,
  isSingleLinkValid,
  isLinkOrId,
  isLinkBroken,
  isShortLink,
  linkProductId,
  searchLimitWarning,
  leanSearchCost,
  t,
  onToggleCategory,
  onQueryChange,
  onToggleCompactSearch,
  onCloseCompactSearch,
  onSubmitSearch,
}: CompactFilterBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isCompactSearchOpen || !isVisible) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 90);
    return () => window.clearTimeout(timer);
  }, [isCompactSearchOpen, isVisible]);

  // Synchronize Y offset edge-to-edge with TopBar:
  // - Hidden (at top of page): parked at headerHeight, invisible
  // - Scrolling down in results: sits flush at y=0, replacing the pushed-out Header
  // - Scrolled slightly back up: glides down to y=headerHeight right beneath the revealed Header
  const translateY = isVisible ? (isHeaderHidden ? 0 : headerHeight) : headerHeight;

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSearching || Boolean(searchLimitWarning) || isLinkBroken) return;
    onCloseCompactSearch();
    onSubmitSearch();
  }

  return (
    <div
      aria-hidden={!isVisible}
      style={{ transform: `translate3d(0, ${translateY}px, 0)` }}
      className={`fixed top-0 inset-x-0 z-[29] border-b border-slate-200/85 dark:border-slate-800/90 bg-[#F8FAFC]/95 dark:bg-[#0B1117]/95 backdrop-blur-md transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
        isVisible
          ? 'opacity-100 pointer-events-auto shadow-[0_4px_16px_-10px_rgba(15,23,42,0.16)] dark:shadow-[0_4px_16px_-10px_rgba(0,0,0,0.45)]'
          : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Main Compact Single Row: Horizontally Scrollable Category Filters + Compact Search Controls */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-12 flex items-center gap-2 sm:gap-3">
        {/* Compact Scrollable Category Strip */}
        <div
          className={`relative flex-1 min-w-0 transition-opacity duration-150 ${
            isLinkOrId ? 'opacity-45 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 pr-5">
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
                  onClick={() => onToggleCategory(cat.id)}
                  className={`h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
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
                          : 'text-slate-400 dark:text-slate-500'
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

        <span
          aria-hidden="true"
          className="h-5 w-px bg-slate-200/90 dark:bg-slate-800 shrink-0"
        />

        {/* Compact Search Box Toggle + Live Search Action */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            tabIndex={isVisible ? 0 : -1}
            onClick={onToggleCompactSearch}
            aria-expanded={isCompactSearchOpen}
            aria-label={isCompactSearchOpen ? t.search.closeSearchBoxBtn : t.search.openSearchBoxBtn}
            title={isCompactSearchOpen ? t.search.closeSearchBoxBtn : t.search.openSearchBoxBtn}
            className={`h-8 px-2 sm:px-2.5 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              isCompactSearchOpen || query.trim()
                ? 'bg-teal-50/80 dark:bg-teal-950/40 border-teal-300/90 dark:border-teal-800 text-teal-800 dark:text-teal-300'
                : 'bg-white dark:bg-[#131B24] border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            {isLinkOrId ? (
              <Link2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Search className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="hidden md:inline max-w-[110px] truncate">
              {query.trim() ? query.trim() : t.search.openSearchBoxBtn}
            </span>
            {query.trim() && (
              <span className="md:hidden text-[10px] font-semibold leading-none">•</span>
            )}
          </button>

          <button
            type="button"
            tabIndex={isVisible ? 0 : -1}
            disabled={isSearching || Boolean(searchLimitWarning) || isLinkBroken}
            onClick={() => {
              onCloseCompactSearch();
              onSubmitSearch();
            }}
            className="h-8 px-2.5 sm:px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-150 whitespace-nowrap shrink-0 disabled:opacity-55 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {isSingleLinkValid ? (
              <Link2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Search className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="max-w-[104px] sm:max-w-none truncate">
              {isSearching
                ? t.search.searchingButton
                : isSingleLinkValid
                  ? t.search.searchSingleButton
                  : t.search.searchButton}
            </span>
            {!isSearching && (
              <span className="hidden lg:inline font-mono-num text-[11px] opacity-85">
                (~{leanSearchCost} cr)
              </span>
            )}
          </button>
        </div>
      </div>

      {/* On-Demand Compact Search Input Drawer Directly Below the Sticky Bar */}
      <AnimatePresence initial={false}>
        {isVisible && isCompactSearchOpen && (
          <motion.div
            key="compact-search-drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-slate-200/75 dark:border-slate-800/85 bg-[#F8FAFC] dark:bg-[#0B1117]"
          >
            <form
              onSubmit={handleFormSubmit}
              className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <div className="relative flex-1 flex items-center bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl focus-within:border-teal-500/70 dark:focus-within:border-teal-500/60 transition-colors">
                  {isLinkOrId ? (
                    <Link2 className="w-4 h-4 text-teal-600 dark:text-teal-400 absolute left-3 pointer-events-none" />
                  ) : (
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        onCloseCompactSearch();
                      }
                    }}
                    placeholder={t.search.placeholder}
                    className="w-full h-9 pl-9 pr-8 rounded-xl bg-transparent text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        onQueryChange('');
                        inputRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="absolute right-1.5 h-6 w-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onCloseCompactSearch}
                  aria-label={t.search.closeSearchBoxBtn}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#131B24] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isSingleLinkValid && linkProductId && (
                <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium px-1">
                  {t.search.linkModeNotice(linkProductId)}
                </p>
              )}
              {isLinkBroken && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 px-1">
                  {isShortLink ? t.search.shortLinkNotice : t.search.invalidLinkNotice}
                </p>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
