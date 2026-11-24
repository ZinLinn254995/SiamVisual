import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Translations } from '../i18n';
import { getStudioFallbackImage } from '../lib/media';
import type {
  KalodataLimitSettings,
  KalodataStatus,
  Language,
  ProductEnrichOptions,
  ProductItem,
  VideoAdPlan,
  VisualStyle,
} from '../types';
import { getEffectiveScoreBreakdown, getScoreTone, ScoreRing } from './ScoreRing';

interface VideoStudioViewProps {
  product: ProductItem;
  plan: VideoAdPlan | null;
  style: VisualStyle;
  savedStyles: VisualStyle[];
  isGenerating: boolean;
  isEnrichingProduct: boolean;
  isExplainingProduct: boolean;
  enrichError: string | null;
  error: string | null;
  cameFromHistory: boolean;
  language: Language;
  kalodataStatus: KalodataStatus;
  kalodataLimits: KalodataLimitSettings;
  t: Translations;
  onBack: () => void;
  onSelectStyle: (style: VisualStyle) => void;
  onConfirmGenerate: (forceFresh: boolean) => void;
  onFetchDeepInsights: (options: ProductEnrichOptions) => Promise<void>;
  onExplainProduct: () => void;
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

export function VideoStudioView({
  product,
  plan,
  style,
  savedStyles,
  isGenerating,
  isEnrichingProduct,
  isExplainingProduct,
  enrichError,
  error,
  cameFromHistory,
  language,
  kalodataStatus,
  kalodataLimits,
  t,
  onBack,
  onSelectStyle,
  onConfirmGenerate,
  onFetchDeepInsights,
  onExplainProduct,
  onOpenScoreDetails,
}: VideoStudioViewProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fallbackSrc = getStudioFallbackImage(product.category);
  const [imgSrc, setImgSrc] = useState<string>(product.imageUrl || fallbackSrc);
  const [usingFallback, setUsingFallback] = useState<boolean>(!product.imageUrl);
  const [confirmMode, setConfirmMode] = useState<'generate' | 'regenerate' | null>(null);

  const deep = product.deepInsights;
  const hasSavedDetails = Boolean(deep?.description);
  const hasSavedSpecs = Boolean(deep?.highlights && deep.highlights.length > 0);
  const hasSavedComments = Boolean(
    (deep?.painPoints && deep.painPoints.length > 0) ||
      (deep?.usageScenarios && deep.usageScenarios.length > 0)
  );

  // Choice (ခ): Optional Single-Product Kalodata Deep Enrichment controls
  const [isDeepPanelOpen, setIsDeepPanelOpen] = useState(false);
  const [enrichOpts, setEnrichOpts] = useState<ProductEnrichOptions>({
    includeDetails: !hasSavedDetails,
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
    setEnrichOpts({
      includeDetails: !Boolean(product.deepInsights?.description),
      includeSpecs: false,
      includeComments: false,
    });
  }, [product.id, product.deepInsights?.description]);

  // Close confirmation dialog cleanly on Escape
  useEffect(() => {
    if (!confirmMode) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setConfirmMode(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirmMode]);

  const score = getEffectiveScoreBreakdown(product);
  const scoreTone = getScoreTone(score.grade);
  const isAiExplained = product.aiEnriched === true && Boolean(product.whatItIs[language]);

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

  const hasAnyDeepData = Boolean(hasSavedDetails || hasSavedSpecs || hasSavedComments);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-5xl mx-auto px-4 sm:px-6 py-7 sm:py-10"
    >
      {/* Top Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="h-10 px-3 -ml-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>{cameFromHistory ? t.studio.backToHistory : t.studio.backToResults}</span>
        </button>

        {plan && !isGenerating && (
          <div className="flex items-center gap-2.5">
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

      {/* Product Summary Strip */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start pb-7 border-b border-slate-200 dark:border-slate-800">
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
            <span className={`font-medium ${scoreTone.labelClass}`}>
              {t.score.grades[score.grade]}
            </span>
            <span aria-hidden="true">·</span>
            <span>{product.categoryLabel[language]}</span>
            <span aria-hidden="true">·</span>
            <span>{product.shopName}</span>
            <span aria-hidden="true">·</span>
            <span className="text-teal-700 dark:text-teal-400 font-medium">
              {t.studio.noSpeechNote}
            </span>
          </div>

          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug min-w-0 flex-1">
              {isAiExplained ? product.clearTitle[language] : product.thaiTitle}
            </h1>

            <button
              type="button"
              onClick={() => onOpenScoreDetails(product)}
              title={`${t.score.grades[score.grade]} (${score.total}/100) — ${t.score.tooltipBtn}`}
              aria-label={`${t.score.tooltipBtn}: ${score.total}/100`}
              className="group/score inline-flex items-center gap-1 rounded-xl p-1 -mt-1 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <ScoreRing
                score={score.total}
                grade={score.grade}
                size={48}
                strokeWidth={3.5}
              />
              <span
                className="inline-flex items-center justify-center h-6 w-6 rounded-md text-slate-400 group-hover/score:text-teal-600 dark:group-hover/score:text-teal-400 transition-colors"
                aria-hidden="true"
              >
                <Info className="w-4 h-4" />
              </span>
            </button>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {isAiExplained && (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {product.thaiTitle}
              </p>
            )}
            <button
              type="button"
              onClick={() => copyText('prod_thai', product.thaiTitle)}
              className="h-6 px-2 rounded border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 hover:border-slate-300 inline-flex items-center gap-1 cursor-pointer"
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
              className="h-6 px-2 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-mono-num text-slate-600 dark:text-slate-300 hover:border-slate-300 inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'prod_id' ? (
                <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              ) : (
                <span>ID: {product.id.slice(0, 12)}</span>
              )}
            </button>
          </div>

          {isAiExplained ? (
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl">
              {product.whatItIs[language]}
            </p>
          ) : (
            <div className="mt-3">
              <button
                type="button"
                disabled={isExplainingProduct}
                onClick={onExplainProduct}
                className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 hover:border-teal-400 dark:hover:border-teal-600 text-slate-700 dark:text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isExplainingProduct ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                )}
                <span>{isExplainingProduct ? t.card.explainingAiBtn : t.card.explainAiBtn}</span>
              </button>
            </div>
          )}

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

          {/* Interactive Visual Style Selector (Select Only — Never Auto-Generates!) */}
          <div className="mt-5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              {t.studio.styleLabel}
            </div>
            <div className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              {STYLE_OPTIONS.map((option) => {
                const active = option === style;
                const hasSaved = savedStyles.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => onSelectStyle(option)}
                    className={`h-9 px-3.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap cursor-pointer disabled:opacity-60 ${
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
        </div>
      </div>

      {/* Choice (ခ): Optional Single-Product Kalodata Deep Enrichment Card */}
      <div className="mt-6 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsDeepPanelOpen((prev) => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors cursor-pointer"
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
          {isDeepPanelOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

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
                      {hasSavedDetails && (
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
                      {hasSavedSpecs && (
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
                      {hasSavedComments && (
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
                className="h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                {isEnrichingProduct
                  ? t.studio.deepFetchingBtn
                  : t.studio.deepFetchBtn(enrichEstimatedCost)}
              </button>
            </div>

            {/* Display permanently stored Deep Insights cleanly when present */}
            {hasAnyDeepData && deep && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
                <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ {t.studio.deepSavedStorageNote}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {deep.highlights && deep.highlights.length > 0 && (
                    <div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {t.studio.deepHighlightsLabel}
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                        {deep.highlights.join(' · ')}
                      </p>
                    </div>
                  )}
                  {deep.painPoints && deep.painPoints.length > 0 && (
                    <div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {t.studio.deepPainPointsLabel}
                      </div>
                      <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-400 list-disc pl-4">
                        {deep.painPoints.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {deep.usageScenarios && deep.usageScenarios.length > 0 && (
                    <div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {t.studio.deepUsageLabel}
                      </div>
                      <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-400 list-disc pl-4">
                        {deep.usageScenarios.map((u, i) => (
                          <li key={i}>{u}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {deep.description && (
                    <div className="md:col-span-2">
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {t.studio.deepDescLabel}
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                        {deep.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Ready-to-Generate Prompt (Never Auto-Generates on Entry or Style Change!) */}
      {!isGenerating && !plan && !error && (
        <div className="mt-7 p-6 sm:p-8 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 text-center max-w-xl mx-auto">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.studio.readyTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.studio.readyDesc}
          </p>
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
        <div className="py-12 space-y-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.studio.generatingTitle}
            </h2>
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
        <div className="mt-8 p-6 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30">
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
          className="mt-7 space-y-12"
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
          <section id="sec-concept" className="space-y-3 scroll-mt-20">
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
          <section id="sec-hooks" className="space-y-4 scroll-mt-20">
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
          <section id="sec-script" className="space-y-4 scroll-mt-20">
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
          <section id="sec-prompts" className="space-y-5 scroll-mt-20">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.studio.sectionPrompts}
            </h2>

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
                      <p className="text-xs sm:text-sm font-mono text-slate-700 dark:text-slate-300 leading-relaxed select-all">
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
                        <p className="text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed select-all">
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
          <section id="sec-seo" className="space-y-4 scroll-mt-20">
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
              className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 shadow-xl p-5 sm:p-6"
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

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmMode(null)}
                  className="h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer"
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
                  className="h-10 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
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
