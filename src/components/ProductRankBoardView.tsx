import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  Check,
  Filter,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import type { Translations } from '../i18n';
import { getStudioFallbackImage } from '../lib/media';
import { CustomSelect } from './CustomSelect';
import { InfoTooltip } from './InfoTooltip';
import {
  type ComputedRankProductRow,
  computeRankProductRow,
  filterAndSortRankBoardRows,
  type RankBoardChannelFilter,
  type RankBoardQuickFilter,
  type RankBoardSortKey,
} from '../lib/rankBoardAnalytics';
import type {
  KalodataStatus,
  Language,
  ProductItem,
  RankBoardCategoryMarketItem,
  RankBoardSnapshot,
  SearchDateRange,
} from '../types';

export const RANK_BOARD_SYNC_COST = 0.4;

interface ProductRankBoardViewProps {
  snapshot: RankBoardSnapshot | null;
  dateRange: SearchDateRange;
  isSyncing: boolean;
  syncError: string | null;
  limitWarning: string | null;
  kalodataStatus: KalodataStatus;
  savedProductIds: Set<string>;
  language: Language;
  nowMs: number;
  t: Translations;
  onChangeDateRange: (next: SearchDateRange) => void;
  onSync: (targetRange?: SearchDateRange) => void;
  onOpenConnectPanel: () => void;
  onSelectProduct: (product: ProductItem) => void;
  onToggleSaveProduct: (product: ProductItem) => void;
}

function formatCompactThb(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `฿${(amount / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `฿${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `฿${(amount / 1_000).toFixed(1)}K`;
  return `฿${Math.round(amount).toLocaleString()}`;
}

function formatCompactCount(count: number | null | undefined): string {
  if (count === null || count === undefined || !Number.isFinite(count)) return '—';
  const abs = Math.abs(count);
  if (abs >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(count / 1_000).toFixed(1)}K`;
  return Math.round(count).toLocaleString();
}

function formatSyncTimestamp(iso: string, language: Language): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Intl.DateTimeFormat(language === 'my' ? 'my-MM' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

// Piecewise X-axis mapping for Price (THB) so ฿0–฿600 (Sweet Spot zone) gets 56% of horizontal width
// while higher prices up to ฿2,500+ compress cleanly without cramping the core Thai TikTok Shop range.
const PLOT_LEFT = 54;
const PLOT_RIGHT = 736;
const PLOT_TOP = 18;
const PLOT_BOTTOM = 242;
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const MAX_COMM_PLOT = 30;

function mapPriceToX(price: number): number {
  const clamped = Math.max(0, Math.min(2500, price));
  const splitPrice = 600;
  const splitRatio = 0.56;
  const normalized =
    clamped <= splitPrice
      ? (clamped / splitPrice) * splitRatio
      : splitRatio + ((clamped - splitPrice) / (2500 - splitPrice)) * (1 - splitRatio);
  return PLOT_LEFT + normalized * PLOT_WIDTH;
}

function mapCommToY(comm: number): number {
  const clamped = Math.max(0, Math.min(MAX_COMM_PLOT, comm));
  return PLOT_BOTTOM - (clamped / MAX_COMM_PLOT) * PLOT_HEIGHT;
}

function computeDotRadius(revenueThb: number, maxRev: number): number {
  if (maxRev <= 0 || revenueThb <= 0) return 5;
  const ratio = Math.sqrt(Math.min(1, revenueThb / maxRev));
  return Math.round((4.5 + ratio * 8.5) * 10) / 10;
}

export interface ScatterPointTarget {
  id: string;
  cx: number;
  cy: number;
}

export function findNearestScatterPointId(params: {
  clientX: number;
  clientY: number;
  rect: { left: number; width: number; top: number; height: number };
  viewBoxWidth: number;
  viewBoxHeight: number;
  points: ScatterPointTarget[];
  maxScreenRadiusPx?: number;
}): string | null {
  const {
    clientX,
    clientY,
    rect,
    viewBoxWidth,
    viewBoxHeight,
    points,
    maxScreenRadiusPx = 24,
  } = params;
  if (rect.width <= 0 || rect.height <= 0 || points.length === 0) return null;

  let bestId: string | null = null;
  let bestDist = maxScreenRadiusPx;

  for (const pt of points) {
    const screenX = rect.left + (pt.cx / viewBoxWidth) * rect.width;
    const screenY = rect.top + (pt.cy / viewBoxHeight) * rect.height;
    const dist = Math.hypot(clientX - screenX, clientY - screenY);
    if (dist <= bestDist) {
      bestDist = dist;
      bestId = pt.id;
    }
  }
  return bestId;
}

function getScoreBadgeClass(score: number | null): string {
  if (score === null) {
    return 'text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40';
  }
  if (score >= 78) {
    return 'text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/40';
  }
  if (score >= 60) {
    return 'text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30';
  }
  if (score >= 42) {
    return 'text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/30';
  }
  return 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50';
}

export function ProductRankBoardView({
  snapshot,
  dateRange,
  isSyncing,
  syncError,
  limitWarning,
  kalodataStatus,
  savedProductIds,
  language,
  nowMs,
  t,
  onChangeDateRange,
  onSync,
  onOpenConnectPanel,
  onSelectProduct,
  onToggleSaveProduct,
}: ProductRankBoardViewProps) {
  const rb = t.rankBoard;

  // Cross-filtering & table state (0 cr — strictly client-side over synced snapshot)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<RankBoardChannelFilter>('all');
  const [quickFilter, setQuickFilter] = useState<RankBoardQuickFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<RankBoardSortKey>('rank');
  const [inspectedProductId, setInspectedProductId] = useState<string | null>(null);
  const scatterSvgRef = useRef<SVGSVGElement | null>(null);
  const activeScrubPointerIdRef = useRef<number | null>(null);

  const allComputedRows = useMemo<ComputedRankProductRow[]>(() => {
    if (!snapshot) return [];
    return snapshot.products.map((product, idx) => computeRankProductRow(product, idx));
  }, [snapshot]);

  const selectedCategory = useMemo<RankBoardCategoryMarketItem | null>(() => {
    if (!snapshot || !selectedCategoryId) return null;
    return snapshot.categoryMarket.find((c) => c.id === selectedCategoryId) ?? null;
  }, [snapshot, selectedCategoryId]);

  const filteredRows = useMemo(
    () =>
      filterAndSortRankBoardRows(allComputedRows, {
        selectedCategory,
        quickFilter,
        channelFilter,
        searchQuery,
        sortBy,
      }),
    [allComputedRows, selectedCategory, quickFilter, channelFilter, searchQuery, sortBy]
  );

  // Scatter matrix rows: only products with verified price & commission
  const scatterRows = useMemo(() => {
    const valid = filteredRows.filter(
      (r) => r.priceThb !== null && r.priceThb > 0 && r.commissionRate !== null
    );
    // Render largest dots first so smaller dots stay clickable on top
    return [...valid].sort((a, b) => b.revenueThb - a.revenueThb);
  }, [filteredRows]);

  const maxRowRevenue = useMemo(
    () => Math.max(1, ...allComputedRows.map((r) => r.revenueThb)),
    [allComputedRows]
  );

  const maxCategoryShare = useMemo(() => {
    if (!snapshot || snapshot.categoryMarket.length === 0) return 100;
    return Math.max(1, ...snapshot.categoryMarket.map((c) => c.marketSharePct));
  }, [snapshot]);

  // Keep inspector focused on tapped dot or default to top filtered scatter row
  const inspectedRow = useMemo<ComputedRankProductRow | null>(() => {
    if (inspectedProductId) {
      const exact = filteredRows.find((r) => r.product.id === inspectedProductId);
      if (exact) return exact;
    }
    return scatterRows[0] ?? filteredRows[0] ?? null;
  }, [inspectedProductId, filteredRows, scatterRows]);

  const scatterPoints = useMemo<ScatterPointTarget[]>(
    () =>
      scatterRows.map((row) => ({
        id: row.product.id,
        cx: mapPriceToX(row.priceThb ?? 0),
        cy: mapCommToY(row.commissionRate ?? 0),
      })),
    [scatterRows]
  );

  // Paint selected dot last so it always renders cleanly above overlapping bubbles
  const orderedScatterRows = useMemo(() => {
    const selectedId = inspectedRow?.product.id;
    if (!selectedId) return scatterRows;
    const nonSelected = scatterRows.filter((r) => r.product.id !== selectedId);
    const selected = scatterRows.find((r) => r.product.id === selectedId);
    return selected ? [...nonSelected, selected] : scatterRows;
  }, [scatterRows, inspectedRow]);

  function selectNearestDotAtClientPoint(clientX: number, clientY: number) {
    const svg = scatterSvgRef.current;
    if (!svg) return;
    const hitId = findNearestScatterPointId({
      clientX,
      clientY,
      rect: svg.getBoundingClientRect(),
      viewBoxWidth: 760,
      viewBoxHeight: 278,
      points: scatterPoints,
      maxScreenRadiusPx: 24,
    });
    if (hitId) {
      setInspectedProductId((prev) => (prev === hitId ? prev : hitId));
    }
  }

  const isStale = useMemo(() => {
    if (!snapshot?.syncedAt) return false;
    const syncedMs = Date.parse(snapshot.syncedAt);
    return Number.isFinite(syncedMs) && nowMs - syncedMs > 24 * 3_600_000;
  }, [snapshot, nowMs]);

  const hasActiveFilters = Boolean(
    selectedCategory || channelFilter !== 'all' || quickFilter !== 'all' || searchQuery.trim()
  );

  function handleResetFilters() {
    setSelectedCategoryId(null);
    setChannelFilter('all');
    setQuickFilter('all');
    setSearchQuery('');
  }

  function handleToggleCategoryFilter(catId: string) {
    setSelectedCategoryId((prev) => (prev === catId ? null : catId));
  }

  function handleToggleChannelFilter(channel: Exclude<RankBoardChannelFilter, 'all'>) {
    setChannelFilter((prev) => (prev === channel ? 'all' : channel));
  }

  const windowTag = (snapshot?.dateRange ?? dateRange) === 'last30Day' ? '30d' : '7d';

  // Donut Chart geometry (r = 62, circumference = 2 * pi * 62 ≈ 389.56)
  const donutRadius = 62;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const summary = snapshot?.marketSummary ?? null;
  const videoPct = summary?.videoSharePct ?? 0;
  const livePct = summary?.liveSharePct ?? 0;
  const shopPct = summary?.shopSharePct ?? 0;

  const videoArc = (videoPct / 100) * donutCircumference;
  const liveArc = (livePct / 100) * donutCircumference;
  const shopArc = Math.max(0, donutCircumference - videoArc - liveArc);

  const dominantChannelMeta = (() => {
    if (!summary) return { label: rb.channelVideo, pct: 0, color: 'text-teal-700 dark:text-teal-400' };
    if (videoPct >= livePct && videoPct >= shopPct) {
      return { label: rb.channelVideo, pct: videoPct, color: 'text-teal-700 dark:text-teal-400' };
    }
    if (livePct >= videoPct && livePct >= shopPct) {
      return { label: rb.channelLive, pct: livePct, color: 'text-indigo-600 dark:text-indigo-400' };
    }
    return { label: rb.channelShop, pct: shopPct, color: 'text-amber-600 dark:text-amber-400' };
  })();

  const sweetX1 = mapPriceToX(100);
  const sweetX2 = mapPriceToX(600);
  const sweetY1 = mapCommToY(MAX_COMM_PLOT);
  const sweetY2 = mapCommToY(10);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-9 space-y-6">
      {/* Executive Header Bar */}
      <section className="rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
              <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {rb.title}
              </h1>
              <InfoTooltip content={rb.subtitle} ariaLabel={rb.title} size="md" />
            </div>
            {snapshot && (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-num tabular-nums text-slate-500 dark:text-slate-400">
                <span>
                  {rb.lastSyncedLabel}:{' '}
                  <strong className="font-medium text-slate-700 dark:text-slate-200">
                    {formatSyncTimestamp(snapshot.syncedAt, language)}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>{rb.productsUnit(snapshot.products.length)}</span>
                <span aria-hidden="true">·</span>
                <span>{rb.categoriesUnit(snapshot.categoryMarket.length)}</span>
                <span aria-hidden="true">·</span>
                <span>{snapshot.dateRange === 'last30Day' ? '30d' : '7d'}</span>
                {snapshot.creditsUsed !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{snapshot.creditsUsed} cr</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right Controls: 7d / 30d Segmented Switch + Manual Update Sync Button */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <div
              role="group"
              aria-label="Rank Board timeframe"
              className="inline-flex items-center p-0.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80"
            >
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => onChangeDateRange('last7Day')}
                aria-pressed={dateRange === 'last7Day'}
                className={`h-9 px-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                  dateRange === 'last7Day'
                    ? 'bg-white dark:bg-[#131B24] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {rb.timeframe7d}
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => onChangeDateRange('last30Day')}
                aria-pressed={dateRange === 'last30Day'}
                className={`h-9 px-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                  dateRange === 'last30Day'
                    ? 'bg-white dark:bg-[#131B24] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {rb.timeframe30d}
              </button>
            </div>

            <button
              type="button"
              disabled={isSyncing}
              onClick={() => onSync(dateRange)}
              className="h-10 px-4 sm:px-5 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? rb.syncingBtn : rb.syncBtn(RANK_BOARD_SYNC_COST)}</span>
            </button>
          </div>
        </div>

        {/* Notices: Stale / Limit Warning / Sync Error */}
        {isStale && !isSyncing && (
          <div className="mt-4 px-3.5 py-2 rounded-xl border border-amber-200/90 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 inline-flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-medium">
              {language === 'my' ? '၂၄ နာရီကျော်ကြာ ဒေတာ' : 'Stale (24h+)'}
            </span>
            <InfoTooltip tone="amber" content={rb.staleNotice} ariaLabel={rb.staleNotice} />
          </div>
        )}
        {limitWarning && (
          <div className="mt-3 px-3.5 py-2.5 rounded-xl border border-amber-200/90 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 text-xs font-medium text-amber-800 dark:text-amber-300">
            {limitWarning}
          </div>
        )}
        {syncError && !isSyncing && (
          <div className="mt-3 px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
            {syncError}
          </div>
        )}
      </section>

      {/* Loading Skeleton State (1:1 Executive Dashboard structure) */}
      {isSyncing && (
        <div className="space-y-5" aria-busy="true" aria-live="polite">
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center">
            {rb.loadingNote}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {[1, 2, 3, 4].map((slot) => (
              <div
                key={slot}
                className="rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/80 dark:border-slate-800 p-4 space-y-3"
              >
                <div className="h-3 w-28 rounded bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
                <div className="h-7 w-24 rounded bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                <div className="h-1.5 w-full rounded bg-slate-200/60 dark:bg-slate-800/70 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 h-72 rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/80 dark:border-slate-800 animate-pulse" />
            <div className="lg:col-span-7 h-72 rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/80 dark:border-slate-800 animate-pulse" />
          </div>
          <div className="h-80 rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/80 dark:border-slate-800 animate-pulse" />
        </div>
      )}

      {/* Empty State (before first Update Sync) */}
      {!isSyncing && !snapshot && (
        <section className="max-w-xl mx-auto rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200/70 dark:border-teal-800/70 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="font-display text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {rb.emptyTitle}
                </h2>
                <InfoTooltip
                  title={rb.emptyTitle}
                  content={rb.emptyDesc}
                  bullets={rb.emptyBullets}
                  ariaLabel={rb.emptyTitle}
                  size="md"
                />
              </div>
            </div>

            {!kalodataStatus.connected ? (
              <div className="flex items-center gap-2 shrink-0">
                <InfoTooltip
                  tone="amber"
                  content={rb.connectPromptNote}
                  ariaLabel={t.nav.connectApiShort}
                />
                <button
                  type="button"
                  onClick={onOpenConnectPanel}
                  className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer"
                >
                  {t.nav.connectApiShort}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={Boolean(limitWarning)}
                onClick={() => onSync(dateRange)}
                className="h-10 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-55"
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                <span>{rb.emptyCtaBtn(RANK_BOARD_SYNC_COST)}</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Executive Dashboard Body */}
      {!isSyncing && snapshot && summary && (
        <>
          {/* 1. 4-Column Market KPI Strip */}
          <section
            aria-label="Market summary KPIs"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4"
          >
            {/* KPI 1: Top 100 Total GMV */}
            <div className="rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 p-4 flex flex-col justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {rb.kpiGmvTitle}
              </div>
              <div className="mt-2 font-mono-num tabular-nums text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">
                {formatCompactThb(summary.totalRevenueThb)}
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {rb.kpiGmvSub(windowTag)}
                </div>
                <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full w-full rounded-full bg-teal-600 dark:bg-teal-400" />
                </div>
              </div>
            </div>

            {/* KPI 2: Total Units Sold */}
            <div className="rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 p-4 flex flex-col justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {rb.kpiUnitsTitle}
              </div>
              <div className="mt-2 font-mono-num tabular-nums text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">
                {formatCompactCount(summary.totalSalesVolume)}
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {rb.kpiUnitsSub(summary.monetizableCount, snapshot.products.length)}
                </div>
                <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-700 dark:bg-slate-300 transition-all duration-300"
                    style={{
                      width: `${
                        snapshot.products.length > 0
                          ? Math.min(100, (summary.monetizableCount / snapshot.products.length) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* KPI 3: Short Video Share */}
            <div className="rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 p-4 flex flex-col justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {rb.kpiVideoShareTitle}
              </div>
              <div className="mt-2 font-mono-num tabular-nums text-2xl sm:text-[26px] font-bold tracking-tight text-teal-700 dark:text-teal-400">
                {summary.videoSharePct.toFixed(1)}%
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {rb.kpiVideoShareSub(summary.videoProvenCount)}
                </div>
                <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-600 dark:bg-teal-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, summary.videoSharePct)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* KPI 4: Avg Commission & Payout */}
            <div className="rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 p-4 flex flex-col justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {rb.kpiAvgCommTitle}
              </div>
              <div className="mt-2 font-mono-num tabular-nums text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">
                {summary.avgCommissionRate !== null ? `${summary.avgCommissionRate.toFixed(1)}%` : '—'}
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {rb.kpiAvgCommSub(
                    summary.avgPayoutThb !== null ? `฿${summary.avgPayoutThb}` : '—',
                    summary.sweetSpotCount
                  )}
                </div>
                <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, ((summary.avgCommissionRate ?? 0) / 25) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 2. Analytics Row 1: Channel Split Donut (Left) + Category Market Share Progress Bars (Right) */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left Card: Channel Revenue Split */}
            <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    {rb.channelSectionTitle}
                  </h2>
                  <InfoTooltip
                    content={[rb.channelSectionSub, rb.channelClickHint]}
                    ariaLabel={rb.channelSectionTitle}
                    size="md"
                  />
                </div>

                {/* Interactive SVG Donut + Center Readout */}
                <div className="mt-5 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5">
                  <div className="relative w-40 h-40 shrink-0">
                    <svg
                      viewBox="0 0 180 180"
                      className="w-full h-full -rotate-90"
                      role="img"
                      aria-label={rb.channelSectionTitle}
                    >
                      <circle
                        cx="90"
                        cy="90"
                        r={donutRadius}
                        fill="none"
                        strokeWidth="22"
                        className="stroke-slate-100 dark:stroke-slate-800/90"
                      />
                      {videoPct > 0 && (
                        <circle
                          cx="90"
                          cy="90"
                          r={donutRadius}
                          fill="none"
                          strokeWidth={channelFilter === 'video' ? 26 : 22}
                          strokeDasharray={`${videoArc} ${donutCircumference}`}
                          strokeDashoffset={0}
                          onClick={() => handleToggleChannelFilter('video')}
                          className="stroke-teal-600 dark:stroke-teal-400 transition-all duration-200 cursor-pointer"
                        />
                      )}
                      {livePct > 0 && (
                        <circle
                          cx="90"
                          cy="90"
                          r={donutRadius}
                          fill="none"
                          strokeWidth={channelFilter === 'live' ? 26 : 22}
                          strokeDasharray={`${liveArc} ${donutCircumference}`}
                          strokeDashoffset={-videoArc}
                          onClick={() => handleToggleChannelFilter('live')}
                          className="stroke-indigo-600 dark:stroke-indigo-400 transition-all duration-200 cursor-pointer"
                        />
                      )}
                      {shopPct > 0 && (
                        <circle
                          cx="90"
                          cy="90"
                          r={donutRadius}
                          fill="none"
                          strokeWidth={channelFilter === 'shop' ? 26 : 22}
                          strokeDasharray={`${shopArc} ${donutCircumference}`}
                          strokeDashoffset={-(videoArc + liveArc)}
                          onClick={() => handleToggleChannelFilter('shop')}
                          className="stroke-amber-500 dark:stroke-amber-400 transition-all duration-200 cursor-pointer"
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {rb.channelDominantLabel}
                      </span>
                      <span
                        className={`font-mono-num tabular-nums text-xl font-bold mt-0.5 ${dominantChannelMeta.color}`}
                      >
                        {dominantChannelMeta.pct.toFixed(1)}%
                      </span>
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate max-w-[100px]">
                        {dominantChannelMeta.label}
                      </span>
                    </div>
                  </div>

                  {/* Clickable Channel Rows */}
                  <div className="flex-1 w-full space-y-2.5">
                    {(
                      [
                        {
                          key: 'video' as const,
                          label: rb.channelVideo,
                          rev: summary.videoRevenueThb,
                          pct: videoPct,
                          dotClass: 'bg-teal-600 dark:bg-teal-400',
                          barClass: 'bg-teal-600 dark:bg-teal-400',
                          activeRing:
                            'border-teal-500/80 bg-teal-50/60 dark:bg-teal-950/35',
                        },
                        {
                          key: 'live' as const,
                          label: rb.channelLive,
                          rev: summary.liveRevenueThb,
                          pct: livePct,
                          dotClass: 'bg-indigo-600 dark:bg-indigo-400',
                          barClass: 'bg-indigo-600 dark:bg-indigo-400',
                          activeRing:
                            'border-indigo-500/80 bg-indigo-50/60 dark:bg-indigo-950/35',
                        },
                        {
                          key: 'shop' as const,
                          label: rb.channelShop,
                          rev: summary.shopRevenueThb,
                          pct: shopPct,
                          dotClass: 'bg-amber-500 dark:bg-amber-400',
                          barClass: 'bg-amber-500 dark:bg-amber-400',
                          activeRing:
                            'border-amber-500/80 bg-amber-50/60 dark:bg-amber-950/35',
                        },
                      ] as const
                    ).map((ch) => {
                      const isSelected = channelFilter === ch.key;
                      return (
                        <button
                          key={ch.key}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleToggleChannelFilter(ch.key)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                            isSelected
                              ? ch.activeRing
                              : 'border-slate-200/75 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="inline-flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${ch.dotClass}`} />
                              <span>{ch.label}</span>
                            </span>
                            <span className="font-mono-num tabular-nums font-semibold text-slate-900 dark:text-white">
                              {ch.pct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2.5">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${ch.barClass} transition-all duration-300`}
                                style={{ width: `${Math.min(100, ch.pct)}%` }}
                              />
                            </div>
                            <span className="font-mono-num tabular-nums text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                              {formatCompactThb(ch.rev)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 100% Stacked Proportion Bar */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/90">
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                  {videoPct > 0 && (
                    <div
                      className="h-full bg-teal-600 dark:bg-teal-400 transition-all duration-300"
                      style={{ width: `${videoPct}%` }}
                      title={`${rb.channelVideo}: ${videoPct.toFixed(1)}%`}
                    />
                  )}
                  {livePct > 0 && (
                    <div
                      className="h-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-300"
                      style={{ width: `${livePct}%` }}
                      title={`${rb.channelLive}: ${livePct.toFixed(1)}%`}
                    />
                  )}
                  {shopPct > 0 && (
                    <div
                      className="h-full bg-amber-500 dark:bg-amber-400 transition-all duration-300"
                      style={{ width: `${shopPct}%` }}
                      title={`${rb.channelShop}: ${shopPct.toFixed(1)}%`}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right Card: Category Market Share Progress Bars */}
            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                      {rb.categorySectionTitle}
                    </h2>
                    <InfoTooltip
                      content={[
                        snapshot.categorySource === 'kalodata_category_rank'
                          ? rb.categorySectionSubLive
                          : rb.categorySectionSubAgg,
                        rb.categoryClickHint,
                      ]}
                      ariaLabel={rb.categorySectionTitle}
                      size="md"
                    />
                  </div>
                  <span className="text-[11px] font-mono-num font-medium px-2 py-0.5 rounded-md border border-slate-200/90 dark:border-slate-700 text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
                    {snapshot.categorySource === 'kalodata_category_rank'
                      ? rb.categorySourceLiveTag
                      : rb.categorySourceAggTag}
                  </span>
                </div>

                {/* Progress Bar Rows */}
                <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto overscroll-contain pr-1">
                  {snapshot.categoryMarket.slice(0, 10).map((cat, idx) => {
                    const isSelected = selectedCategoryId === cat.id;
                    const relativeWidth = Math.max(
                      4,
                      Math.min(100, (cat.marketSharePct / maxCategoryShare) * 100)
                    );
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleToggleCategoryFilter(cat.id)}
                        className={`w-full min-h-[44px] text-left px-3 py-2 rounded-xl border transition-all active:scale-[0.99] cursor-pointer ${
                          isSelected
                            ? 'border-teal-500/90 bg-teal-50/70 dark:bg-teal-950/40'
                            : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/45'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono-num text-[11px] text-slate-400 dark:text-slate-500 w-4 shrink-0">
                              {idx + 1}.
                            </span>
                            <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                              {cat.label[language]}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2.5 font-mono-num tabular-nums shrink-0">
                            {cat.revenueThb !== null && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                                {formatCompactThb(cat.revenueThb)}
                              </span>
                            )}
                            <span className="text-xs font-semibold text-slate-900 dark:text-white w-11 text-right">
                              {cat.marketSharePct.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div className="mt-1.5 flex items-center gap-2.5">
                          <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isSelected
                                  ? 'bg-teal-600 dark:bg-teal-400'
                                  : idx === 0
                                    ? 'bg-teal-600/85 dark:bg-teal-400/90'
                                    : 'bg-slate-500/70 dark:bg-slate-400/70'
                              }`}
                              style={{ width: `${relativeWidth}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono-num tabular-nums text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                            {rb.categoryTop100Count(cat.productCountInTop100)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedCategory && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/90 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 font-medium text-teal-700 dark:text-teal-400">
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span>{selectedCategory.label[language]}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(null)}
                    className="font-semibold text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    {rb.clearAllFilters}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* 3. Analytics Row 2: Full-Width Price × Commission Opportunity Matrix */}
          <section className="rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 p-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  {rb.matrixSectionTitle}
                </h2>
                <InfoTooltip
                  content={[rb.matrixSectionSub, rb.matrixTapHint]}
                  ariaLabel={rb.matrixSectionTitle}
                  size="md"
                />
              </div>
              {/* Compact Semantic Legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600 dark:bg-teal-400" />
                  <span>{rb.matrixLegendVideo}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  <span>{rb.matrixLegendLive}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500 dark:bg-slate-400" />
                  <span>{rb.matrixLegendOther}</span>
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Interactive SVG Scatter Plot (SVG-level coordinate matching & drag scrubbing) */}
              <div className="lg:col-span-8 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0E151D] p-2 sm:p-3 overflow-hidden">
                <svg
                  ref={scatterSvgRef}
                  viewBox="0 0 760 278"
                  onPointerDown={(e) => {
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    activeScrubPointerIdRef.current = e.pointerId;
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // ignore unsupported capture
                    }
                    selectNearestDotAtClientPoint(e.clientX, e.clientY);
                  }}
                  onPointerMove={(e) => {
                    if (
                      activeScrubPointerIdRef.current === e.pointerId ||
                      e.pointerType === 'mouse'
                    ) {
                      selectNearestDotAtClientPoint(e.clientX, e.clientY);
                    }
                  }}
                  onPointerUp={(e) => {
                    if (activeScrubPointerIdRef.current === e.pointerId) {
                      activeScrubPointerIdRef.current = null;
                      try {
                        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        }
                      } catch {
                        // ignore
                      }
                    }
                  }}
                  onPointerCancel={(e) => {
                    if (activeScrubPointerIdRef.current === e.pointerId) {
                      activeScrubPointerIdRef.current = null;
                    }
                  }}
                  className="w-full h-auto block select-none touch-none cursor-crosshair"
                  role="img"
                  aria-label={rb.matrixSectionTitle}
                >
                  {/* Sweet Spot Shaded Zone (฿100–฿600 & ≥10% Comm) */}
                  <rect
                    x={sweetX1}
                    y={sweetY1}
                    width={sweetX2 - sweetX1}
                    height={sweetY2 - sweetY1}
                    rx={6}
                    className="fill-teal-500/10 dark:fill-teal-400/10 stroke-teal-600/45 dark:stroke-teal-400/45"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={sweetX1 + 8}
                    y={sweetY1 + 15}
                    className="fill-teal-700 dark:fill-teal-300 text-[10px] font-semibold"
                  >
                    {rb.matrixSweetSpotLabel}
                  </text>

                  {/* Horizontal Gridlines & Y-Axis (Commission %) */}
                  {[0, 10, 20, 30].map((commTick) => {
                    const y = mapCommToY(commTick);
                    return (
                      <g key={commTick}>
                        <line
                          x1={PLOT_LEFT}
                          x2={PLOT_RIGHT}
                          y1={y}
                          y2={y}
                          className="stroke-slate-200 dark:stroke-slate-800"
                          strokeWidth="1"
                        />
                        <text
                          x={PLOT_LEFT - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          className="fill-slate-400 dark:fill-slate-500 font-mono-num text-[10px]"
                        >
                          {commTick === 30 ? '30%+' : `${commTick}%`}
                        </text>
                      </g>
                    );
                  })}

                  {/* Vertical Gridlines & X-Axis (Price THB) */}
                  {[0, 100, 300, 600, 1200, 2500].map((priceTick) => {
                    const x = mapPriceToX(priceTick);
                    return (
                      <g key={priceTick}>
                        <line
                          x1={x}
                          x2={x}
                          y1={PLOT_TOP}
                          y2={PLOT_BOTTOM}
                          className="stroke-slate-200/80 dark:stroke-slate-800/80"
                          strokeWidth="1"
                          strokeDasharray={priceTick === 0 ? undefined : '2 3'}
                        />
                        <text
                          x={x}
                          y={PLOT_BOTTOM + 16}
                          textAnchor="middle"
                          className="fill-slate-400 dark:fill-slate-500 font-mono-num text-[10px]"
                        >
                          {priceTick === 2500
                            ? '฿2.5K+'
                            : priceTick >= 1000
                              ? `฿${(priceTick / 1000).toFixed(1)}K`
                              : `฿${priceTick}`}
                        </text>
                      </g>
                    );
                  })}

                  {/* Axis Titles */}
                  <text
                    x={(PLOT_LEFT + PLOT_RIGHT) / 2}
                    y={273}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-medium"
                  >
                    {rb.matrixAxisPrice}
                  </text>
                  <text
                    x={13}
                    y={(PLOT_TOP + PLOT_BOTTOM) / 2}
                    textAnchor="middle"
                    transform={`rotate(-90 13 ${(PLOT_TOP + PLOT_BOTTOM) / 2})`}
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-medium"
                  >
                    {rb.matrixAxisComm}
                  </text>

                  {/* Product Bubbles */}
                  {orderedScatterRows.map((row) => {
                    const cx = mapPriceToX(row.priceThb ?? 0);
                    const cy = mapCommToY(row.commissionRate ?? 0);
                    const r = computeDotRadius(row.revenueThb, maxRowRevenue);
                    const isSelected = inspectedRow?.product.id === row.product.id;
                    const displayR = isSelected ? r + 2.5 : r;

                    const fillClass = isSelected
                      ? row.dominantChannel === 'video'
                        ? 'fill-teal-500 dark:fill-teal-300'
                        : row.dominantChannel === 'live'
                          ? 'fill-indigo-500 dark:fill-indigo-300'
                          : 'fill-slate-700 dark:fill-slate-100'
                      : row.dominantChannel === 'video'
                        ? 'fill-teal-600/75 dark:fill-teal-400/75'
                        : row.dominantChannel === 'live'
                          ? 'fill-indigo-600/75 dark:fill-indigo-400/75'
                          : 'fill-slate-500/70 dark:fill-slate-400/70';

                    return (
                      <g
                        key={row.product.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`#${row.rank} ${row.product.thaiTitle}`}
                        aria-pressed={isSelected}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setInspectedProductId(row.product.id);
                          }
                        }}
                        className="cursor-pointer focus:outline-none"
                      >
                        {isSelected && (
                          <>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={displayR + 7.5}
                              fill="none"
                              strokeWidth="3"
                              className="stroke-teal-500/30 dark:stroke-teal-300/30"
                            />
                            <circle
                              cx={cx}
                              cy={cy}
                              r={displayR + 4}
                              fill="none"
                              strokeWidth="2"
                              className="stroke-slate-900 dark:stroke-white"
                            />
                          </>
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={displayR}
                          className={`${fillClass} stroke-white dark:stroke-[#0E151D] transition-all duration-150`}
                          strokeWidth={isSelected ? 2 : 1}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Right Panel: Selected Product Inspector Card */}
              <div className="lg:col-span-4 rounded-xl border border-slate-200/85 dark:border-slate-800 bg-slate-50/40 dark:bg-[#0E151D] p-4 flex flex-col justify-between">
                {inspectedRow ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono-num font-bold text-teal-700 dark:text-teal-400">
                          Rank #{inspectedRow.rank}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {language === 'my'
                            ? inspectedRow.categoryNameMy
                            : inspectedRow.categoryNameEn}
                        </span>
                      </div>

                      <div className="mt-3 flex items-start gap-3">
                        <img
                          src={
                            inspectedRow.product.imageUrl ||
                            getStudioFallbackImage(inspectedRow.product.category)
                          }
                          alt={inspectedRow.product.thaiTitle}
                          className="w-16 h-16 rounded-lg object-cover border border-slate-200/80 dark:border-slate-700/80 shrink-0 bg-slate-100 dark:bg-slate-800"
                        />
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                            {inspectedRow.product.thaiTitle}
                          </h3>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {inspectedRow.product.shopName}
                          </p>
                        </div>
                      </div>

                      {/* Inspector Key Numbers */}
                      <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#131B24] border border-slate-200/75 dark:border-slate-800">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {rb.colRevenue}
                          </div>
                          <div className="mt-0.5 font-mono-num tabular-nums font-bold text-slate-900 dark:text-white">
                            {formatCompactThb(inspectedRow.revenueThb)}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#131B24] border border-slate-200/75 dark:border-slate-800">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {rb.colPrice}
                          </div>
                          <div className="mt-0.5 font-mono-num tabular-nums font-bold text-slate-900 dark:text-white">
                            {inspectedRow.priceThb !== null
                              ? `฿${Math.round(inspectedRow.priceThb).toLocaleString()}`
                              : '—'}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#131B24] border border-slate-200/75 dark:border-slate-800">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {rb.colCommission}
                          </div>
                          <div className="mt-0.5 font-mono-num tabular-nums font-bold text-teal-700 dark:text-teal-400">
                            {inspectedRow.commissionRate !== null
                              ? `${inspectedRow.commissionRate}%`
                              : '—'}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#131B24] border border-slate-200/75 dark:border-slate-800">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {rb.colPayout}
                          </div>
                          <div className="mt-0.5 font-mono-num tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                            {inspectedRow.payoutThb !== null
                              ? `฿${Math.round(inspectedRow.payoutThb).toLocaleString()}`
                              : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Mini Stacked Channel Mix Bar */}
                      <div className="mt-3.5">
                        <div className="flex items-center justify-between text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                          <span>V {inspectedRow.videoSharePct.toFixed(0)}%</span>
                          <span>L {inspectedRow.liveSharePct.toFixed(0)}%</span>
                          <span>S {inspectedRow.shopSharePct.toFixed(0)}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden flex">
                          <div
                            className="h-full bg-teal-600 dark:bg-teal-400"
                            style={{ width: `${inspectedRow.videoSharePct}%` }}
                          />
                          <div
                            className="h-full bg-indigo-600 dark:bg-indigo-400"
                            style={{ width: `${inspectedRow.liveSharePct}%` }}
                          />
                          <div
                            className="h-full bg-amber-500 dark:bg-amber-400"
                            style={{ width: `${inspectedRow.shopSharePct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectProduct(inspectedRow.product)}
                      className="mt-4 h-10 w-full rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>{rb.matrixOpenStudioBtn}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center p-4 text-xs text-slate-500 dark:text-slate-400">
                    {rb.matrixInspectorEmpty}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 4. Ranked Product Leaderboard Table */}
          <section className="rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden">
            {/* Table Header & Controls */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    {rb.tableSectionTitle}
                  </h2>
                  <span className="text-xs font-mono-num tabular-nums text-slate-500 dark:text-slate-400">
                    ({filteredRows.length}/{allComputedRows.length})
                  </span>
                  <InfoTooltip
                    content={rb.tableSectionSub(filteredRows.length, allComputedRows.length)}
                    ariaLabel={rb.tableSectionTitle}
                  />
                </div>

                {/* Live Search Input (0 cr) */}
                <div className="relative w-full sm:w-64 md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={rb.searchPlaceholder}
                    className="w-full h-11 sm:h-9 pl-9 pr-10 rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-slate-50/70 dark:bg-[#0E151D] text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label={t.history.clearFilterAria}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 sm:h-7 sm:w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Filter Segmented Control + Mobile Sort + Active Cross-Filter Indicators */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div
                  role="group"
                  aria-label="Quick rank filters"
                  className="inline-flex flex-wrap items-center gap-1.5 sm:gap-1 p-1 sm:p-0.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/75 dark:border-slate-700/70"
                >
                  {(
                    [
                      { key: 'all' as const, label: rb.filterAll },
                      { key: 'video_proven' as const, label: rb.filterVideoProven },
                      { key: 'high_commission' as const, label: rb.filterHighComm },
                      { key: 'sweet_spot' as const, label: rb.filterSweetSpot },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      aria-pressed={quickFilter === opt.key}
                      onClick={() => setQuickFilter(opt.key)}
                      className={`h-10 sm:h-8 px-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer ${
                        quickFilter === opt.key
                          ? 'bg-white dark:bg-[#131B24] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Mobile/Tablet Sort Unified Picker */}
                <div className="flex items-center gap-2 md:hidden">
                  <label
                    htmlFor="rank-board-mobile-sort"
                    className="text-xs font-medium text-slate-500 dark:text-slate-400"
                  >
                    {rb.sortLabel}:
                  </label>
                  <CustomSelect
                    id="rank-board-mobile-sort"
                    ariaLabel={rb.sortLabel}
                    size="sm"
                    value={sortBy}
                    options={[
                      { value: 'rank', label: rb.colRank },
                      { value: 'revenue', label: rb.colRevenue },
                      { value: 'sales', label: rb.colUnits },
                      { value: 'commission', label: rb.colCommission },
                      { value: 'payout', label: rb.colPayout },
                      { value: 'videoShare', label: 'Video %' },
                      { value: 'score', label: rb.colScore },
                    ]}
                    onChange={(val) => setSortBy(val as RankBoardSortKey)}
                  />
                </div>

                {/* Active Cross-Filter Banner */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Filter className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    {selectedCategory && (
                      <span className="inline-flex items-center gap-1 font-medium text-teal-800 dark:text-teal-300">
                        <span>{rb.activeCategoryFilter(selectedCategory.label[language])}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCategoryId(null)}
                          className="p-0.5 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {channelFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 font-medium text-indigo-700 dark:text-indigo-300">
                        <span>
                          {rb.activeChannelFilter(
                            channelFilter === 'video'
                              ? rb.channelVideo
                              : channelFilter === 'live'
                                ? rb.channelLive
                                : rb.channelShop
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setChannelFilter('all')}
                          className="p-0.5 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 font-medium underline cursor-pointer"
                    >
                      {rb.clearAllFilters}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="p-10 text-center">
                <div className="inline-flex items-center justify-center gap-1.5">
                  <h3 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                    {rb.noMatchesTitle}
                  </h3>
                  <InfoTooltip
                    content={rb.noMatchesDesc}
                    ariaLabel={rb.noMatchesTitle}
                    size="md"
                  />
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-4 h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                  >
                    {rb.clearAllFilters}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop / Tablet (md+) Clean Executive Data Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0E151D]/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {(
                          [
                            { key: 'rank' as const, label: rb.colRank, align: 'text-left w-12 pl-5' },
                            { key: null, label: rb.colProduct, align: 'text-left' },
                            { key: null, label: rb.colPrice, align: 'text-right w-24' },
                            { key: 'revenue' as const, label: rb.colRevenue, align: 'text-right w-36' },
                            { key: 'sales' as const, label: rb.colUnits, align: 'text-right w-24' },
                            { key: 'commission' as const, label: rb.colCommission, align: 'text-right w-24' },
                            { key: 'payout' as const, label: rb.colPayout, align: 'text-right w-24' },
                            { key: 'videoShare' as const, label: rb.colChannels, align: 'text-left w-36' },
                            { key: 'score' as const, label: rb.colScore, align: 'text-right w-20' },
                            { key: null, label: '', align: 'text-right w-24 pr-5' },
                          ] as const
                        ).map((col, idx) => (
                          <th key={idx} className={`py-3 px-2.5 whitespace-nowrap ${col.align}`}>
                            {col.key ? (
                              <button
                                type="button"
                                onClick={() => setSortBy(col.key)}
                                className={`inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                  sortBy === col.key
                                    ? 'text-teal-700 dark:text-teal-400'
                                    : 'hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                              >
                                <span>{col.label}</span>
                                {sortBy === col.key && <ArrowDown className="w-3 h-3 shrink-0" />}
                              </button>
                            ) : (
                              <span>{col.label}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                      {filteredRows.map((row) => {
                        const isSaved = savedProductIds.has(row.product.id);
                        const revBarPct = Math.max(
                          3,
                          Math.min(100, (row.revenueThb / maxRowRevenue) * 100)
                        );
                        return (
                          <tr
                            key={row.product.id}
                            onClick={() => onSelectProduct(row.product)}
                            className="group hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                          >
                            {/* Rank */}
                            <td className="py-3 pl-5 pr-2 font-mono-num tabular-nums font-bold text-slate-500 dark:text-slate-400">
                              <span
                                className={
                                  row.rank <= 3
                                    ? 'text-teal-700 dark:text-teal-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                }
                              >
                                #{row.rank}
                              </span>
                            </td>

                            {/* Product Thumbnail + Untouched Thai Title */}
                            <td className="py-3 px-2.5 max-w-[280px]">
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={
                                    row.product.imageUrl ||
                                    getStudioFallbackImage(row.product.category)
                                  }
                                  alt={row.product.thaiTitle}
                                  loading="lazy"
                                  className="w-11 h-11 rounded-lg object-cover border border-slate-200/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors line-clamp-2 leading-snug">
                                    {row.product.thaiTitle}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {row.product.shopName} ·{' '}
                                    {language === 'my' ? row.categoryNameMy : row.categoryNameEn}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Price */}
                            <td className="py-3 px-2.5 text-right font-mono-num tabular-nums font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {row.priceThb !== null
                                ? `฿${Math.round(row.priceThb).toLocaleString()}`
                                : '—'}
                            </td>

                            {/* Revenue + Inline Progress Bar */}
                            <td className="py-3 px-2.5 text-right whitespace-nowrap">
                              <div className="font-mono-num tabular-nums font-semibold text-slate-900 dark:text-white">
                                {formatCompactThb(row.revenueThb)}
                              </div>
                              <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-teal-600/85 dark:bg-teal-400/85"
                                  style={{ width: `${revBarPct}%` }}
                                />
                              </div>
                            </td>

                            {/* Units */}
                            <td className="py-3 px-2.5 text-right font-mono-num tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {formatCompactCount(row.salesVolume)}
                            </td>

                            {/* Commission */}
                            <td className="py-3 px-2.5 text-right font-mono-num tabular-nums whitespace-nowrap">
                              <span
                                className={
                                  row.commissionRate !== null && row.commissionRate >= 10
                                    ? 'font-semibold text-teal-700 dark:text-teal-400'
                                    : 'text-slate-600 dark:text-slate-400'
                                }
                              >
                                {row.commissionRate !== null ? `${row.commissionRate}%` : '—'}
                              </span>
                            </td>

                            {/* Payout / Sale */}
                            <td className="py-3 px-2.5 text-right font-mono-num tabular-nums font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                              {row.payoutThb !== null
                                ? `฿${Math.round(row.payoutThb).toLocaleString()}`
                                : '—'}
                            </td>

                            {/* Video / Live / Shop Stacked Bar */}
                            <td className="py-3 px-2.5">
                              <div className="flex items-center justify-between text-[10px] font-mono-num tabular-nums text-slate-500 dark:text-slate-400">
                                <span className="text-teal-700 dark:text-teal-400 font-semibold">
                                  V {row.videoSharePct.toFixed(0)}%
                                </span>
                                <span>L {row.liveSharePct.toFixed(0)}%</span>
                              </div>
                              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                                <div
                                  className="h-full bg-teal-600 dark:bg-teal-400"
                                  style={{ width: `${row.videoSharePct}%` }}
                                />
                                <div
                                  className="h-full bg-indigo-600 dark:bg-indigo-400"
                                  style={{ width: `${row.liveSharePct}%` }}
                                />
                                <div
                                  className="h-full bg-amber-500 dark:bg-amber-400"
                                  style={{ width: `${row.shopSharePct}%` }}
                                />
                              </div>
                            </td>

                            {/* Search Score */}
                            <td className="py-3 px-2.5 text-right whitespace-nowrap">
                              <span
                                className={`inline-flex items-center justify-center min-w-[34px] h-6 px-1.5 rounded-md border font-mono-num tabular-nums text-[11px] font-bold ${getScoreBadgeClass(
                                  row.searchScore
                                )}`}
                              >
                                {row.searchScore ?? '—'}
                              </span>
                            </td>

                            {/* Actions: Save + Studio */}
                            <td className="py-3 pl-2 pr-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  aria-label={
                                    isSaved ? t.card.unsaveProduct : t.card.saveProduct
                                  }
                                  title={isSaved ? t.card.unsaveProduct : t.card.saveProduct}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSaveProduct(row.product);
                                  }}
                                  className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                                    isSaved
                                      ? 'border-teal-500/70 bg-teal-50/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400'
                                      : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                  }`}
                                >
                                  <Bookmark
                                    className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectProduct(row.product);
                                  }}
                                  className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0E151D] group-hover:border-teal-500/80 group-hover:text-teal-700 dark:group-hover:text-teal-400 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <span>{rb.openStudioAction}</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile (< md) Structured Rank Cards */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.map((row) => {
                    const isSaved = savedProductIds.has(row.product.id);
                    return (
                      <div
                        key={row.product.id}
                        onClick={() => onSelectProduct(row.product)}
                        className="p-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative shrink-0">
                            <img
                              src={
                                row.product.imageUrl ||
                                getStudioFallbackImage(row.product.category)
                              }
                              alt={row.product.thaiTitle}
                              loading="lazy"
                              className="w-14 h-14 rounded-lg object-cover border border-slate-200/80 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                            />
                            <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-mono-num text-[10px] font-bold">
                              #{row.rank}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 select-text ${
                                language === 'my' ? 'leading-[1.55]' : 'leading-snug'
                              }`}
                            >
                              {row.product.thaiTitle}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate select-text">
                              {row.product.shopName} ·{' '}
                              {language === 'my' ? row.categoryNameMy : row.categoryNameEn}
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center justify-center min-w-[30px] h-6 px-1.5 rounded-md border font-mono-num text-[11px] font-bold shrink-0 ${getScoreBadgeClass(
                              row.searchScore
                            )}`}
                          >
                            {row.searchScore ?? '—'}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-mono-num tabular-nums">
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0E151D] border border-slate-200/60 dark:border-slate-800">
                            <div className="text-[10px] font-sans text-slate-400">{rb.colRevenue}</div>
                            <div className="font-semibold text-slate-900 dark:text-white select-text">
                              {formatCompactThb(row.revenueThb)}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0E151D] border border-slate-200/60 dark:border-slate-800">
                            <div className="text-[10px] font-sans text-slate-400">{rb.colPrice}</div>
                            <div className="font-semibold text-slate-900 dark:text-white select-text">
                              {row.priceThb !== null ? `฿${Math.round(row.priceThb)}` : '—'}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0E151D] border border-slate-200/60 dark:border-slate-800">
                            <div className="text-[10px] font-sans text-slate-400">{rb.colCommission}</div>
                            <div className="font-semibold text-teal-700 dark:text-teal-400 select-text">
                              {row.commissionRate !== null ? `${row.commissionRate}%` : '—'}
                              {row.payoutThb !== null ? ` · ฿${Math.round(row.payoutThb)}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-500 dark:text-slate-400">
                              <span>V {row.videoSharePct.toFixed(0)}%</span>
                              <span>L {row.liveSharePct.toFixed(0)}%</span>
                              <span>S {row.shopSharePct.toFixed(0)}%</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                              <div
                                className="h-full bg-teal-600 dark:bg-teal-400"
                                style={{ width: `${row.videoSharePct}%` }}
                              />
                              <div
                                className="h-full bg-indigo-600 dark:bg-indigo-400"
                                style={{ width: `${row.liveSharePct}%` }}
                              />
                              <div
                                className="h-full bg-amber-500 dark:bg-amber-400"
                                style={{ width: `${row.shopSharePct}%` }}
                              />
                            </div>
                          </div>
                          <div className="inline-flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              aria-label={isSaved ? t.card.unsaveProduct : t.card.saveProduct}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleSaveProduct(row.product);
                              }}
                              className={`relative h-11 w-11 inline-flex items-center justify-center rounded-lg border transition-transform active:scale-95 cursor-pointer ${
                                isSaved
                                  ? 'border-teal-500/70 bg-teal-50/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-400'
                              }`}
                            >
                              <Bookmark
                                className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectProduct(row.product);
                              }}
                              className="h-11 px-3.5 rounded-lg bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1 active:scale-[0.98] transition-transform cursor-pointer"
                            >
                              <span>{rb.openStudioAction}</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
