import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Translations } from '../i18n';

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  t: Translations;
  onPageChange: (page: number) => void;
  className?: string;
}

function getVisiblePageTokens(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }
  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const tokens: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      tokens.push('ellipsis');
    }
    tokens.push(sorted[i]);
  }
  return tokens;
}

export function PaginationBar({
  currentPage,
  totalPages,
  t,
  onPageChange,
  className = '',
}: PaginationBarProps) {
  if (totalPages <= 1) return null;

  const safeCurrent = Math.max(1, Math.min(currentPage, totalPages));
  const tokens = getVisiblePageTokens(safeCurrent, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-between sm:justify-center gap-2 ${className}`}
    >
      <button
        type="button"
        disabled={safeCurrent <= 1}
        onClick={() => onPageChange(safeCurrent - 1)}
        aria-label={t.pagination.prev}
        className="h-11 sm:h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <ChevronLeft className="w-4 h-4 shrink-0" />
        <span>{t.pagination.prev}</span>
      </button>

      {/* Mobile compact page readout */}
      <span className="sm:hidden font-mono-num tabular-nums text-xs font-semibold text-slate-700 dark:text-slate-200 px-2">
        {t.pagination.pageOf(safeCurrent, totalPages)}
      </span>

      {/* Desktop / tablet page pills */}
      <div className="hidden sm:flex items-center gap-1">
        {tokens.map((token, idx) =>
          token === 'ellipsis' ? (
            <span
              key={`el_${idx}`}
              aria-hidden="true"
              className="px-1.5 text-xs text-slate-400 dark:text-slate-500 select-none"
            >
              …
            </span>
          ) : (
            <button
              key={token}
              type="button"
              onClick={() => onPageChange(token)}
              aria-label={t.pagination.goToPageAria(token)}
              aria-current={token === safeCurrent ? 'page' : undefined}
              className={`h-9 min-w-[36px] px-2.5 rounded-lg font-mono-num tabular-nums text-xs font-semibold transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                token === safeCurrent
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950'
                  : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {token}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        disabled={safeCurrent >= totalPages}
        onClick={() => onPageChange(safeCurrent + 1)}
        aria-label={t.pagination.next}
        className="h-11 sm:h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <span>{t.pagination.next}</span>
        <ChevronRight className="w-4 h-4 shrink-0" />
      </button>
    </nav>
  );
}
