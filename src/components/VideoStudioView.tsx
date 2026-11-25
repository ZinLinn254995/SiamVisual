import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Translations } from '../i18n';
import { translateCategoryNameToMyanmar } from '../lib/categoryTranslations';
import { getStudioFallbackImage } from '../lib/media';
import { getKalodataProductUrl, getTikTokShopProductUrl } from '../lib/tiktokLink';
import type {
  KalodataLimitSettings,
  KalodataStatus,
  Language,
  ProductAiAnalysis,
  ProductEnrichOptions,
  ProductItem,
  ScoreGrade,
  VideoAdPlan,
  VisualStyle,
} from '../types';
import {
  ensureProductV2Intelligence,
  getClassificationTone,
  getDimensionBarClass,
  getToneClasses,
} from '../lib/productIntelligenceView.ts';
import { AiChatPromptCard } from './AiChatPromptCard';
import { ScoreRing } from './ScoreRing';

interface VideoStudioViewProps {
  product: ProductItem;
  isSaved: boolean;
  plan: VideoAdPlan | null;
  style: VisualStyle;
  savedStyles: VisualStyle[];
  isGenerating: boolean;
  isEnrichingProduct: boolean;
  isAnalyzingProduct: boolean;
  enrichError: string | null;
  analysisError: string | null;
  error: string | null;
  cameFromHistory: boolean;
  language: Language;
  nowMs?: number;
  kalodataStatus: KalodataStatus;
  kalodataLimits: KalodataLimitSettings;
  t: Translations;
  onBack: () => void;
  onToggleSave: (product: ProductItem) => void;
  onSelectStyle: (style: VisualStyle) => void;
  onConfirmGenerate: (forceFresh: boolean) => void;
  onFetchDeepInsights: (options: ProductEnrichOptions) => Promise<void>;
  onAnalyzeProduct: () => Promise<void>;
  onOpenScoreDetails: (product: ProductItem) => void;
}

const STYLE_OPTIONS: VisualStyle[] = [
  'cinematic',
  'asmr',
  'before_after',
  'problem_fix',
];

const SINGLE_DETAIL_COST = 0.2;
const SINGLE_SPECS_COST = 0.5;
const SINGLE_COMMENTS_COST = 1.0;

function formatGrowthRate(rate: number): string {
  // Phase 0 live-verified percentage-point unit on /rank (e.g. 17.75 = +17.75%, -1.8 = -1.8%)
  const pct = Math.round(rate * 10) / 10;
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

export function VideoStudioView({
  product,
  isSaved,
  plan,
  style,
  savedStyles,
  isGenerating,
  isEnrichingProduct,
  isAnalyzingProduct,
  enrichError,
  analysisError,
  error,
  cameFromHistory,
  language,
  nowMs,
  kalodataStatus,
  kalodataLimits,
  t,
  onBack,
  onToggleSave,
  onSelectStyle,
  onConfirmGenerate,
  onFetchDeepInsights,
  onAnalyzeProduct,
  onOpenScoreDetails,
}: VideoStudioViewProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fallbackSrc = getStudioFallbackImage(product.category);
  const [imgSrc, setImgSrc] = useState<string>(product.imageUrl || fallbackSrc);
  const [usingFallback, setUsingFallback] = useState<boolean>(!product.imageUrl);
  const [confirmMode, setConfirmMode] = useState<'generate' | 'regenerate' | null>(null);

  const deep = product.deepInsights;
  const metrics = product.kalodataMetrics;
  const analysis = product.aiAnalysis;
  const tiktokShopUrl = getTikTokShopProductUrl(product);
  const kalodataProductUrl = getKalodataProductUrl(product.id);

  const hasSavedDetails = Boolean(deep?.description && deep.description.trim());
  const hasSavedSpecs = Boolean(deep?.highlights && deep.highlights.length > 0);
  const hasSavedComments = Boolean(
    (deep?.painPoints && deep.painPoints.length > 0) ||
      (deep?.usageScenarios && deep.usageScenarios.length > 0)
  );
  const hasFetchedDetailsLayer = Boolean(hasSavedDetails || deep?.fetchedDetails);
  const hasFetchedSpecsLayer = Boolean(hasSavedSpecs || deep?.fetchedSpecs);
  const hasFetchedCommentsLayer = Boolean(hasSavedComments || deep?.fetchedComments);

  const hasSalesMetrics = Boolean(
    (typeof metrics?.salesVolume7d === 'number' && Number.isFinite(metrics.salesVolume7d)) ||
      (typeof metrics?.revenueThb7d === 'number' && Number.isFinite(metrics.revenueThb7d)) ||
      (typeof metrics?.videoRevenueThb7d === 'number' && Number.isFinite(metrics.videoRevenueThb7d))
  );
  const hasAnyMetricsData = Boolean(
    hasSalesMetrics ||
      (typeof metrics?.liveRevenueThb7d === 'number' && Number.isFinite(metrics.liveRevenueThb7d)) ||
      (typeof metrics?.revenueGrowthRate === 'number' && Number.isFinite(metrics.revenueGrowthRate)) ||
      (typeof metrics?.creatorCount === 'number' && Number.isFinite(metrics.creatorCount)) ||
      (typeof metrics?.rating === 'number' && Number.isFinite(metrics.rating)) ||
      (typeof metrics?.reviewCount === 'number' && Number.isFinite(metrics.reviewCount))
  );

  // Detect if newer Kalodata Deep Data or sales metrics were fetched after the saved AI analysis
  const hasNewerDataForAnalysis = Boolean(
    analysis &&
      ((hasSalesMetrics && !analysis.dataSnapshot.hasSalesMetrics) ||
        (hasSavedDetails && !analysis.dataSnapshot.hasDetails) ||
        (hasSavedSpecs && !analysis.dataSnapshot.hasSpecs) ||
        (hasSavedComments && !analysis.dataSnapshot.hasComments))
  );

  // Choice (ခ): Optional Single-Product Kalodata Deep Enrichment controls
  const [isDeepPanelOpen, setIsDeepPanelOpen] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [enrichOpts, setEnrichOpts] = useState<ProductEnrichOptions>({
    includeDetails: !hasFetchedDetailsLayer,
    includeSpecs: false,
    includeComments: false,
  });

  // Sync image & default checkboxes when switching products or after fetching deep data
  useEffect(() => {
    if (product.imageUrl) {
      setImgSrc(product.imageUrl);
      setUsingFallback(false);
    } else {
      setImgSrc(fallbackSrc);
      setUsingFallback(true);
    }
  }, [product.id, product.imageUrl, fallbackSrc]);

  useEffect(() => {
    setIsDescExpanded(false);
    setCopiedKey(null);
    setConfirmMode(null);
    setIsDeepPanelOpen(false);
  }, [product.id]);

  useEffect(() => {
    setEnrichOpts({
      includeDetails: !Boolean(product.deepInsights?.description || product.deepInsights?.fetchedDetails),
      includeSpecs: false,
      includeComments: false,
    });
  }, [
    product.id,
    product.deepInsights?.description,
    product.deepInsights?.fetchedDetails,
    product.deepInsights?.fetchedSpecs,
    product.deepInsights?.fetchedComments,
  ]);

  // Close confirmation dialog cleanly on Escape and lock body scroll while open
  useEffect(() => {
    if (!confirmMode) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setConfirmMode(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [confirmMode]);

  const productWithV2 = useMemo(
    () =>
      ensureProductV2Intelligence(
        product,
        nowMs !== undefined ? { nowMs } : undefined
      ),
    [product, nowMs]
  );
  const commercialV2 = productWithV2.commercialScoreV2!;
  const strategyV2 = productWithV2.strategyIntelligenceV2!;
  const v2Score = commercialV2.commercialOpportunityScore;
  const v2Grade: ScoreGrade =
    v2Score === null
      ? 'low'
      : v2Score >= 75
        ? 'top'
        : v2Score >= 58
          ? 'strong'
          : v2Score >= 40
            ? 'fair'
            : 'low';
  const v2ClassTone = getToneClasses(
    getClassificationTone(strategyV2.opportunityClassification)
  );

  const enrichEstimatedCost = useMemo(() => {
    const sum =
      (enrichOpts.includeDetails ? SINGLE_DETAIL_COST : 0) +
      (enrichOpts.includeSpecs ? SINGLE_SPECS_COST : 0) +
      (enrichOpts.includeComments ? SINGLE_COMMENTS_COST : 0);
    return Math.round(sum * 100) / 100;
  }, [enrichOpts]);

  const enrichLimitWarning = useMemo(() => {
    if (!kalodataStatus.connected || enrichEstimatedCost <= 0) return null;
    if (
      kalodataLimits.maxSpendCredits !== null &&
      kalodataLimits.trackedSpentCredits + enrichEstimatedCost >
        kalodataLimits.maxSpendCredits + 0.0001
    ) {
      return t.kalodata.limitExceededMaxSpend(
        kalodataLimits.trackedSpentCredits,
        enrichEstimatedCost,
        kalodataLimits.maxSpendCredits
      );
    }
    const avail = kalodataStatus.balance?.available;
    if (
      kalodataLimits.minBalanceReserve !== null &&
      avail !== null &&
      avail !== undefined &&
      avail - enrichEstimatedCost < kalodataLimits.minBalanceReserve - 0.0001
    ) {
      return t.kalodata.limitExceededReserve(
        avail,
        enrichEstimatedCost,
        kalodataLimits.minBalanceReserve
      );
    }
    return null;
  }, [kalodataStatus, kalodataLimits, enrichEstimatedCost, t]);

  async function copyText(key: string, text: string) {
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
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 1800);
  }

  function buildAnalysisCopyText(currentAnalysis: ProductAiAnalysis): string {
    const lines = [
      `=== ${product.thaiTitle} ===`,
      `Product ID: ${product.id}`,
      `Decision: ${t.studio.analysisDecisions[currentAnalysis.decision]}`,
      `Summary: ${currentAnalysis.bottomLine[language]}`,
      '',
      `[${t.studio.analysisSecIdentity}]`,
      currentAnalysis.productOverview[language],
      '',
      `[${t.studio.analysisSecSalesPricing}]`,
      currentAnalysis.salesAndPricingAudit[language],
      '',
      `[${t.studio.analysisSecProfitMath}]`,
      currentAnalysis.profitCalculation[language],
      '',
      `[${t.studio.analysisSecSilentAd}]`,
      currentAnalysis.silentVideoVerdict[language],
      ...currentAnalysis.visualAngles[language].map((a) => `- ${a}`),
      '',
      `[${t.studio.analysisSecSpecs}]`,
      currentAnalysis.deepDataSpecsAudit[language],
      '',
      `[${t.studio.analysisSecBuyers}]`,
      currentAnalysis.deepDataBuyerAudit[language],
      '',
      `[${t.studio.analysisSecRisks}]`,
      ...currentAnalysis.risks[language].map((r) => `- ${r}`),
    ];
    if (currentAnalysis.missingDataNotes[language].length > 0) {
      lines.push(
        '',
        `[${t.studio.analysisSecMissing}]`,
        ...currentAnalysis.missingDataNotes[language].map((n) => `- ${n}`)
      );
    }
    return lines.join('\n');
  }

  function buildFullPlanText(currentPlan: VideoAdPlan): string {
    const priceText = product.priceThb !== null ? `฿${product.priceThb}` : '—';
    const commText =
      product.commissionRate !== null
        ? `${product.commissionRate}%${product.commissionThb !== null ? ` (฿${product.commissionThb}/sale)` : ''}`
        : '—';
    const lines: string[] = [
      `=== ${product.clearTitle[language]} ===`,
      `Thai Listing: ${product.thaiTitle}`,
      `Product ID: ${product.id}`,
      `Price: ${priceText} | Commission: ${commText}`,
      `Style: ${t.styles[currentPlan.style]} (Zero-Speech Visual)`,
      '',
      `[CONCEPT]`,
      currentPlan.conceptTitle[language],
      currentPlan.conceptSummary[language],
      `Visual Direction: ${currentPlan.visualDirection[language]}`,
      '',
      `[VISUAL HOOKS (0-3s)]`,
      ...currentPlan.hooks.map(
        (h, i) =>
          `${i + 1}. ${h.title[language]}\n   Visual: ${h.visualAction[language]}\n   Thai Text: ${h.onScreenTextTh} (${h.onScreenTextMeaning[language]})`
      ),
      '',
      `[SILENT SHOT-BY-SHOT SCRIPT]`,
      ...currentPlan.storyboard.map(
        (s) =>
          `${s.timeRange} | Visual: ${s.sceneVisual[language]} | Camera: ${s.cameraMove[language]} | Sound: ${s.soundDesign[language]} | Thai Text: ${s.onScreenTextTh}`
      ),
      '',
      `[AI VIDEO PROMPTS]`,
      ...currentPlan.aiVideoPrompts.map((p, i) => `${i + 1}. ${p.label[language]}:\n${p.prompt}`),
      '',
      `[AI IMAGE KEYFRAME PROMPTS]`,
      ...currentPlan.aiImagePrompts.map((p, i) => `${i + 1}. ${p.label[language]}:\n${p.prompt}`),
      '',
      `[TIKTOK THAILAND SEO]`,
      `Caption (TH):\n${currentPlan.seo.captionTh}`,
      `Meaning: ${currentPlan.seo.captionMeaning[language]}`,
      `Hashtags: ${currentPlan.seo.hashtags.join(' ')}`,
      `Keywords: ${currentPlan.seo.keywords.join(', ')}`,
    ];
    return lines.join('\n');
  }

  const hasAnyDeepData = Boolean(
    hasFetchedDetailsLayer ||
      hasFetchedSpecsLayer ||
      hasFetchedCommentsLayer ||
      (deep?.fetchedAt && hasAnyMetricsData)
  );

  function buildDeepDataCopyText(): string {
    const lines: string[] = [
      `=== Kalodata Deep Data: ${product.thaiTitle} ===`,
      `Product ID: ${product.id}`,
      `Shop: ${product.shopName}`,
    ];
    if (typeof metrics?.salesVolume7d === 'number') {
      lines.push(`7d Units Sold: ${metrics.salesVolume7d.toLocaleString()}`);
    }
    if (typeof metrics?.revenueThb7d === 'number') {
      lines.push(`7d Total Revenue: ฿${Math.round(metrics.revenueThb7d).toLocaleString()}`);
    }
    if (typeof metrics?.videoRevenueThb7d === 'number') {
      lines.push(`7d Video Revenue: ฿${Math.round(metrics.videoRevenueThb7d).toLocaleString()}`);
    }
    if (typeof metrics?.liveRevenueThb7d === 'number') {
      lines.push(`7d Live Revenue: ฿${Math.round(metrics.liveRevenueThb7d).toLocaleString()}`);
    }
    if (typeof metrics?.revenueGrowthRate === 'number') {
      const unverifiedTag =
        productWithV2.validatedMetrics?.revenueGrowthRate.unit === 'UNVERIFIED'
          ? ` (${t.studio.growthUnverifiedShort})`
          : '';
      lines.push(`7d Growth Rate: ${formatGrowthRate(metrics.revenueGrowthRate)}${unverifiedTag}`);
    }
    if (typeof metrics?.creatorCount === 'number') {
      lines.push(`Active Creators: ${metrics.creatorCount.toLocaleString()}`);
    }
    if (typeof metrics?.rating === 'number' || typeof metrics?.reviewCount === 'number') {
      const ratingPart = typeof metrics?.rating === 'number' ? `${metrics.rating.toFixed(1)}/5` : '—';
      const reviewPart =
        typeof metrics?.reviewCount === 'number'
          ? ` (${metrics.reviewCount.toLocaleString()} reviews)`
          : '';
      lines.push(`Rating: ${ratingPart}${reviewPart}`);
    }
    if (deep?.highlights && deep.highlights.length > 0) {
      lines.push('', `[${t.studio.deepHighlightsLabel}]`, ...deep.highlights.map((h) => `- ${h}`));
    }
    if (deep?.painPoints && deep.painPoints.length > 0) {
      lines.push('', `[${t.studio.deepPainPointsLabel}]`, ...deep.painPoints.map((p) => `- ${p}`));
    }
    if (deep?.usageScenarios && deep.usageScenarios.length > 0) {
      lines.push('', `[${t.studio.deepUsageLabel}]`, ...deep.usageScenarios.map((u) => `- ${u}`));
    }
    if (deep?.description) {
      lines.push('', `[${t.studio.deepDescLabel}]`, deep.description);
    }
    return lines.join('\n');
  }

  function renderVisualStyleSelector(centered = false) {
    return (
      <div className={centered ? 'flex flex-col items-center' : ''}>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
          {t.studio.styleLabel}
        </div>
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          {STYLE_OPTIONS.map((option) => {
            const active = option === style;
            const hasSaved = savedStyles.includes(option);
            return (
              <button
                key={option}
                type="button"
                disabled={isGenerating}
                onClick={() => onSelectStyle(option)}
                className={`h-9 px-3.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                  active
                    ? 'bg-white dark:bg-[#131B24] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{t.styles[option]}</span>
                {hasSaved && (
                  <Check
                    className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0"
                    aria-label={t.studio.savedStyleMark}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const decisionToneClass =
    analysis?.decision === 'strong_go'
      ? 'text-emerald-700 dark:text-emerald-400'
      : analysis?.decision === 'need_more_data'
        ? 'text-rose-700 dark:text-rose-400'
        : 'text-amber-700 dark:text-amber-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-5xl mx-auto px-4 sm:px-6 py-7 sm:py-10"
    >
      {/* Top Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="h-10 px-3 -ml-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>{cameFromHistory ? t.studio.backToHistory : t.studio.backToResults}</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleSave(product)}
          aria-pressed={isSaved}
          aria-label={isSaved ? t.card.unsaveProduct : t.card.saveProduct}
          title={isSaved ? t.card.unsaveProduct : t.card.saveProduct}
          className={`h-9 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            isSaved
              ? 'border-teal-500/70 dark:border-teal-500/60 bg-teal-50/80 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:text-teal-700 dark:hover:text-teal-400'
          }`}
        >
          <Bookmark className="w-4 h-4 shrink-0" fill={isSaved ? 'currentColor' : 'none'} />
          <span>{isSaved ? t.card.savedTag : t.card.saveShort}</span>
        </button>
      </div>

      {/* Product Summary Strip (Clean: Title, Copy Thai, ID, Score, Price & Commission only) */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 items-start pb-7 border-b border-slate-200 dark:border-slate-800">
        <div
          className={`aspect-[4/3] md:aspect-square w-full rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-800 ${
            usingFallback
              ? 'bg-slate-100 dark:bg-slate-900'
              : 'bg-slate-50 dark:bg-slate-900/70 p-2'
          }`}
        >
          <img
            src={imgSrc}
            alt={product.clearTitle[language]}
            referrerPolicy="no-referrer"
            onError={() => {
              if (imgSrc !== fallbackSrc) {
                setImgSrc(fallbackSrc);
                setUsingFallback(true);
              }
            }}
            className={`w-full h-full ${usingFallback ? 'object-cover' : 'object-contain'}`}
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className={`font-semibold ${v2ClassTone.text}`}>
              {t.v2.classifications[strategyV2.opportunityClassification]}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {language === 'my'
                ? product.categoryLabel.my && /[\u1000-\u109F]/.test(product.categoryLabel.my)
                  ? product.categoryLabel.my
                  : translateCategoryNameToMyanmar(
                      product.categoryLabel.en || product.categoryLabel.my
                    )
                : product.categoryLabel.en || product.categoryLabel.my}
            </span>
            <span aria-hidden="true">·</span>
            <span>{product.shopName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num tabular-nums text-slate-600 dark:text-slate-300">
              {t.v2.confidenceLabel}: {Math.round(commercialV2.dataConfidence.score)}/100
            </span>
          </div>

          <div className="mt-2 flow-root">
            <button
              type="button"
              onClick={() => onOpenScoreDetails(productWithV2)}
              title={`${t.v2.classifications[strategyV2.opportunityClassification]} (${
                v2Score ?? '—'
              }/100) — ${t.score.tooltipBtn}`}
              aria-label={`${t.score.tooltipBtn}: ${v2Score ?? 'Withheld'}`}
              className="float-left mr-3 mt-[3px] inline-flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:scale-[1.04] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <ScoreRing
                score={v2Score}
                grade={v2Grade}
                size={56}
                strokeWidth={4}
                className="w-[50px] h-[50px] sm:w-[58px] sm:h-[58px]"
              />
            </button>

            <h1 className="font-display text-[19px] leading-[28px] sm:text-[23px] sm:leading-[32px] font-bold text-slate-900 dark:text-slate-100">
              {product.thaiTitle}
            </h1>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copyText('prod_thai', product.thaiTitle)}
              className="h-7 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {copiedKey === 'prod_thai' ? (
                <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedKey === 'prod_thai' ? t.card.copiedShort : t.card.copyThai}</span>
            </button>
            <button
              type="button"
              onClick={() => copyText('prod_id', product.id)}
              className="h-7 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-mono-num text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {copiedKey === 'prod_id' ? (
                <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              ) : (
                <span>ID: {product.id.slice(0, 12)}</span>
              )}
            </button>
            {tiktokShopUrl && (
              <a
                href={tiktokShopUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={t.card.openTikTokShop}
                className="h-7 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-teal-700 dark:text-teal-400 hover:border-teal-500/70 dark:hover:border-teal-500/70 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <span>{t.card.openTikTokShort}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            )}
            {kalodataProductUrl && (
              <a
                href={kalodataProductUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={language === 'my' ? 'Kalodata ပစ္စည်းစာမျက်နှာဖွင့်မယ်' : 'Open Product on Kalodata'}
                className="h-7 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <span>Kalodata</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400 mr-2">{t.card.price}:</span>
              <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 mr-2">{t.card.commission}:</span>
              <span className="font-mono-num font-semibold text-teal-700 dark:text-teal-400">
                {product.commissionRate !== null
                  ? `${product.commissionRate}%${
                      product.commissionThb !== null
                        ? ` (฿${product.commissionThb.toLocaleString()} ${t.card.perSale})`
                        : ''
                    }`
                  : '—'}
              </span>
            </div>
          </div>

          {/* 4 Independent Commercial Dimensions Summary Row */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {(
              [
                [
                  t.v2.dimensions.demand.short,
                  commercialV2.demandScore.score,
                  commercialV2.demandScore.status,
                ],
                [
                  t.v2.dimensions.earning.short,
                  commercialV2.earningScore.score,
                  commercialV2.earningScore.status,
                ],
                [
                  t.v2.dimensions.competition.short,
                  commercialV2.competitionScore.score,
                  commercialV2.competitionScore.status,
                ],
                [
                  t.v2.dimensions.quality.short,
                  commercialV2.customerQualityScore.score,
                  commercialV2.customerQualityScore.status,
                ],
              ] as const
            ).map(([label, dimScore, dimStatus]) => {
              const tone = getDimensionBarClass(dimScore, dimStatus);
              return (
                <div key={label} className="min-w-0">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
                  <div className={`mt-0.5 font-mono-num tabular-nums font-semibold ${tone.textClass}`}>
                    {dimScore !== null
                      ? `${Math.round(dimScore)}/100`
                      : dimStatus === 'NOT_MONETIZABLE'
                        ? '0% Comm'
                        : t.v2.dimensionStatus[dimStatus]}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>{t.studio.commercialStudioNotice}</span>
          </p>
        </div>
      </div>

      {/* Section 1: Optional Single-Product Kalodata Deep Enrichment Card */}
      <div className="mt-6 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsDeepPanelOpen((prev) => !prev)}
          className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Database className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t.studio.deepToggleTitle}
                </span>
                {hasAnyDeepData && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    ✓ {t.studio.deepFetchedBadge}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t.studio.deepToggleHint}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
            <span className="hidden sm:inline">
              {isDeepPanelOpen ? t.studio.deepHideFetchBtn : t.studio.deepManageFetchBtn}
            </span>
            {isDeepPanelOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </div>
        </button>

        {/* Collapsible Fetch Controls Drawer */}
        {isDeepPanelOpen && (
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800/90 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Product Details (+0.2 cr for 1 product) */}
              <label className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer">
                <div className="flex items-start gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={enrichOpts.includeDetails}
                    onChange={(e) =>
                      setEnrichOpts((prev) => ({ ...prev, includeDetails: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 accent-teal-600 shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <span>{t.studio.deepOptDetailTitle}</span>
                      {hasFetchedDetailsLayer && (
                        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          ✓ {t.studio.deepSavedTag}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {t.studio.deepOptDetailDesc}
                    </div>
                  </div>
                </div>
                <span className="font-mono-num text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                  ~{SINGLE_DETAIL_COST} cr
                </span>
              </label>

              {/* Selling Specs (+0.5 cr for 1 product) */}
              <label className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer">
                <div className="flex items-start gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={enrichOpts.includeSpecs}
                    onChange={(e) =>
                      setEnrichOpts((prev) => ({ ...prev, includeSpecs: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 accent-teal-600 shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <span>{t.studio.deepOptSpecsTitle}</span>
                      {hasFetchedSpecsLayer && (
                        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          ✓ {t.studio.deepSavedTag}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {t.studio.deepOptSpecsDesc}
                    </div>
                  </div>
                </div>
                <span className="font-mono-num text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                  ~{SINGLE_SPECS_COST} cr
                </span>
              </label>

              {/* Buyer Reviews (+1.0 cr for 1 product) */}
              <label className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer">
                <div className="flex items-start gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={enrichOpts.includeComments}
                    onChange={(e) =>
                      setEnrichOpts((prev) => ({ ...prev, includeComments: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 accent-teal-600 shrink-0 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <span>{t.studio.deepOptCommentsTitle}</span>
                      {hasFetchedCommentsLayer && (
                        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          ✓ {t.studio.deepSavedTag}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {t.studio.deepOptCommentsDesc}
                    </div>
                  </div>
                </div>
                <span className="font-mono-num text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                  ~{SINGLE_COMMENTS_COST} cr
                </span>
              </label>
            </div>

            {enrichLimitWarning && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {enrichLimitWarning}
              </p>
            )}
            {enrichError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{enrichError}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {!kalodataStatus.connected ? (
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  {t.kalodata.connectRequiredError}
                </span>
              ) : enrichEstimatedCost <= 0 ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t.studio.deepSelectOneHint}
                </span>
              ) : (
                <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                  1 Product · ~{enrichEstimatedCost} {t.kalodata.creditsUnit}
                </span>
              )}

              <button
                type="button"
                disabled={
                  !kalodataStatus.connected ||
                  enrichEstimatedCost <= 0 ||
                  Boolean(enrichLimitWarning) ||
                  isEnrichingProduct
                }
                onClick={() => onFetchDeepInsights(enrichOpts)}
                className="h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                {isEnrichingProduct && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                <span>
                  {isEnrichingProduct
                    ? t.studio.deepFetchingBtn
                    : t.studio.deepFetchBtn(enrichEstimatedCost)}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Always-Visible Fetched Kalodata Deep Data Display */}
        {hasAnyDeepData && deep && (
          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
            {/* Compact Header + Copy Data */}
            <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/90">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t.studio.deepDataHeading}
                </span>
                {deep.fetchedAt && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(deep.fetchedAt).toLocaleString(
                        language === 'my' ? 'my-MM' : 'en-US',
                        { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                      )}
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => copyText('deep_data_all', buildDeepDataCopyText())}
                className="h-7 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {copiedKey === 'deep_data_all' ? (
                  <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>
                  {copiedKey === 'deep_data_all' ? t.studio.copied : t.studio.deepCopyDataBtn}
                </span>
              </button>
            </div>

            {/* Kalodata 7-Day Metrics & Shop Strip */}
            {(hasAnyMetricsData || (hasFetchedDetailsLayer && product.shopName)) && (
              <div className="px-5 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3 border-b border-slate-100 dark:border-slate-800/90">
                {typeof metrics?.salesVolume7d === 'number' && Number.isFinite(metrics.salesVolume7d) && (
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.studio.analysisMetricSales7d}
                    </div>
                    <div className="mt-0.5 text-sm font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                      {metrics.salesVolume7d.toLocaleString()}
                      {t.card.unitsSuffix}
                    </div>
                  </div>
                )}

                {typeof metrics?.revenueThb7d === 'number' && Number.isFinite(metrics.revenueThb7d) && (
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.studio.analysisMetricRevenue7d}
                    </div>
                    <div className="mt-0.5 text-sm font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                      ฿{Math.round(metrics.revenueThb7d).toLocaleString()}
                    </div>
                  </div>
                )}

                {typeof metrics?.videoRevenueThb7d === 'number' &&
                  Number.isFinite(metrics.videoRevenueThb7d) && (
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.studio.analysisMetricVideoRev7d}
                      </div>
                      <div className="mt-0.5 text-sm font-mono-num font-semibold text-teal-700 dark:text-teal-400">
                        ฿{Math.round(metrics.videoRevenueThb7d).toLocaleString()}
                      </div>
                    </div>
                  )}

                {typeof metrics?.liveRevenueThb7d === 'number' &&
                  Number.isFinite(metrics.liveRevenueThb7d) && (
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.studio.deepMetricLiveRev7d}
                      </div>
                      <div className="mt-0.5 text-sm font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        ฿{Math.round(metrics.liveRevenueThb7d).toLocaleString()}
                      </div>
                    </div>
                  )}

                {typeof metrics?.revenueGrowthRate === 'number' &&
                  Number.isFinite(metrics.revenueGrowthRate) && (
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.studio.analysisMetricGrowth}
                      </div>
                      <div
                        className={`mt-0.5 text-sm font-mono-num font-semibold ${
                          metrics.revenueGrowthRate >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {formatGrowthRate(metrics.revenueGrowthRate)}
                        {(productWithV2.validatedMetrics?.revenueGrowthRate.unit === 'UNVERIFIED' ||
                          commercialV2.demandScore.growthStatus === 'UNVERIFIED') && (
                          <span className="ml-1 font-sans text-[10px] font-medium text-amber-700 dark:text-amber-400">
                            ({t.studio.growthUnverifiedShort})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                {typeof metrics?.creatorCount === 'number' && Number.isFinite(metrics.creatorCount) && (
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.studio.deepMetricCreators}
                    </div>
                    <div className="mt-0.5 text-sm font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                      {metrics.creatorCount.toLocaleString()}
                      {productWithV2.validatedMetrics?.creatorCount.unit === 'UNVERIFIED' && (
                        <span className="ml-1 font-sans text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          ({t.studio.growthUnverifiedShort})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {((typeof metrics?.rating === 'number' && Number.isFinite(metrics.rating)) ||
                  (typeof metrics?.reviewCount === 'number' &&
                    Number.isFinite(metrics.reviewCount))) && (
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.studio.deepMetricRating}
                    </div>
                    <div className="mt-0.5 text-sm font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                      {typeof metrics?.rating === 'number' ? `${metrics.rating.toFixed(1)} ★` : '—'}
                      {typeof metrics?.reviewCount === 'number' && (
                        <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                          ({metrics.reviewCount.toLocaleString()})
                        </span>
                      )}
                      {productWithV2.validatedMetrics?.reviewCount.unit === 'UNVERIFIED' &&
                        typeof metrics?.reviewCount === 'number' && (
                          <span className="ml-1 font-sans text-[10px] font-medium text-amber-700 dark:text-amber-400">
                            ({t.studio.growthUnverifiedShort})
                          </span>
                        )}
                    </div>
                  </div>
                )}

                {hasFetchedDetailsLayer && product.shopName && (
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.studio.deepMetricShop}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {product.shopName}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fetched Text & Insights Details */}
            <div className="px-5 py-4 space-y-4 text-xs">
              {/* Selling Specs & Highlights */}
              {(hasSavedSpecs || hasFetchedSpecsLayer) && (
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {t.studio.deepHighlightsLabel}
                  </div>
                  {deep.highlights && deep.highlights.length > 0 ? (
                    <ul className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-slate-600 dark:text-slate-300 list-disc pl-4 leading-relaxed">
                      {deep.highlights.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {t.studio.deepNoSpecsReturned}
                    </p>
                  )}
                </div>
              )}

              {/* Buyer Pain Points & Usage Scenarios */}
              {(hasSavedComments || hasFetchedCommentsLayer) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hasSavedComments ? (
                    <>
                      {deep.painPoints && deep.painPoints.length > 0 && (
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {t.studio.deepPainPointsLabel}
                          </div>
                          <ul className="mt-1.5 space-y-1 text-slate-600 dark:text-slate-300 list-disc pl-4 leading-relaxed">
                            {deep.painPoints.map((pt, i) => (
                              <li key={i}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {deep.usageScenarios && deep.usageScenarios.length > 0 && (
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {t.studio.deepUsageLabel}
                          </div>
                          <ul className="mt-1.5 space-y-1 text-slate-600 dark:text-slate-300 list-disc pl-4 leading-relaxed">
                            {deep.usageScenarios.map((u, i) => (
                              <li key={i}>{u}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="md:col-span-2">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {t.studio.deepOptCommentsTitle}
                      </div>
                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                        {t.studio.deepNoCommentsReturned}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Seller Description */}
              {(hasSavedDetails || hasFetchedDetailsLayer) && (
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {t.studio.deepDescLabel}
                  </div>
                  {deep.description ? (
                    <div className="mt-1.5">
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {isDescExpanded || deep.description.length <= 320
                          ? deep.description
                          : `${deep.description.slice(0, 320).trimEnd()}…`}
                      </p>
                      {deep.description.length > 320 && (
                        <button
                          type="button"
                          onClick={() => setIsDescExpanded((prev) => !prev)}
                          className="mt-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                        >
                          {isDescExpanded ? t.studio.deepShowLess : t.studio.deepShowMore}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {t.studio.deepNoDescReturned}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: NEW — AI Product Deep Analysis (Between Kalodata Deep Data & Video Ideas) */}
      <section className="mt-6 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                {t.studio.analysisTitle}
              </h2>
              {analysis && (
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  ✓ {t.studio.analysisSavedTag}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              {t.studio.analysisSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {analysis && !isAnalyzingProduct && (
              <button
                type="button"
                onClick={() => copyText('full_analysis', buildAnalysisCopyText(analysis))}
                className="h-10 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {copiedKey === 'full_analysis' ? (
                  <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                ) : (
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {copiedKey === 'full_analysis' ? t.studio.copied : t.studio.analysisCopyBtn}
                </span>
              </button>
            )}

            <button
              type="button"
              disabled={isAnalyzingProduct}
              onClick={onAnalyzeProduct}
              className={`h-10 px-4 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 ${
                analysis
                  ? 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 hover:border-teal-400 dark:hover:border-teal-600 text-slate-800 dark:text-slate-100'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950'
              }`}
            >
              {isAnalyzingProduct ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : analysis ? (
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {isAnalyzingProduct
                  ? t.studio.analysisRunningBtn
                  : analysis
                    ? t.studio.analysisReBtn
                    : t.studio.analysisBtn}
              </span>
            </button>
          </div>
        </div>

        {/* Quiet Unboxed Kalodata Data Availability Strip */}
        <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800/90 bg-slate-50/50 dark:bg-slate-900/30 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            {t.studio.analysisDataSourcesLabel}:
          </span>
          <span
            className={
              hasSalesMetrics
                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-amber-700 dark:text-amber-400'
            }
          >
            {t.studio.analysisSrcSales}:{' '}
            {hasSalesMetrics ? `✓ ${t.studio.analysisAvailable}` : t.studio.analysisNotAvailable}
          </span>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>
          <span
            className={
              hasSavedDetails
                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-slate-500 dark:text-slate-400'
            }
          >
            {t.studio.analysisSrcDetails}:{' '}
            {hasSavedDetails ? `✓ ${t.studio.analysisAvailable}` : t.studio.analysisNotAvailable}
          </span>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>
          <span
            className={
              hasSavedSpecs
                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-slate-500 dark:text-slate-400'
            }
          >
            {t.studio.analysisSrcSpecs}:{' '}
            {hasSavedSpecs ? `✓ ${t.studio.analysisAvailable}` : t.studio.analysisNotAvailable}
          </span>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>
          <span
            className={
              hasSavedComments
                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-slate-500 dark:text-slate-400'
            }
          >
            {t.studio.analysisSrcReviews}:{' '}
            {hasSavedComments ? `✓ ${t.studio.analysisAvailable}` : t.studio.analysisNotAvailable}
          </span>
        </div>

        {/* Notice if user fetched more Kalodata Deep Data after the last analysis */}
        {hasNewerDataForAnalysis && !isAnalyzingProduct && (
          <div className="px-5 py-2.5 border-t border-amber-200/70 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
            <span>{t.studio.analysisStaleHint}</span>
            <button
              type="button"
              onClick={onAnalyzeProduct}
              className="font-semibold underline hover:text-amber-950 dark:hover:text-amber-200 whitespace-nowrap cursor-pointer"
            >
              {t.studio.analysisReBtn}
            </button>
          </div>
        )}

        {/* Loading State */}
        {isAnalyzingProduct && (
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((slot) => (
                <div
                  key={slot}
                  className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800/70 animate-pulse"
                />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((slot) => (
                <div
                  key={slot}
                  className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800/70 animate-pulse"
                />
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {!isAnalyzingProduct && analysisError && (
          <div className="p-5 border-t border-red-200/80 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-red-700 dark:text-red-300">{analysisError}</p>
            <button
              type="button"
              onClick={onAnalyzeProduct}
              className="h-9 px-3.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              {t.discover.retry}
            </button>
          </div>
        )}

        {/* Populated AI Product Analysis Result */}
        {!isAnalyzingProduct && analysis && (
          <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/90">
            {/* Decision Verdict + Bottom Line */}
            <div className="p-5 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`font-semibold ${decisionToneClass}`}>
                  {t.studio.analysisDecisions[analysis.decision]}
                </span>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                  ·
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {product.thaiTitle}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {analysis.bottomLine[language]}
              </p>
            </div>

            {/* Real Kalodata Tabular Metrics Strip (Explicitly flags missing figures) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-100 dark:bg-slate-800/90">
              <div className="p-3.5 bg-slate-50/70 dark:bg-[#131B24]">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.studio.analysisMetricPrice}
                </div>
                <div className="mt-1 text-sm font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                  {product.priceThb !== null ? (
                    `฿${product.priceThb.toLocaleString()}`
                  ) : (
                    <span className="font-sans text-xs font-normal text-amber-700 dark:text-amber-400">
                      {t.studio.analysisNotAvailable}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/70 dark:bg-[#131B24]">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.studio.analysisMetricCommission}
                </div>
                <div className="mt-1 text-sm font-mono-num font-semibold text-teal-700 dark:text-teal-400">
                  {product.commissionRate !== null ? (
                    `${product.commissionRate}%${
                      product.commissionThb !== null ? ` · ฿${product.commissionThb}` : ''
                    }`
                  ) : (
                    <span className="font-sans text-xs font-normal text-amber-700 dark:text-amber-400">
                      {t.studio.analysisNotAvailable}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/70 dark:bg-[#131B24]">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.studio.analysisMetricSales7d}
                </div>
                <div className="mt-1 text-sm font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                  {typeof metrics?.salesVolume7d === 'number' ? (
                    metrics.salesVolume7d.toLocaleString()
                  ) : (
                    <span className="font-sans text-xs font-normal text-amber-700 dark:text-amber-400">
                      {t.studio.analysisNotAvailable}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/70 dark:bg-[#131B24]">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.studio.analysisMetricRevenue7d}
                </div>
                <div className="mt-1 text-sm font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                  {typeof metrics?.revenueThb7d === 'number' ? (
                    `฿${metrics.revenueThb7d.toLocaleString()}`
                  ) : (
                    <span className="font-sans text-xs font-normal text-amber-700 dark:text-amber-400">
                      {t.studio.analysisNotAvailable}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/70 dark:bg-[#131B24]">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.studio.analysisMetricVideoRev7d}
                </div>
                <div className="mt-1 text-sm font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                  {typeof metrics?.videoRevenueThb7d === 'number' ? (
                    `฿${metrics.videoRevenueThb7d.toLocaleString()}`
                  ) : (
                    <span className="font-sans text-xs font-normal text-amber-700 dark:text-amber-400">
                      {t.studio.analysisNotAvailable}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/70 dark:bg-[#131B24]">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.studio.analysisMetricGrowth}
                </div>
                <div className="mt-1 text-sm font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                  {typeof metrics?.revenueGrowthRate === 'number' ? (
                    formatGrowthRate(metrics.revenueGrowthRate)
                  ) : (
                    <span className="font-sans text-xs font-normal text-amber-700 dark:text-amber-400">
                      {t.studio.analysisNotAvailable}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Structured Detailed Analysis Sections */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.studio.analysisSecIdentity}
                </h3>
                <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                  {analysis.productOverview[language]}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.studio.analysisSecProfitMath}
                </h3>
                <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                  {analysis.profitCalculation[language]}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.studio.analysisSecSalesPricing}
                </h3>
                <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                  {analysis.salesAndPricingAudit[language]}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.studio.analysisSecSilentAd}
                </h3>
                <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                  {analysis.silentVideoVerdict[language]}
                </p>
                {analysis.visualAngles[language].length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t.studio.analysisSecVisualAngles}
                    </div>
                    <ul className="mt-1.5 space-y-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300 list-disc pl-4">
                      {analysis.visualAngles[language].map((angle, i) => (
                        <li key={i}>{angle}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.studio.analysisSecSpecs}
                </h3>
                <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                  {analysis.deepDataSpecsAudit[language]}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.studio.analysisSecBuyers}
                </h3>
                <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                  {analysis.deepDataBuyerAudit[language]}
                </p>
              </div>
            </div>

            {/* Risks & Explicit Missing Kalodata Data Checklist */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 text-xs sm:text-sm">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.studio.analysisSecRisks}
                </h3>
                <ul className="mt-2 space-y-1.5 text-slate-700 dark:text-slate-300 list-disc pl-4">
                  {analysis.risks[language].map((risk, i) => (
                    <li key={i}>{risk}</li>
                  ))}
                </ul>
              </div>

              {analysis.missingDataNotes[language].length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-amber-700 dark:text-amber-400 inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.studio.analysisSecMissing}</span>
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-amber-800/90 dark:text-amber-300/90 list-disc pl-4">
                    {analysis.missingDataNotes[language].map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Section 2.5: Universal Copy Prompt for Any AI Chat (ChatGPT / Claude / Gemini / DeepSeek) */}
      <AiChatPromptCard product={product} t={t} />

      {/* Section 3: Silent AI Video Ideas & Production Kit (Visual Style Selector lives here!) */}
      <section className="mt-8 pt-7 border-t border-slate-200 dark:border-slate-800">
        {/* Video Ideas Section Header + Relocated Visual Style Selector (when plan exists or loading/error) */}
        {(plan || isGenerating || error) && (
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t.studio.videoSectionTitle}
              </h2>
              <div className="mt-3">{renderVisualStyleSelector(false)}</div>
            </div>

            {plan && !isGenerating && (
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmMode('regenerate')}
                  className="h-10 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-slate-700 dark:text-slate-200 text-sm font-medium inline-flex items-center gap-2 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  <span>{t.studio.regenerate}</span>
                </button>

                <button
                  type="button"
                  onClick={() => copyText('full_kit', buildFullPlanText(plan))}
                  className="h-10 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                >
                  {copiedKey === 'full_kit' ? (
                    <Check className="w-4 h-4 shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 shrink-0" />
                  )}
                  <span>{copiedKey === 'full_kit' ? t.studio.copied : t.studio.copyFullKit}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Manual Ready-to-Generate Card with Visual Style Selector embedded directly inside */}
        {!isGenerating && !plan && !error && (
          <div className="p-6 sm:p-8 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 text-center max-w-2xl mx-auto">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.studio.readyTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
              {t.studio.readyDesc}
            </p>

            <div className="mt-5">{renderVisualStyleSelector(true)}</div>

            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-center gap-2">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {t.studio.confirmStyleLabel}: {t.styles[style]}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  hasAnyDeepData
                    ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                    : 'text-slate-500 dark:text-slate-400'
                }
              >
                {hasAnyDeepData ? t.studio.confirmDeepIncluded : t.studio.confirmDeepNotIncluded}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setConfirmMode('generate')}
              className="mt-5 h-11 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{t.studio.generateNowBtn}</span>
            </button>
          </div>
        )}

        {/* Loading State */}
        {isGenerating && (
          <div className="py-10 space-y-6">
            <div>
              <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t.studio.generatingTitle}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t.studio.generatingDesc}
              </p>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="h-24 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse"
                />
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {!isGenerating && error && (
          <div className="mt-6 p-6 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => setConfirmMode('generate')}
              className="mt-4 h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium cursor-pointer"
            >
              {t.discover.retry}
            </button>
          </div>
        )}

        {/* Generated Silent Video Kit */}
        {!isGenerating && plan && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 space-y-12"
          >
            {/* Sticky Quick Jump Strip & Quiet Auto-Saved Note */}
            <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 border-b border-slate-200/70 dark:border-slate-800">
              <nav aria-label="Plan sections" className="flex items-center gap-4 overflow-x-auto text-xs font-medium text-slate-600 dark:text-slate-400">
                <a href="#sec-concept" className="hover:text-teal-700 dark:hover:text-teal-400 whitespace-nowrap">
                  {t.studio.jumpConcept}
                </a>
                <a href="#sec-hooks" className="hover:text-teal-700 dark:hover:text-teal-400 whitespace-nowrap">
                  {t.studio.jumpHooks}
                </a>
                <a href="#sec-script" className="hover:text-teal-700 dark:hover:text-teal-400 whitespace-nowrap">
                  {t.studio.jumpScript}
                </a>
                <a href="#sec-prompts" className="hover:text-teal-700 dark:hover:text-teal-400 whitespace-nowrap">
                  {t.studio.jumpPrompts}
                </a>
                <a href="#sec-seo" className="hover:text-teal-700 dark:hover:text-teal-400 whitespace-nowrap">
                  {t.studio.jumpSeo}
                </a>
              </nav>

              <span className="text-xs text-slate-500 dark:text-slate-400">
                {plan.usedDeepInsights ? `${t.studio.deepFetchedBadge} · ` : ''}
                {t.studio.autoSaved}
              </span>
            </div>

          {/* 01. Concept */}
          <section id="sec-concept" className="space-y-3 scroll-mt-28 sm:scroll-mt-20">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.studio.sectionConcept}
            </h2>
            <div className="p-6 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 space-y-3">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                {plan.conceptTitle[language]}
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {plan.conceptSummary[language]}
              </p>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-sm">
                <span className="font-medium text-slate-900 dark:text-slate-100 mr-2">
                  {t.studio.visualDirectionLabel}:
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  {plan.visualDirection[language]}
                </span>
              </div>
            </div>
          </section>

          {/* 02. Visual Hooks (0-3s) */}
          <section id="sec-hooks" className="space-y-4 scroll-mt-28 sm:scroll-mt-20">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.studio.sectionHooks}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plan.hooks.map((hook, idx) => {
                const copyId = `hook_${idx}`;
                const hookCopyPayload = `${hook.visualAction[language]}\nThai On-Screen Text: ${hook.onScreenTextTh}`;
                return (
                  <div
                    key={idx}
                    className="flex flex-col p-5 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {idx + 1}. {hook.title[language]}
                      </h3>
                      <button
                        type="button"
                        onClick={() => copyText(copyId, hookCopyPayload)}
                        className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedKey === copyId ? (
                          <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedKey === copyId ? t.studio.copied : t.studio.copy}</span>
                      </button>
                    </div>
                    <p className="mt-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {hook.visualAction[language]}
                    </p>
                    <div className="mt-auto pt-4">
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t.studio.onScreenThaiLabel}
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {hook.onScreenTextTh}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {t.studio.meaningLabel}: {hook.onScreenTextMeaning[language]}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 03. Shot-by-Shot Silent Script */}
          <section id="sec-script" className="space-y-4 scroll-mt-28 sm:scroll-mt-20">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.studio.sectionStoryboard}
            </h2>
            <div className="rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden">
              <div className="hidden md:grid grid-cols-[90px_1.5fr_1fr_1.15fr] gap-4 px-5 py-3 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <div>{t.studio.timeCol}</div>
                <div>{t.studio.visualCol}</div>
                <div>{t.studio.soundCol}</div>
                <div>{t.studio.screenTextCol}</div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/90">
                {plan.storyboard.map((shot, idx) => {
                  const shotKey = `shot_th_${idx}`;
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-[90px_1.5fr_1fr_1.15fr] gap-3 md:gap-4 p-5 text-sm"
                    >
                      <div className="font-mono-num text-xs font-semibold text-teal-700 dark:text-teal-400">
                        {shot.timeRange}
                      </div>
                      <div>
                        <p className="text-slate-900 dark:text-slate-100 leading-relaxed">
                          {shot.sceneVisual[language]}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {shot.cameraMove[language]}
                        </p>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
                        <span className="md:hidden font-medium text-slate-500 dark:text-slate-400 mr-1.5">
                          {t.studio.soundCol}:
                        </span>
                        {shot.soundDesign[language]}
                      </div>
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {shot.onScreenTextTh}
                          </p>
                          {shot.onScreenTextTh && (
                            <button
                              type="button"
                              onClick={() => copyText(shotKey, shot.onScreenTextTh)}
                              title={t.studio.copyThaiText}
                              className="h-6 px-1.5 rounded text-[11px] text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              {copiedKey === shotKey ? (
                                <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {shot.onScreenTextMeaning[language]}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 04. AI Video & Keyframe Image Prompts */}
          <section id="sec-prompts" className="space-y-5 scroll-mt-28 sm:scroll-mt-20">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.studio.sectionPrompts}
            </h2>

            {/* Master Video Prompt (All-in-One 0-15s) */}
            {plan.masterVideoPrompt && (
              <div className="p-5 sm:p-6 rounded-xl bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-transparent border border-teal-500/30 dark:border-teal-500/20 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                      {t.studio.masterPromptTitle}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t.studio.masterPromptSub}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText('master_vprompt', plan.masterVideoPrompt!.en)}
                    className="h-10 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 self-start cursor-pointer shadow-xs"
                  >
                    {copiedKey === 'master_vprompt' ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>{copiedKey === 'master_vprompt' ? t.studio.copied : t.studio.copy}</span>
                  </button>
                </div>

                <div className="pt-3 border-t border-teal-500/20 space-y-2">
                  <p className="text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed break-words select-all bg-white/70 dark:bg-[#0B1117]/80 p-4 rounded-lg border border-teal-500/20">
                    {plan.masterVideoPrompt.en}
                  </p>
                  {language === 'my' && plan.masterVideoPrompt.my && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {t.studio.meaningLabel}:
                      </span>{' '}
                      {plan.masterVideoPrompt.my}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.studio.videoPromptsSub}
              </h3>
              <div className="space-y-3">
                {plan.aiVideoPrompts.map((item, idx) => {
                  const key = `vprompt_${idx}`;
                  return (
                    <div
                      key={idx}
                      className="p-5 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.label[language]}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyText(key, item.prompt)}
                          className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          {copiedKey === key ? (
                            <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedKey === key ? t.studio.copied : t.studio.copy}</span>
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm font-mono text-slate-700 dark:text-slate-300 leading-relaxed break-words select-all">
                        {item.prompt}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {plan.aiImagePrompts.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.studio.imagePromptsSub}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.aiImagePrompts.map((item, idx) => {
                    const key = `iprompt_${idx}`;
                    return (
                      <div
                        key={idx}
                        className="p-5 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 flex flex-col"
                      >
                        <div className="flex items-center justify-between gap-3 mb-2.5">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {item.label[language]}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyText(key, item.prompt)}
                            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            {copiedKey === key ? (
                              <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedKey === key ? t.studio.copied : t.studio.copy}</span>
                          </button>
                        </div>
                        <p className="text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed break-words select-all">
                          {item.prompt}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 05. TikTok Thailand SEO */}
          <section id="sec-seo" className="space-y-4 scroll-mt-28 sm:scroll-mt-20">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.studio.sectionSeo}
            </h2>
            <div className="p-6 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 space-y-6">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t.studio.thaiCaptionLabel}
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        'caption_th',
                        `${plan.seo.captionTh}\n\n${plan.seo.hashtags.join(' ')}`
                      )
                    }
                    className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'caption_th' ? (
                      <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'caption_th' ? t.studio.copied : t.studio.copy}</span>
                  </button>
                </div>
                <p className="mt-2.5 text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 whitespace-pre-line leading-relaxed">
                  {plan.seo.captionTh}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t.studio.meaningLabel}: {plan.seo.captionMeaning[language]}
                </p>
              </div>

              <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t.studio.hashtagsLabel}
                  </h3>
                  <button
                    type="button"
                    onClick={() => copyText('hashtags', plan.seo.hashtags.join(' '))}
                    className="h-8 px-2.5 rounded-md text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'hashtags' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedKey === 'hashtags' ? t.studio.copied : t.studio.copyAllHashtags}
                    </span>
                  </button>
                </div>
                <p className="mt-2 text-sm text-teal-700 dark:text-teal-400 leading-relaxed break-words">
                  {plan.seo.hashtags.join(' ')}
                </p>
              </div>

              <div className="pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t.studio.keywordsLabel}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {plan.seo.keywords.join(' · ')}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t.studio.postingTipLabel}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {plan.seo.postingTip[language]}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </motion.div>
      )}
      </section>

      {/* Minimalist Confirmation Dialog before Generating / Regenerating Video Plan */}
      <AnimatePresence>
        {confirmMode && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-generate-title"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setConfirmMode(null)}
              className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 shadow-xl p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h3
                  id="confirm-generate-title"
                  className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  {confirmMode === 'regenerate'
                    ? t.studio.confirmRegenTitle
                    : t.studio.confirmGenTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setConfirmMode(null)}
                  aria-label={t.studio.confirmCancelBtn}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.studio.confirmGenDesc}
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">
                    {t.studio.confirmStyleLabel}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-right">
                    {t.styles[style]}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">
                    Kalodata Deep Data
                  </span>
                  <span
                    className={`font-medium text-right ${
                      hasAnyDeepData
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {hasAnyDeepData
                      ? t.studio.confirmDeepIncluded
                      : t.studio.confirmDeepNotIncluded}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmMode(null)}
                  className="h-10 px-4 flex-1 sm:flex-none justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium inline-flex items-center cursor-pointer"
                >
                  {t.studio.confirmCancelBtn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const isRegen = confirmMode === 'regenerate';
                    setConfirmMode(null);
                    onConfirmGenerate(isRegen);
                  }}
                  className="h-10 px-4 flex-1 sm:flex-none justify-center rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.studio.confirmProceedBtn}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
