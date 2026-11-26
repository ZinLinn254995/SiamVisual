import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Check,
  Link2,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Translations } from '../i18n';
import {
  createRecommendedSearchConfigDraft,
  type DiscoveryPriceBand,
  type DiscoveryShortlistPreset,
  type DiscoverySortMode,
  SEARCH_DATE_RANGE_OPTIONS,
  SEARCH_PAGE_SIZE_OPTIONS,
  type SearchConfigDraft,
} from '../lib/discoveryFilterEngine';
import { inspectQueryLink } from '../lib/productLinkInspector';
import type { KalodataCategoryItem, Language } from '../types';
import { CustomSelect, type CustomSelectOption } from './CustomSelect';

interface SearchConfigDrawerProps {
  isOpen: boolean;
  initialConfig: SearchConfigDraft;
  categories: KalodataCategoryItem[];
  categoryMatchCounts: Map<string, number>;
  language: Language;
  isConnected: boolean;
  isSearching: boolean;
  isSyncingCategories: boolean;
  hasLiveSyncedCategories: boolean;
  searchLimitWarning: string | null;
  leanSearchCost: number;
  t: Translations;
  onClose: () => void;
  onSyncCategories: () => void;
  onSubmit: (config: SearchConfigDraft) => void;
}

const PRESET_ORDER: DiscoveryShortlistPreset[] = [
  'all',
  'monetizable_only',
  'video_proven',
  'strong_earnings',
  'rising_trend',
];

const SORT_ORDER: DiscoverySortMode[] = [
  'search_score_desc',
  'video_revenue_desc',
  'payout_desc',
  'commission_desc',
  'revenue_desc',
  'sales_desc',
];

const PRICE_BAND_ORDER: DiscoveryPriceBand[] = ['all', 'under_300', '300_1000', 'over_1000'];

export function SearchConfigDrawer({
  isOpen,
  initialConfig,
  categories,
  categoryMatchCounts,
  language,
  isConnected,
  isSearching,
  isSyncingCategories,
  hasLiveSyncedCategories,
  searchLimitWarning,
  leanSearchCost,
  t,
  onClose,
  onSyncCategories,
  onSubmit,
}: SearchConfigDrawerProps) {
  const prefersReducedMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef<boolean>(false);
  const [draft, setDraft] = useState<SearchConfigDraft>(() => ({
    ...initialConfig,
    cateIds: [...initialConfig.cateIds],
    filterState: { ...initialConfig.filterState },
  }));

  // Sync draft with live parent state ONLY on the closed -> open transition
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;
    setDraft({
      ...initialConfig,
      cateIds: [...initialConfig.cateIds],
      filterState: { ...initialConfig.filterState },
    });
  }, [isOpen, initialConfig]);

  // Lock body scroll and close on Escape while open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const linkInfo = useMemo(() => inspectQueryLink(draft.query), [draft.query]);
  const isSingleLinkValid =
    linkInfo.isLinkOrId && (Boolean(linkInfo.productId) || linkInfo.isShortLink);
  const isLinkBroken = linkInfo.isLinkOrId && !linkInfo.productId && !linkInfo.isShortLink;

  const copy = t.v2.searchDrawer;
  const filterCopy = t.v2.discoveryFilter;

  function toggleCategory(cateId: string) {
    setDraft((prev) => {
      if (!cateId) {
        return { ...prev, cateIds: [] };
      }
      const exists = prev.cateIds.includes(cateId);
      return {
        ...prev,
        cateIds: exists
          ? prev.cateIds.filter((id) => id !== cateId)
          : [...prev.cateIds, cateId],
      };
    });
  }

  function handleResetToRecommendedDefaults() {
    setDraft(createRecommendedSearchConfigDraft());
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSearching || Boolean(searchLimitWarning) || isLinkBroken) return;
    onSubmit({
      ...draft,
      query: draft.query.trim(),
      cateIds: linkInfo.isLinkOrId ? [] : [...draft.cateIds],
      filterState: { ...draft.filterState },
    });
  }

  const windowTag = draft.dateRange === 'last30Day' ? '30d' : '7d';
  const summaryText =
    linkInfo.isLinkOrId && linkInfo.productId
      ? copy.summaryLink(linkInfo.productId, leanSearchCost)
      : linkInfo.isLinkOrId && linkInfo.isShortLink
        ? copy.summaryShortLink(leanSearchCost)
        : copy.summaryRank(
            draft.pageSize,
            windowTag,
            filterCopy.presets[draft.filterState.preset],
            leanSearchCost
          );

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="search-config-drawer-title"
        >
          {/* Backdrop Scrim */}
          <motion.div
            key="search-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px]"
          />

          {/* Bottom Sheet Surface */}
          <motion.div
            key="search-drawer-panel"
            initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={{
              duration: prefersReducedMotion ? 0.01 : 0.28,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{ willChange: 'transform' }}
            className="relative z-10 w-full max-w-4xl max-h-[88dvh] flex flex-col rounded-t-2xl bg-white dark:bg-[#131B24] border-t border-x border-slate-200/90 dark:border-slate-800 shadow-[0_-16px_48px_-12px_rgba(15,23,42,0.28)] dark:shadow-[0_-16px_48px_-12px_rgba(0,0,0,0.65)] overflow-hidden"
          >
            {/* Subtle Sheet Handle Indicator */}
            <div className="pt-2.5 pb-1 flex justify-center shrink-0">
              <span
                aria-hidden="true"
                className="w-10 h-1 rounded-full bg-slate-300/90 dark:bg-slate-700"
              />
            </div>

            {/* Sticky Drawer Header */}
            <div className="px-4 sm:px-6 pt-1 pb-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2
                  id="search-config-drawer-title"
                  className="font-display text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug"
                >
                  {copy.title}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {copy.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={copy.closeAria}
                className="h-10 w-10 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Wrapping Scrollable Content + Sticky Action Footer */}
            <form
              onSubmit={handleFormSubmit}
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              {/* Scrollable Configuration Body */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5">
                {/* Section 1: Keyword OR Single Product Link / ID */}
                <div>
                  <label
                    htmlFor="drawer-keyword-or-link"
                    className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2"
                  >
                    {copy.keywordOrLinkLabel}
                  </label>
                  <div className="relative flex items-center rounded-xl border border-slate-200/95 dark:border-slate-700/90 bg-slate-50/70 dark:bg-slate-900/65 focus-within:border-teal-500 dark:focus-within:border-teal-400 focus-within:bg-white dark:focus-within:bg-[#0E151D] transition-colors">
                    {linkInfo.isLinkOrId ? (
                      <Link2 className="w-4 h-4 text-teal-600 dark:text-teal-400 absolute left-3.5 pointer-events-none" />
                    ) : (
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    )}
                    <input
                      ref={inputRef}
                      id="drawer-keyword-or-link"
                      type="text"
                      value={draft.query}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, query: e.target.value }))
                      }
                      placeholder={copy.keywordOrLinkPlaceholder}
                      className="w-full h-11 pl-10 pr-10 rounded-xl bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                    />
                    {draft.query && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraft((prev) => ({ ...prev, query: '' }));
                          inputRef.current?.focus();
                        }}
                        aria-label={t.history.clearFilterAria}
                        className="absolute right-1.5 h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {linkInfo.isLinkOrId && linkInfo.productId ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400">
                      <Link2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{t.search.linkModeNotice(linkInfo.productId)}</span>
                    </p>
                  ) : linkInfo.isLinkOrId && linkInfo.isShortLink ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400">
                      <Link2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{t.search.shortLinkNotice}</span>
                    </p>
                  ) : isLinkBroken ? (
                    <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                      {t.search.invalidLinkNotice}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {copy.keywordOrLinkHint}
                    </p>
                  )}
                </div>

                {/* Section 2: Discovery Scope — Product Count & Sales Window */}
                <div
                  className={`pt-4 border-t border-slate-100 dark:border-slate-800/85 grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-150 ${
                    linkInfo.isLinkOrId ? 'opacity-45 pointer-events-none select-none' : 'opacity-100'
                  }`}
                >
                  {/* Product Count Selector (20 / 50 / 100) */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {copy.countLabel}
                      </span>
                      <span className="font-mono-num tabular-nums text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                        ~{leanSearchCost} cr
                      </span>
                    </div>
                    <div
                      role="group"
                      aria-label={copy.countLabel}
                      className="grid grid-cols-3 gap-1.5"
                    >
                      {SEARCH_PAGE_SIZE_OPTIONS.map((size) => {
                        const isSelected = draft.pageSize === size;
                        const isMaxBest = size === 100;
                        return (
                          <button
                            key={size}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setDraft((prev) => ({ ...prev, pageSize: size }))}
                            className={`h-10 px-2.5 rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                              isSelected
                                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-semibold'
                                : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border border-slate-200/85 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <span className="font-mono-num tabular-nums">
                              {copy.countUnit(size)}
                            </span>
                            {isMaxBest && (
                              <span
                                className={`text-[10px] font-medium ${
                                  isSelected
                                    ? 'text-teal-300 dark:text-teal-700'
                                    : 'text-teal-700 dark:text-teal-400'
                                }`}
                              >
                                · {copy.recommendedTag}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                      {copy.countCostNote}
                    </p>
                  </div>

                  {/* Sales Window Selector (7d / 30d) */}
                  <div>
                    <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                      {copy.windowLabel}
                    </span>
                    <div
                      role="group"
                      aria-label={copy.windowLabel}
                      className="grid grid-cols-2 gap-1.5"
                    >
                      {SEARCH_DATE_RANGE_OPTIONS.map((win) => {
                        const isSelected = draft.dateRange === win;
                        return (
                          <button
                            key={win}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setDraft((prev) => ({ ...prev, dateRange: win }))}
                            className={`h-10 px-3 rounded-xl text-xs font-medium inline-flex items-center justify-center transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                              isSelected
                                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-semibold'
                                : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border border-slate-200/85 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            {win === 'last7Day' ? copy.window7d : copy.window30d}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {copy.windowNote}
                    </p>
                  </div>
                </div>

                {/* Section 3: Categories (Multi-select) */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/85">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {copy.categoriesLabel}
                      </span>
                      {!linkInfo.isLinkOrId && draft.cateIds.length > 0 && (
                        <>
                          <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400 font-mono-num">
                            {t.search.selectedCount(draft.cateIds.length)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDraft((prev) => ({ ...prev, cateIds: [] }))}
                            className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
                          >
                            {t.search.clearCategories}
                          </button>
                        </>
                      )}
                      {!linkInfo.isLinkOrId &&
                        draft.cateIds.length === 0 &&
                        hasLiveSyncedCategories && (
                          <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                            {t.search.liveSyncedTag}
                          </span>
                        )}
                    </div>

                    {isConnected && !linkInfo.isLinkOrId && (
                      <button
                        type="button"
                        disabled={isSyncingCategories || Boolean(searchLimitWarning)}
                        onClick={onSyncCategories}
                        className="text-[11px] font-medium text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${isSyncingCategories ? 'animate-spin' : ''}`}
                        />
                        <span>
                          {isSyncingCategories
                            ? t.search.syncingCategoriesBtn
                            : t.search.syncCategoriesBtn}
                        </span>
                      </button>
                    )}
                  </div>

                  {linkInfo.isLinkOrId ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {copy.categoriesDisabledInLinkMode}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {categories.map((cat) => {
                        const isAll = !cat.id;
                        const isSelected = isAll
                          ? draft.cateIds.length === 0
                          : draft.cateIds.includes(cat.id);
                        const matchCount = categoryMatchCounts.get(cat.id) ?? 0;

                        return (
                          <button
                            key={cat.id || 'all'}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => toggleCategory(cat.id)}
                            className={`h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                              isSelected
                                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-semibold'
                                : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border border-slate-200/85 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            {!isAll && isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                            <span>{cat.label[language]}</span>
                            {matchCount > 0 && (
                              <span
                                className={`font-mono-num tabular-nums text-[11px] ${
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
                  )}
                </div>

                {/* Section 4: Affiliate Result Filters & Sort (0 cr local filtering) */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/85">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span>{copy.affiliateFiltersLabel}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {copy.affiliateFiltersHint}
                    </span>
                  </div>

                  {linkInfo.isLinkOrId ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {copy.affiliateFiltersDisabledInLinkMode}
                    </p>
                  ) : (
                    <div className="space-y-3.5">
                      {/* Shortlist Preset Buttons */}
                      <div>
                        <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                          {copy.presetLabel}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {PRESET_ORDER.map((preset) => {
                            const isSelected = draft.filterState.preset === preset;
                            return (
                              <button
                                key={preset}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    filterState: { ...prev.filterState, preset },
                                  }))
                                }
                                className={`h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                                  isSelected
                                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-semibold'
                                    : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border border-slate-200/85 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 shrink-0" />}
                                <span>{filterCopy.presets[preset]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Threshold Filters + Sort Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Min Commission Rate */}
                        <div>
                          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {filterCopy.minCommissionLabel}
                          </span>
                          <CustomSelect
                            ariaLabel={filterCopy.minCommissionLabel}
                            size="md"
                            fullWidth
                            mono
                            value={
                              draft.filterState.minCommissionPct === null
                                ? ''
                                : String(draft.filterState.minCommissionPct)
                            }
                            isHighlighted={draft.filterState.minCommissionPct !== null}
                            options={[
                              { value: '', label: filterCopy.anyOption },
                              { value: '5', label: '≥ 5%' },
                              { value: '10', label: '≥ 10%' },
                              { value: '15', label: '≥ 15%' },
                            ]}
                            onChange={(val) =>
                              setDraft((prev) => ({
                                ...prev,
                                filterState: {
                                  ...prev.filterState,
                                  minCommissionPct: val ? Number(val) : null,
                                },
                              }))
                            }
                          />
                        </div>

                        {/* Min Video Revenue Share */}
                        <div>
                          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {filterCopy.minVideoShareLabel}
                          </span>
                          <CustomSelect
                            ariaLabel={filterCopy.minVideoShareLabel}
                            size="md"
                            fullWidth
                            mono
                            value={
                              draft.filterState.minVideoSharePct === null
                                ? ''
                                : String(draft.filterState.minVideoSharePct)
                            }
                            isHighlighted={draft.filterState.minVideoSharePct !== null}
                            options={[
                              { value: '', label: filterCopy.anyOption },
                              { value: '25', label: '≥ 25%' },
                              { value: '50', label: '≥ 50%' },
                            ]}
                            onChange={(val) =>
                              setDraft((prev) => ({
                                ...prev,
                                filterState: {
                                  ...prev.filterState,
                                  minVideoSharePct: val ? Number(val) : null,
                                },
                              }))
                            }
                          />
                        </div>

                        {/* Price Band */}
                        <div>
                          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {filterCopy.priceBandLabel}
                          </span>
                          <CustomSelect
                            ariaLabel={filterCopy.priceBandLabel}
                            size="md"
                            fullWidth
                            mono
                            value={draft.filterState.priceBand}
                            isHighlighted={draft.filterState.priceBand !== 'all'}
                            options={PRICE_BAND_ORDER.map<CustomSelectOption>((band) => ({
                              value: band,
                              label: filterCopy.priceBands[band],
                            }))}
                            onChange={(val) =>
                              setDraft((prev) => ({
                                ...prev,
                                filterState: {
                                  ...prev.filterState,
                                  priceBand: val as DiscoveryPriceBand,
                                },
                              }))
                            }
                          />
                        </div>

                        {/* Sort Order */}
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            <ArrowUpDown className="w-3 h-3 shrink-0" />
                            <span>{filterCopy.sortLabel}</span>
                          </span>
                          <CustomSelect
                            ariaLabel={filterCopy.sortLabel}
                            size="md"
                            fullWidth
                            value={
                              draft.filterState.sortMode === 'intelligence'
                                ? 'search_score_desc'
                                : draft.filterState.sortMode
                            }
                            isHighlighted={
                              draft.filterState.sortMode !== 'search_score_desc' &&
                              draft.filterState.sortMode !== 'intelligence'
                            }
                            options={SORT_ORDER.map<CustomSelectOption>((mode) => ({
                              value: mode,
                              label: filterCopy.sortOptions[mode],
                            }))}
                            onChange={(val) =>
                              setDraft((prev) => ({
                                ...prev,
                                filterState: {
                                  ...prev.filterState,
                                  sortMode: val as DiscoverySortMode,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {searchLimitWarning && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    {searchLimitWarning}
                  </p>
                )}
              </div>

              {/* Sticky Bottom Footer */}
              <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200/85 dark:border-slate-800 bg-slate-50/85 dark:bg-[#0E151D] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex flex-wrap items-center justify-between sm:justify-start gap-x-3 gap-y-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={handleResetToRecommendedDefaults}
                    className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>{copy.resetDefaultsBtn}</span>
                  </button>
                  <span className="font-mono-num tabular-nums text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {summaryText}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 px-4 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-[#131B24] text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 whitespace-nowrap cursor-pointer"
                  >
                    {copy.cancelBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={isSearching || Boolean(searchLimitWarning) || isLinkBroken}
                    className="flex-1 sm:flex-initial h-11 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap disabled:opacity-55 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    {isSingleLinkValid ? (
                      <Link2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <Search className="w-4 h-4 shrink-0" />
                    )}
                    <span>
                      {isSearching
                        ? t.search.searchingButton
                        : isSingleLinkValid
                          ? copy.submitLinkBtn(leanSearchCost)
                          : copy.submitRankBtn(draft.pageSize, leanSearchCost)}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
