import { ArrowUpDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { Translations } from '../i18n';
import {
  DEFAULT_DISCOVERY_FILTER_STATE,
  type DiscoveryFilterPoolCounts,
  type DiscoveryFilterState,
  type DiscoveryPriceBand,
  type DiscoveryShortlistPreset,
  type DiscoverySortMode,
} from '../lib/discoveryFilterEngine';
import { CustomSelect, type CustomSelectOption } from './CustomSelect';
import { InfoTooltip } from './InfoTooltip';

interface DiscoveryFilterBarProps {
  state: DiscoveryFilterState;
  counts: DiscoveryFilterPoolCounts;
  t: Translations;
  onChange: (next: DiscoveryFilterState) => void;
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

export function DiscoveryFilterBar({
  state,
  counts,
  t,
  onChange,
}: DiscoveryFilterBarProps) {
  const copy = t.v2.discoveryFilter;
  const effectiveSort: DiscoverySortMode =
    state.sortMode === 'intelligence' ? 'search_score_desc' : state.sortMode;
  const isDefault =
    state.preset === 'all' &&
    state.minCommissionPct === null &&
    state.minVideoSharePct === null &&
    state.priceBand === 'all' &&
    effectiveSort === 'search_score_desc';

  const presetCountMap: Record<DiscoveryShortlistPreset, number> = {
    all: counts.totalCount,
    monetizable_only: counts.monetizableCount,
    video_proven: counts.videoProvenCount,
    strong_earnings: counts.strongEarningsCount,
    rising_trend: counts.risingTrendCount,
  };

  const sortOptions: CustomSelectOption[] = SORT_ORDER.map((mode) => ({
    value: mode,
    label: copy.sortOptions[mode],
  }));

  const commissionOptions: CustomSelectOption[] = [
    { value: '', label: copy.anyOption },
    { value: '5', label: '≥ 5%' },
    { value: '10', label: '≥ 10%' },
    { value: '15', label: '≥ 15%' },
  ];

  const videoShareOptions: CustomSelectOption[] = [
    { value: '', label: copy.anyOption },
    { value: '25', label: '≥ 25%' },
    { value: '50', label: '≥ 50%' },
  ];

  const priceBandOptions: CustomSelectOption[] = PRICE_BAND_ORDER.map((band) => ({
    value: band,
    label: copy.priceBands[band],
  }));

  return (
    <section
      aria-label={copy.barAriaLabel}
      className="mb-4 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden"
    >
      {/* Row 1: Evidence Shortlist Presets + Verified-Metric Sort */}
      <div className="px-3.5 sm:px-4 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-1.5 overflow-x-auto no-scrollbar pr-6 lg:pr-0">
            {PRESET_ORDER.map((preset) => {
              const isSelected = state.preset === preset;
              const itemCount = presetCountMap[preset];
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onChange({ ...state, preset })}
                  className={`h-10 sm:h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all active:scale-[0.97] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-semibold'
                      : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span>{copy.presets[preset]}</span>
                  <span
                    className={`font-mono-num tabular-nums text-[11px] ${
                      isSelected
                        ? 'text-white/80 dark:text-slate-950/75'
                        : itemCount > 0
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    {itemCount}
                  </span>
                </button>
              );
            })}
          </div>
          <div
            aria-hidden="true"
            className="lg:hidden pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white dark:from-[#131B24] to-transparent"
          />
        </div>

        {/* Custom Verified-Metric Sort Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
            <span>{copy.sortLabel}</span>
          </span>
          <CustomSelect
            id="discovery-sort-select"
            ariaLabel={copy.sortLabel}
            size="sm"
            value={effectiveSort}
            options={sortOptions}
            isHighlighted={effectiveSort !== 'search_score_desc'}
            onChange={(val) => onChange({ ...state, sortMode: val as DiscoverySortMode })}
          />
        </div>
      </div>

      {/* Row 2: Zero-Credit Local Affiliate Refinements + Live Match Summary */}
      <div className="px-3.5 sm:px-4 py-2 border-t border-slate-100 dark:border-slate-800/85 bg-slate-50/55 dark:bg-slate-900/35 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <SlidersHorizontal className="w-3 h-3 shrink-0" />
            <span>0 cr</span>
            <InfoTooltip content={copy.zeroCreditHint} ariaLabel={copy.zeroCreditHint} />
          </span>

          {/* Min Commission Rate */}
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <span>{copy.minCommissionLabel}</span>
            <CustomSelect
              ariaLabel={copy.minCommissionLabel}
              size="sm"
              mono
              value={state.minCommissionPct === null ? '' : String(state.minCommissionPct)}
              options={commissionOptions}
              isHighlighted={state.minCommissionPct !== null}
              onChange={(val) =>
                onChange({
                  ...state,
                  minCommissionPct: val ? Number(val) : null,
                })
              }
            />
          </div>

          {/* Min Video Revenue Share */}
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <span>{copy.minVideoShareLabel}</span>
            <CustomSelect
              ariaLabel={copy.minVideoShareLabel}
              size="sm"
              mono
              value={state.minVideoSharePct === null ? '' : String(state.minVideoSharePct)}
              options={videoShareOptions}
              isHighlighted={state.minVideoSharePct !== null}
              onChange={(val) =>
                onChange({
                  ...state,
                  minVideoSharePct: val ? Number(val) : null,
                })
              }
            />
          </div>

          {/* Price Band */}
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <span>{copy.priceBandLabel}</span>
            <CustomSelect
              ariaLabel={copy.priceBandLabel}
              size="sm"
              mono
              value={state.priceBand}
              options={priceBandOptions}
              isHighlighted={state.priceBand !== 'all'}
              onChange={(val) => onChange({ ...state, priceBand: val as DiscoveryPriceBand })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <span className="font-mono-num tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
            {copy.showingCount(counts.filteredCount, counts.totalCount)}
          </span>
          {!isDefault && (
            <button
              type="button"
              onClick={() =>
                onChange({ ...DEFAULT_DISCOVERY_FILTER_STATE, sortMode: 'search_score_desc' })
              }
              className="h-10 sm:h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1 active:scale-[0.97] transition-transform cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span>{copy.resetBtn}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
