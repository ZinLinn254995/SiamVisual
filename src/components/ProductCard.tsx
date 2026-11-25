import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import type { Translations } from '../i18n';
import { translateCategoryNameToMyanmar } from '../lib/categoryTranslations';
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

function formatDimensionValue(
  score: number | null,
  status: V2DimensionStatus,
  t: Translations
): string {
  if (status === 'NOT_MONETIZABLE') return '0%';
  if (score === null || status === 'INSUFFICIENT' || status === 'INVALID') {
    return status === 'INSUFFICIENT' ? t.v2.metricsShort.missing : status;
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
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const commercial = product.commercialScoreV2!;
  const strategyReport = product.strategyIntelligenceV2!;
  const validated = product.validatedMetrics!;
  const provenanceSummary = useMemo(
    () => intelligenceItem?.provenanceSummary ?? summarizeProductProvenance(validated),
    [intelligenceItem, validated]
  );

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
  const analysis = product.aiAnalysis;
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
          className={`absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-md border inline-flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            isSaved
              ? 'border-teal-500/70 bg-teal-50/95 dark:bg-teal-950/85 text-teal-700 dark:text-teal-300'
              : 'border-slate-200/80 dark:border-slate-700/80 bg-white/85 dark:bg-[#131B24]/85 text-slate-500 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 hover:border-teal-400/70'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      );
    }

    const sizeClass = variant === 'regular' ? 'h-7 w-7' : 'h-6 w-6';
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
        className={`${sizeClass} rounded-md inline-flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
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
          product.commissionThb !== null ? ` · ฿${product.commissionThb.toLocaleString()}` : ''
        }`
      : t.v2.metricsShort.missing;

  const salesVolText = hasSalesVol
    ? `${formatCompactCount(metrics!.salesVolume7d!)}${t.card.unitsSuffix}`
    : '—';

  const revenueText = hasVideoRev
    ? formatCompactThb(metrics!.videoRevenueThb7d!)
    : hasTotalRev
      ? formatCompactThb(metrics!.revenueThb7d!)
      : '—';

  // Dimension details for independent 4-dimension display
  const growthText =
    commercial.demandScore.growthStatus === 'VERIFIED' &&
    commercial.demandScore.subcomponents.verifiedGrowthPercent !== null
      ? `${commercial.demandScore.subcomponents.verifiedGrowthPercent > 0 ? '+' : ''}${commercial.demandScore.subcomponents.verifiedGrowthPercent.toFixed(0)}%`
      : commercial.demandScore.growthStatus === 'UNVERIFIED'
        ? t.v2.metricsShort.unverified
        : commercial.demandScore.growthStatus === 'MISSING'
          ? t.v2.metricsShort.missing
          : commercial.demandScore.growthStatus;

  const payoutText =
    commercial.earningScore.payoutPerSaleThb !== null
      ? `฿${commercial.earningScore.payoutPerSaleThb.toFixed(commercial.earningScore.payoutPerSaleThb < 10 ? 1 : 0)}`
      : isZeroCommission
        ? '฿0'
        : t.v2.metricsShort.missing;

  const competitionSubtext =
    commercial.competitionScore.creatorCount !== null
      ? `${commercial.competitionScore.creatorCount}c${
          commercial.adjustedRpcThb !== null
            ? ` · ${formatCompactThb(commercial.adjustedRpcThb)}`
            : ''
        }`
      : validated.creatorCount.unit === 'UNVERIFIED'
        ? t.v2.metricsShort.unverified
        : t.v2.metricsShort.missing;

  const qualitySubtext =
    commercial.customerQualityScore.bayesianRating !== null &&
    commercial.customerQualityScore.reviewCount !== null
      ? `${commercial.customerQualityScore.bayesianRating.toFixed(2)}★ (${formatCompactCount(
          commercial.customerQualityScore.reviewCount
        )})`
      : validated.rating.unit === 'UNVERIFIED' || validated.reviewCount.unit === 'UNVERIFIED'
        ? t.v2.metricsShort.unverified
        : t.v2.metricsShort.missing;

  const dimensions = [
    {
      key: 'demand',
      label: t.v2.dimensions.demand.short,
      score: commercial.demandScore.score,
      status: commercial.demandScore.status,
      subtext: growthText,
    },
    {
      key: 'earning',
      label: t.v2.dimensions.earning.short,
      score: commercial.earningScore.score,
      status: commercial.earningScore.status,
      subtext: payoutText,
    },
    {
      key: 'competition',
      label: t.v2.dimensions.competition.short,
      score: commercial.competitionScore.score,
      status: commercial.competitionScore.status,
      subtext: competitionSubtext,
    },
    {
      key: 'quality',
      label: t.v2.dimensions.quality.short,
      score: commercial.customerQualityScore.score,
      status: commercial.customerQualityScore.status,
      subtext: qualitySubtext,
    },
  ];

  // Conversion evidence summary (kept distinct from commercial score)
  const convEvidence = commercial.conversionEvidence;
  const convText =
    convEvidence.evidenceLevel === 'INSUFFICIENT'
      ? t.v2.conversionLevels.INSUFFICIENT
      : convEvidence.videoRevenueShare !== null
        ? `${t.v2.conversionChannels[convEvidence.dominantChannel]} · ${Math.round(
            convEvidence.videoRevenueShare * 100
          )}% Video`
        : t.v2.conversionLevels[convEvidence.evidenceLevel];

  // Top concise risk warnings (max 3 inline labels)
  const activeRisks = (intelligenceItem?.riskTags ?? commercial.riskTags).slice(0, 3);
  const formattedRisks = activeRisks.map(
    (tag) => t.v2.riskLabels[tag] ?? t.v2.formatRiskTag(tag)
  );

  // Strategy match label
  const strategyMatchLabel = isStrategyView
    ? `${t.v2.strategies[activeStrategyView].shortName}: ${
        t.v2.strategyEligibility[
          intelligenceItem?.kind === 'excluded'
            ? intelligenceItem.eligibilityStatus
            : strategyEval?.eligibilityStatus ?? 'INSUFFICIENT_DATA'
        ]
      }`
    : strategyReport.bestStrategyId
      ? t.v2.strategies[strategyReport.bestStrategyId].name
      : t.v2.strategyExplorer.noStrategyQualified;

  const renderUtilityButtons = (compactMode: boolean) => (
    <div className={`flex items-center shrink-0 ${compactMode ? 'gap-0.5' : 'gap-1'}`}>
      <button
        type="button"
        onClick={() => handleCopy('thai', product.thaiTitle)}
        title={t.card.copyThai}
        className={`${
          compactMode ? 'h-5.5 px-1 text-[10px]' : 'h-6 px-1.5 text-[11px]'
        } rounded font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-0.5 transition-colors cursor-pointer`}
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
          compactMode ? 'h-5.5 px-1 text-[10px]' : 'h-6 px-1.5 text-[11px]'
        } rounded font-mono-num font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-0.5 transition-colors cursor-pointer`}
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
              compactMode ? 'h-5.5 px-1 text-[10px]' : 'h-6 px-1.5 text-[11px]'
            } rounded font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500`}
          >
            <span className={compactMode ? 'hidden sm:inline' : 'inline'}>Shop</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </>
      )}
    </div>
  );

  const renderDimensionsBlock = (columnsClass: string, compactSpacing: boolean) => (
    <div
      className={`grid ${columnsClass} ${
        compactSpacing ? 'gap-x-3 gap-y-2' : 'gap-x-4 gap-y-2.5'
      } pt-2.5 border-t border-slate-100 dark:border-slate-800/80`}
    >
      {dimensions.map((dim) => {
        const tone = getDimensionBarClass(dim.score, dim.status);
        const pct =
          dim.score !== null && dim.status !== 'INSUFFICIENT' && dim.status !== 'INVALID'
            ? Math.max(4, Math.min(100, dim.score))
            : 0;
        return (
          <div key={dim.key} className="min-w-0">
            <div className="flex items-baseline justify-between gap-1.5">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                {dim.label}
              </span>
              <span className={`text-xs font-mono-num tabular-nums font-semibold shrink-0 ${tone.textClass}`}>
                {formatDimensionValue(dim.score, dim.status, t)}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800/90 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${tone.barClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-0.5 text-[10px] font-mono-num tabular-nums text-slate-500 dark:text-slate-400 truncate">
              {dim.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderEvidenceAndRisks = () => {
    const confidenceTone =
      commercial.dataConfidence.level === 'HIGH'
        ? 'text-emerald-700 dark:text-emerald-400'
        : commercial.dataConfidence.level === 'MEDIUM'
          ? 'text-teal-700 dark:text-teal-400'
          : commercial.dataConfidence.level === 'LOW'
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-rose-700 dark:text-rose-400';

    const reasons =
      intelligenceItem?.kind === 'ranked'
        ? intelligenceItem.reasonsForRanking
        : strategyReport.opportunityInsights;
    const cautions =
      intelligenceItem?.kind === 'excluded'
        ? [intelligenceItem.explanation]
        : strategyReport.cautionInsights;
    const failedReqs =
      intelligenceItem?.kind === 'excluded'
        ? intelligenceItem.failedRequirements
        : strategyEval?.failedRequirements ?? [];

    return (
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-[11px]">
        {/* Confidence + Conversion Evidence (strictly separated) */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="inline-flex items-center gap-1.5 min-w-0">
            <span className="text-slate-500 dark:text-slate-400">{t.v2.confidenceLabel}:</span>
            <span className={`font-mono-num tabular-nums font-semibold ${confidenceTone}`}>
              {Math.round(commercial.dataConfidence.score)}/100 ·{' '}
              {t.v2.confidenceLevels[commercial.dataConfidence.level]}
            </span>
          </div>

          <div
            className="inline-flex items-center gap-1.5 min-w-0 text-slate-600 dark:text-slate-300"
            title={t.v2.conversionDisclaimerShort}
          >
            <span className="text-slate-500 dark:text-slate-400">{t.v2.conversionLabel}:</span>
            <span className="font-mono-num tabular-nums font-medium truncate">{convText}</span>
          </div>
        </div>

        {/* Concise Unboxed Risk / Unverified Warning Line */}
        {(formattedRisks.length > 0 || provenanceSummary.hasUnverifiedCoreMetrics) && (
          <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400 leading-snug">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="min-w-0">
              {formattedRisks.length > 0
                ? formattedRisks.join(' · ')
                : t.v2.provenance.unverifiedCoreBanner(provenanceSummary.unverifiedCount)}
            </span>
          </div>
        )}

        {/* Inline Expandable Why-Ranked & Full Breakdown Trigger */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setIsDetailsExpanded((prev) => !prev)}
            aria-expanded={isDetailsExpanded}
            className="text-[11px] font-medium text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>
              {isDetailsExpanded
                ? t.v2.strategyExplorer.hideReasonsBtn
                : t.v2.strategyExplorer.whyRankedBtn}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                isDetailsExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => onOpenScoreDetails(product)}
            className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3 shrink-0" />
            <span>{t.v2.strategyExplorer.viewFullBreakdownBtn}</span>
          </button>
        </div>

        {isDetailsExpanded && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {reasons.length > 0 && (
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {t.v2.strategyExplorer.whyRankedTitle}
                </div>
                <ul className="mt-0.5 space-y-0.5 list-disc pl-4">
                  {reasons.slice(0, 3).map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {failedReqs.length > 0 && (
              <div>
                <div className="font-semibold text-rose-700 dark:text-rose-400">
                  {t.v2.strategyExplorer.failedRequirementsTitle}
                </div>
                <ul className="mt-0.5 space-y-0.5 list-disc pl-4">
                  {failedReqs.slice(0, 3).map((req) => (
                    <li key={req.key}>
                      <span className="font-medium">{req.label}:</span> {req.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cautions.length > 0 && (
              <div>
                <div className="font-semibold text-amber-700 dark:text-amber-400">
                  {t.v2.strategyExplorer.cautionsTitle}
                </div>
                <ul className="mt-0.5 space-y-0.5 list-disc pl-4">
                  {cautions.slice(0, 2).map((caution, idx) => (
                    <li key={idx}>{caution}</li>
                  ))}
                </ul>
              </div>
            )}

            {commercial.missingMetrics.length > 0 && (
              <div className="text-slate-500 dark:text-slate-400">
                <span className="font-semibold">
                  {t.v2.strategyExplorer.missingOrUnverifiedTitle}:
                </span>{' '}
                <span className="font-mono-num">{commercial.missingMetrics.join(', ')}</span>
              </div>
            )}

            <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">
              {t.v2.conversionDisclaimerShort}
            </div>
          </div>
        )}
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
                <span className={`font-medium shrink-0 ${classTone.text}`}>
                  {t.v2.classifications[classification]}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate" title={displayCategoryLabel}>
                  {displayCategoryLabel}
                </span>
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
                <span className="hidden md:inline text-slate-500 dark:text-slate-400">
                  D:{formatDimensionValue(commercial.demandScore.score, commercial.demandScore.status, t)}{' '}
                  · E:{formatDimensionValue(commercial.earningScore.score, commercial.earningScore.status, t)}{' '}
                  · C:{formatDimensionValue(commercial.competitionScore.score, commercial.competitionScore.status, t)}{' '}
                  · Q:{formatDimensionValue(commercial.customerQualityScore.score, commercial.customerQualityScore.status, t)}
                </span>
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
                className="h-8 px-2.5 sm:px-3 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <span className="hidden xs:inline sm:inline">{t.discover.openStudioShort}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        </article>
      );
    }

    // List Level 2 (Detailed): Complete V2 Product Intelligence row (stacks cleanly on <640px phones)
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
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                    #{isExcluded ? '—' : index + 1}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={`font-semibold shrink-0 ${classTone.text}`}>
                    {t.v2.classifications[classification]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-teal-700 dark:text-teal-400 font-medium truncate">
                    {strategyMatchLabel}
                  </span>
                  <span aria-hidden="true" className="hidden md:inline">
                    ·
                  </span>
                  <span className="hidden md:inline truncate" title={displayCategoryLabel}>
                    {displayCategoryLabel}
                  </span>
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
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1">
                {product.shopName}
              </p>
              {renderUtilityButtons(false)}
            </div>
          </div>

          {/* 4 Independent Dimensions (4-col on md+, 2-col on mobile) */}
          {renderDimensionsBlock('grid-cols-2 md:grid-cols-4', true)}

          {/* Evidence, Confidence & Risks */}
          {renderEvidenceAndRisks()}

          {/* Horizontal Tabular Metrics + Mobile CTA */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-baseline gap-x-4 sm:gap-x-6 gap-y-1.5">
              <div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                  {t.card.price}
                </div>
                <div className="text-xs sm:text-sm font-semibold font-mono-num tabular-nums text-slate-900 dark:text-slate-100">
                  {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
                </div>
              </div>

              <div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                  {t.card.commission}
                </div>
                <div
                  className={`text-xs sm:text-sm font-semibold font-mono-num tabular-nums ${
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
                  <div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                      {t.card.sales7d}
                    </div>
                    <div className="text-xs font-semibold font-mono-num tabular-nums text-slate-800 dark:text-slate-200">
                      {salesVolText}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                      {hasVideoRev ? t.card.videoRev7d : t.card.revenue7d}
                    </div>
                    <div className="text-xs font-semibold font-mono-num tabular-nums text-slate-800 dark:text-slate-200">
                      {revenueText}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => onSelect(product)}
              className="sm:hidden h-8 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t.discover.openStudioShort}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>

        {/* Desktop / Tablet Right Action Column */}
        <div className="hidden sm:flex flex-col items-end justify-between gap-3 w-48 md:w-52 shrink-0 p-4 border-l border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/20">
          <div className="w-full flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {isStrategyView && !isExcluded
                  ? t.v2.strategyScoreLabel
                  : t.v2.commercialScoreLabel}
              </div>
              <div className={`text-xs font-semibold truncate ${classTone.text}`}>
                {displayedScore === null
                  ? isZeroCommission
                    ? t.v2.withheldZeroCommLabel
                    : t.v2.withheldLabel
                  : `${displayedScore}/100`}
              </div>
              {isStrategyView && commercial.commercialOpportunityScore !== null && (
                <div className="text-[10px] font-mono-num tabular-nums text-slate-500 dark:text-slate-400">
                  {t.v2.commercialScoreShort}: {commercial.commercialOpportunityScore}
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
              className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:scale-[1.04] transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <ScoreRing score={displayedScore} grade={scoreGrade} size={44} strokeWidth={3.5} />
            </button>
          </div>

          {analysis && (
            <div className="w-full text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
              {analysis.bottomLine[language]}
            </div>
          )}

          <button
            type="button"
            onClick={() => onSelect(product)}
            className="w-full h-10 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <span className="truncate">{t.card.createPlan}</span>
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
  // GRID VIEW — Adaptive Spacious / Standard / Compact Cards
  // =========================================================================
  const imageAspectClass = isSpacious
    ? 'aspect-[4/3] sm:aspect-[16/10]'
    : isCompact
      ? 'aspect-square sm:aspect-[4/3]'
      : 'aspect-[4/3]';

  const bodyPaddingClass = isSpacious ? 'p-5 sm:p-6' : isCompact ? 'p-3 sm:p-3.5' : 'p-4 sm:p-5';

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
        {/* Clean Unboxed Metadata Line: Rank · Classification · Category */}
        <div
          className={`flex items-center justify-between gap-1.5 text-slate-500 dark:text-slate-400 ${
            isCompact ? 'text-[11px]' : 'text-xs'
          }`}
        >
          <div className="flex items-center gap-1 min-w-0 truncate">
            <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
              #{isExcluded ? '—' : index + 1}
            </span>
            <span aria-hidden="true">·</span>
            <span className={`font-semibold shrink-0 truncate ${classTone.text}`}>
              {t.v2.classifications[classification]}
            </span>
            {!isCompact && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate" title={displayCategoryLabel}>
                  {displayCategoryLabel}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 -mr-1">
            {renderSaveIconButton('compact')}
          </div>
        </div>

        {/* Title + Primary V2 Commercial / Strategy Score Ring */}
        <div
          className={`${isCompact ? 'mt-1.5 gap-2' : 'mt-2.5 gap-3'} flex items-start justify-between`}
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
                      : 'text-sm sm:text-base'
                }`}
              >
                {primaryTitle}
              </h3>
            </button>

            {!isCompact && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                <span className="text-teal-700 dark:text-teal-400 font-medium truncate">
                  {strategyMatchLabel}
                </span>
                {isStrategyView && commercial.commercialOpportunityScore !== null && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono-num tabular-nums text-slate-500 dark:text-slate-400">
                      {t.v2.commercialScoreShort}: {commercial.commercialOpportunityScore}
                    </span>
                  </>
                )}
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
            className="inline-flex items-center justify-center rounded-full p-0.5 -mt-0.5 -mr-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:scale-[1.04] transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <ScoreRing
              score={displayedScore}
              grade={scoreGrade}
              size={isSpacious ? 48 : isCompact ? 34 : 44}
              strokeWidth={isCompact ? 3 : 3.5}
            />
          </button>
        </div>

        {/* Shop Name + Utilities */}
        <div
          className={`${
            isCompact ? 'mt-1.5 flex-wrap gap-y-1' : 'mt-1.5'
          } flex items-center justify-between gap-1.5`}
        >
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1">
            {product.shopName}
          </p>
          {renderUtilityButtons(isCompact)}
        </div>

        {/* 4 Independent Dimensions */}
        {isCompact ? (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-4 gap-1 text-center font-mono-num tabular-nums">
            {dimensions.map((dim) => {
              const tone = getDimensionBarClass(dim.score, dim.status);
              return (
                <div key={dim.key} className="min-w-0">
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">
                    {dim.label}
                  </div>
                  <div className={`text-[11px] font-semibold ${tone.textClass}`}>
                    {dim.score !== null ? Math.round(dim.score) : dim.status === 'NOT_MONETIZABLE' ? '0%' : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            {renderDimensionsBlock(isSpacious ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2', false)}
            {renderEvidenceAndRisks()}
          </div>
        )}

        {/* Bottom Honest Kalodata Metrics & Studio CTA */}
        <div className={`mt-auto ${isCompact ? 'pt-2.5' : 'pt-3.5'}`}>
          <div
            className={`border-t border-slate-100 dark:border-slate-800/90 ${
              isCompact ? 'pt-2 space-y-1.5' : 'pt-3 space-y-2.5'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <div
                  className={`${
                    isCompact ? 'text-[10px]' : 'text-[11px]'
                  } text-slate-500 dark:text-slate-400`}
                >
                  {t.card.price}
                </div>
                <div
                  className={`mt-0.5 font-semibold font-mono-num tabular-nums text-slate-900 dark:text-slate-100 ${
                    isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                  }`}
                >
                  {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
                </div>
              </div>

              <div className="text-right min-w-0">
                <div
                  className={`${
                    isCompact ? 'text-[10px]' : 'text-[11px]'
                  } text-slate-500 dark:text-slate-400`}
                >
                  {t.card.commission}
                </div>
                <div
                  className={`mt-0.5 font-semibold font-mono-num tabular-nums truncate ${
                    isZeroCommission
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-teal-700 dark:text-teal-400'
                  } ${isCompact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}
                >
                  {commissionText}
                </div>
              </div>
            </div>

            {hasAnySalesRow && !isCompact && (
              <div className="pt-2 border-t border-slate-100/90 dark:border-slate-800/70 flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t.card.sales7d}
                  </div>
                  <div className="mt-0.5 font-semibold font-mono-num tabular-nums text-xs text-slate-800 dark:text-slate-200">
                    {salesVolText}
                  </div>
                </div>

                <div className="text-right min-w-0">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {hasVideoRev ? t.card.videoRev7d : t.card.revenue7d}
                  </div>
                  <div className="mt-0.5 font-semibold font-mono-num tabular-nums text-xs text-slate-800 dark:text-slate-200">
                    {revenueText}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelect(product)}
            className={`w-full rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#131B24] ${
              isCompact ? 'mt-2.5 h-8 px-2.5 text-[11px]' : 'mt-3.5 h-10 px-4 text-xs sm:text-sm'
            }`}
          >
            <span className="truncate">{isCompact ? t.discover.openStudioShort : t.card.createPlan}</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </article>
  );
}
