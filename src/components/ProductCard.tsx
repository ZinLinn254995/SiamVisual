import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
} from 'lucide-react';
import type { Translations } from '../i18n';
import { translateCategoryNameToMyanmar } from '../lib/categoryTranslations';
import { getStudioFallbackImage } from '../lib/media';
import {
  ensureProductV2Intelligence,
  type ExcludedIntelligenceCardItem,
  type RankedIntelligenceCardItem,
} from '../lib/productIntelligenceView.ts';
import {
  evaluateSearchOpportunityScore,
  type SearchScoreCapCode,
  type SearchScoreGrade,
} from '../lib/searchScoreEngine.ts';
import { getTikTokShopProductUrl } from '../lib/tiktokLink';
import type {
  CardDensity,
  Language,
  ProductItem,
  ResultViewMode,
  ScoreGrade,
} from '../types';
import { ScoreRing } from './ScoreRing';

interface ProductCardProps {
  product: ProductItem;
  intelligenceItem?: RankedIntelligenceCardItem | ExcludedIntelligenceCardItem;
  index: number;
  language: Language;
  isSaved: boolean;
  viewMode?: ResultViewMode;
  density?: CardDensity;
  nowMs?: number;
  t: Translations;
  onSelect: (product: ProductItem) => void;
  onToggleSave: (product: ProductItem) => void;
  onOpenScoreDetails: (product: ProductItem) => void;
}

function formatCompactThb(amount: number): string {
  if (amount >= 1_000_000) {
    return `฿${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  }
  if (amount >= 10_000) {
    return `฿${(amount / 1_000).toFixed(amount >= 100_000 ? 0 : 1)}K`;
  }
  return `฿${Math.round(amount).toLocaleString()}`;
}

function formatCompactCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 10_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return Math.round(count).toLocaleString();
}

function searchGradeToScoreGrade(grade: SearchScoreGrade): ScoreGrade {
  switch (grade) {
    case 'TOP':
      return 'top';
    case 'STRONG':
      return 'strong';
    case 'MODERATE':
      return 'fair';
    case 'WEAK':
    case 'NOT_MONETIZABLE':
    case 'INSUFFICIENT':
    default:
      return 'low';
  }
}

function searchGradeToTextClass(grade: SearchScoreGrade): string {
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

function formatCapChip(cap: SearchScoreCapCode, language: Language): string {
  switch (cap) {
    case 'NO_VIDEO_SALES_CAP':
      return language === 'my' ? 'Video ฿0' : '฿0 Video';
    case 'LIVE_DEPENDENT_CAP':
      return language === 'my' ? 'Live အဓိက' : 'Live-Led';
    case 'WEAK_DEMAND_CAP':
      return language === 'my' ? 'ရောင်းအားနည်း' : 'Low Sales';
    case 'MISSING_VIDEO_DATA_CAP':
      return language === 'my' ? 'Video Data မပါ' : 'No Video Data';
    default:
      return language === 'my' ? 'ကန့်သတ်ချက်' : 'Capped';
  }
}

export function ProductCard({
  product: rawProduct,
  intelligenceItem,
  index,
  language,
  isSaved,
  viewMode = 'grid',
  density = 'standard',
  nowMs,
  t,
  onSelect,
  onToggleSave,
  onOpenScoreDetails,
}: ProductCardProps) {
  const product = useMemo(
    () =>
      intelligenceItem?.product ??
      ensureProductV2Intelligence(rawProduct, nowMs !== undefined ? { nowMs } : undefined),
    [intelligenceItem, rawProduct, nowMs]
  );

  const fallbackSrc = getStudioFallbackImage(product.category);
  const [imgSrc, setImgSrc] = useState<string>(product.imageUrl || fallbackSrc);
  const [usingFallback, setUsingFallback] = useState<boolean>(!product.imageUrl);
  const [copiedField, setCopiedField] = useState<'thai' | 'id' | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState<boolean>(false);

  useEffect(() => {
    setDetailsExpanded(false);
  }, [product.id]);

  const validated = product.validatedMetrics!;
  const historicalTrend = intelligenceItem?.historicalTrend;
  const compactTrendChip = useMemo(() => {
    if (!historicalTrend) return null;
    const cls = historicalTrend.overallTrend;
    const count = historicalTrend.comparableSnapshotCount;
    if (cls === 'RISING') {
      return {
        text: `↗ ${count}d`,
        tone: 'text-emerald-600 dark:text-emerald-400',
        title: historicalTrend.overallExplanation,
      };
    }
    if (cls === 'DECLINING') {
      return {
        text: `↘ ${count}d`,
        tone: 'text-rose-600 dark:text-rose-400',
        title: historicalTrend.overallExplanation,
      };
    }
    if (cls === 'VOLATILE') {
      return {
        text: `↕ ${count}d`,
        tone: 'text-amber-600 dark:text-amber-400',
        title: historicalTrend.overallExplanation,
      };
    }
    if (cls === 'STABLE') {
      return {
        text: `→ ${count}d`,
        tone: 'text-slate-500 dark:text-slate-400',
        title: historicalTrend.overallExplanation,
      };
    }
    return null;
  }, [historicalTrend]);

  const searchScore = useMemo(
    () =>
      intelligenceItem?.searchScore ??
      evaluateSearchOpportunityScore(validated, nowMs !== undefined ? { nowMs } : undefined),
    [intelligenceItem, validated, nowMs]
  );

  const displayedScore: number | null = searchScore.score;
  const scoreGrade = searchGradeToScoreGrade(searchScore.grade);
  const statusToneTextClass = searchGradeToTextClass(searchScore.grade);
  const scoreRingCaption = t.v2.searchScore.badgeShort;
  const headerStatusText = t.v2.searchScore.grades[searchScore.grade];
  const scoreTooltipTitle = `${t.v2.searchScore.badgeShort}: ${headerStatusText} (${
    displayedScore ?? '—'
  }/100) — ${t.score.tooltipBtn}`;

  const metrics = product.kalodataMetrics;
  const tiktokShopUrl = getTikTokShopProductUrl(product);
  const primaryTitle = product.thaiTitle;

  const displayCategoryLabel =
    language === 'my'
      ? product.categoryLabel.my && /[\u1000-\u109F]/.test(product.categoryLabel.my)
        ? product.categoryLabel.my
        : translateCategoryNameToMyanmar(
            product.categoryLabel.en || product.categoryLabel.my,
            product.kalodataCategoryId
          )
      : product.categoryLabel.en || product.categoryLabel.my;

  const hasSalesVol =
    typeof metrics?.salesVolume7d === 'number' && Number.isFinite(metrics.salesVolume7d);
  const hasVideoRev =
    typeof metrics?.videoRevenueThb7d === 'number' &&
    Number.isFinite(metrics.videoRevenueThb7d) &&
    metrics.videoRevenueThb7d > 0;
  const hasTotalRev =
    typeof metrics?.revenueThb7d === 'number' && Number.isFinite(metrics.revenueThb7d);
  const hasAnySalesRow = hasSalesVol || hasVideoRev || hasTotalRev;

  useEffect(() => {
    if (product.imageUrl) {
      setImgSrc(product.imageUrl);
      setUsingFallback(false);
    } else {
      setImgSrc(fallbackSrc);
      setUsingFallback(true);
    }
  }, [product.id, product.imageUrl, fallbackSrc]);

  async function handleCopy(field: 'thai' | 'id', text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField((curr) => (curr === field ? null : curr));
    }, 1600);
  }

  const renderSaveIconButton = (variant: 'compact' | 'regular' | 'overlay' = 'compact') => {
    const label = isSaved ? t.card.unsaveProduct : t.card.saveProduct;
    if (variant === 'overlay') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(product);
          }}
          aria-pressed={isSaved}
          aria-label={label}
          title={label}
          className={`absolute top-1.5 right-1.5 z-10 h-9 w-9 sm:h-8 sm:w-8 rounded-lg border inline-flex items-center justify-center backdrop-blur-xs transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 before:content-[""] before:absolute before:-inset-1 sm:before:hidden ${
            isSaved
              ? 'border-teal-500/70 bg-teal-50/95 dark:bg-teal-950/85 text-teal-700 dark:text-teal-300'
              : 'border-slate-200/80 dark:border-slate-700/80 bg-white/85 dark:bg-[#131B24]/85 text-slate-500 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 hover:border-teal-400/70'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      );
    }

    const sizeClass =
      variant === 'regular' ? 'h-10 w-10 sm:h-9 sm:w-9' : 'h-9 w-9 sm:h-8 sm:w-8';
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSave(product);
        }}
        aria-pressed={isSaved}
        aria-label={label}
        title={label}
        className={`relative ${sizeClass} rounded-lg inline-flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 before:content-[""] before:absolute before:-inset-1 sm:before:hidden ${
          isSaved
            ? 'text-teal-700 dark:text-teal-400 bg-teal-50/90 dark:bg-teal-950/50 hover:bg-teal-100/80 dark:hover:bg-teal-950/80'
            : 'text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Bookmark className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
      </button>
    );
  };

  const isMicro = density === 'micro';
  const isCompact = density === 'compact';
  const isSpacious = density === 'spacious';

  const isZeroCommission =
    validated.commissionRate.state === 'ZERO' || searchScore.status === 'NOT_MONETIZABLE';

  const commissionText =
    product.commissionRate !== null
      ? `${product.commissionRate}%${
          product.commissionThb !== null
            ? ` · ฿${Math.round(product.commissionThb).toLocaleString()}`
            : ''
        }`
      : '—';

  const salesVolText = hasSalesVol
    ? `${formatCompactCount(metrics!.salesVolume7d!)}${t.card.unitsSuffix}`
    : '—';

  const revenueText = hasVideoRev
    ? formatCompactThb(metrics!.videoRevenueThb7d!)
    : hasTotalRev
      ? formatCompactThb(metrics!.revenueThb7d!)
      : '—';

  // 4 Unified Search Score Pillars — all computed directly from real search data
  const pillars = [
    {
      key: 'demand',
      label: t.v2.searchScore.pillars.demand.short,
      score: searchScore.pillars.demand.score,
      barClass: 'bg-emerald-500 dark:bg-emerald-400',
      textClass: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      key: 'earning',
      label: t.v2.searchScore.pillars.earning.short,
      score: isZeroCommission ? 0 : searchScore.pillars.earning.score,
      barClass: isZeroCommission ? 'bg-rose-500 dark:bg-rose-400' : 'bg-teal-500 dark:bg-teal-400',
      textClass: isZeroCommission
        ? 'text-rose-700 dark:text-rose-400'
        : 'text-teal-700 dark:text-teal-400',
    },
    {
      key: 'videoProof',
      label: t.v2.searchScore.pillars.videoProof.short,
      score: searchScore.pillars.videoProof.score,
      barClass: 'bg-sky-500 dark:bg-sky-400',
      textClass: 'text-sky-700 dark:text-sky-400',
    },
    {
      key: 'priceFit',
      label: t.v2.searchScore.pillars.priceFit.short,
      score: searchScore.pillars.priceFit.score,
      barClass: 'bg-indigo-500 dark:bg-indigo-400',
      textClass: 'text-indigo-700 dark:text-indigo-400',
    },
  ];

  // Channel split percentages for proportional Video / Live / Mall visual bar
  const videoSharePct =
    searchScore.metrics.videoSharePct !== null
      ? Math.max(0, Math.min(100, Math.round(searchScore.metrics.videoSharePct)))
      : null;
  const liveSharePct =
    searchScore.metrics.liveSharePct !== null
      ? Math.max(
          0,
          Math.min(
            videoSharePct !== null ? 100 - videoSharePct : 100,
            Math.round(searchScore.metrics.liveSharePct)
          )
        )
      : null;
  const mallSharePct =
    videoSharePct !== null
      ? Math.max(0, 100 - videoSharePct - (liveSharePct ?? 0))
      : null;

  const videoPoolThb = searchScore.metrics.videoCommissionPoolThb;
  const primaryCap = searchScore.capsApplied[0] ?? null;

  const renderUtilityButtons = (compactMode: boolean) => (
    <div className={`flex items-center shrink-0 ${compactMode ? 'gap-1.5 sm:gap-0.5' : 'gap-2 sm:gap-1'}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleCopy('thai', product.thaiTitle);
        }}
        title={t.card.copyThai}
        className={`relative ${
          compactMode
            ? 'h-8 sm:h-7 px-2 sm:px-1.5 text-[11px] sm:text-[10px]'
            : 'h-8 sm:h-7 px-2 sm:px-1.5 text-[11px]'
        } rounded-md font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-0.5 transition-all active:scale-95 cursor-pointer before:content-[""] before:absolute before:-inset-1 sm:before:hidden`}
      >
        {copiedField === 'thai' ? (
          <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
        ) : (
          <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        )}
        <span>{copiedField === 'thai' ? t.card.copiedShort : 'TH'}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleCopy('id', product.id);
        }}
        title={`${t.card.copyId}: ${product.id}`}
        className={`relative ${
          compactMode
            ? 'h-8 sm:h-7 px-2 sm:px-1.5 text-[11px] sm:text-[10px]'
            : 'h-8 sm:h-7 px-2 sm:px-1.5 text-[11px]'
        } rounded-md font-mono-num font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-0.5 transition-all active:scale-95 cursor-pointer before:content-[""] before:absolute before:-inset-1 sm:before:hidden`}
      >
        {copiedField === 'id' ? (
          <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
        ) : (
          <span>ID</span>
        )}
      </button>
      {tiktokShopUrl && (
        <>
          <span
            aria-hidden="true"
            className="h-3 w-px bg-slate-200 dark:bg-slate-700/80 mx-0.5 shrink-0"
          />
          <a
            href={tiktokShopUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={t.card.openTikTokShop}
            aria-label={`${t.card.openTikTokShop}: ${primaryTitle}`}
            className={`relative ${
              compactMode
                ? 'h-8 sm:h-7 px-2 sm:px-1.5 text-[11px] sm:text-[10px]'
                : 'h-8 sm:h-7 px-2 sm:px-1.5 text-[11px]'
            } rounded-md font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 inline-flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 before:content-[""] before:absolute before:-inset-1 sm:before:hidden`}
          >
            <span className={compactMode ? 'hidden sm:inline' : 'inline'}>Shop</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </>
      )}
    </div>
  );

  // Hero 4-number visual strip: Price, Commission, 7d Sales, 7d Video/Total Rev
  const renderHeroMetricsStrip = (colsClass: string) => (
    <div
      className={`grid ${colsClass} gap-x-3 gap-y-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80`}
    >
      <div className="min-w-0">
        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
          {t.card.price}
        </div>
        <div className="mt-0.5 text-sm font-semibold font-mono-num tabular-nums text-slate-900 dark:text-slate-100 truncate select-text">
          {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
          {t.card.commission}
        </div>
        <div
          className={`mt-0.5 text-sm font-semibold font-mono-num tabular-nums truncate select-text ${
            isZeroCommission
              ? 'text-rose-700 dark:text-rose-400'
              : 'text-teal-700 dark:text-teal-400'
          }`}
        >
          {commissionText}
        </div>
      </div>

      {hasAnySalesRow && (
        <>
          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {t.card.sales7d}
            </div>
            <div className="mt-0.5 text-xs sm:text-sm font-semibold font-mono-num tabular-nums text-slate-800 dark:text-slate-200 truncate select-text">
              {salesVolText}
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {hasVideoRev ? t.card.videoRev7d : t.card.revenue7d}
            </div>
            <div className="mt-0.5 text-xs sm:text-sm font-semibold font-mono-num tabular-nums text-slate-800 dark:text-slate-200 truncate select-text">
              {revenueText}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // 4 Real Search Score Pillar Bars (Demand · Earning · Video · Price)
  const renderPillarBars = (columnsClass: string) => (
    <div
      className={`grid ${columnsClass} gap-x-3.5 gap-y-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80`}
    >
      {pillars.map((pillar) => {
        const hasScore = pillar.score !== null;
        const rounded = hasScore ? Math.round(pillar.score!) : null;
        const widthPct = rounded !== null ? Math.max(rounded > 0 ? 5 : 0, Math.min(100, rounded)) : 0;

        return (
          <div
            key={pillar.key}
            className="min-w-0"
            title={`${pillar.label}: ${rounded !== null ? `${rounded}/100` : '—'}`}
          >
            <div className="flex items-baseline justify-between gap-1.5">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                {pillar.label}
              </span>
              <span
                className={`text-xs font-semibold font-mono-num tabular-nums shrink-0 ${
                  rounded !== null ? pillar.textClass : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {rounded !== null ? (pillar.key === 'earning' && isZeroCommission ? '0%' : rounded) : '—'}
              </span>
            </div>

            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800/90 overflow-hidden">
              {rounded !== null && widthPct > 0 && (
                <div
                  className={`h-full rounded-full transition-all duration-200 ${pillar.barClass}`}
                  style={{ width: `${widthPct}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Clean Visual Channel Split Bar + Affiliate Video Pool / Cap Signal
  const renderChannelAndPoolStrip = () => {
    const channelLegend =
      videoSharePct !== null
        ? `${t.v2.searchScore.channelShort.video} ${videoSharePct}%${
            liveSharePct !== null && liveSharePct >= 10
              ? ` · ${t.v2.searchScore.channelShort.live} ${liveSharePct}%`
              : ''
          }`
        : '—';

    return (
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-x-3.5 items-end">
        {/* Left: Proportional Video / Live / Mall Channel Bar */}
        <div
          className="min-w-0"
          title={`${t.v2.searchScore.channelsTitle}: ${channelLegend}`}
          aria-label={`${t.v2.searchScore.channelsTitle}: ${channelLegend}`}
        >
          <div className="flex items-baseline justify-between gap-1 text-[10px]">
            <span className="text-slate-500 dark:text-slate-400 truncate">
              {t.v2.searchScore.channelShort.video}
            </span>
            <span className="font-mono-num tabular-nums font-semibold text-slate-700 dark:text-slate-200 shrink-0">
              {videoSharePct !== null ? `${videoSharePct}%` : '—'}
            </span>
          </div>
          {videoSharePct !== null ? (
            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden flex">
              {videoSharePct > 0 && (
                <div
                  className="h-full bg-sky-500 dark:bg-sky-400"
                  style={{ width: `${videoSharePct}%` }}
                />
              )}
              {liveSharePct !== null && liveSharePct > 0 && (
                <div
                  className="h-full bg-amber-400 dark:bg-amber-400/90"
                  style={{ width: `${liveSharePct}%` }}
                />
              )}
              {mallSharePct !== null && mallSharePct > 0 && (
                <div
                  className="h-full bg-slate-300 dark:bg-slate-600"
                  style={{ width: `${mallSharePct}%` }}
                />
              )}
            </div>
          ) : (
            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800" />
          )}
        </div>

        {/* Right: Video Commission Pool OR Active Cap / Zero Commission Alert */}
        <div className="min-w-0 text-right">
          {isZeroCommission ? (
            <div className="inline-flex items-center justify-end gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="truncate">{t.v2.searchScore.grades.NOT_MONETIZABLE}</span>
            </div>
          ) : primaryCap ? (
            <div className="inline-flex items-center justify-end gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="truncate">{formatCapChip(primaryCap, language)}</span>
              {compactTrendChip && (
                <span className={`font-mono-num tabular-nums text-[10px] font-semibold ${compactTrendChip.tone}`}>
                  {compactTrendChip.text}
                </span>
              )}
            </div>
          ) : (
            <div className="min-w-0">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {t.v2.searchScore.videoPoolLabel}
              </div>
              <div className="mt-0.5 flex items-baseline justify-end gap-1.5 font-mono-num tabular-nums">
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 truncate">
                  {videoPoolThb !== null && videoPoolThb > 0 ? formatCompactThb(videoPoolThb) : '—'}
                </span>
                {compactTrendChip && (
                  <span
                    className={`text-[10px] font-semibold shrink-0 ${compactTrendChip.tone}`}
                    title={compactTrendChip.title}
                  >
                    {compactTrendChip.text}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // LIST VIEW — 3 Zoom Levels (Micro: Image + Name | Compact | Detailed)
  // =========================================================================
  if (viewMode === 'list') {
    if (isMicro) {
      return (
        <article
          data-product-id={product.id}
          className="group flex items-center gap-1 pr-2 bg-white dark:bg-[#131B24] border border-slate-200/85 dark:border-slate-800 rounded-xl overflow-hidden transition-colors duration-150 hover:border-slate-300 dark:hover:border-slate-700"
        >
          <button
            type="button"
            onClick={() => onSelect(product)}
            title={primaryTitle}
            aria-label={primaryTitle}
            className="flex-1 min-w-0 flex items-center gap-3 p-2 sm:p-2.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
          >
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800/80 ${
                usingFallback
                  ? 'bg-slate-100 dark:bg-slate-900'
                  : 'bg-slate-50 dark:bg-slate-900/70 p-1'
              }`}
            >
              <img
                src={imgSrc}
                alt={primaryTitle}
                referrerPolicy="no-referrer"
                loading="lazy"
                onError={() => {
                  if (imgSrc !== fallbackSrc) {
                    setImgSrc(fallbackSrc);
                    setUsingFallback(true);
                  }
                }}
                className={`w-full h-full transition-transform duration-200 group-hover:scale-[1.04] ${
                  usingFallback ? 'object-cover' : 'object-contain'
                }`}
              />
            </div>

            <h3 className={`flex-1 min-w-0 font-display text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors ${language === 'my' ? 'leading-[1.55]' : 'leading-snug'} line-clamp-2`}>
              {primaryTitle}
            </h3>
          </button>
          {renderSaveIconButton('regular')}
        </article>
      );
    }

    if (isCompact) {
      return (
        <article
          data-product-id={product.id}
          className="group flex flex-row items-center bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden transition-colors duration-150 hover:border-slate-300 dark:hover:border-slate-700"
        >
          <button
            type="button"
            onClick={() => onSelect(product)}
            aria-label={`${primaryTitle} — ${t.card.createPlan}`}
            className={`relative w-18 h-18 sm:w-22 sm:h-22 shrink-0 overflow-hidden border-r border-slate-100 dark:border-slate-800/80 block text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
              usingFallback
                ? 'bg-slate-100 dark:bg-slate-900'
                : 'bg-slate-50 dark:bg-slate-900/70 p-1.5'
            }`}
          >
            <img
              src={imgSrc}
              alt={primaryTitle}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => {
                if (imgSrc !== fallbackSrc) {
                  setImgSrc(fallbackSrc);
                  setUsingFallback(true);
                }
              }}
              className={`w-full h-full transition-transform duration-200 group-hover:scale-[1.04] ${
                usingFallback ? 'object-cover' : 'object-contain'
              }`}
            />
          </button>

          <div className="flex-1 min-w-0 px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                  #{index + 1}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate" title={displayCategoryLabel}>
                  {displayCategoryLabel}
                </span>
                {videoSharePct !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num tabular-nums text-sky-700 dark:text-sky-400 font-medium shrink-0">
                      Video {videoSharePct}%
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => onSelect(product)}
                className="mt-0.5 text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
              >
                <h3 className={`font-display text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors ${language === 'my' ? 'leading-[1.55]' : 'leading-snug'} line-clamp-1`}>
                  {primaryTitle}
                </h3>
              </button>

              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono-num tabular-nums select-text">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
                </span>
                <span
                  className={
                    isZeroCommission
                      ? 'text-rose-700 dark:text-rose-400 font-semibold'
                      : 'text-teal-700 dark:text-teal-400 font-semibold'
                  }
                >
                  {commissionText}
                </span>
                {hasVideoRev && (
                  <span className="hidden sm:inline text-slate-500 dark:text-slate-400">
                    {revenueText}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {renderSaveIconButton('regular')}

              <button
                type="button"
                onClick={() => onOpenScoreDetails(product)}
                title={scoreTooltipTitle}
                aria-label={`${t.score.tooltipBtn}: ${displayedScore ?? '—'}`}
                className='relative inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer before:content-[""] before:absolute before:-inset-1 sm:before:hidden'
              >
                <ScoreRing score={displayedScore} grade={scoreGrade} size={34} strokeWidth={3} />
              </button>

              <button
                type="button"
                onClick={() => onSelect(product)}
                aria-label={`${primaryTitle} — ${t.discover.openStudioShort}`}
                className="h-10 sm:h-9 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="hidden sm:inline">{t.discover.openStudioShort}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        </article>
      );
    }

    // List Level 2 (Detailed): Visual-First Search Score Row
    return (
      <article
        data-product-id={product.id}
        className="group flex flex-col sm:flex-row items-stretch bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden transition-colors duration-150 hover:border-slate-300 dark:hover:border-slate-700"
      >
        <button
          type="button"
          onClick={() => onSelect(product)}
          aria-label={`${primaryTitle} — ${t.card.createPlan}`}
          className={`relative w-full h-40 sm:h-auto sm:w-36 md:w-44 shrink-0 overflow-hidden border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-800/80 block text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
            usingFallback
              ? 'bg-slate-100 dark:bg-slate-900'
              : 'bg-slate-50 dark:bg-slate-900/70 p-2 sm:p-2.5'
          }`}
        >
          <img
            src={imgSrc}
            alt={primaryTitle}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => {
              if (imgSrc !== fallbackSrc) {
                setImgSrc(fallbackSrc);
                setUsingFallback(true);
              }
            }}
            className={`w-full h-full transition-transform duration-300 ease-out group-hover:scale-[1.03] ${
              usingFallback ? 'object-cover' : 'object-contain'
            }`}
          />
        </button>

        <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between gap-2.5">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                    #{index + 1}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate" title={displayCategoryLabel}>
                    {displayCategoryLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={`font-semibold shrink-0 ${statusToneTextClass}`}>
                    {headerStatusText}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelect(product)}
                  className="mt-1 text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                >
                  <h3 className={`font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors ${language === 'my' ? 'leading-[1.55]' : 'leading-snug'} line-clamp-2 sm:line-clamp-1`}>
                    {primaryTitle}
                  </h3>
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-1 shrink-0 -mt-0.5 -mr-0.5">
                {renderSaveIconButton('regular')}
                <button
                  type="button"
                  onClick={() => onOpenScoreDetails(product)}
                  title={scoreTooltipTitle}
                  aria-label={`${t.score.tooltipBtn}: ${displayedScore ?? '—'}`}
                  className='relative sm:hidden inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 shrink-0 cursor-pointer before:content-[""] before:absolute before:-inset-1 sm:before:hidden'
                >
                  <ScoreRing score={displayedScore} grade={scoreGrade} size={36} strokeWidth={3} />
                </button>
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1 select-text">
                {product.shopName}
              </p>
              {renderUtilityButtons(false)}
            </div>
          </div>

          {renderHeroMetricsStrip('grid-cols-2 sm:grid-cols-4')}
          {renderPillarBars('grid-cols-2 md:grid-cols-4')}
          {renderChannelAndPoolStrip()}

          {/* Mobile Action Footer */}
          <div className="sm:hidden pt-1">
            <button
              type="button"
              onClick={() => onSelect(product)}
              className="w-full h-10 sm:h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-[0.98] transition-transform cursor-pointer"
            >
              <span>{t.discover.openStudioShort}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>

        {/* Desktop / Tablet Right Action Column */}
        <div className="hidden sm:flex flex-col items-end justify-between gap-3 w-44 md:w-48 shrink-0 p-4 border-l border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/20">
          <div className="w-full flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {scoreRingCaption}
              </div>
              <div className={`text-sm font-mono-num tabular-nums font-semibold truncate ${statusToneTextClass}`}>
                {displayedScore === null ? (isZeroCommission ? '0%' : '—') : `${displayedScore}/100`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenScoreDetails(product)}
              title={scoreTooltipTitle}
              aria-label={`${t.score.tooltipBtn}: ${displayedScore ?? '—'}`}
              className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:scale-[1.04] transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <ScoreRing score={displayedScore} grade={scoreGrade} size={44} strokeWidth={3.5} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onSelect(product)}
            className="w-full h-10 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <span className="truncate">{t.discover.openStudioShort}</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </article>
    );
  }

  // =========================================================================
  // GRID VIEW — Smallest Gallery Zoom Level (Micro)
  // =========================================================================
  if (isMicro) {
    return (
      <article
        data-product-id={product.id}
        className="relative group flex flex-col bg-white dark:bg-[#131B24] border border-slate-200/85 dark:border-slate-800 rounded-xl overflow-hidden transition-colors duration-150 hover:border-slate-300 dark:hover:border-slate-700"
      >
        {renderSaveIconButton('overlay')}
        <button
          type="button"
          onClick={() => onSelect(product)}
          title={primaryTitle}
          aria-label={primaryTitle}
          className="flex flex-col flex-1 text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
        >
          <div
            className={`relative aspect-square w-full overflow-hidden border-b border-slate-100 dark:border-slate-800/80 ${
              usingFallback
                ? 'bg-slate-100 dark:bg-slate-900'
                : 'bg-slate-50 dark:bg-slate-900/70 p-1.5'
            }`}
          >
            <img
              src={imgSrc}
              alt={primaryTitle}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => {
                if (imgSrc !== fallbackSrc) {
                  setImgSrc(fallbackSrc);
                  setUsingFallback(true);
                }
              }}
              className={`w-full h-full transition-transform duration-300 ease-out group-hover:scale-[1.04] ${
                usingFallback ? 'object-cover' : 'object-contain'
              }`}
            />
          </div>

          <div className="px-2 py-2 sm:px-2.5 sm:py-2.5 flex-1">
            <h3 className={`font-display text-[11px] sm:text-xs font-medium text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors ${language === 'my' ? 'leading-[1.55]' : 'leading-snug'} line-clamp-2`}>
              {primaryTitle}
            </h3>
          </div>
        </button>
      </article>
    );
  }

  // =========================================================================
  // GRID VIEW — Adaptive Spacious / Standard / Compact Visual-First Cards
  // =========================================================================
  const imageAspectClass = isSpacious
    ? 'aspect-[4/3] sm:aspect-[16/10]'
    : isCompact
      ? 'aspect-square sm:aspect-[4/3]'
      : 'aspect-[4/3]';

  const bodyPaddingClass = isSpacious ? 'p-4 sm:p-5' : isCompact ? 'p-3' : 'p-3.5 sm:p-4';

  return (
    <article
      data-product-id={product.id}
      className="group flex flex-col bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700"
    >
      <button
        type="button"
        onClick={() => onSelect(product)}
        aria-label={`${primaryTitle} — ${t.card.createPlan}`}
        className={`relative ${imageAspectClass} w-full overflow-hidden border-b border-slate-100 dark:border-slate-800/80 block text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
          usingFallback
            ? 'bg-slate-100 dark:bg-slate-900'
            : isCompact
              ? 'bg-slate-50 dark:bg-slate-900/70 p-1.5'
              : 'bg-slate-50 dark:bg-slate-900/70 p-2'
        }`}
      >
        <img
          src={imgSrc}
          alt={primaryTitle}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => {
            if (imgSrc !== fallbackSrc) {
              setImgSrc(fallbackSrc);
              setUsingFallback(true);
            }
          }}
          className={`w-full h-full transition-transform duration-300 ease-out group-hover:scale-[1.03] ${
            usingFallback ? 'object-cover' : 'object-contain'
          }`}
        />
      </button>

      <div className={`flex flex-col flex-1 ${bodyPaddingClass}`}>
        {/* Clean 1-Line Kicker: #Rank · Category · Grade */}
        <div
          className={`flex items-center justify-between gap-1.5 text-slate-500 dark:text-slate-400 ${
            isCompact ? 'text-[11px]' : 'text-xs'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
              #{index + 1}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate" title={displayCategoryLabel}>
              {displayCategoryLabel}
            </span>
            {!isCompact && (
              <>
                <span aria-hidden="true">·</span>
                <span className={`font-semibold shrink-0 ${statusToneTextClass}`}>
                  {headerStatusText}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 -mr-1">
            {renderSaveIconButton('compact')}
          </div>
        </div>

        {/* Title + Tappable Search Score Ring */}
        <div
          className={`${isCompact ? 'mt-1 gap-2' : 'mt-1.5 gap-2.5'} flex items-start justify-between`}
        >
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onSelect(product)}
              className="text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
            >
              <h3
                className={`font-display font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors ${
                  language === 'my' ? 'leading-[1.55]' : 'leading-snug'
                } line-clamp-2 ${
                  isSpacious
                    ? 'text-base sm:text-lg'
                    : isCompact
                      ? 'text-xs sm:text-sm'
                      : 'text-sm sm:text-[15px]'
                }`}
              >
                {primaryTitle}
              </h3>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenScoreDetails(product)}
            title={scoreTooltipTitle}
            aria-label={`${t.score.tooltipBtn}: ${displayedScore ?? '—'}`}
            className='relative inline-flex flex-col items-center justify-center rounded-xl p-0.5 -mt-0.5 -mr-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 before:content-[""] before:absolute before:-inset-1 sm:before:hidden'
          >
            <ScoreRing
              score={displayedScore}
              grade={scoreGrade}
              size={isSpacious ? 46 : isCompact ? 34 : 42}
              strokeWidth={isCompact ? 3 : 3.5}
            />
            {!isCompact && (
              <span className="mt-0.5 text-[9px] font-medium text-slate-400 dark:text-slate-500 leading-none">
                {scoreRingCaption}
              </span>
            )}
          </button>
        </div>

        {/* Shop Name + Compact Utilities */}
        <div className="mt-1 flex items-center justify-between gap-1.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1 select-text">
            {product.shopName}
          </p>
          {renderUtilityButtons(isCompact)}
        </div>

        {/* Visual Body: Hero Numbers -> 4 Real Search Score Pillar Bars -> Channel Split & Video Pool */}
        {isCompact ? (
          <>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-x-2 gap-y-1 font-mono-num tabular-nums">
              {pillars.map((pillar) => (
                <div key={pillar.key} className="min-w-0 flex items-baseline justify-between gap-1">
                  <span className="font-sans text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {pillar.label}
                  </span>
                  <span
                    className={`text-[11px] font-semibold shrink-0 ${
                      pillar.score !== null ? pillar.textClass : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {pillar.score !== null
                      ? pillar.key === 'earning' && isZeroCommission
                        ? '0%'
                        : Math.round(pillar.score)
                      : '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-2.5">
              <div className="border-t border-slate-100 dark:border-slate-800/90 pt-2 flex items-baseline justify-between gap-2">
                <div className="text-xs sm:text-sm font-semibold font-mono-num tabular-nums text-slate-900 dark:text-slate-100 select-text">
                  {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
                </div>
                <div
                  className={`text-[11px] sm:text-xs font-semibold font-mono-num tabular-nums truncate select-text ${
                    isZeroCommission
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-teal-700 dark:text-teal-400'
                  }`}
                >
                  {commissionText}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelect(product)}
                className="mt-2.5 w-full h-10 sm:h-9 px-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <span className="truncate">{t.discover.openStudioShort}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-2.5 space-y-2.5">
              {renderHeroMetricsStrip(isSpacious ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2')}
              {isSpacious ? (
                <>
                  <div className={detailsExpanded ? 'space-y-2.5' : 'hidden lg:block space-y-2.5'}>
                    {renderPillarBars('grid-cols-2 sm:grid-cols-4')}
                    {renderChannelAndPoolStrip()}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailsExpanded((prev) => !prev)}
                    aria-expanded={detailsExpanded}
                    className="lg:hidden h-9 px-2 -ml-1 rounded-lg text-xs font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50/80 dark:hover:bg-teal-950/40 inline-flex items-center gap-1 active:scale-95 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    <span>
                      {detailsExpanded ? t.card.hideDetailsToggle : t.card.showDetailsToggle}
                    </span>
                    {detailsExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </button>
                </>
              ) : (
                <>
                  {renderPillarBars('grid-cols-2')}
                  {renderChannelAndPoolStrip()}
                </>
              )}
            </div>

            {/* Clean Single-Action Studio CTA Footer */}
            <div className="mt-auto pt-3">
              <button
                type="button"
                onClick={() => onSelect(product)}
                className="w-full h-10 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#131B24]"
              >
                <span className="truncate">{t.discover.openStudioShort}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
