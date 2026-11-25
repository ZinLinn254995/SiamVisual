import { useEffect, useState } from 'react';
import { ArrowRight, Bookmark, Check, Copy, ExternalLink } from 'lucide-react';
import type { Translations } from '../i18n';
import { translateCategoryNameToMyanmar } from '../lib/categoryTranslations';
import { getStudioFallbackImage } from '../lib/media';
import { getTikTokShopProductUrl } from '../lib/tiktokLink';
import type { CardDensity, Language, ProductItem, ResultViewMode } from '../types';
import { getEffectiveScoreBreakdown, getScoreTone, ScoreRing } from './ScoreRing';

interface ProductCardProps {
  product: ProductItem;
  index: number;
  language: Language;
  isSaved: boolean;
  viewMode?: ResultViewMode;
  density?: CardDensity;
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

export function ProductCard({
  product,
  index,
  language,
  isSaved,
  viewMode = 'grid',
  density = 'standard',
  t,
  onSelect,
  onToggleSave,
  onOpenScoreDetails,
}: ProductCardProps) {
  const fallbackSrc = getStudioFallbackImage(product.category);
  const [imgSrc, setImgSrc] = useState<string>(product.imageUrl || fallbackSrc);
  const [usingFallback, setUsingFallback] = useState<boolean>(!product.imageUrl);
  const [copiedField, setCopiedField] = useState<'thai' | 'id' | null>(null);

  const score = getEffectiveScoreBreakdown(product);
  const scoreTone = getScoreTone(score.grade);
  const analysis = product.aiAnalysis;
  const metrics = product.kalodataMetrics;
  const tiktokShopUrl = getTikTokShopProductUrl(product);

  const hasSavedDeepData = Boolean(
    product.deepInsights?.description?.trim() ||
      (product.deepInsights?.highlights && product.deepInsights.highlights.length > 0) ||
      (product.deepInsights?.painPoints && product.deepInsights.painPoints.length > 0) ||
      (product.deepInsights?.usageScenarios && product.deepInsights.usageScenarios.length > 0)
  );

  // Always preserve the original product name (do not replace with translated AI analysis name)
  const primaryTitle = product.thaiTitle;
  const isTitleDecoded = false;

  // Ensure Category label always renders in Myanmar when Myanmar mode is active
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

  const decisionToneClass =
    analysis?.decision === 'strong_go'
      ? 'text-emerald-700 dark:text-emerald-400'
      : analysis?.decision === 'need_more_data'
        ? 'text-rose-700 dark:text-rose-400'
        : 'text-amber-700 dark:text-amber-400';

  // Keep image synced cleanly when product list updates
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

  // Single quiet secondary status label (saved state is shown directly by the Bookmark icon)
  const studioStatusLabel = analysis
    ? t.card.analyzedTag
    : hasSavedDeepData
      ? t.card.deepDataTag
      : null;

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

  const commissionText =
    product.commissionRate !== null
      ? `${product.commissionRate}%${
          product.commissionThb !== null ? ` · ฿${product.commissionThb.toLocaleString()}` : ''
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

  // =========================================================================
  // LIST VIEW — 3 Zoom Levels (Micro: Image + Name | Compact | Detailed)
  // =========================================================================
  if (viewMode === 'list') {
    // List Level 0 (Smallest): Product Thumbnail + Product Name + minimized Save icon
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

    // List Level 1 (Compact): medium thumbnail + title + core price/commission + score ring
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
                {studioStatusLabel && (
                  <>
                    <span aria-hidden="true" className="hidden sm:inline">
                      ·
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium shrink-0">
                      <span>{studioStatusLabel}</span>
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

              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono-num">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
                </span>
                <span className="text-teal-700 dark:text-teal-400 font-semibold">
                  {commissionText}
                </span>
                {hasAnySalesRow && (
                  <span className="hidden sm:inline text-slate-500 dark:text-slate-400">
                    {salesVolText} · {revenueText}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {renderSaveIconButton('regular')}

              {tiktokShopUrl && (
                <a
                  href={tiktokShopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t.card.openTikTokShop}
                  aria-label={`${t.card.openTikTokShop}: ${primaryTitle}`}
                  className="hidden sm:inline-flex h-7 px-2 rounded-md text-[11px] font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 items-center gap-1 transition-colors"
                >
                  <span>Shop</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              )}

              <button
                type="button"
                onClick={() => onOpenScoreDetails(product)}
                title={`${t.score.grades[score.grade]} (${score.total}/100) — ${t.score.tooltipBtn}`}
                aria-label={`${t.score.tooltipBtn}: ${score.total}/100`}
                className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
              >
                <ScoreRing score={score.total} grade={score.grade} size={34} strokeWidth={3} />
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

    // List Level 2 (Detailed / Full): complete horizontal analytics row
    return (
      <article className="group flex flex-row items-stretch bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden transition-colors duration-150 hover:border-slate-300 dark:hover:border-slate-700">
        {/* Left Studio Thumbnail */}
        <button
          type="button"
          onClick={() => onSelect(product)}
          aria-label={`${primaryTitle} — ${t.card.createPlan}`}
          className={`relative w-24 sm:w-36 md:w-44 shrink-0 overflow-hidden border-r border-slate-100 dark:border-slate-800/80 block text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
            usingFallback
              ? 'bg-slate-100 dark:bg-slate-900'
              : 'bg-slate-50 dark:bg-slate-900/70 p-1.5 sm:p-2.5'
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

        {/* Center Info & Inline Metrics */}
        <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between gap-2">
          <div>
            {/* Metadata + Mobile Score */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                  <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                    #{index + 1}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={`font-medium shrink-0 ${scoreTone.labelClass}`}>
                    {t.score.grades[score.grade]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate" title={displayCategoryLabel}>
                    {displayCategoryLabel}
                  </span>
                  {studioStatusLabel && (
                    <>
                      <span aria-hidden="true" className="hidden md:inline">
                        ·
                      </span>
                      <span className="hidden md:inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium whitespace-nowrap shrink-0">
                        <span>{studioStatusLabel}</span>
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

                {/* Mobile Compact Score Ring */}
                <button
                  type="button"
                  onClick={() => onOpenScoreDetails(product)}
                  title={`${t.score.grades[score.grade]} (${score.total}/100) — ${t.score.tooltipBtn}`}
                  aria-label={`${t.score.tooltipBtn}: ${score.total}/100`}
                  className="sm:hidden inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 shrink-0 cursor-pointer"
                >
                  <ScoreRing score={score.total} grade={score.grade} size={36} strokeWidth={3} />
                </button>
              </div>
            </div>

            {/* Shop Name + Minimized Utilities */}
            <div className="mt-1 flex items-center justify-between gap-2">
              <p
                className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1"
                title={isTitleDecoded ? `${product.shopName} · ${product.thaiTitle}` : product.shopName}
              >
                {product.shopName}
              </p>
              {renderUtilityButtons(false)}
            </div>

            {/* Saved AI Analysis 1-Line Summary */}
            {analysis && (
              <div className="hidden sm:flex items-baseline gap-2 mt-2 text-xs">
                <span className={`font-semibold shrink-0 ${decisionToneClass}`}>
                  {t.studio.analysisDecisions[analysis.decision]}
                </span>
                {analysis.bottomLine[language] && (
                  <p className="text-slate-600 dark:text-slate-300 truncate min-w-0">
                    {analysis.bottomLine[language]}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Horizontal Tabular Metrics + Mobile CTA */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-baseline gap-x-4 sm:gap-x-6 gap-y-1.5">
              <div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                  {t.card.price}
                </div>
                <div className="text-xs sm:text-sm font-semibold font-mono-num text-slate-900 dark:text-slate-100">
                  {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
                </div>
              </div>

              <div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                  {t.card.commission}
                </div>
                <div className="text-xs sm:text-sm font-semibold font-mono-num text-teal-700 dark:text-teal-400">
                  {commissionText}
                </div>
              </div>

              {hasAnySalesRow && (
                <>
                  <div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                      {t.card.sales7d}
                    </div>
                    <div className="text-xs font-semibold font-mono-num text-slate-800 dark:text-slate-200">
                      {salesVolText}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                      {hasVideoRev ? t.card.videoRev7d : t.card.revenue7d}
                    </div>
                    <div className="text-xs font-semibold font-mono-num text-slate-800 dark:text-slate-200">
                      {revenueText}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Inline Compact CTA */}
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
        <div className="hidden sm:flex flex-col items-end justify-between gap-3 w-44 md:w-48 shrink-0 p-4 border-l border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/20">
          <div className="w-full flex items-center justify-between gap-2">
            <div className="min-w-0">
              {studioStatusLabel && (
                <div className="inline-flex md:hidden items-center gap-1 text-[11px] text-teal-700 dark:text-teal-400 font-medium truncate">
                  <span className="truncate">{studioStatusLabel}</span>
                </div>
              )}
              <div className={`text-[11px] font-medium ${scoreTone.labelClass}`}>
                {t.score.grades[score.grade]}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                {score.total}/100
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenScoreDetails(product)}
              title={`${t.score.grades[score.grade]} (${score.total}/100) — ${t.score.tooltipBtn}`}
              aria-label={`${t.score.tooltipBtn}: ${score.total}/100`}
              className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:scale-[1.04] transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <ScoreRing score={score.total} grade={score.grade} size={42} strokeWidth={3.5} />
            </button>
          </div>

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
  // GRID VIEW — Smallest Gallery Zoom Level (Micro: Image + Product Name + Save Icon)
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

  const bodyPaddingClass = isSpacious ? 'p-5 sm:p-6' : isCompact ? 'p-3 sm:p-3.5' : 'p-5';

  return (
    <article className="group flex flex-col bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700">
      {/* Clickable Clean Studio Product Frame */}
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

      {/* Essential Product Details Grounded Strictly in Kalodata & Studio State */}
      <div className={`flex flex-col flex-1 ${bodyPaddingClass}`}>
        {/* Clean unboxed inline metadata with rank, score tier & localized category */}
        <div
          className={`flex items-center justify-between gap-1.5 text-slate-500 dark:text-slate-400 ${
            isCompact ? 'text-[11px]' : 'text-xs'
          }`}
        >
          <div className="flex items-center gap-1 min-w-0 truncate">
            <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
              #{index + 1}
            </span>
            {!isCompact && (
              <>
                <span aria-hidden="true">·</span>
                <span className={`font-medium shrink-0 ${scoreTone.labelClass}`}>
                  {t.score.grades[score.grade]}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="truncate" title={displayCategoryLabel}>
              {displayCategoryLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 -mr-1">
            {studioStatusLabel && (
              <span className="inline-flex items-center text-teal-700 dark:text-teal-400 font-medium whitespace-nowrap shrink-0">
                <span className={isCompact ? 'hidden sm:inline' : 'inline'}>
                  {studioStatusLabel}
                </span>
              </span>
            )}
            {renderSaveIconButton('compact')}
          </div>
        </div>

        {/* Title + Direct Clickable Score Circle */}
        <div
          className={`${isCompact ? 'mt-1.5 gap-2' : 'mt-2.5 gap-3'} flex items-start justify-between`}
        >
          <button
            type="button"
            onClick={() => onSelect(product)}
            className="text-left min-w-0 flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            <h3
              className={`font-display font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors leading-snug line-clamp-2 ${
                isSpacious
                  ? 'text-base sm:text-lg'
                  : isCompact
                    ? 'text-xs sm:text-sm'
                    : 'text-base'
              }`}
            >
              {primaryTitle}
            </h3>
          </button>

          <button
            type="button"
            onClick={() => onOpenScoreDetails(product)}
            title={`${t.score.grades[score.grade]} (${score.total}/100) — ${t.score.tooltipBtn}`}
            aria-label={`${t.score.tooltipBtn}: ${score.total}/100`}
            className="inline-flex items-center justify-center rounded-full p-0.5 -mt-0.5 -mr-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:scale-[1.04] transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <ScoreRing
              score={score.total}
              grade={score.grade}
              size={isSpacious ? 48 : isCompact ? 34 : 44}
              strokeWidth={isCompact ? 3 : 3.5}
            />
          </button>
        </div>

        {/* Shop Name + Quick Copy TH / ID + Minimized Shop Link */}
        <div
          className={`${
            isCompact ? 'mt-1.5 flex-wrap gap-y-1' : 'mt-1.5'
          } flex items-center justify-between gap-1.5`}
        >
          <p
            className={`${
              isCompact ? 'text-[11px]' : 'text-xs'
            } text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1`}
            title={isTitleDecoded ? `${product.shopName} · ${product.thaiTitle}` : product.shopName}
          >
            {product.shopName}
          </p>
          {renderUtilityButtons(isCompact)}
        </div>

        {/* Saved AI Product Analysis Verdict Preview (shown ONLY if user already analyzed in Studio) */}
        {analysis && !isCompact && (
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
            <div className={`text-[11px] font-semibold ${decisionToneClass}`}>
              {t.studio.analysisDecisions[analysis.decision]}
            </div>
            {analysis.bottomLine[language] && (
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                {analysis.bottomLine[language]}
              </p>
            )}
          </div>
        )}

        {/* Bottom Honest Kalodata Metrics & Studio CTA */}
        <div className={`mt-auto ${isCompact ? 'pt-2.5' : 'pt-4'}`}>
          {isSpacious && hasAnySalesRow ? (
            /* Spacious 2-col desktop: clean 4-column horizontal KPI bar */
            <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/90 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.card.price}</div>
                <div className="mt-0.5 text-base font-semibold font-mono-num text-slate-900 dark:text-slate-100">
                  {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.card.commission}
                </div>
                <div className="mt-0.5 text-sm font-semibold font-mono-num text-teal-700 dark:text-teal-400">
                  {commissionText}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.card.sales7d}
                </div>
                <div className="mt-0.5 text-sm font-semibold font-mono-num text-slate-800 dark:text-slate-200">
                  {salesVolText}
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {hasVideoRev ? t.card.videoRev7d : t.card.revenue7d}
                </div>
                <div className="mt-0.5 text-sm font-semibold font-mono-num text-slate-800 dark:text-slate-200">
                  {revenueText}
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`border-t border-slate-100 dark:border-slate-800/90 ${
                isCompact ? 'pt-2.5 space-y-2' : 'pt-3.5 space-y-3'
              }`}
            >
              {/* Row 1: Price & Affiliate Commission */}
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
                    className={`mt-0.5 font-semibold font-mono-num text-slate-900 dark:text-slate-100 ${
                      isCompact ? 'text-xs sm:text-sm' : 'text-base'
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
                    className={`mt-0.5 font-semibold font-mono-num text-teal-700 dark:text-teal-400 truncate ${
                      isCompact ? 'text-[11px] sm:text-xs' : 'text-sm'
                    }`}
                  >
                    {isCompact && product.commissionRate !== null
                      ? `${product.commissionRate}%${
                          product.commissionThb !== null
                            ? ` · ฿${Math.round(product.commissionThb).toLocaleString()}`
                            : ''
                        }`
                      : commissionText}
                  </div>
                </div>
              </div>

              {/* Row 2: Live Kalodata 7-Day Sales & Video/Total Revenue */}
              {hasAnySalesRow && (
                <div
                  className={`${
                    isCompact ? 'pt-1.5' : 'pt-2.5'
                  } border-t border-slate-100/90 dark:border-slate-800/70 flex items-baseline justify-between gap-2`}
                >
                  <div className="min-w-0">
                    <div
                      className={`${
                        isCompact ? 'text-[10px]' : 'text-[11px]'
                      } text-slate-500 dark:text-slate-400`}
                    >
                      {t.card.sales7d}
                    </div>
                    <div
                      className={`mt-0.5 font-semibold font-mono-num text-slate-800 dark:text-slate-200 ${
                        isCompact ? 'text-[11px]' : 'text-xs'
                      }`}
                    >
                      {salesVolText}
                    </div>
                  </div>

                  <div className="text-right min-w-0">
                    <div
                      className={`${
                        isCompact ? 'text-[10px]' : 'text-[11px]'
                      } text-slate-500 dark:text-slate-400`}
                    >
                      {hasVideoRev ? t.card.videoRev7d : t.card.revenue7d}
                    </div>
                    <div
                      className={`mt-0.5 font-semibold font-mono-num text-slate-800 dark:text-slate-200 ${
                        isCompact ? 'text-[11px]' : 'text-xs'
                      }`}
                    >
                      {revenueText}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => onSelect(product)}
            className={`w-full rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#131B24] ${
              isCompact ? 'mt-3 h-9 px-2.5 text-xs' : 'mt-4 h-11 px-4 text-sm'
            }`}
          >
            <span className={isCompact ? 'sm:hidden truncate' : 'hidden'}>
              {t.discover.openStudioShort}
            </span>
            <span className={isCompact ? 'hidden sm:inline truncate' : 'truncate'}>
              {t.card.createPlan}
            </span>
            <ArrowRight className={isCompact ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'} />
          </button>
        </div>
      </div>
    </article>
  );
}
