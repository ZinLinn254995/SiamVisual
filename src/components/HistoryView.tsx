import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Download, ExternalLink, Search, Trash2, Upload, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { Translations } from '../i18n';
import { translateCategoryNameToMyanmar } from '../lib/categoryTranslations';
import { getStudioFallbackImage } from '../lib/media';
import {
  evaluateSearchOpportunityScore,
  type SearchScoreGrade,
} from '../lib/searchScoreEngine.ts';
import { hydrateProductFromStorage } from '../lib/storage';
import { getTikTokShopProductUrl } from '../lib/tiktokLink';
import type { Language, SavedHistoryEntry } from '../types';
import { PaginationBar } from './PaginationBar';

const HISTORY_PAGE_SIZE = 6;

function historyGradeClass(grade: SearchScoreGrade): string {
  switch (grade) {
    case 'TOP':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'STRONG':
      return 'text-teal-700 dark:text-teal-400';
    case 'MODERATE':
      return 'text-amber-700 dark:text-amber-400';
    case 'WEAK':
    case 'NOT_MONETIZABLE':
      return 'text-rose-700 dark:text-rose-400';
    case 'INSUFFICIENT':
    default:
      return 'text-slate-600 dark:text-slate-400';
  }
}

function historyGradeSymbol(grade: SearchScoreGrade): string {
  switch (grade) {
    case 'TOP':
      return '★';
    case 'STRONG':
      return '◆';
    case 'MODERATE':
      return '●';
    case 'WEAK':
      return '▾';
    case 'NOT_MONETIZABLE':
      return '✕';
    case 'INSUFFICIENT':
    default:
      return '◌';
  }
}

interface HistoryViewProps {
  entries: SavedHistoryEntry[];
  recentSearchesCount?: number;
  language: Language;
  nowMs?: number;
  t: Translations;
  onOpenEntry: (entry: SavedHistoryEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onExportBackup: () => void;
  onImportBackupFile: (file: File) => void;
  onGoDiscover: () => void;
}

export function HistoryView({
  entries,
  recentSearchesCount = 0,
  language,
  nowMs,
  t,
  onOpenEntry,
  onDeleteEntry,
  onExportBackup,
  onImportBackupFile,
  onGoDiscover,
}: HistoryViewProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hydratedEntries = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        product: hydrateProductFromStorage(
          entry.product,
          nowMs !== undefined ? { nowMs } : undefined
        ),
      })),
    [entries, nowMs]
  );

  const filteredEntries = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return hydratedEntries;
    return hydratedEntries.filter((item) => {
      const haystack = [
        item.product.id,
        item.product.aiAnalysis?.cleanName?.my,
        item.product.aiAnalysis?.cleanName?.en,
        item.product.clearTitle.my,
        item.product.clearTitle.en,
        item.product.thaiTitle,
        item.product.shopName,
        item.product.categoryLabel.my,
        item.product.categoryLabel.en,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [hydratedEntries, filterQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / HISTORY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedEntries = useMemo(() => {
    const start = (safePage - 1) * HISTORY_PAGE_SIZE;
    return filteredEntries.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredEntries, safePage]);

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function formatSavedDate(iso: string): string {
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

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6"
    >
      <h1 className="sr-only">{t.history.title}</h1>
      {/* Action Bar: Search Input (when entries exist) + Backup / Restore */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-200 dark:border-slate-800">
        {entries.length > 0 ? (
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => {
                setFilterQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t.history.searchPlaceholder}
              className="w-full h-11 sm:h-10 pl-10 pr-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => {
                  setFilterQuery('');
                  setPage(1);
                }}
                aria-label={t.history.clearFilterAria}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div />
        )}

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={onExportBackup}
            disabled={entries.length === 0 && recentSearchesCount === 0}
            className="flex-1 sm:flex-none justify-center h-11 sm:h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-slate-800 dark:text-slate-100 text-sm font-medium inline-flex items-center gap-2 hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-45 disabled:cursor-not-allowed transition-all active:scale-[0.98] duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{t.history.backupBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-none justify-center h-11 sm:h-10 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-sm font-semibold inline-flex items-center gap-2 transition-all active:scale-[0.98] duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>{t.history.restoreBtn}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImportBackupFile(file);
              }
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Empty State */}
      {entries.length === 0 ? (
        <div className="py-16 text-center max-w-md mx-auto">
          <button
            type="button"
            onClick={onGoDiscover}
            className="h-11 px-5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <span>{t.history.goDiscover}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {filteredEntries.length === 0 ? (
            <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">
              {t.history.noFilterMatches}
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {pagedEntries.map((entry) => {
              const fallback = getStudioFallbackImage(entry.product.category);
              const isConfirming = confirmDeleteId === entry.id;
              const primaryTitle = entry.product.thaiTitle;
              const displayCategoryLabel =
                language === 'my'
                  ? entry.product.categoryLabel.my && /[\u1000-\u109F]/.test(entry.product.categoryLabel.my)
                    ? entry.product.categoryLabel.my
                    : translateCategoryNameToMyanmar(
                        entry.product.categoryLabel.en || entry.product.categoryLabel.my,
                        entry.product.kalodataCategoryId
                      )
                  : entry.product.categoryLabel.en || entry.product.categoryLabel.my;
              const tiktokShopUrl = getTikTokShopProductUrl(entry.product);
              const entrySearchScore = evaluateSearchOpportunityScore(
                entry.product,
                nowMs !== undefined ? { nowMs } : undefined
              );

              return (
                <article
                  key={entry.id}
                  className="flex flex-col bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden"
                >
                  <div className="flex items-start gap-3 p-3">
                    <img
                      src={entry.product.imageUrl || fallback}
                      alt={primaryTitle}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        if (e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                      className="w-16 h-16 rounded-lg object-contain bg-slate-50 dark:bg-slate-900/70 p-1 border border-slate-100 dark:border-slate-800 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {(() => {
                          const savedIdeaNumbers = ([0, 1, 2] as const)
                            .filter((idx) => Boolean(entry.ideaPlans?.[idx]))
                            .map((idx) => idx + 1);
                          if (savedIdeaNumbers.length > 0) {
                            return (
                              <span className="font-medium text-teal-700 dark:text-teal-400">
                                {t.history.ideaPlansSavedLabel(savedIdeaNumbers)}
                              </span>
                            );
                          }
                          if (entry.plan?.conceptTitle?.[language]) {
                            return (
                              <span className="font-medium text-teal-700 dark:text-teal-400">
                                {entry.plan.conceptTitle[language]}
                              </span>
                            );
                          }
                          return <span>{displayCategoryLabel}</span>;
                        })()}
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span className="font-mono-num">{formatSavedDate(entry.savedAt)}</span>
                      </div>
                      <h2 className="mt-1 font-display text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 select-text">
                        {primaryTitle}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate select-text">
                        {entry.product.shopName}
                      </p>
                    </div>
                  </div>

                  <div className="px-3 pb-3 mt-auto">
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/90 flex items-center justify-between gap-2 text-xs font-mono-num">
                      <div className="flex items-center gap-2 min-w-0 truncate select-text">
                        <span
                          className={`font-semibold tabular-nums ${historyGradeClass(
                            entrySearchScore.grade
                          )}`}
                        >
                          <span aria-hidden="true">
                            {historyGradeSymbol(entrySearchScore.grade)}{' '}
                          </span>
                          {entrySearchScore.score !== null
                            ? `${entrySearchScore.score}/100`
                            : '—'}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">
                          {entry.product.priceThb !== null
                            ? `฿${entry.product.priceThb.toLocaleString()}`
                            : '—'}
                        </span>
                        <span className="text-teal-700 dark:text-teal-400 font-medium truncate">
                          {entry.product.commissionRate !== null
                            ? `${entry.product.commissionRate}%${
                                entry.product.commissionThb !== null
                                  ? ` · ฿${entry.product.commissionThb.toLocaleString()}`
                                  : ''
                              }`
                            : '—'}
                        </span>
                      </div>
                      {tiktokShopUrl && (
                        <a
                          href={tiktokShopUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={t.card.openTikTokShop}
                          aria-label={`${t.card.openTikTokShop}: ${primaryTitle}`}
                          className='relative font-sans h-9 sm:h-6 px-2.5 sm:px-1.5 rounded text-[11px] font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 before:content-[""] before:absolute before:-inset-1 sm:before:hidden'
                        >
                          <span>Shop</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenEntry(entry)}
                        className="flex-1 min-w-[120px] h-10 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        <span>{t.history.openPlan}</span>
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
                            className="h-10 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            {t.history.confirmDelete}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-10 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            {t.history.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(entry.id)}
                          aria-label={t.history.deleteBtn}
                          title={t.history.deleteBtn}
                          className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900/60 transition-colors duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
              })}
              </div>
              <PaginationBar
                currentPage={safePage}
                totalPages={totalPages}
                t={t}
                onPageChange={handlePageChange}
                className="mt-5"
              />
            </>
          )}
        </>
      )}
    </motion.section>
  );
}
