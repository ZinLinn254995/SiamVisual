import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Check,
  Copy,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import type { Translations } from '../i18n';
import { translateCategoryNameToMyanmar } from '../lib/categoryTranslations';
import { classifyProductDiscoveryShortlist } from '../lib/discoveryShortlist.ts';
import { getStudioFallbackImage } from '../lib/media';
import {
  type ActiveStrategyView,
  ensureProductV2Intelligence,
  type ExcludedIntelligenceCardItem,
  getClassificationTone,
  getDimensionBarClass,
  getToneClasses,
  type RankedIntelligenceCardItem,
  summarizeProductProvenance,
} from '../lib/productIntelligenceView.ts';
import { getTikTokShopProductUrl } from '../lib/tiktokLink';
import type {
  CardDensity,
  Language,
  ProductItem,
  ResultViewMode,
  ScoreGrade,
  V2DimensionStatus,
} from '../types';
import { ScoreRing } from './ScoreRing';

interface ProductCardProps {
  product: ProductItem;
  intelligenceItem?: RankedIntelligenceCardItem | ExcludedIntelligenceCardItem;
  activeStrategyView?: ActiveStrategyView;
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

const SEVERE_VERIFIED_RISKS = new Set([
  'EXTREME_COMPETITION',
  'HIGH_COMPETITION',
  'POOR_CUSTOMER_QUALITY',
  'NEGATIVE_GROWTH',
  'STALE_DATA',
  'ZERO_COMMISSION',
  'NOT_MONETIZABLE',
  'ZERO_CREATORS_POSITIVE_REVENUE',
]);

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

function scoreToGrade(score: number | null): ScoreGrade {
  if (score === null) return 'low';
  if (score >= 75) return 'top';
  if (score >= 58) return 'strong';
  if (score >= 40) return 'fair';
  return 'low';
}

function formatCompactDimensionScore(
  score: number | null,
  status: V2DimensionStatus
): string {
  if (status === 'NOT_MONETIZABLE') return '0%';
  if (score === null || status === 'INSUFFICIENT' || status === 'INVALID') {
    return '—';
  }
  return `${Math.round(score)}`;
}

export function ProductCard({
  product: rawProduct,
  intelligenceItem,
  activeStrategyView = 'overall',
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

  const commercial = product.commercialScoreV2!;
  const strategyReport = product.strategyIntelligenceV2!;
  const validated = product.validatedMetrics!;
  const provenanceSummary = useMemo(
    () => intelligenceItem?.provenanceSummary ?? summarizeProductProvenance(validated),
    [intelligenceItem, validated]
  );
  const discoveryShortlist = useMemo(
    () =>
      intelligenceItem?.discoveryShortlist ??
      classifyProductDiscoveryShortlist(validated, commercial),
    [intelligenceItem, validated, commercial]
  );
  const snapshotCount = intelligenceItem?.snapshotCount ?? 0;

  const isExcluded = intelligenceItem?.kind === 'excluded';
  const isStrategyView = activeStrategyView !== 'overall';
  const strategyEval = isStrategyView
    ? strategyReport.strategies[activeStrategyView]
    : strategyReport.bestStrategyId
      ? strategyReport.strategies[strategyReport.bestStrategyId]
      : null;

  const displayedScore: number | null = isExcluded
    ? intelligenceItem.strategyScore ?? intelligenceItem.commercialOpportunityScore
    : isStrategyView
      ? strategyEval?.strategyScore ?? commercial.commercialOpportunityScore
      : commercial.commercialOpportunityScore;

  const scoreGrade = scoreToGrade(displayedScore);
  const classification = strategyReport.opportunityClassification;
  const classTone = getToneClasses(getClassificationTone(classification));
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
          className={`absolute top-1.5 right-1.5 z-10 h-8 w-8 rounded-lg border inline-flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            isSaved
              ? 'border-teal-500/70 bg-teal-50/95 dark:bg-teal-950/85 text-teal-700 dark:text-teal-300'
              : 'border-slate-200/80 dark:border-slate-700/80 bg-white/85 dark:bg-[#131B24]/85 text-slate-500 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 hover:border-teal-400/70'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      );
    }

    const sizeClass = variant === 'regular' ? 'h-9 w-9' : 'h-8 w-8';
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
        className={`${sizeClass} rounded-lg inline-flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
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
    validated.commissionRate.state === 'ZERO' ||
    commercial.earningScore.status === 'NOT_MONETIZABLE';

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

  // 4 independent visual dimensions (clean numeric bars; dashed empty tracks for missing/unverified)
  const dimensions = [
    {
      key: 'demand',
      label: t.v2.dimensions.demand.short,
      score: commercial.demandScore.score,
      status: commercial.demandScore.status,
      verifiedTag:
        commercial.demandScore.growthStatus === 'VERIFIED' &&
        commercial.demandScore.subcomponents.verifiedGrowthPercent !== null
          ? `${commercial.demandScore.subcomponents.verifiedGrowthPercent > 0 ? '+' : ''}${Math.round(
              commercial.demandScore.subcomponents.verifiedGrowthPercent
            )}%`
          : null,
      tooltip: `${t.v2.dimensions.demand.label}: ${
        commercial.demandScore.score !== null
          ? `${Math.round(commercial.demandScore.score)}/100`
          : t.v2.dimensionStatus[commercial.demandScore.status]
      }`,
    },
    {
      key: 'earning',
      label: t.v2.dimensions.earning.short,
      score: commercial.earningScore.score,
      status: commercial.earningScore.status,
      verifiedTag: null,
      tooltip: `${t.v2.dimensions.earning.label}: ${
        commercial.earningScore.score !== null
          ? `${Math.round(commercial.earningScore.score)}/100`
          : t.v2.dimensionStatus[commercial.earningScore.status]
      }`,
    },
    {
      key: 'competition',
      label: t.v2.dimensions.competition.short,
      score: commercial.competitionScore.score,
      status: commercial.competitionScore.status,
      verifiedTag:
        commercial.competitionScore.creatorCount !== null
          ? `${commercial.competitionScore.creatorCount}c`
          : null,
      tooltip: `${t.v2.dimensions.competition.label}: ${
        commercial.competitionScore.score !== null
          ? `${Math.round(commercial.competitionScore.score)}/100 (${commercial.competitionScore.creatorCount ?? '—'} creators)`
          : validated.creatorCount.unit === 'UNVERIFIED'
            ? t.v2.metricsShort.unverified
            : t.v2.metricsShort.missing
      }`,
    },
    {
      key: 'quality',
      label: t.v2.dimensions.quality.short,
      score: commercial.customerQualityScore.score,
      status: commercial.customerQualityScore.status,
      verifiedTag:
        commercial.customerQualityScore.bayesianRating !== null
          ? `${commercial.customerQualityScore.bayesianRating.toFixed(1)}★`
          : null,
      tooltip: `${t.v2.dimensions.quality.label}: ${
        commercial.customerQualityScore.score !== null
          ? `${Math.round(commercial.customerQualityScore.score)}/100 (${commercial.customerQualityScore.bayesianRating?.toFixed(2)}★)`
          : validated.rating.unit === 'UNVERIFIED' || validated.reviewCount.unit === 'UNVERIFIED'
            ? t.v2.metricsShort.unverified
            : t.v2.metricsShort.missing
      }`,
    },
  ];

  // Channel split percentages for proportional Video / Live / Mall visual bar
  const convEvidence = commercial.conversionEvidence;
  const videoSharePct =
    convEvidence.videoRevenueShare !== null
      ? Math.max(0, Math.min(100, Math.round(convEvidence.videoRevenueShare * 100)))
      : null;
  const liveSharePct =
    convEvidence.liveRevenueShare !== null
      ? Math.max(
          0,
          Math.min(
            videoSharePct !== null ? 100 - videoSharePct : 100,
            Math.round(convEvidence.liveRevenueShare * 100)
          )
        )
      : null;
  const otherSharePct =
    videoSharePct !== null
      ? Math.max(0, 100 - videoSharePct - (liveSharePct ?? 0))
      : null;

  // Confidence 5-segment visual meter
  const confidenceScore = Math.round(commercial.dataConfidence.score);
  const confidenceSegmentsFilled = Math.max(1, Math.min(5, Math.round(confidenceScore / 20)));
  const verifiedCount = provenanceSummary.verifiedSourceCount + provenanceSummary.zeroCount;
  const confidenceBarColor =
    commercial.dataConfidence.level === 'HIGH'
      ? 'bg-emerald-500 dark:bg-emerald-400'
      : commercial.dataConfidence.level === 'MEDIUM'
        ? 'bg-teal-500 dark:bg-teal-400'
        : commercial.dataConfidence.level === 'LOW'
          ? 'bg-amber-500 dark:bg-amber-400'
          : 'bg-rose-500 dark:bg-rose-400';
  const confidenceTextColor =
    commercial.dataConfidence.level === 'HIGH'
      ? 'text-emerald-700 dark:text-emerald-400'
      : commercial.dataConfidence.level === 'MEDIUM'
        ? 'text-teal-700 dark:text-teal-400'
        : commercial.dataConfidence.level === 'LOW'
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-rose-700 dark:text-rose-400';

  // Only surface genuinely actionable verified warnings (avoid repeating "Missing Competition" text)
  const severeRisks = (intelligenceItem?.riskTags ?? commercial.riskTags)
    .filter((tag) => SEVERE_VERIFIED_RISKS.has(tag))
    .slice(0, 2);
  const formattedSevereRisks = severeRisks.map(
    (tag) => t.v2.riskLabels[tag] ?? t.v2.formatRiskTag(tag)
  );

  // Only show strategy subtitle when in a Strategy tab OR when a strategy actually qualified
  const activeStrategyLabel = isStrategyView
    ? `${t.v2.strategies[activeStrategyView].shortName} · ${
        t.v2.strategyEligibility[
          intelligenceItem?.kind === 'excluded'
            ? intelligenceItem.eligibilityStatus
            : strategyEval?.eligibilityStatus ?? 'INSUFFICIENT_DATA'
        ]
      }`
    : strategyReport.bestStrategyId
      ? t.v2.strategies[strategyReport.bestStrategyId].shortName
      : null;

  // Compact header status: omit noisy "Insufficient Evidence" text when score ring already shows dashed "—"
  const headerStatusText =
    classification === 'INSUFFICIENT_EVIDENCE'
      ? null
      : t.v2.classifications[classification];

  const renderUtilityButtons = (compactMode: boolean) => (
    <div className={`flex items-center shrink-0 ${compactMode ? 'gap-0.5' : 'gap-1'}`}>
      <button
        type="button"
        onClick={() => handleCopy('thai', product.thaiTitle)}
        title={t.card.copyThai}
        className={`${
          compactMode ? 'h-7 px-1.5 text-[10px]' : 'h-7 px-1.5 text-[11px]'
        } rounded-md font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-0.5 transition-colors cursor-pointer`}
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
        onClick={() => handleCopy('id', product.id)}
        title={`${t.card.copyId}: ${product.id}`}
        className={`${
          compactMode ? 'h-7 px-1.5 text-[10px]' : 'h-7 px-1.5 text-[11px]'
        } rounded-md font-mono-num font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-0.5 transition-colors cursor-pointer`}
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
            title={t.card.openTikTokShop}
            aria-label={`${t.card.openTikTokShop}: ${primaryTitle}`}
            className={`${
              compactMode ? 'h-7 px-1.5 text-[10px]' : 'h-7 px-1.5 text-[11px]'
            } rounded-md font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500`}
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
        <div className="mt-0.5 text-sm font-semibold font-mono-num tabular-nums text-slate-900 dark:text-slate-100 truncate">
          {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
          {t.card.commission}
        </div>
        <div
          className={`mt-0.5 text-sm font-semibold font-mono-num tabular-nums truncate ${
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
            <div className="mt-0.5 text-xs sm:text-sm font-semibold font-mono-num tabular-nums text-slate-800 dark:text-slate-200 truncate">
              {salesVolText}
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {hasVideoRev ? t.card.videoRev7d : t.card.revenue7d}
            </div>
            <div className="mt-0.5 text-xs sm:text-sm font-semibold font-mono-num tabular-nums text-slate-800 dark:text-slate-200 truncate">
              {revenueText}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Visual 4-dimension bars (solid colored bars for scored, dashed tracks for missing/unverified)
  const renderVisualDimensionBars = (columnsClass: string) => (
    <div
      className={`grid ${columnsClass} gap-x-3.5 gap-y-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80`}
    >
      {dimensions.map((dim) => {
        const tone = getDimensionBarClass(dim.score, dim.status);
        const isScored =
          dim.score !== null && dim.status !== 'INSUFFICIENT' && dim.status !== 'INVALID';
        const pct = isScored ? Math.max(6, Math.min(100, dim.score!)) : 0;

        return (
          <div key={dim.key} className="min-w-0" title={dim.tooltip}>
            <div className="flex items-baseline justify-between gap-1.5">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                {dim.label}
              </span>
              <span className="inline-flex items-baseline gap-1 shrink-0 font-mono-num tabular-nums">
                {dim.verifiedTag && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {dim.verifiedTag}
                  </span>
                )}
                <span className={`text-xs font-semibold ${tone.textClass}`}>
                  {formatCompactDimensionScore(dim.score, dim.status)}
                </span>
              </span>
            </div>

            {isScored ? (
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800/90 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${tone.barClass}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            ) : (
              <div
                aria-label={dim.tooltip}
                className="mt-1.5 h-0.5 w-full border-t border-dashed border-slate-300 dark:border-slate-700"
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // Visual Channel Split Bar (Video vs Live vs Mall) + 5-Block Confidence Meter (replaces 6+ lines of text!)
  const renderVisualSignalsBlock = () => {
    const failedReqs =
      intelligenceItem?.kind === 'excluded'
        ? intelligenceItem.failedRequirements
        : strategyEval?.failedRequirements ?? [];
    const inlineExclusionSummary = isExcluded
      ? failedReqs[0]
        ? `${failedReqs[0].label}: ${failedReqs[0].detail}`
        : intelligenceItem?.explanation ?? null
      : null;

    const channelLegendText =
      videoSharePct !== null
        ? `Video ${videoSharePct}%${
            liveSharePct !== null && liveSharePct >= 10 ? ` · Live ${liveSharePct}%` : ''
          }`
        : convEvidence.evidenceLevel === 'INSUFFICIENT'
          ? '—'
          : t.v2.conversionChannels[convEvidence.dominantChannel];

    const shortlistToneClass =
      discoveryShortlist.primaryClassification === 'STRONG_DEMAND_LOW_COMPETITION' ||
      discoveryShortlist.primaryClassification === 'EMERGING_OPPORTUNITY'
        ? 'text-emerald-700 dark:text-emerald-400'
        : discoveryShortlist.primaryClassification === 'STRONG_DEMAND_STRONG_VIDEO_SALES' ||
            discoveryShortlist.primaryClassification === 'STRONG_AFFILIATE_EARNINGS'
          ? 'text-teal-700 dark:text-teal-400'
          : discoveryShortlist.primaryClassification === 'HIGH_DEMAND_HIGH_COMPETITION'
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-slate-500 dark:text-slate-400';

    return (
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
        {/* Visual Conversion Channel Split Bar + 5-Block Confidence Meter */}
        <div className="grid grid-cols-2 gap-x-3.5 items-end">
          {/* Left: Proportional Video / Live / Mall Channel Bar */}
          <div
            className="min-w-0"
            title={`${t.v2.conversionLabel}: ${channelLegendText} — ${t.v2.conversionDisclaimerShort}`}
            aria-label={`${t.v2.conversionLabel}: ${channelLegendText}`}
          >
            <div className="flex items-baseline justify-between gap-1 text-[10px]">
              <span className="text-slate-500 dark:text-slate-400 truncate">
                {videoSharePct !== null ? 'Video' : t.v2.conversionLabel}
              </span>
              <span className="font-mono-num tabular-nums font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                {videoSharePct !== null ? `${videoSharePct}%` : '—'}
              </span>
            </div>
            {videoSharePct !== null ? (
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden flex">
                {videoSharePct > 0 && (
                  <div
                    className="h-full bg-teal-500 dark:bg-teal-400"
                    style={{ width: `${videoSharePct}%` }}
                  />
                )}
                {liveSharePct !== null && liveSharePct > 0 && (
                  <div
                    className="h-full bg-amber-400 dark:bg-amber-400/90"
                    style={{ width: `${liveSharePct}%` }}
                  />
                )}
                {otherSharePct !== null && otherSharePct > 0 && (
                  <div
                    className="h-full bg-slate-300 dark:bg-slate-600"
                    style={{ width: `${otherSharePct}%` }}
                  />
                )}
              </div>
            ) : (
              <div className="mt-1.5 h-0.5 w-full border-t border-dashed border-slate-300 dark:border-slate-700" />
            )}
          </div>

          {/* Right: 5-Segment Data Confidence Meter + Verified Ratio */}
          <div
            className="min-w-0"
            title={`${t.v2.confidenceLabel}: ${confidenceScore}/100 (${t.v2.confidenceLevels[commercial.dataConfidence.level]}) · ${t.v2.provenance.verifiedCountLabel(verifiedCount, 11)}${
              provenanceSummary.hasUnverifiedCoreMetrics ? ` · ${t.v2.metricsShort.unverified}` : ''
            }`}
            aria-label={`${t.v2.confidenceLabel}: ${confidenceScore}/100, ${t.v2.provenance.verifiedCountLabel(verifiedCount, 11)}`}
          >
            <div className="flex items-baseline justify-between gap-1 text-[10px]">
              <span className={`font-mono-num tabular-nums font-semibold truncate ${confidenceTextColor}`}>
                {t.v2.provenance.verifiedCountLabel(verifiedCount, 11)}
              </span>
              {provenanceSummary.hasUnverifiedCoreMetrics && (
                <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0">
                  {t.v2.metricsShort.unverified}
                </span>
              )}
            </div>
            <div className="mt-1 grid grid-cols-5 gap-1">
              {[0, 1, 2, 3, 4].map((seg) => (
                <div
                  key={seg}
                  className={`h-1.5 rounded-full ${
                    seg < confidenceSegmentsFilled
                      ? confidenceBarColor
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Single Concise Status Strip (ONLY when excluded, severe verified risk, or clear shortlist signal) */}
        {inlineExclusionSummary ? (
          <div className="flex items-start gap-1.5 text-[11px] text-rose-700 dark:text-rose-400 leading-snug">
            {formattedSevereRisks.length > 0 && (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            )}
            <p className="min-w-0 line-clamp-2">
              {formattedSevereRisks.length > 0 ? (
                <>
                  <span className="font-semibold">{formattedSevereRisks.join(' · ')}</span>
                  <span aria-hidden="true"> · </span>
                </>
              ) : null}
              {inlineExclusionSummary}
            </p>
          </div>
        ) : formattedSevereRisks.length > 0 ? (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 leading-snug truncate">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate font-medium">{formattedSevereRisks.join(' · ')}</span>
          </div>
        ) : discoveryShortlist.primaryClassification !== 'INSUFFICIENT_EVIDENCE' ? (
          <div
            className="flex items-center justify-between gap-2 text-[11px] leading-snug"
            title={discoveryShortlist.cautionNote}
          >
            <span className={`font-medium truncate ${shortlistToneClass}`}>
              {t.v2.discoveryShortlist.categories[discoveryShortlist.primaryClassification]}
            </span>
            <span className="font-mono-num tabular-nums text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
              {snapshotCount >= 2
                ? `${snapshotCount}d`
                : discoveryShortlist.isPreliminaryCandidate
                  ? t.v2.discoveryShortlist.preliminaryTag
                  : ''}
            </span>
          </div>
        ) : null}
      </div>
    );
  };

  // =========================================================================
  // LIST VIEW — 3 Zoom Levels (Micro: Image + Name | Compact | Detailed)
  // =========================================================================
  if (viewMode === 'list') {
    if (isMicro) {
      return (
        <article className="group flex items-center gap-1 pr-2 bg-white dark:bg-[#131B24] border border-slate-200/85 dark:border-slate-800 rounded-xl overflow-hidden transition-colors duration-150 hover:border-slate-300 dark:hover:border-slate-700">
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

            <h3 className="flex-1 min-w-0 font-display text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors leading-snug line-clamp-2">
              {primaryTitle}
            </h3>
          </button>
          {renderSaveIconButton('regular')}
        </article>
      );
    }

    if (isCompact) {
      return (
        <article className="group flex flex-row items-center bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden transition-colors duration-150 hover:border-slate-300 dark:hover:border-slate-700">
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
                    <span className="font-mono-num tabular-nums text-teal-700 dark:text-teal-400 font-medium shrink-0">
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
                <h3 className="font-display text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors leading-snug line-clamp-1">
                  {primaryTitle}
                </h3>
              </button>

              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono-num tabular-nums">
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
                title={`${t.v2.classifications[classification]} (${
                  displayedScore ?? '—'
                }/100) — ${t.score.tooltipBtn}`}
                aria-label={`${t.score.tooltipBtn}: ${displayedScore ?? 'Withheld'}`}
                className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
              >
                <ScoreRing score={displayedScore} grade={scoreGrade} size={34} strokeWidth={3} />
              </button>

              <button
                type="button"
                onClick={() => onSelect(product)}
                aria-label={`${primaryTitle} — ${t.discover.openStudioShort}`}
                className="h-9 px-2.5 sm:px-3 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <span className="hidden sm:inline">{t.discover.openStudioShort}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        </article>
      );
    }

    // List Level 2 (Detailed): Visual-First Intelligence Row
    return (
      <article className="group flex flex-col sm:flex-row items-stretch bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden transition-colors duration-150 hover:border-slate-300 dark:hover:border-slate-700">
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
                    #{isExcluded ? '—' : index + 1}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate" title={displayCategoryLabel}>
                    {displayCategoryLabel}
                  </span>
                  {headerStatusText && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className={`font-semibold shrink-0 ${classTone.text}`}>
                        {headerStatusText}
                      </span>
                    </>
                  )}
                  {activeStrategyLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-teal-700 dark:text-teal-400 font-medium truncate">
                        {activeStrategyLabel}
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onSelect(product)}
                  className="mt-1 text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                >
                  <h3 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors leading-snug line-clamp-2 sm:line-clamp-1">
                    {primaryTitle}
                  </h3>
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0 -mt-0.5 -mr-0.5">
                {renderSaveIconButton('regular')}
                <button
                  type="button"
                  onClick={() => onOpenScoreDetails(product)}
                  title={`${t.v2.classifications[classification]} (${
                    displayedScore ?? '—'
                  }/100) — ${t.score.tooltipBtn}`}
                  aria-label={`${t.score.tooltipBtn}: ${displayedScore ?? 'Withheld'}`}
                  className="sm:hidden inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 shrink-0 cursor-pointer"
                >
                  <ScoreRing score={displayedScore} grade={scoreGrade} size={36} strokeWidth={3} />
                </button>
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1">
                {product.shopName}
              </p>
              {renderUtilityButtons(false)}
            </div>
          </div>

          {renderHeroMetricsStrip('grid-cols-2 sm:grid-cols-4')}
          {renderVisualDimensionBars('grid-cols-2 md:grid-cols-4')}
          {renderVisualSignalsBlock()}

          {/* Mobile Action Footer */}
          <div className="sm:hidden pt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenScoreDetails(product)}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>{t.v2.strategyExplorer.viewFullBreakdownBtn}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelect(product)}
              className="flex-1 h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
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
                {isStrategyView && !isExcluded
                  ? t.v2.strategyScoreShort
                  : t.v2.commercialScoreShort}
              </div>
              <div className={`text-sm font-mono-num tabular-nums font-semibold truncate ${classTone.text}`}>
                {displayedScore === null ? (isZeroCommission ? '0%' : '—') : `${displayedScore}/100`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenScoreDetails(product)}
              title={`${t.v2.classifications[classification]} (${
                displayedScore ?? '—'
              }/100) — ${t.score.tooltipBtn}`}
              aria-label={`${t.score.tooltipBtn}: ${displayedScore ?? 'Withheld'}`}
              className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:scale-[1.04] transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <ScoreRing score={displayedScore} grade={scoreGrade} size={44} strokeWidth={3.5} />
            </button>
          </div>

          <div className="w-full space-y-2">
            <button
              type="button"
              onClick={() => onOpenScoreDetails(product)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.v2.strategyExplorer.viewFullBreakdownBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelect(product)}
              className="w-full h-10 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <span className="truncate">{t.discover.openStudioShort}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </article>
    );
  }

  // =========================================================================
  // GRID VIEW — Smallest Gallery Zoom Level (Micro)
  // =========================================================================
  if (isMicro) {
    return (
      <article className="relative group flex flex-col bg-white dark:bg-[#131B24] border border-slate-200/85 dark:border-slate-800 rounded-xl overflow-hidden transition-colors duration-150 hover:border-slate-300 dark:hover:border-slate-700">
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
            <h3 className="font-display text-[11px] sm:text-xs font-medium text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors leading-snug line-clamp-2">
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
    <article className="group flex flex-col bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700">
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
        {/* Clean 1-Line Kicker: #Rank · Category (+ Status only when qualified/not-monetizable) */}
        <div
          className={`flex items-center justify-between gap-1.5 text-slate-500 dark:text-slate-400 ${
            isCompact ? 'text-[11px]' : 'text-xs'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
              #{isExcluded ? '—' : index + 1}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate" title={displayCategoryLabel}>
              {displayCategoryLabel}
            </span>
            {!isCompact && headerStatusText && (
              <>
                <span aria-hidden="true">·</span>
                <span className={`font-semibold shrink-0 ${classTone.text}`}>
                  {headerStatusText}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 -mr-1">
            {renderSaveIconButton('compact')}
          </div>
        </div>

        {/* Title + Tappable Score Ring */}
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
                className={`font-display font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors leading-snug line-clamp-2 ${
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

            {!isCompact && activeStrategyLabel && (
              <div className="mt-1 text-[11px] font-medium text-teal-700 dark:text-teal-400 truncate">
                {activeStrategyLabel}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenScoreDetails(product)}
            title={`${t.v2.classifications[classification]} (${
              displayedScore ?? '—'
            }/100) — ${t.score.tooltipBtn}`}
            aria-label={`${t.score.tooltipBtn}: ${displayedScore ?? 'Withheld'}`}
            className="inline-flex flex-col items-center justify-center rounded-xl p-0.5 -mt-0.5 -mr-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <ScoreRing
              score={displayedScore}
              grade={scoreGrade}
              size={isSpacious ? 46 : isCompact ? 34 : 42}
              strokeWidth={isCompact ? 3 : 3.5}
            />
            {!isCompact && (
              <span className="mt-0.5 text-[9px] font-medium text-slate-400 dark:text-slate-500 leading-none">
                {isStrategyView && !isExcluded
                  ? t.v2.strategyScoreShort
                  : t.v2.commercialScoreShort}
              </span>
            )}
          </button>
        </div>

        {/* Shop Name + Compact Utilities */}
        <div className="mt-1 flex items-center justify-between gap-1.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1">
            {product.shopName}
          </p>
          {renderUtilityButtons(isCompact)}
        </div>

        {/* Visual Body: Hero Numbers First -> 4 Visual Bars -> Channel + Confidence Meters */}
        {isCompact ? (
          <>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-x-2 gap-y-1 font-mono-num tabular-nums">
              {dimensions.map((dim) => {
                const tone = getDimensionBarClass(dim.score, dim.status);
                return (
                  <div key={dim.key} className="min-w-0 flex items-baseline justify-between gap-1">
                    <span className="font-sans text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {dim.label}
                    </span>
                    <span className={`text-[11px] font-semibold shrink-0 ${tone.textClass}`}>
                      {formatCompactDimensionScore(dim.score, dim.status)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto pt-2.5">
              <div className="border-t border-slate-100 dark:border-slate-800/90 pt-2 flex items-baseline justify-between gap-2">
                <div className="text-xs sm:text-sm font-semibold font-mono-num tabular-nums text-slate-900 dark:text-slate-100">
                  {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
                </div>
                <div
                  className={`text-[11px] sm:text-xs font-semibold font-mono-num tabular-nums truncate ${
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
                className="mt-2.5 w-full h-9 px-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
              {renderVisualDimensionBars(isSpacious ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2')}
              {renderVisualSignalsBlock()}
            </div>

            {/* Clean Single-Row Footer: Secondary Breakdown Button + Primary Studio CTA */}
            <div className="mt-auto pt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenScoreDetails(product)}
                title={t.score.tooltipBtn}
                aria-label={t.score.tooltipBtn}
                className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{language === 'my' ? 'အသေးစိတ်' : 'Details'}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelect(product)}
                className="flex-1 min-w-0 h-10 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#131B24]"
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
