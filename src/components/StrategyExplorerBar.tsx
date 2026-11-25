import { Clock, Eye, EyeOff, Info, Layers, ShieldAlert } from 'lucide-react';
import type { Translations } from '../i18n';
import type {
  ActiveStrategyView,
  ProductIntelligenceViewModel,
} from '../lib/productIntelligenceView.ts';
import type { StrategyId } from '../types';

interface StrategyExplorerBarProps {
  viewModel: ProductIntelligenceViewModel;
  activeView: ActiveStrategyView;
  showExcluded: boolean;
  t: Translations;
  onSelectView: (next: ActiveStrategyView) => void;
  onToggleShowExcluded: () => void;
}

export function StrategyExplorerBar({
  viewModel,
  activeView,
  showExcluded,
  t,
  onSelectView,
  onToggleShowExcluded,
}: StrategyExplorerBarProps) {
  const activeSummary =
    activeView === 'overall'
      ? null
      : viewModel.strategySummaries.find((s) => s.id === activeView) ?? null;

  const isOverall = activeView === 'overall';

  return (
    <section
      aria-label={t.v2.strategyExplorer.title}
      className="mb-6 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden"
    >
      {/* Header Row */}
      <div className="px-4 sm:px-5 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.v2.strategyExplorer.title}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t.v2.strategyExplorer.subtitle}
            </span>
          </div>
        </div>

        <div className="text-[11px] font-mono-num tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
          {t.v2.engineBadge} · {t.v2.strategyExplorer.overallCountLabel(viewModel.poolSize)}
        </div>
      </div>

      {/* Scrollable / Responsive Segmented Strategy Selector (Interactive Controls Only) */}
      <div className="px-4 sm:px-5 pb-3.5">
        <div className="relative">
          <div
            role="tablist"
            aria-label={t.v2.strategyExplorer.title}
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 pr-7 sm:pr-0 sm:flex-wrap"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isOverall}
              onClick={() => onSelectView('overall')}
              className={`h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                isOverall
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-semibold'
                  : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
            <span>{t.v2.overallTabShort}</span>
            <span
              className={`font-mono-num tabular-nums text-[11px] ${
                isOverall
                  ? 'text-white/80 dark:text-slate-950/75'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {viewModel.overallCount}
            </span>
          </button>

          {viewModel.strategySummaries.map((summary) => {
            const isSelected = activeView === summary.id;
            const strategyCopy = t.v2.strategies[summary.id as StrategyId];
            const isUnavailable =
              summary.requiresHistoricalSnapshots &&
              summary.qualifiedCount === 0 &&
              Boolean(summary.unavailableReason);

            return (
                <button
                  key={summary.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onSelectView(summary.id)}
                  className={`h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                    isSelected
                      ? 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950 font-semibold'
                      : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {summary.requiresHistoricalSnapshots && (
                    <Clock
                      className={`w-3 h-3 shrink-0 ${
                        isSelected
                          ? 'text-white/90 dark:text-slate-950/80'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                  )}
                  <span>{strategyCopy.shortName}</span>
                  <span
                    className={`font-mono-num tabular-nums text-[11px] ${
                      isSelected
                        ? 'text-white/85 dark:text-slate-950/80'
                        : summary.qualifiedCount > 0
                          ? 'text-teal-700 dark:text-teal-400 font-semibold'
                          : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {isUnavailable ? 'N/A' : summary.qualifiedCount}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Right-edge scroll fade indicator on mobile so users notice all 8 strategies */}
          <div
            aria-hidden="true"
            className="sm:hidden pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-white dark:from-[#131B24] to-transparent"
          />
        </div>
      </div>

      {/* Active Strategy Rule & Status Summary Bar */}
      <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800/85 bg-slate-50/50 dark:bg-slate-900/30 text-xs">
        {isOverall ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="font-semibold text-slate-900 dark:text-slate-100 mr-1.5">
                {t.v2.overallTabLabel}:
              </span>
              {t.v2.overallDescription}
            </p>
            {viewModel.smallPoolWarning && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 shrink-0">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>{t.v2.strategyExplorer.smallPoolWarning(viewModel.poolSize)}</span>
              </span>
            )}
          </div>
        ) : activeSummary ? (
          <div className="space-y-2">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-2.5">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {t.v2.strategies[activeSummary.id].name}
                  </span>
                  {activeSummary.profile.isPrimary && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-medium text-teal-700 dark:text-teal-400">
                        {t.v2.strategyExplorer.primaryStrategyTag}
                      </span>
                    </>
                  )}
                  {activeSummary.requiresHistoricalSnapshots && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {t.v2.strategyExplorer.historyUnavailableBadge}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t.v2.strategies[activeSummary.id].desc}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.v2.strategies[activeSummary.id].minimumRule}
                </p>
              </div>

              {activeSummary.excludedCount > 0 && !viewModel.isHistoricalDataUnavailable && (
                <button
                  type="button"
                  onClick={onToggleShowExcluded}
                  className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start cursor-pointer"
                >
                  {showExcluded ? (
                    <EyeOff className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>
                    {showExcluded
                      ? t.v2.strategyExplorer.hideExcludedBtn
                      : t.v2.strategyExplorer.showExcludedBtn(activeSummary.excludedCount)}
                  </span>
                </button>
              )}
            </div>

            {/* Clean Typographic Eligibility Breakdown (Zero Pill Clutter) */}
            <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono-num tabular-nums text-slate-500 dark:text-slate-400">
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                {t.v2.strategyEligibility.QUALIFIED}: {activeSummary.statusCounts.QUALIFIED}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t.v2.strategyEligibility.PARTIAL_EVIDENCE}:{' '}
                {activeSummary.statusCounts.PARTIAL_EVIDENCE}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t.v2.strategyEligibility.INSUFFICIENT_DATA}:{' '}
                {activeSummary.statusCounts.INSUFFICIENT_DATA}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t.v2.strategyEligibility.NOT_ELIGIBLE}: {activeSummary.statusCounts.NOT_ELIGIBLE}
              </span>
              {activeSummary.statusCounts.DATA_UNAVAILABLE > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 dark:text-amber-400 font-semibold">
                    {t.v2.strategyEligibility.DATA_UNAVAILABLE}:{' '}
                    {activeSummary.statusCounts.DATA_UNAVAILABLE}
                  </span>
                </>
              )}
            </div>

            {viewModel.isHistoricalDataUnavailable && (
              <div className="pt-2 border-t border-amber-200/70 dark:border-amber-900/50 flex items-start gap-2 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="space-y-0.5 leading-relaxed">
                  <div className="font-semibold">
                    {t.v2.strategyExplorer.historyUnavailableTitle}
                  </div>
                  <p className="text-[11px] text-amber-700/95 dark:text-amber-300/90">
                    {t.v2.strategyExplorer.historyUnavailableDesc}{' '}
                    {t.v2.strategyExplorer.historyUnavailableNote}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Concise Non-Guarantee Ranking Transparency Reminder */}
        <p className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/75 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
          <span>{t.v2.rankingTransparencyNote}</span>
        </p>
      </div>
    </section>
  );
}
