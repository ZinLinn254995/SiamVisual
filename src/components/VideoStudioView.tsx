import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  ExternalLink,
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
  VideoIdeaConcept,
  VideoIdeaIndex,
} from '../types';
import { ensureProductV2Intelligence } from '../lib/productIntelligenceView.ts';
import {
  evaluateSearchOpportunityScore,
  type SearchScoreGrade,
} from '../lib/searchScoreEngine.ts';
import { AiChatPromptCard } from './AiChatPromptCard';
import { BottomSheet } from './BottomSheet';
import { ScoreRing } from './ScoreRing';
import { useBackHistoryLayer } from '../lib/backHistory';

export type StudioSubpage = 'data' | 'ideas' | 'prompt';
export type StudioIdeasTab = 'idea_0' | 'idea_1' | 'idea_2' | 'summary' | 'seo';
export type StudioIdeaPlanSection = 'script' | 'prompts' | 'seo';

interface VideoStudioViewProps {
  product: ProductItem;
  isSaved: boolean;
  ideaPlans: Partial<Record<VideoIdeaIndex, VideoAdPlan>>;
  generatingIdeaIndex: VideoIdeaIndex | null;
  planErrorByIdea: Partial<Record<VideoIdeaIndex, string | null>>;
  isEnrichingProduct: boolean;
  isAnalyzingProduct: boolean;
  enrichError: string | null;
  analysisError: string | null;
  cameFromHistory: boolean;
  returnTab?: 'discover' | 'rank_board' | 'history';
  language: Language;
  nowMs?: number;
  kalodataStatus: KalodataStatus;
  kalodataLimits: KalodataLimitSettings;
  isOffline?: boolean;
  isBottomNavHidden?: boolean;
  initialSubpage?: StudioSubpage;
  initialIdeasTab?: StudioIdeasTab;
  initialPlanSection?: StudioIdeaPlanSection;
  t: Translations;
  onBack: () => void;
  onToggleSave: (product: ProductItem) => void;
  onGenerateIdeaPlan: (ideaIndex: VideoIdeaIndex, forceFresh: boolean) => void | Promise<void>;
  onFetchDeepInsights: (options: ProductEnrichOptions) => Promise<void>;
  onAnalyzeProduct: () => Promise<void>;
  onOpenScoreDetails: (product: ProductItem) => void;
  onNotifyToast?: (text: string, tone?: 'neutral' | 'error') => void;
}

const SINGLE_DETAIL_COST = 0.2;
const SINGLE_SPECS_COST = 0.5;
const SINGLE_COMMENTS_COST = 1.0;

function formatGrowthRate(rate: number): string {
  const pct = Math.round(rate * 10) / 10;
  return `${pct > 0 ? '▲ +' : pct < 0 ? '▼ ' : '• '}${pct}%`;
}

function searchGradeSymbol(grade: SearchScoreGrade): string {
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
    default:
      return '◌';
  }
}

export function VideoStudioView({
  product,
  isSaved,
  ideaPlans,
  generatingIdeaIndex,
  planErrorByIdea,
  isEnrichingProduct,
  isAnalyzingProduct,
  enrichError,
  analysisError,
  cameFromHistory,
  returnTab,
  language,
  nowMs,
  kalodataStatus,
  kalodataLimits,
  isOffline = false,
  isBottomNavHidden = false,
  initialSubpage,
  initialIdeasTab,
  initialPlanSection,
  t,
  onBack,
  onToggleSave,
  onGenerateIdeaPlan,
  onFetchDeepInsights,
  onAnalyzeProduct,
  onOpenScoreDetails,
  onNotifyToast,
}: VideoStudioViewProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fallbackSrc = getStudioFallbackImage(product.category);
  const [imgSrc, setImgSrc] = useState<string>(product.imageUrl || fallbackSrc);
  const [usingFallback, setUsingFallback] = useState<boolean>(!product.imageUrl);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const deep = product.deepInsights;
  const metrics = product.kalodataMetrics;
  const analysis = product.aiAnalysis;
  const videoIdeas =
    analysis?.videoIdeasPack && analysis.videoIdeasPack.concepts.length > 0
      ? analysis.videoIdeasPack
      : null;
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
  const hasAnyDeepDataInitial = Boolean(
    hasFetchedDetailsLayer ||
      hasFetchedSpecsLayer ||
      hasFetchedCommentsLayer ||
      (deep?.fetchedAt && hasAnyMetricsData)
  );

  const hasAnySavedIdeaPlan = Boolean(ideaPlans[0] || ideaPlans[1] || ideaPlans[2]);

  const [activeSubpage, setActiveSubpage] = useState<StudioSubpage>(
    () => initialSubpage ?? (videoIdeas || hasAnySavedIdeaPlan ? 'ideas' : 'data')
  );
  const [activeIdeasTab, setActiveIdeasTab] = useState<StudioIdeasTab>(
    () => initialIdeasTab ?? 'idea_0'
  );
  const [activePlanSection, setActivePlanSection] = useState<StudioIdeaPlanSection>(
    () => initialPlanSection ?? 'script'
  );

  const [isDeepPanelOpen, setIsDeepPanelOpen] = useState<boolean>(() => !hasAnyDeepDataInitial);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [enrichOpts, setEnrichOpts] = useState<ProductEnrichOptions>({
    includeDetails: !hasFetchedDetailsLayer,
    includeSpecs: false,
    includeComments: false,
    dateRange: 'last7Day',
  });

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
    setShowLeaveConfirm(false);
    setIsDeepPanelOpen(!hasAnyDeepDataInitial);
    setActiveIdeasTab(initialIdeasTab ?? 'idea_0');
    setActivePlanSection(initialPlanSection ?? 'script');
    setActiveSubpage(
      initialSubpage ?? (videoIdeas || hasAnySavedIdeaPlan ? 'ideas' : 'data')
    );
  }, [product.id]);

  useEffect(() => {
    setEnrichOpts({
      includeDetails: !Boolean(
        product.deepInsights?.description || product.deepInsights?.fetchedDetails
      ),
      includeSpecs: false,
      includeComments: false,
      dateRange: product.kalodataMetrics?.dateRange === 'last30Day' ? 'last30Day' : 'last7Day',
    });
  }, [
    product.id,
    product.deepInsights?.description,
    product.deepInsights?.fetchedDetails,
    product.deepInsights?.fetchedSpecs,
    product.deepInsights?.fetchedComments,
  ]);

  const isStudioBusy =
    generatingIdeaIndex !== null || isAnalyzingProduct || isEnrichingProduct;

  useEffect(() => {
    if (!isStudioBusy) {
      setShowLeaveConfirm(false);
    }
  }, [isStudioBusy]);

  useBackHistoryLayer(isStudioBusy, () => setShowLeaveConfirm(true), 'studio_busy_guard');

  useEffect(() => {
    const syncScrollTop = () => {
      setShowScrollTop(window.scrollY > 480);
    };
    syncScrollTop();
    window.addEventListener('scroll', syncScrollTop, { passive: true });
    return () => window.removeEventListener('scroll', syncScrollTop);
  }, []);

  const productWithV2 = useMemo(
    () =>
      ensureProductV2Intelligence(
        product,
        nowMs !== undefined ? { nowMs } : undefined
      ),
    [product, nowMs]
  );
  const searchScore = useMemo(
    () =>
      evaluateSearchOpportunityScore(
        productWithV2.validatedMetrics!,
        nowMs !== undefined ? { nowMs } : undefined
      ),
    [productWithV2, nowMs]
  );
  const studioScore = searchScore.score;
  const studioGrade: ScoreGrade =
    searchScore.grade === 'TOP'
      ? 'top'
      : searchScore.grade === 'STRONG'
        ? 'strong'
        : searchScore.grade === 'MODERATE'
          ? 'fair'
          : 'low';
  const studioGradeTextClass: Record<SearchScoreGrade, string> = {
    TOP: 'text-emerald-700 dark:text-emerald-400',
    STRONG: 'text-teal-700 dark:text-teal-400',
    MODERATE: 'text-amber-700 dark:text-amber-400',
    WEAK: 'text-rose-700 dark:text-rose-400',
    NOT_MONETIZABLE: 'text-rose-700 dark:text-rose-400',
    INSUFFICIENT: 'text-slate-600 dark:text-slate-400',
  };
  const studioGradeClass = studioGradeTextClass[searchScore.grade];

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
    onNotifyToast?.(t.studio.copied, 'neutral');
    setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 1800);
  }

  function buildSingleIdeaCopyText(concept: VideoIdeaConcept, idx: number): string {
    const vi = t.studio.videoIdeas;
    const lines = [
      `=== ${product.thaiTitle} ===`,
      `${vi.ideaTabLabel(idx + 1)}: ${concept.title[language]}`,
      `Framework: ${vi.frameworks[concept.framework]} | ${vi.awarenessLevels[concept.awarenessLevel]} | ${concept.recommendedDuration}`,
      `${vi.angleLabel}: ${concept.creativeAngle[language]}`,
      `${vi.formatLabel}: ${concept.ugcFormat[language]}`,
      `${vi.targetLabel}: ${concept.targetSegment[language]}`,
      ...(concept.kalodataBasis?.[language]
        ? [`${vi.kalodataBasisLabel}: ${concept.kalodataBasis[language]}`]
        : []),
      ...(concept.visualShootingTips?.[language]
        ? [`${vi.visualShootingTipsLabel}: ${concept.visualShootingTips[language]}`]
        : []),
      '',
      `[${vi.hookSectionLabel} — ${concept.hook3Layer.hookType[language]}]`,
      `- ${vi.visualHookLabel}: ${concept.hook3Layer.visualHook[language]}`,
      `- ${vi.verbalHookLabel}: ${concept.hook3Layer.verbalHook[language]}`,
      `- ${vi.textHookLabel}: ${concept.hook3Layer.textHook[language]}`,
      '',
      `[${vi.bridgeSectionLabel}]`,
      concept.bridgeHold[language],
      '',
      `[${vi.bodySectionLabel}]`,
      concept.bodyPlan[language],
      '',
      `[${vi.ctaSectionLabel}]`,
      concept.ctaAction[language],
      '',
      `[${vi.muteTestLabel}]`,
      concept.muteTestVisual[language],
    ];
    if (concept.extraHookVariations[language].length > 0) {
      lines.push(
        '',
        `[${vi.extraHooksLabel}]`,
        ...concept.extraHookVariations[language].map((h, i) => `${i + 1}. ${h}`)
      );
    }
    if (concept.seo) {
      lines.push(
        '',
        `[${vi.conceptSeoTitle}]`,
        `Title (TH): ${concept.seo.titleTh}`,
        `Meaning: ${concept.seo.titleMeaning[language]}`,
        `Description (TH): ${concept.seo.descriptionTh}`,
        `Meaning: ${concept.seo.descriptionMeaning[language]}`,
        `Hashtags: ${concept.seo.hashtags.join(' ')}`,
        `Keywords: ${concept.seo.keywords.join(', ')}`
      );
    }
    return lines.join('\n');
  }

  function buildSeoPackCopyText(pack: NonNullable<NonNullable<ProductAiAnalysis['videoIdeasPack']>['seoPack']>): string {
    return [
      `=== ${product.thaiTitle} — TikTok SEO Pack ===`,
      '',
      `[${t.studio.seoTitlesLabel}]`,
      ...pack.titlesTh.map((title, idx) => `${idx + 1}. ${title}`),
      `${t.studio.meaningLabel}: ${pack.titlesMeaning[language]}`,
      '',
      `[${t.studio.seoDescriptionLabel}]`,
      pack.descriptionTh,
      `${t.studio.meaningLabel}: ${pack.descriptionMeaning[language]}`,
      '',
      `[${t.studio.hashtagsLabel}]`,
      pack.hashtags.join(' '),
      '',
      `[${t.studio.keywordsLabel}]`,
      pack.keywords.join(', '),
      '',
      `[${t.studio.postingTipLabel}]`,
      pack.postingTip[language],
    ].join('\n');
  }

  function buildAnalysisCopyText(currentAnalysis: ProductAiAnalysis): string {
    const pack = currentAnalysis.videoIdeasPack;
    if (!pack) return product.thaiTitle;
    const vi = t.studio.videoIdeas;
    const lines = [
      `=== ${product.thaiTitle} ===`,
      `Product ID: ${product.id}`,
      `${vi.playbookLabel}: ${vi.playbooks[pack.playbookCategory]}`,
      pack.playbookReason[language],
      '',
      ...(pack.kalodataEvidenceSummary?.[language]
        ? [`[${vi.kalodataEvidenceLabel}]`, pack.kalodataEvidenceSummary[language], '']
        : []),
      ...(pack.summaryStrategies
        ? [
            `[${vi.summaryStrategiesTab}]`,
            `- ${vi.executiveSummaryLabel}: ${pack.summaryStrategies.executiveSummary[language]}`,
            `- ${vi.kalodataDataPlayLabel}: ${pack.summaryStrategies.kalodataDataPlay[language]}`,
            `- ${vi.creativeExecutionStrategyLabel}: ${pack.summaryStrategies.creativeExecutionStrategy[language]}`,
            `- ${vi.testingAndFunnelStrategyLabel}: ${pack.summaryStrategies.testingAndFunnelStrategy[language]}`,
            '',
          ]
        : []),
      `[${vi.briefTitle}]`,
      `- ${vi.featureLabel}: ${pack.productAnalysis.coreFeature[language]}`,
      `- ${vi.benefitLabel}: ${pack.productAnalysis.functionalBenefit[language]}`,
      `- ${vi.emotionLabel}: ${pack.productAnalysis.emotionalBenefit[language]}`,
      `- ${vi.uspLabel}: ${pack.productAnalysis.coreUsp[language]}`,
      `- ${vi.visualProofLabel}: ${pack.productAnalysis.visualProofIdea[language]}`,
      `- ${vi.audienceLabel}: ${pack.targetAudience.primaryBuyer[language]}`,
      `- ${vi.painLadderLabel}: ${pack.targetAudience.painPointLadder[language]}`,
      `- ${vi.buyerVoiceLabel}: ${pack.targetAudience.buyerVoiceInsight[language]}`,
      '',
      ...pack.concepts.flatMap((c, idx) => [
        `----------------------------------------`,
        buildSingleIdeaCopyText(c, idx),
        '',
      ]),
      ...(pack.seoPack ? [buildSeoPackCopyText(pack.seoPack), ''] : []),
      `[${vi.scalingTitle}]`,
      `${vi.iterationRoadmapLabel}: ${pack.scalingPlan.iterationRoadmap[language]}`,
      ...(pack.scalingPlan.commentMiningIdeas[language].length > 0
        ? [
            '',
            `${vi.commentMiningLabel}:`,
            ...pack.scalingPlan.commentMiningIdeas[language].map((item) => `- ${item}`),
          ]
        : []),
      ...(pack.scalingPlan.watchOuts[language].length > 0
        ? [
            '',
            `${vi.watchOutsLabel}:`,
            ...pack.scalingPlan.watchOuts[language].map((item) => `- ${item}`),
          ]
        : []),
    ];
    return lines.join('\n');
  }

  function buildFullPlanText(currentPlan: VideoAdPlan): string {
    const priceText = product.priceThb !== null ? `฿${product.priceThb}` : '—';
    const commText =
      product.commissionRate !== null
        ? `${product.commissionRate}%${
            product.commissionThb !== null ? ` (฿${product.commissionThb}/sale)` : ''
          }`
        : '—';
    const ideaLabel =
      typeof currentPlan.ideaIndex === 'number'
        ? `Video Idea ${currentPlan.ideaIndex + 1}${
            currentPlan.ideaFramework ? ` (${currentPlan.ideaFramework})` : ''
          }`
        : 'Custom Video Plan';
    const lines: string[] = [
      `=== ${product.thaiTitle} ===`,
      `Product ID: ${product.id}`,
      `Price: ${priceText} | Commission: ${commText}`,
      `Plan Target: ${ideaLabel}`,
      '',
      `[CONCEPT & PRODUCTION STRATEGY]`,
      currentPlan.conceptTitle[language],
      currentPlan.conceptSummary[language],
      `Visual Direction: ${currentPlan.visualDirection[language]}`,
      ...(currentPlan.productionStrategy?.[language]
        ? [`Production Strategy: ${currentPlan.productionStrategy[language]}`]
        : []),
      '',
      `[OPENING HOOKS (0-3s)]`,
      ...currentPlan.hooks.map(
        (h, i) =>
          `${i + 1}. ${h.title[language]}\n   Visual: ${h.visualAction[language]}\n   Thai Text: ${h.onScreenTextTh} (${h.onScreenTextMeaning[language]})`
      ),
      '',
      `[SHOT-BY-SHOT SCRIPT & STORYBOARD]`,
      ...currentPlan.storyboard.map(
        (s) =>
          `${s.timeRange} | Visual: ${s.sceneVisual[language]} | Camera: ${s.cameraMove[language]} | Audio/Voice: ${s.soundDesign[language]} | Thai Text: ${s.onScreenTextTh}`
      ),
      ...(currentPlan.masterVideoPrompt
        ? ['', `[MASTER VIDEO PROMPT (ALL-IN-ONE)]`, currentPlan.masterVideoPrompt.en]
        : []),
      '',
      `[AI VIDEO PROMPTS]`,
      ...currentPlan.aiVideoPrompts.map((p, i) => `${i + 1}. ${p.label[language]}:\n${p.prompt}`),
      '',
      `[AI IMAGE KEYFRAME PROMPTS]`,
      ...currentPlan.aiImagePrompts.map((p, i) => `${i + 1}. ${p.label[language]}:\n${p.prompt}`),
      '',
      `[TIKTOK THAILAND SEO]`,
      ...(currentPlan.seo.titlesTh?.length
        ? [`Titles (TH):\n${currentPlan.seo.titlesTh.map((tItem, i) => `${i + 1}. ${tItem}`).join('\n')}`]
        : []),
      ...(currentPlan.seo.titlesMeaning?.[language]
        ? [`Titles Meaning: ${currentPlan.seo.titlesMeaning[language]}`]
        : []),
      `Description / Caption (TH):\n${currentPlan.seo.captionTh}`,
      `Meaning: ${currentPlan.seo.captionMeaning[language]}`,
      `Hashtags: ${currentPlan.seo.hashtags.join(' ')}`,
      `Keywords: ${currentPlan.seo.keywords.join(', ')}`,
      `Posting Tip: ${currentPlan.seo.postingTip[language]}`,
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
      lines.push(`7d Growth Rate: ${formatGrowthRate(metrics.revenueGrowthRate)}`);
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

  const activeIdeaIdx: VideoIdeaIndex | null =
    activeIdeasTab === 'idea_0'
      ? 0
      : activeIdeasTab === 'idea_1'
        ? 1
        : activeIdeasTab === 'idea_2'
          ? 2
          : null;

  const activeIdea: VideoIdeaConcept | null =
    videoIdeas && activeIdeaIdx !== null && videoIdeas.concepts[activeIdeaIdx]
      ? videoIdeas.concepts[activeIdeaIdx]
      : null;

  const activeIdeaPlan: VideoAdPlan | null =
    activeIdeaIdx !== null ? ideaPlans[activeIdeaIdx] ?? null : null;
  const activeIdeaPlanError: string | null =
    activeIdeaIdx !== null ? planErrorByIdea[activeIdeaIdx] ?? null : null;
  const isGeneratingActiveIdea =
    activeIdeaIdx !== null && generatingIdeaIndex === activeIdeaIdx;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-5"
    >
      {/* Top Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            if (isStudioBusy) {
              setShowLeaveConfirm(true);
            } else {
              onBack();
            }
          }}
          className="h-9 px-2.5 -ml-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-2 transition-all active:scale-[0.98] duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>
            {returnTab === 'rank_board'
              ? t.studio.backToRankBoard
              : cameFromHistory || returnTab === 'history'
                ? t.studio.backToHistory
                : t.studio.backToResults}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onToggleSave(product)}
          aria-pressed={isSaved}
          aria-label={isSaved ? t.card.unsaveProduct : t.card.saveProduct}
          title={isSaved ? t.card.unsaveProduct : t.card.saveProduct}
          className={`h-9 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-all active:scale-[0.98] duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            isSaved
              ? 'border-teal-500/70 dark:border-teal-500/60 bg-teal-50/80 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:text-teal-700 dark:hover:text-teal-400'
          }`}
        >
          <Bookmark className="w-4 h-4 shrink-0" fill={isSaved ? 'currentColor' : 'none'} />
          <span>{isSaved ? t.card.savedTag : t.card.saveShort}</span>
        </button>
      </div>

      {/* Product Summary Strip (Image spans 2 rows on md+ so Actions + Price sit directly below Title) */}
      <div className="mt-3.5 grid grid-cols-[80px_1fr] md:grid-cols-[128px_1fr] md:grid-rows-[auto_1fr] gap-x-3 sm:gap-x-4 gap-y-2.5 items-start pb-4 border-b border-slate-200 dark:border-slate-800">
        <div
          className={`w-20 h-20 md:w-32 md:h-32 md:row-span-2 rounded-lg md:rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shrink-0 ${
            usingFallback
              ? 'bg-slate-100 dark:bg-slate-900'
              : 'bg-slate-50 dark:bg-slate-900/70 p-1.5'
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
            <span className={`font-semibold ${studioGradeClass}`}>
              <span aria-hidden="true">{searchGradeSymbol(searchScore.grade)} </span>
              {t.v2.searchScore.grades[searchScore.grade]}
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
            <span className="select-text">{product.shopName}</span>
          </div>

          <div className="mt-1 flow-root">
            <button
              type="button"
              onClick={() => onOpenScoreDetails(productWithV2)}
              title={`${t.v2.searchScore.badgeShort}: ${t.v2.searchScore.grades[searchScore.grade]} (${
                studioScore ?? '—'
              }/100) — ${t.score.tooltipBtn}`}
              aria-label={`${t.score.tooltipBtn}: ${studioScore ?? '—'}`}
              className="float-left mr-2.5 mt-[2px] inline-flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:scale-[1.04] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <ScoreRing
                score={studioScore}
                grade={studioGrade}
                size={48}
                strokeWidth={3.5}
                className="w-[44px] h-[44px] sm:w-[50px] sm:h-[50px]"
              />
            </button>

            <h1
              className={`font-display text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100 select-text ${
                language === 'my' ? 'leading-[1.5]' : 'leading-snug'
              }`}
            >
              {product.thaiTitle}
            </h1>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 md:col-start-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => copyText('prod_thai', product.thaiTitle)}
              className="h-9 sm:h-7 px-3 sm:px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
              aria-label={`Copy product ID ${product.id}`}
              className="h-9 sm:h-7 px-3 sm:px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-mono-num text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
                aria-label={t.card.openTikTokShop}
                className="h-9 sm:h-7 px-3 sm:px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-teal-700 dark:text-teal-400 hover:border-teal-500/70 dark:hover:border-teal-500/70 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
                title={
                  language === 'my' ? 'Kalodata ပစ္စည်းစာမျက်နှာဖွင့်မယ်' : 'Open Product on Kalodata'
                }
                aria-label={
                  language === 'my' ? 'Kalodata ပစ္စည်းစာမျက်နှာဖွင့်မယ်' : 'Open Product on Kalodata'
                }
                className="h-9 sm:h-7 px-3 sm:px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <span>Kalodata</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs sm:text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400 mr-1.5">{t.card.price}:</span>
              <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 mr-1.5">{t.card.commission}:</span>
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
        </div>
      </div>

      {/* Sticky Studio Subpage Navigation Bar (3 Subpages: Deep Data · Video Ideas · AI Prompt) */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] sm:top-[calc(3.75rem+env(safe-area-inset-top))] mobile-landscape-studio-sticky z-20 mt-3 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-[#F8FAFC]/95 dark:bg-[#0B1117]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div
          role="tablist"
          aria-label="Studio workspace sections"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain pl-0.5 pr-4 sm:pr-0"
        >
          {(
            [
              { key: 'data', label: t.studio.subpages.data, ready: hasAnyDeepData },
              {
                key: 'ideas',
                label: t.studio.subpages.ideas,
                ready: Boolean(videoIdeas || hasAnySavedIdeaPlan),
              },
              { key: 'prompt', label: t.studio.subpages.prompt, ready: false },
            ] as Array<{ key: StudioSubpage; label: string; ready: boolean }>
          ).map((tab) => {
            const isActive = activeSubpage === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveSubpage(tab.key);
                  if (typeof window !== 'undefined' && window.scrollY > 180) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className={`min-h-[40px] sm:min-h-[36px] px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  isActive
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 shadow-xs'
                    : 'bg-white dark:bg-[#131B24] border border-slate-200/85 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                {tab.ready && (
                  <span
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isActive ? 'bg-teal-400 dark:bg-teal-600' : 'bg-teal-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subpage 1: Optional Single-Product Kalodata Deep Enrichment Card */}
      {activeSubpage === 'data' && (
        <div className="mt-3.5 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden">
          <div className="px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <Database className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <button
                type="button"
                onClick={() => setIsDeepPanelOpen((prev) => !prev)}
                aria-expanded={isDeepPanelOpen}
                className="text-left text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                {t.studio.deepToggleTitle}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsDeepPanelOpen((prev) => !prev)}
              aria-expanded={isDeepPanelOpen}
              aria-label={isDeepPanelOpen ? t.studio.deepHideFetchBtn : t.studio.deepManageFetchBtn}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shrink-0 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <span className="hidden sm:inline">
                {isDeepPanelOpen ? t.studio.deepHideFetchBtn : t.studio.deepManageFetchBtn}
              </span>
              {isDeepPanelOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>
          </div>

          {isDeepPanelOpen && (
            <div className="px-3.5 sm:px-4 pb-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/90 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Product Details */}
                <div className="flex flex-col justify-between gap-2.5 p-3.5 sm:p-3 min-h-[48px] rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 sm:gap-2 min-w-0">
                      <input
                        id="deep-opt-details"
                        type="checkbox"
                        checked={enrichOpts.includeDetails}
                        onChange={(e) =>
                          setEnrichOpts((prev) => ({ ...prev, includeDetails: e.target.checked }))
                        }
                        className="h-5 w-5 sm:h-4 sm:w-4 accent-teal-600 shrink-0 cursor-pointer"
                      />
                      <label
                        htmlFor="deep-opt-details"
                        className="text-xs font-semibold text-slate-900 dark:text-slate-100 cursor-pointer"
                      >
                        {t.studio.deepOptDetailTitle}
                      </label>
                    </div>
                    <span className="font-mono-num text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                      ~{SINGLE_DETAIL_COST} cr
                    </span>
                  </div>
                  {enrichOpts.includeDetails && (
                    <div className="flex items-center justify-end gap-2 pl-7 sm:pl-6 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden text-[11px]">
                        <button
                          type="button"
                          onClick={() => setEnrichOpts((prev) => ({ ...prev, dateRange: 'last7Day' }))}
                          className={`h-8 sm:h-auto px-2.5 sm:px-2 py-0.5 font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                            (enrichOpts.dateRange ?? 'last7Day') === 'last7Day'
                              ? 'bg-teal-600 text-white'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {t.v2.detailTrend.detailWindow7d}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnrichOpts((prev) => ({ ...prev, dateRange: 'last30Day' }))}
                          className={`h-8 sm:h-auto px-2.5 sm:px-2 py-0.5 font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                            enrichOpts.dateRange === 'last30Day'
                              ? 'bg-teal-600 text-white'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {t.v2.detailTrend.detailWindow30d}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Selling Specs */}
                <div className="flex items-center justify-between gap-3 p-3.5 sm:p-3 min-h-[48px] rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700">
                  <div className="flex items-center gap-2.5 sm:gap-2 min-w-0">
                    <input
                      id="deep-opt-specs"
                      type="checkbox"
                      checked={enrichOpts.includeSpecs}
                      onChange={(e) =>
                        setEnrichOpts((prev) => ({ ...prev, includeSpecs: e.target.checked }))
                      }
                      className="h-5 w-5 sm:h-4 sm:w-4 accent-teal-600 shrink-0 cursor-pointer"
                    />
                    <label
                      htmlFor="deep-opt-specs"
                      className="text-xs font-semibold text-slate-900 dark:text-slate-100 cursor-pointer"
                    >
                      {t.studio.deepOptSpecsTitle}
                    </label>
                  </div>
                  <span className="font-mono-num text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                    ~{SINGLE_SPECS_COST} cr
                  </span>
                </div>

                {/* Buyer Reviews */}
                <div className="flex items-center justify-between gap-3 p-3.5 sm:p-3 min-h-[48px] rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700">
                  <div className="flex items-center gap-2.5 sm:gap-2 min-w-0">
                    <input
                      id="deep-opt-comments"
                      type="checkbox"
                      checked={enrichOpts.includeComments}
                      onChange={(e) =>
                        setEnrichOpts((prev) => ({ ...prev, includeComments: e.target.checked }))
                      }
                      className="h-5 w-5 sm:h-4 sm:w-4 accent-teal-600 shrink-0 cursor-pointer"
                    />
                    <label
                      htmlFor="deep-opt-comments"
                      className="text-xs font-semibold text-slate-900 dark:text-slate-100 cursor-pointer"
                    >
                      {t.studio.deepOptCommentsTitle}
                    </label>
                  </div>
                  <span className="font-mono-num text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                    ~{SINGLE_COMMENTS_COST} cr
                  </span>
                </div>
              </div>

              {enrichLimitWarning && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {enrichLimitWarning}
                </p>
              )}
              {enrichError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{enrichError}</p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3">
                {isOffline && (
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400 mr-auto">
                    {t.kalodata.offlineNotice}
                  </span>
                )}

                <button
                  type="button"
                  disabled={
                    isOffline ||
                    !kalodataStatus.connected ||
                    enrichEstimatedCost <= 0 ||
                    Boolean(enrichLimitWarning) ||
                    isEnrichingProduct
                  }
                  onClick={() => onFetchDeepInsights(enrichOpts)}
                  className="h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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

          {hasAnyDeepData && deep && (
            <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
              <div className="px-3.5 sm:px-4 py-2 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/90">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {t.studio.deepDataHeading}
                </span>

                <button
                  type="button"
                  onClick={() => copyText('deep_data_all', buildDeepDataCopyText())}
                  className="h-7 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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

              {(hasAnyMetricsData || (hasFetchedDetailsLayer && product.shopName)) && (
                <div className="px-3.5 sm:px-4 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 border-b border-slate-100 dark:border-slate-800/90">
                  {typeof metrics?.salesVolume7d === 'number' &&
                    Number.isFinite(metrics.salesVolume7d) && (
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

                  {typeof metrics?.revenueThb7d === 'number' &&
                    Number.isFinite(metrics.revenueThb7d) && (
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
                        </div>
                      </div>
                    )}

                  {typeof metrics?.creatorCount === 'number' &&
                    Number.isFinite(metrics.creatorCount) && (
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t.studio.deepMetricCreators}
                        </div>
                        <div className="mt-0.5 text-sm font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                          {metrics.creatorCount.toLocaleString()}
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

              {(Boolean(deep.highlights && deep.highlights.length > 0) ||
                Boolean(deep.painPoints && deep.painPoints.length > 0) ||
                Boolean(deep.usageScenarios && deep.usageScenarios.length > 0) ||
                Boolean(deep.description)) && (
                <div className="px-3.5 sm:px-4 py-3 space-y-3 text-xs">
                  {deep.highlights && deep.highlights.length > 0 && (
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {t.studio.deepHighlightsLabel}
                      </div>
                      <ul className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-slate-600 dark:text-slate-300 list-disc pl-4 leading-relaxed select-text">
                        {deep.highlights.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {hasSavedComments && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {deep.painPoints && deep.painPoints.length > 0 && (
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {t.studio.deepPainPointsLabel}
                          </div>
                          <ul className="mt-1.5 space-y-1 text-slate-600 dark:text-slate-300 list-disc pl-4 leading-relaxed select-text">
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
                          <ul className="mt-1.5 space-y-1 text-slate-600 dark:text-slate-300 list-disc pl-4 leading-relaxed select-text">
                            {deep.usageScenarios.map((u, i) => (
                              <li key={i}>{u}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {deep.description && (
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {t.studio.deepDescLabel}
                      </div>
                      <div className="mt-1.5">
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line select-text">
                          {isDescExpanded || deep.description.length <= 320
                            ? deep.description
                            : `${deep.description.slice(0, 320).trimEnd()}…`}
                        </p>
                        {deep.description.length > 320 && (
                          <button
                            type="button"
                            onClick={() => setIsDescExpanded((prev) => !prev)}
                            className="mt-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            {isDescExpanded ? t.studio.deepShowLess : t.studio.deepShowMore}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Subpage 2: AI Video Ideas + Summary Strategies + TikTok SEO Pack + Per-Idea Video Plans */}
      {activeSubpage === 'ideas' && (
        <section className="mt-3.5 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden">
          <div className="p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={isAnalyzingProduct || isOffline}
              onClick={onAnalyzeProduct}
              className={`h-10 px-4 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                videoIdeas
                  ? 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 hover:border-teal-400 dark:hover:border-teal-600 text-slate-800 dark:text-slate-100'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950'
              }`}
            >
              {isAnalyzingProduct ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : videoIdeas ? (
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {isAnalyzingProduct
                  ? t.studio.analysisRunningBtn
                  : videoIdeas
                    ? t.studio.analysisReBtn
                    : t.studio.analysisBtn}
              </span>
            </button>

            {videoIdeas && analysis && !isAnalyzingProduct && (
              <button
                type="button"
                onClick={() => copyText('full_analysis', buildAnalysisCopyText(analysis))}
                className="h-10 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
          </div>

          {isOffline && !isAnalyzingProduct && (
            <p className="px-3.5 pb-3 text-xs font-medium text-amber-700 dark:text-amber-400">
              {t.kalodata.offlineNotice}
            </p>
          )}

          {isAnalyzingProduct && (
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((slot) => (
                  <div
                    key={slot}
                    className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800/70 animate-pulse"
                  />
                ))}
              </div>
            </div>
          )}

          {!isAnalyzingProduct && analysisError && (
            <div className="p-5 border-t border-red-200/80 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-red-700 dark:text-red-300">{analysisError}</p>
              <button
                type="button"
                onClick={onAnalyzeProduct}
                className="h-9 px-3.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                {t.discover.retry}
              </button>
            </div>
          )}

          {!isAnalyzingProduct && videoIdeas && (
            <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/90">
              {/* 5-Tab Workspace Bar: Video Idea 1, 2, 3 + Summary Strategies + TikTok SEO Pack */}
              <div
                role="tablist"
                aria-label="Video Ideas Workspace"
                className="pl-4 pr-6 sm:px-5 bg-slate-50/60 dark:bg-slate-900/40 flex items-stretch gap-1 overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain"
              >
                {videoIdeas.concepts.map((concept, idx) => {
                  const tabKey = `idea_${idx}` as StudioIdeasTab;
                  const isActive = activeIdeasTab === tabKey;
                  const hasIdeaPlan = Boolean(ideaPlans[idx as VideoIdeaIndex]);
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveIdeasTab(tabKey)}
                      className={`min-h-[44px] py-2.5 px-3.5 text-left border-b-2 transition-colors whitespace-nowrap cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                        isActive
                          ? 'border-teal-600 dark:border-teal-400 text-slate-900 dark:text-white'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <span>{t.studio.videoIdeas.ideaTabLabel(idx + 1)}</span>
                        {hasIdeaPlan && (
                          <span
                            aria-label={t.studio.planReadyBadge}
                            className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0"
                          />
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 max-w-[180px] truncate">
                        {concept.creativeAngle[language]}
                      </div>
                    </button>
                  );
                })}

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeIdeasTab === 'summary'}
                  onClick={() => setActiveIdeasTab('summary')}
                  className={`min-h-[44px] py-2.5 px-3.5 text-left border-b-2 transition-colors whitespace-nowrap cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                    activeIdeasTab === 'summary'
                      ? 'border-teal-600 dark:border-teal-400 text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-semibold">
                    {t.studio.videoIdeas.summaryStrategiesTab}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 max-w-[180px] truncate">
                    {t.studio.videoIdeas.playbooks[videoIdeas.playbookCategory]}
                  </div>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeIdeasTab === 'seo'}
                  onClick={() => setActiveIdeasTab('seo')}
                  className={`min-h-[44px] py-2.5 px-3.5 text-left border-b-2 transition-colors whitespace-nowrap cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                    activeIdeasTab === 'seo'
                      ? 'border-teal-600 dark:border-teal-400 text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-semibold">{t.studio.videoIdeas.seoPackTab}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Title · Desc · #Tags
                  </div>
                </button>
              </div>

              {/* Active Video Idea 1 / 2 / 3 Tab Panel + Per-Idea Video Plan & AI Prompts */}
              {activeIdea && activeIdeaIdx !== null && (
                <div className="p-3.5 sm:p-4 space-y-4">
                  {/* Concept Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug select-text">
                        {activeIdea.title[language]}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-teal-700 dark:text-teal-400">
                          {t.studio.videoIdeas.frameworks[activeIdea.framework]}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {t.studio.videoIdeas.awarenessLevels[activeIdea.awarenessLevel]}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                          ·
                        </span>
                        <span>{activeIdea.ugcFormat[language]}</span>
                        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono-num font-medium text-slate-700 dark:text-slate-200">
                          {activeIdea.recommendedDuration}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 select-text">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {t.studio.videoIdeas.targetLabel}:
                        </span>{' '}
                        {activeIdea.targetSegment[language]}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `idea_${activeIdeaIdx}`,
                          buildSingleIdeaCopyText(activeIdea, activeIdeaIdx)
                        )
                      }
                      className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      {copiedKey === `idea_${activeIdeaIdx}` ? (
                        <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {copiedKey === `idea_${activeIdeaIdx}`
                          ? t.studio.copied
                          : t.studio.videoIdeas.copyIdeaBtn}
                      </span>
                    </button>
                  </div>

                  {/* Kalodata Basis + Visual Shooting Tips */}
                  {(activeIdea.kalodataBasis?.[language] ||
                    activeIdea.visualShootingTips?.[language]) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {activeIdea.kalodataBasis?.[language] && (
                        <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/35 p-3">
                          <div className="font-semibold text-teal-700 dark:text-teal-400">
                            {t.studio.videoIdeas.kalodataBasisLabel}
                          </div>
                          <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                            {activeIdea.kalodataBasis[language]}
                          </p>
                        </div>
                      )}
                      {activeIdea.visualShootingTips?.[language] && (
                        <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/35 p-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {t.studio.videoIdeas.visualShootingTipsLabel}
                          </div>
                          <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                            {activeIdea.visualShootingTips[language]}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Part 1: 3-Layer Hook */}
                  <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {t.studio.videoIdeas.hookSectionLabel}
                      </h4>
                      <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
                        {activeIdea.hook3Layer.hookType[language]}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
                      <div>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {t.studio.videoIdeas.visualHookLabel}
                        </div>
                        <p className="mt-1 text-slate-800 dark:text-slate-200 leading-relaxed select-text">
                          {activeIdea.hook3Layer.visualHook[language]}
                        </p>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {t.studio.videoIdeas.verbalHookLabel}
                        </div>
                        <p className="mt-1 text-slate-900 dark:text-white font-medium leading-relaxed select-text">
                          “{activeIdea.hook3Layer.verbalHook[language]}”
                        </p>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {t.studio.videoIdeas.textHookLabel}
                        </div>
                        <p className="mt-1 text-slate-800 dark:text-slate-200 font-medium leading-relaxed select-text">
                          {activeIdea.hook3Layer.textHook[language]}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Parts 2, 3, 4: Bridge -> Body -> CTA + Mute Test */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border-y border-slate-100 dark:border-slate-800/80 text-xs sm:text-sm">
                    <div className="py-3 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4">
                      <div className="sm:col-span-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t.studio.videoIdeas.bridgeSectionLabel}
                      </div>
                      <p className="sm:col-span-8 text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                        {activeIdea.bridgeHold[language]}
                      </p>
                    </div>

                    <div className="py-3 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4">
                      <div className="sm:col-span-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t.studio.videoIdeas.bodySectionLabel}
                      </div>
                      <p className="sm:col-span-8 text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                        {activeIdea.bodyPlan[language]}
                      </p>
                    </div>

                    <div className="py-3 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4">
                      <div className="sm:col-span-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t.studio.videoIdeas.ctaSectionLabel}
                      </div>
                      <p className="sm:col-span-8 text-slate-800 dark:text-slate-100 font-medium leading-relaxed select-text">
                        {activeIdea.ctaAction[language]}
                      </p>
                    </div>

                    <div className="py-3 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4">
                      <div className="sm:col-span-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t.studio.videoIdeas.muteTestLabel}
                      </div>
                      <p className="sm:col-span-8 text-slate-600 dark:text-slate-400 leading-relaxed select-text">
                        {activeIdea.muteTestVisual[language]}
                      </p>
                    </div>
                  </div>

                  {/* Extra Hook Variations */}
                  {activeIdea.extraHookVariations[language].length > 0 && (
                    <div className="space-y-2 text-xs sm:text-sm">
                      <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t.studio.videoIdeas.extraHooksLabel}
                      </h4>
                      <ol className="space-y-1.5 list-decimal pl-4 text-slate-700 dark:text-slate-300 select-text">
                        {activeIdea.extraHookVariations[language].map((hookLine, i) => (
                          <li key={i} className="leading-relaxed">
                            {hookLine}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Concept-Specific Title, Description & Hashtags (TikTok SEO) */}
                  {activeIdea.seo && (
                    <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-3.5 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                          {t.studio.videoIdeas.conceptSeoTitle}
                        </h4>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              `concept_seo_${activeIdeaIdx}`,
                              `${activeIdea.seo!.titleTh}\n\n${activeIdea.seo!.descriptionTh}\n\n${activeIdea.seo!.hashtags.join(' ')}`
                            )
                          }
                          className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          {copiedKey === `concept_seo_${activeIdeaIdx}` ? (
                            <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>
                            {copiedKey === `concept_seo_${activeIdeaIdx}`
                              ? t.studio.copied
                              : t.studio.copy}
                          </span>
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 select-text">
                            {activeIdea.seo.titleTh}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 select-text">
                            {t.studio.meaningLabel}: {activeIdea.seo.titleMeaning[language]}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed select-text">
                            {activeIdea.seo.descriptionTh}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 select-text">
                            {t.studio.meaningLabel}: {activeIdea.seo.descriptionMeaning[language]}
                          </p>
                        </div>
                        <p className="text-teal-700 dark:text-teal-400 font-medium break-words select-text">
                          {activeIdea.seo.hashtags.join(' ')}
                        </p>
                        {activeIdea.seo.keywords.length > 0 && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 select-text">
                            {t.studio.keywordsLabel}: {activeIdea.seo.keywords.join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Per-Idea Dedicated Video Plan + AI Video/Image Prompt Generator */}
                  <div
                    id={`sec-idea-plan-${activeIdeaIdx}`}
                    className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4 scroll-mt-36 sm:scroll-mt-28"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                          {t.studio.ideaPlanSectionTitle(activeIdeaIdx + 1)}
                        </h4>
                        {activeIdeaPlan && !isGeneratingActiveIdea && (
                          <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
                            · {t.studio.planReadyBadge}
                          </span>
                        )}
                      </div>

                      {activeIdeaPlan && !isGeneratingActiveIdea && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={isOffline || generatingIdeaIndex !== null}
                            onClick={() => onGenerateIdeaPlan(activeIdeaIdx, true)}
                            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-slate-700 dark:text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                            <span>{t.studio.regenerateIdeaPlanBtn}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                `full_idea_plan_${activeIdeaIdx}`,
                                buildFullPlanText(activeIdeaPlan)
                              )
                            }
                            className="h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            {copiedKey === `full_idea_plan_${activeIdeaIdx}` ? (
                              <Check className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>
                              {copiedKey === `full_idea_plan_${activeIdeaIdx}`
                                ? t.studio.copied
                                : t.studio.copyFullIdeaPlanBtn}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Generate Video Plan CTA when no plan yet for this Idea */}
                    {!activeIdeaPlan && !isGeneratingActiveIdea && !activeIdeaPlanError && (
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {t.studio.generatingIdeaPlanDesc(activeIdeaIdx + 1)}
                        </p>
                        <button
                          type="button"
                          disabled={isOffline || generatingIdeaIndex !== null}
                          onClick={() => onGenerateIdeaPlan(activeIdeaIdx, false)}
                          className="h-11 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <Sparkles className="w-4 h-4 shrink-0" />
                          <span>{t.studio.generateIdeaPlanBtn(activeIdeaIdx + 1)}</span>
                        </button>
                      </div>
                    )}

                    {/* Loading State for this Idea Plan */}
                    {isGeneratingActiveIdea && (
                      <div className="py-5 space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          <Loader2 className="w-4 h-4 animate-spin text-teal-600 dark:text-teal-400 shrink-0" />
                          <span>{t.studio.generatingIdeaPlanTitle(activeIdeaIdx + 1)}</span>
                        </div>
                        <div className="space-y-3">
                          {[1, 2, 3].map((row) => (
                            <div
                              key={row}
                              className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800/70 animate-pulse"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error State for this Idea Plan */}
                    {!isGeneratingActiveIdea && activeIdeaPlanError && (
                      <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs sm:text-sm text-red-700 dark:text-red-300">
                          {activeIdeaPlanError}
                        </p>
                        <button
                          type="button"
                          disabled={isOffline || generatingIdeaIndex !== null}
                          onClick={() => onGenerateIdeaPlan(activeIdeaIdx, true)}
                          className="h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          {t.discover.retry}
                        </button>
                      </div>
                    )}

                    {/* Generated Plan Output for Active Video Idea */}
                    {!isGeneratingActiveIdea && activeIdeaPlan && (
                      <div className="space-y-4">
                        {/* Concept & Production Strategy Overview */}
                        <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                          <h5 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 select-text">
                            {activeIdeaPlan.conceptTitle[language]}
                          </h5>
                          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                            {activeIdeaPlan.conceptSummary[language]}
                          </p>
                          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {t.studio.visualDirectionLabel}:{' '}
                              </span>
                              <span className="text-slate-600 dark:text-slate-300 select-text">
                                {activeIdeaPlan.visualDirection[language]}
                              </span>
                            </div>
                            {activeIdeaPlan.productionStrategy?.[language] && (
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {t.studio.productionStrategyLabel}:{' '}
                                </span>
                                <span className="text-slate-600 dark:text-slate-300 select-text">
                                  {activeIdeaPlan.productionStrategy[language]}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Plan Sections Sub-Tabs: Script · AI Video/Image Prompts · SEO */}
                        <div
                          role="tablist"
                          aria-label="Idea Plan Sections"
                          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain pb-1 border-b border-slate-200/70 dark:border-slate-800"
                        >
                          {(
                            [
                              { key: 'script', label: t.studio.planSubtabs.script },
                              { key: 'prompts', label: t.studio.planSubtabs.prompts },
                              { key: 'seo', label: t.studio.planSubtabs.seo },
                            ] as Array<{ key: StudioIdeaPlanSection; label: string }>
                          ).map((sec) => {
                            const isActive = activePlanSection === sec.key;
                            return (
                              <button
                                key={sec.key}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActivePlanSection(sec.key)}
                                className={`min-h-[40px] sm:min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                                  isActive
                                    ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-300/80 dark:border-teal-700/70'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent hover:border-slate-200 dark:hover:border-slate-800'
                                }`}
                              >
                                {sec.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Section A: Hooks + Shot-by-Shot Script & Storyboard */}
                        {activePlanSection === 'script' && (
                          <div id="sec-script" className="space-y-5 scroll-mt-36 sm:scroll-mt-28">
                            {activeIdeaPlan.hooks.length > 0 && (
                              <div className="space-y-2.5">
                                <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  {t.studio.sectionHooks}
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {activeIdeaPlan.hooks.map((hook, idx) => {
                                    const copyId = `plan_${activeIdeaIdx}_hook_${idx}`;
                                    const hookCopyPayload = `${hook.visualAction[language]}\nThai On-Screen Text: ${hook.onScreenTextTh}`;
                                    return (
                                      <div
                                        key={idx}
                                        className="flex flex-col p-3.5 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <h6 className="font-display text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            {idx + 1}. {hook.title[language]}
                                          </h6>
                                          <button
                                            type="button"
                                            onClick={() => copyText(copyId, hookCopyPayload)}
                                            className="h-8 px-2 rounded-md text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white inline-flex items-center gap-1 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                          >
                                            {copiedKey === copyId ? (
                                              <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5" />
                                            )}
                                            <span>
                                              {copiedKey === copyId ? t.studio.copied : t.studio.copy}
                                            </span>
                                          </button>
                                        </div>
                                        <p className="mt-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                                          {hook.visualAction[language]}
                                        </p>
                                        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
                                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                            {t.studio.onScreenThaiLabel}
                                          </div>
                                          <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 select-text">
                                            {hook.onScreenTextTh}
                                          </p>
                                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 select-text">
                                            {t.studio.meaningLabel}: {hook.onScreenTextMeaning[language]}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="space-y-2.5">
                              <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {t.studio.sectionStoryboard}
                              </h5>
                              <div className="rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden">
                                <div className="hidden md:grid grid-cols-[90px_1.5fr_1.15fr_1.15fr] gap-4 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                                  <div>{t.studio.timeCol}</div>
                                  <div>{t.studio.visualCol}</div>
                                  <div>{t.studio.audioVoiceCol}</div>
                                  <div>{t.studio.screenTextCol}</div>
                                </div>

                                <div className="divide-y divide-slate-100 dark:divide-slate-800/90">
                                  {activeIdeaPlan.storyboard.map((shot, idx) => {
                                    const shotKey = `plan_${activeIdeaIdx}_shot_${idx}`;
                                    return (
                                      <div
                                        key={idx}
                                        className="grid grid-cols-1 md:grid-cols-[90px_1.5fr_1.15fr_1.15fr] gap-2.5 md:gap-4 p-3.5 sm:p-4 text-xs sm:text-sm"
                                      >
                                        <div className="font-mono-num text-xs font-semibold text-teal-700 dark:text-teal-400">
                                          {shot.timeRange}
                                        </div>
                                        <div>
                                          <p className="text-slate-900 dark:text-slate-100 leading-relaxed select-text">
                                            {shot.sceneVisual[language]}
                                          </p>
                                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 select-text">
                                            {shot.cameraMove[language]}
                                          </p>
                                        </div>
                                        <div className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed select-text">
                                          <span className="md:hidden font-medium text-slate-500 dark:text-slate-400 mr-1.5">
                                            {t.studio.audioVoiceCol}:
                                          </span>
                                          {shot.soundDesign[language]}
                                        </div>
                                        <div>
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="font-medium text-slate-900 dark:text-slate-100 select-text">
                                              {shot.onScreenTextTh}
                                            </p>
                                            {shot.onScreenTextTh && (
                                              <button
                                                type="button"
                                                onClick={() => copyText(shotKey, shot.onScreenTextTh)}
                                                title={t.studio.copyThaiText}
                                                aria-label={t.studio.copyThaiText}
                                                className="h-8 sm:h-6 px-2 sm:px-1.5 rounded text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                              >
                                                {copiedKey === shotKey ? (
                                                  <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                                                ) : (
                                                  <Copy className="w-3 h-3" />
                                                )}
                                              </button>
                                            )}
                                          </div>
                                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 select-text">
                                            {shot.onScreenTextMeaning[language]}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Section B: AI Video Prompts & Keyframe Image Prompts */}
                        {activePlanSection === 'prompts' && (
                          <div id="sec-prompts" className="space-y-4 scroll-mt-36 sm:scroll-mt-28">
                            {activeIdeaPlan.masterVideoPrompt && (
                              <div className="p-3.5 sm:p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/25 border border-teal-500/30 dark:border-teal-500/25 space-y-2.5">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                                  <div>
                                    <h5 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                                      {t.studio.masterPromptTitle}
                                    </h5>
                                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                                      {t.studio.masterPromptSub}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyText(
                                        `master_vprompt_${activeIdeaIdx}`,
                                        activeIdeaPlan.masterVideoPrompt!.en
                                      )
                                    }
                                    className="h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 self-start cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                  >
                                    {copiedKey === `master_vprompt_${activeIdeaIdx}` ? (
                                      <Check className="w-4 h-4 text-white" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                    <span>
                                      {copiedKey === `master_vprompt_${activeIdeaIdx}`
                                        ? t.studio.copied
                                        : t.studio.copy}
                                    </span>
                                  </button>
                                </div>
                                <p className="text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed break-words select-text bg-white/80 dark:bg-[#0B1117]/80 p-3 rounded-lg border border-teal-500/20">
                                  {activeIdeaPlan.masterVideoPrompt.en}
                                </p>
                                {language === 'my' && activeIdeaPlan.masterVideoPrompt.my && (
                                  <p className="text-xs text-slate-600 dark:text-slate-400 select-text">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                      {t.studio.meaningLabel}:
                                    </span>{' '}
                                    {activeIdeaPlan.masterVideoPrompt.my}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="space-y-2.5">
                              <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                {t.studio.videoPromptsSub}
                              </h5>
                              <div className="space-y-2.5">
                                {activeIdeaPlan.aiVideoPrompts.map((item, idx) => {
                                  const key = `plan_${activeIdeaIdx}_vp_${idx}`;
                                  return (
                                    <div
                                      key={idx}
                                      className="p-3.5 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800"
                                    >
                                      <div className="flex items-center justify-between gap-3 mb-2">
                                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                                          {item.label[language]}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => copyText(key, item.prompt)}
                                          className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                        >
                                          {copiedKey === key ? (
                                            <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                          <span>
                                            {copiedKey === key ? t.studio.copied : t.studio.copy}
                                          </span>
                                        </button>
                                      </div>
                                      <p className="text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed break-words select-text">
                                        {item.prompt}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {activeIdeaPlan.aiImagePrompts.length > 0 && (
                              <div className="space-y-2.5 pt-1">
                                <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                  {t.studio.imagePromptsSub}
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {activeIdeaPlan.aiImagePrompts.map((item, idx) => {
                                    const key = `plan_${activeIdeaIdx}_ip_${idx}`;
                                    return (
                                      <div
                                        key={idx}
                                        className="p-3.5 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 flex flex-col"
                                      >
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            {item.label[language]}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => copyText(key, item.prompt)}
                                            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                          >
                                            {copiedKey === key ? (
                                              <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5" />
                                            )}
                                            <span>
                                              {copiedKey === key ? t.studio.copied : t.studio.copy}
                                            </span>
                                          </button>
                                        </div>
                                        <p className="text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed break-words select-text">
                                          {item.prompt}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section C: Per-Idea Title, Description & TikTok SEO */}
                        {activePlanSection === 'seo' && (
                          <div id="sec-seo" className="space-y-4 scroll-mt-36 sm:scroll-mt-28">
                            <div className="p-4 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 space-y-4">
                              {activeIdeaPlan.seo.titlesTh &&
                                activeIdeaPlan.seo.titlesTh.length > 0 && (
                                  <div className="space-y-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                      {t.studio.seoTitlesLabel}
                                    </h5>
                                    <div className="space-y-2">
                                      {activeIdeaPlan.seo.titlesTh.map((thTitle, i) => {
                                        const titleKey = `plan_${activeIdeaIdx}_title_${i}`;
                                        return (
                                          <div
                                            key={i}
                                            className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800"
                                          >
                                            <span className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 select-text">
                                              {i + 1}. {thTitle}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => copyText(titleKey, thTitle)}
                                              className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                            >
                                              {copiedKey === titleKey ? (
                                                <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                                              ) : (
                                                <Copy className="w-3 h-3" />
                                              )}
                                              <span>
                                                {copiedKey === titleKey
                                                  ? t.studio.copied
                                                  : t.studio.copy}
                                              </span>
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {activeIdeaPlan.seo.titlesMeaning?.[language] && (
                                      <p className="text-xs text-slate-500 dark:text-slate-400 select-text">
                                        {t.studio.meaningLabel}:{' '}
                                        {activeIdeaPlan.seo.titlesMeaning[language]}
                                      </p>
                                    )}
                                  </div>
                                )}

                              <div>
                                <div className="flex items-center justify-between gap-3">
                                  <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {t.studio.seoDescriptionLabel}
                                  </h5>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyText(
                                        `plan_${activeIdeaIdx}_caption`,
                                        `${activeIdeaPlan.seo.captionTh}\n\n${activeIdeaPlan.seo.hashtags.join(' ')}`
                                      )
                                    }
                                    className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                  >
                                    {copiedKey === `plan_${activeIdeaIdx}_caption` ? (
                                      <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      {copiedKey === `plan_${activeIdeaIdx}_caption`
                                        ? t.studio.copied
                                        : t.studio.copy}
                                    </span>
                                  </button>
                                </div>
                                <p className="mt-2 text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 whitespace-pre-line leading-relaxed select-text">
                                  {activeIdeaPlan.seo.captionTh}
                                </p>
                                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed select-text">
                                  {t.studio.meaningLabel}:{' '}
                                  {activeIdeaPlan.seo.captionMeaning[language]}
                                </p>
                              </div>

                              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between gap-3">
                                  <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {t.studio.hashtagsLabel}
                                  </h5>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyText(
                                        `plan_${activeIdeaIdx}_hashtags`,
                                        activeIdeaPlan.seo.hashtags.join(' ')
                                      )
                                    }
                                    className="h-8 px-2.5 rounded-md text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                  >
                                    {copiedKey === `plan_${activeIdeaIdx}_hashtags` ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      {copiedKey === `plan_${activeIdeaIdx}_hashtags`
                                        ? t.studio.copied
                                        : t.studio.copyAllHashtags}
                                    </span>
                                  </button>
                                </div>
                                <p className="mt-2 text-sm text-teal-700 dark:text-teal-400 leading-relaxed break-words select-text">
                                  {activeIdeaPlan.seo.hashtags.join(' ')}
                                </p>
                              </div>

                              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {t.studio.keywordsLabel}
                                  </h5>
                                  <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                                    {activeIdeaPlan.seo.keywords.join(' · ')}
                                  </p>
                                </div>
                                <div>
                                  <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {t.studio.postingTipLabel}
                                  </h5>
                                  <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                                    {activeIdeaPlan.seo.postingTip[language]}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Summary Strategies (Kalodata Deep Data Strategy + Product Brief + Scaling) */}
              {activeIdeasTab === 'summary' && (
                <div className="p-3.5 sm:p-4 space-y-4">
                  {/* Playbook & Kalodata Evidence Summary */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {t.studio.videoIdeas.playbookLabel}
                      </span>
                      <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                        {t.studio.videoIdeas.playbooks[videoIdeas.playbookCategory]}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                      {videoIdeas.playbookReason[language]}
                    </p>
                    {videoIdeas.kalodataEvidenceSummary?.[language] && (
                      <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800">
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {t.studio.videoIdeas.kalodataEvidenceLabel}
                        </div>
                        <p className="mt-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                          {videoIdeas.kalodataEvidenceSummary[language]}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 4 Detailed Summary Strategy Cards */}
                  {videoIdeas.summaryStrategies && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131B24] space-y-1.5">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {t.studio.videoIdeas.executiveSummaryLabel}
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                          {videoIdeas.summaryStrategies.executiveSummary[language]}
                        </p>
                      </div>

                      <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131B24] space-y-1.5">
                        <h4 className="text-xs sm:text-sm font-semibold text-teal-700 dark:text-teal-400">
                          {t.studio.videoIdeas.kalodataDataPlayLabel}
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                          {videoIdeas.summaryStrategies.kalodataDataPlay[language]}
                        </p>
                      </div>

                      <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131B24] space-y-1.5">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {t.studio.videoIdeas.creativeExecutionStrategyLabel}
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                          {videoIdeas.summaryStrategies.creativeExecutionStrategy[language]}
                        </p>
                      </div>

                      <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131B24] space-y-1.5">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {t.studio.videoIdeas.testingAndFunnelStrategyLabel}
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                          {videoIdeas.summaryStrategies.testingAndFunnelStrategy[language]}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Product Strategy Brief (Lessons 1–3) */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3 text-xs sm:text-sm">
                    <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {t.studio.videoIdeas.briefTitle}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {t.studio.videoIdeas.uspLabel}
                        </div>
                        <p className="mt-0.5 text-slate-800 dark:text-slate-200 select-text">
                          {videoIdeas.productAnalysis.coreUsp[language]}
                        </p>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {t.studio.videoIdeas.visualProofLabel}
                        </div>
                        <p className="mt-0.5 text-slate-800 dark:text-slate-200 select-text">
                          {videoIdeas.productAnalysis.visualProofIdea[language]}
                        </p>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {t.studio.videoIdeas.featureLabel}
                        </div>
                        <p className="mt-0.5 text-slate-700 dark:text-slate-300 select-text">
                          {videoIdeas.productAnalysis.coreFeature[language]}
                        </p>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {t.studio.videoIdeas.emotionLabel}
                        </div>
                        <p className="mt-0.5 text-slate-700 dark:text-slate-300 select-text">
                          {videoIdeas.productAnalysis.emotionalBenefit[language]}
                        </p>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {t.studio.videoIdeas.audienceLabel}
                        </div>
                        <p className="mt-0.5 text-slate-700 dark:text-slate-300 select-text">
                          {videoIdeas.targetAudience.primaryBuyer[language]}
                        </p>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {t.studio.videoIdeas.buyerVoiceLabel}
                        </div>
                        <p className="mt-0.5 text-slate-700 dark:text-slate-300 select-text">
                          {videoIdeas.targetAudience.buyerVoiceInsight[language]}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Lesson 13: Testing, Comment Mining & Scaling */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3 text-xs sm:text-sm">
                    <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {t.studio.videoIdeas.scalingTitle}
                    </h4>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {t.studio.videoIdeas.iterationRoadmapLabel}
                      </div>
                      <p className="mt-1 text-slate-800 dark:text-slate-200 leading-relaxed select-text">
                        {videoIdeas.scalingPlan.iterationRoadmap[language]}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {videoIdeas.scalingPlan.commentMiningIdeas[language].length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {t.studio.videoIdeas.commentMiningLabel}
                          </div>
                          <ul className="mt-1.5 space-y-1 list-disc pl-4 text-slate-700 dark:text-slate-300 select-text">
                            {videoIdeas.scalingPlan.commentMiningIdeas[language].map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {videoIdeas.scalingPlan.watchOuts[language].length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {t.studio.videoIdeas.watchOutsLabel}
                          </div>
                          <ul className="mt-1.5 space-y-1 list-disc pl-4 text-slate-700 dark:text-slate-300 select-text">
                            {videoIdeas.scalingPlan.watchOuts[language].map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Master TikTok Shop SEO Pack */}
              {activeIdeasTab === 'seo' && (
                <div className="p-3.5 sm:p-4 space-y-4">
                  {videoIdeas.seoPack ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                          {t.studio.videoIdeas.seoPackTitle}
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            copyText('full_seo_pack', buildSeoPackCopyText(videoIdeas.seoPack!))
                          }
                          className="h-9 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          {copiedKey === 'full_seo_pack' ? (
                            <Check className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>
                            {copiedKey === 'full_seo_pack'
                              ? t.studio.copied
                              : t.studio.videoIdeas.copySeoPackBtn}
                          </span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {t.studio.seoTitlesLabel}
                        </h4>
                        <div className="space-y-2">
                          {videoIdeas.seoPack.titlesTh.map((thTitle, idx) => {
                            const key = `pack_seo_title_${idx}`;
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800"
                              >
                                <span className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 select-text">
                                  {idx + 1}. {thTitle}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyText(key, thTitle)}
                                  className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                >
                                  {copiedKey === key ? (
                                    <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  <span>{copiedKey === key ? t.studio.copied : t.studio.copy}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 select-text">
                          {t.studio.meaningLabel}: {videoIdeas.seoPack.titlesMeaning[language]}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {t.studio.seoDescriptionLabel}
                          </h4>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                'pack_seo_desc',
                                `${videoIdeas.seoPack!.descriptionTh}\n\n${videoIdeas.seoPack!.hashtags.join(' ')}`
                              )
                            }
                            className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            {copiedKey === 'pack_seo_desc' ? (
                              <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>
                              {copiedKey === 'pack_seo_desc' ? t.studio.copied : t.studio.copy}
                            </span>
                          </button>
                        </div>
                        <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 whitespace-pre-line leading-relaxed select-text">
                          {videoIdeas.seoPack.descriptionTh}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed select-text">
                          {t.studio.meaningLabel}: {videoIdeas.seoPack.descriptionMeaning[language]}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {t.studio.hashtagsLabel}
                          </h4>
                          <button
                            type="button"
                            onClick={() =>
                              copyText('pack_seo_hashtags', videoIdeas.seoPack!.hashtags.join(' '))
                            }
                            className="h-8 px-2.5 rounded-md text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            {copiedKey === 'pack_seo_hashtags' ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {copiedKey === 'pack_seo_hashtags'
                                ? t.studio.copied
                                : t.studio.copyAllHashtags}
                            </span>
                          </button>
                        </div>
                        <p className="text-sm text-teal-700 dark:text-teal-400 leading-relaxed break-words select-text">
                          {videoIdeas.seoPack.hashtags.join(' ')}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {t.studio.keywordsLabel}
                          </h4>
                          <p className="mt-1.5 text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                            {videoIdeas.seoPack.keywords.join(' · ')}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {t.studio.postingTipLabel}
                          </h4>
                          <p className="mt-1.5 text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                            {videoIdeas.seoPack.postingTip[language]}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2">
                      <p>{t.studio.analysisStaleHint}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Subpage 3: Universal Copy Prompt for Any AI Chat */}
      {activeSubpage === 'prompt' && (
        <AiChatPromptCard product={product} t={t} onNotifyToast={onNotifyToast} />
      )}

      {/* Busy-State Back / Leave Confirmation Dialog */}
      <BottomSheet
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        historyKey="studio_leave_confirm"
        variant="dialog"
        maxWidthClass="max-w-md"
        labelledBy="leave-busy-title"
        showMobileHandle={false}
      >
        <div
          data-sheet-handle="true"
          className="px-5 pt-4 sm:pt-6 pb-3 flex items-start justify-between gap-3 touch-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <h3
              id="leave-busy-title"
              className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {t.studio.leaveBusyTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(false)}
            aria-label={t.studio.leaveStayBtn}
            className="h-10 w-10 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          data-sheet-scroll="true"
          className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6"
        >
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t.studio.leaveBusyDesc}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowLeaveConfirm(false)}
              className="h-11 sm:h-10 px-4 flex-1 sm:flex-none justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium inline-flex items-center active:scale-[0.98] transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {t.studio.leaveStayBtn}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLeaveConfirm(false);
                onBack();
              }}
              className="h-11 sm:h-10 px-4 flex-1 sm:flex-none justify-center rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <span>{t.studio.leaveConfirmBtn}</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Mobile / Tablet Floating Scroll-to-Top Action */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{ duration: 0.16 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label={t.studio.scrollToTopAria}
            title={t.studio.scrollToTopAria}
            className={`lg:hidden fixed right-4 ${
              isBottomNavHidden
                ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
                : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'
            } z-30 h-11 w-11 rounded-full bg-slate-900/90 dark:bg-slate-100/95 text-white dark:text-slate-950 shadow-lg border border-slate-800/80 dark:border-slate-300/80 backdrop-blur-sm inline-flex items-center justify-center active:scale-95 transition-[bottom,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500`}
          >
            <ChevronUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
