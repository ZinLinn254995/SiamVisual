import { useMemo, useState } from 'react';
import { ArrowRight, Search, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { Translations } from '../i18n';
import { translateCategoryNameToMyanmar } from '../lib/categoryTranslations';
import { getStudioFallbackImage } from '../lib/media';
import type { BilingualText, Language, RecentSearchEntry } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface SearchHistoryViewProps {
  entries: RecentSearchEntry[];
  activeRecentId: string | null;
  language: Language;
  t: Translations;
  onOpenEntry: (entry: RecentSearchEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onClearAll: () => void;
  onGoDiscover: () => void;
}

const HAS_MYANMAR_SCRIPT = /[\u1000-\u109F]/;

function localizeSavedCateLabel(lbl: BilingualText, language: Language): string {
  if (language === 'my') {
    if (lbl.my && HAS_MYANMAR_SCRIPT.test(lbl.my)) return lbl.my;
    return translateCategoryNameToMyanmar(lbl.en || lbl.my);
  }
  return lbl.en || lbl.my;
}

export function SearchHistoryView({
  entries,
  activeRecentId,
  language,
  t,
  onOpenEntry,
  onDeleteEntry,
  onClearAll,
  onGoDiscover,
}: SearchHistoryViewProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filteredEntries = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      const cateText = entry.cateLabels
        .map((l) => `${l.my} ${l.en} ${translateCategoryNameToMyanmar(l.en || l.my)}`)
        .join(' ');
      const productText = entry.products
        .slice(0, 6)
        .map((p) => `${p.thaiTitle} ${p.clearTitle.my} ${p.clearTitle.en} ${p.shopName}`)
        .join(' ');
      return `${entry.query} ${cateText} ${productText}`.toLowerCase().includes(q);
    });
  }, [entries, filterQuery]);

  function formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat(language === 'my' ? 'my-MM' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  }

  function getEntryModeLabel(entry: RecentSearchEntry): string {
    if (entry.mode === 'single_link') return t.searchHistoryPage.modeLink;
    if (entry.query.trim()) return t.searchHistoryPage.modeKeyword;
    if (entry.cateLabels.length > 0 || entry.cateIds.length > 0) {
      return t.searchHistoryPage.modeCategory;
    }
    return t.searchHistoryPage.modeDefault;
  }

  function getEntryTitle(entry: RecentSearchEntry): string {
    const localizedCates = entry.cateLabels.map((lbl) =>
      localizeSavedCateLabel(lbl, language)
    );
    if (entry.mode === 'single_link') {
      return entry.products[0]?.clearTitle[language] || entry.query;
    }
    if (entry.query.trim()) {
      return localizedCates.length > 0
        ? `${entry.query.trim()} · ${localizedCates.join(', ')}`
        : entry.query.trim();
    }
    if (localizedCates.length > 0) {
      return localizedCates.join(', ');
    }
    return t.recent.defaultBestLabel;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"
    >
      {/* Header & Clear All Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {t.searchHistoryPage.title}
            </h1>
            <InfoTooltip
              content={t.searchHistoryPage.subtitle}
              ariaLabel={t.searchHistoryPage.title}
              size="md"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono-num tabular-nums">
            {t.searchHistoryPage.totalCount(entries.length)}
          </p>
        </div>

        {entries.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {confirmClearAll ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmClearAll(false);
                  }}
                  className="h-11 sm:h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer"
                >
                  {t.searchHistoryPage.confirmClearAll}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="h-11 sm:h-10 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-slate-700 dark:text-slate-300 text-sm font-medium whitespace-nowrap active:scale-[0.98] transition-transform cursor-pointer"
                >
                  {t.searchHistoryPage.cancel}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="h-11 sm:h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-slate-600 dark:text-slate-300 hover:text-red-600 hover:border-red-200 dark:hover:text-red-400 dark:hover:border-red-900/60 text-sm font-medium inline-flex items-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>{t.searchHistoryPage.clearAllBtn}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {entries.length === 0 ? (
        <div className="py-16 sm:py-20 text-center max-w-md mx-auto">
          <div className="inline-flex items-center justify-center gap-1.5">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.searchHistoryPage.emptyTitle}
            </h2>
            <InfoTooltip
              content={t.searchHistoryPage.emptyDesc}
              ariaLabel={t.searchHistoryPage.emptyTitle}
              size="md"
            />
          </div>
          <button
            type="button"
            onClick={onGoDiscover}
            className="mt-6 h-11 px-5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <span>{t.searchHistoryPage.goDiscover}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Client-side Filter Bar */}
          <div className="mt-6 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder={t.searchHistoryPage.searchPlaceholder}
                className="w-full h-11 pl-10 pr-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  aria-label={t.history.clearFilterAria}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">
              {t.searchHistoryPage.noFilterMatches}
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredEntries.map((entry) => {
                const isLatest = entries[0]?.id === entry.id;
                const isCurrentlyShown = activeRecentId === entry.id;
                const isConfirming = confirmDeleteId === entry.id;
                const previews = entry.products.slice(0, 4);

                return (
                  <article
                    key={entry.id}
                    className={`flex flex-col bg-white dark:bg-[#131B24] border rounded-xl p-5 transition-colors ${
                      isCurrentlyShown
                        ? 'border-teal-400/90 dark:border-teal-700'
                        : 'border-slate-200/90 dark:border-slate-800'
                    }`}
                  >
                    {/* Unboxed Metadata Header Row */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      {isLatest && (
                        <>
                          <span className="font-semibold text-teal-700 dark:text-teal-400">
                            {t.searchHistoryPage.latestTag}
                          </span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span>{getEntryModeLabel(entry)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num tabular-nums">
                        {formatDate(entry.searchedAt)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num tabular-nums">
                        {t.recent.itemsCount(entry.products.length)}
                      </span>
                      {typeof entry.creditsUsed === 'number' && entry.creditsUsed > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num tabular-nums">
                            {t.searchHistoryPage.creditsSpent(entry.creditsUsed)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Search Title */}
                    <h3 className="mt-2 font-display text-base font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 select-text">
                      {getEntryTitle(entry)}
                    </h3>

                    {/* Product Thumbnail Strip Preview */}
                    {previews.length > 0 && (
                      <div className="mt-3.5 flex items-center gap-2">
                        {previews.map((product) => {
                          const fallback = getStudioFallbackImage(product.category);
                          return (
                            <img
                              key={product.id}
                              src={product.imageUrl || fallback}
                              alt={product.clearTitle[language]}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                if (e.currentTarget.src !== fallback) {
                                  e.currentTarget.src = fallback;
                                }
                              }}
                              className="w-12 h-12 rounded-lg object-cover bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shrink-0"
                            />
                          );
                        })}
                        {entry.products.length > 4 && (
                          <span className="ml-1 text-xs font-mono-num tabular-nums text-slate-500 dark:text-slate-400">
                            +{entry.products.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Top Product Sample Line */}
                    {entry.products[0] && (
                      <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 truncate select-text">
                        {entry.products[0].clearTitle[language]}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/90 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenEntry(entry)}
                        className="flex-1 min-w-[140px] h-10 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] duration-150 whitespace-nowrap cursor-pointer"
                      >
                        <span>{t.searchHistoryPage.openResultsBtn}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {isConfirming ? (
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteEntry(entry.id);
                              setConfirmDeleteId(null);
                            }}
                            className="h-10 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                          >
                            {t.searchHistoryPage.confirmDelete}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-10 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap cursor-pointer"
                          >
                            {t.searchHistoryPage.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(entry.id)}
                          aria-label={t.searchHistoryPage.deleteBtn}
                          title={t.searchHistoryPage.deleteBtn}
                          className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900/60 transition-colors duration-150 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </motion.section>
  );
}
