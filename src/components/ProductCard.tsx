import { useEffect, useState } from 'react';
import { ArrowRight, BookmarkCheck, Check, Copy, Info, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { Translations } from '../i18n';
import { getStudioFallbackImage } from '../lib/media';
import type { Language, ProductItem } from '../types';
import { getEffectiveScoreBreakdown, getScoreTone, ScoreRing } from './ScoreRing';

interface ProductCardProps {
  product: ProductItem;
  index: number;
  language: Language;
  isSaved: boolean;
  isExplaining: boolean;
  t: Translations;
  onSelect: (product: ProductItem) => void;
  onOpenScoreDetails: (product: ProductItem) => void;
  onExplainSingle: (product: ProductItem) => void;
}

export function ProductCard({
  product,
  index,
  language,
  isSaved,
  isExplaining,
  t,
  onSelect,
  onOpenScoreDetails,
  onExplainSingle,
}: ProductCardProps) {
  const fallbackSrc = getStudioFallbackImage(product.category);
  const [imgSrc, setImgSrc] = useState<string>(product.imageUrl || fallbackSrc);
  const [usingFallback, setUsingFallback] = useState<boolean>(!product.imageUrl);
  const [copiedField, setCopiedField] = useState<'thai' | 'id' | null>(null);

  const score = getEffectiveScoreBreakdown(product);
  const scoreTone = getScoreTone(score.grade);
  const isAiExplained = product.aiEnriched === true && Boolean(product.whatItIs[language]);

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

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.22,
        delay: Math.min(index * 0.03, 0.16),
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group flex flex-col bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700"
    >
      {/* Clean Studio Product Frame (real TikTok product photos use object-contain so packaging never gets cropped) */}
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden border-b border-slate-100 dark:border-slate-800/80 ${
          usingFallback
            ? 'bg-slate-100 dark:bg-slate-900'
            : 'bg-slate-50 dark:bg-slate-900/70 p-2'
        }`}
      >
        <img
          src={imgSrc}
          alt={product.clearTitle[language]}
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
      </div>

      {/* Essential Clear Product Details */}
      <div className="flex flex-col flex-1 p-5">
        {/* Clean unboxed inline metadata with rank + color-coded tier label */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
              #{index + 1}
            </span>
            <span aria-hidden="true">·</span>
            <span className={`font-medium shrink-0 ${scoreTone.labelClass}`}>
              {t.score.grades[score.grade]}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{product.categoryLabel[language]}</span>
          </div>
          {isSaved && (
            <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium whitespace-nowrap shrink-0">
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>{t.card.savedTag}</span>
            </span>
          )}
        </div>

        {/* Title + Always-Visible Color-Coded Circular Progress Ring & Tooltip Button */}
        <div className="mt-2.5 flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug min-w-0 flex-1 line-clamp-3">
            {isAiExplained ? product.clearTitle[language] : product.thaiTitle}
          </h3>

          <button
            type="button"
            onClick={() => onOpenScoreDetails(product)}
            title={`${t.score.grades[score.grade]} (${score.total}/100) — ${t.score.tooltipBtn}`}
            aria-label={`${t.score.tooltipBtn}: ${score.total}/100`}
            className="group/score inline-flex items-center gap-0.5 rounded-xl p-0.5 -mt-0.5 -mr-0.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <ScoreRing
              score={score.total}
              grade={score.grade}
              size={44}
              strokeWidth={3.5}
            />
            <span
              className="inline-flex items-center justify-center h-6 w-6 rounded-md text-slate-400 group-hover/score:text-teal-600 dark:group-hover/score:text-teal-400 transition-colors"
              aria-hidden="true"
            >
              <Info className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>

        {/* Original Thai Product Name / Shop + Quick Copy Actions */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p
            className="text-xs text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1"
            title={isAiExplained ? product.thaiTitle : product.shopName}
          >
            {isAiExplained ? product.thaiTitle : product.shopName}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleCopy('thai', product.thaiTitle)}
              title={t.card.copyThai}
              className="h-6 px-1.5 rounded text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedField === 'thai' ? (
                <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedField === 'thai' ? t.card.copiedShort : 'TH'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopy('id', product.id)}
              title={`${t.card.copyId}: ${product.id}`}
              className="h-6 px-1.5 rounded text-[11px] font-mono-num font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedField === 'id' ? (
                <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              ) : (
                <span>ID</span>
              )}
            </button>
          </div>
        </div>

        {/* Manual AI Explanation Area (only populated when user clicks AI Explain) */}
        {isAiExplained ? (
          <>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {product.whatItIs[language]}
            </p>
            {product.whySilentWorks[language] && (
              <p className="mt-2 text-xs text-teal-700 dark:text-teal-400 leading-relaxed">
                {t.card.silentEdge}: {product.whySilentWorks[language]}
              </p>
            )}
          </>
        ) : (
          <div className="mt-3">
            <button
              type="button"
              disabled={isExplaining}
              onClick={() => onExplainSingle(product)}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 hover:border-teal-400 dark:hover:border-teal-600 text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isExplaining ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
              )}
              <span>{isExplaining ? t.card.explainingAiBtn : t.card.explainAiBtn}</span>
            </button>
          </div>
        )}

        {/* Bottom Honest Price, Commission & Primary CTA */}
        <div className="mt-auto pt-4">
          <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/90 flex items-baseline justify-between gap-4">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.card.price}
              </div>
              <div className="mt-0.5 text-base font-semibold font-mono-num text-slate-900 dark:text-slate-100">
                {product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '—'}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.card.commission}
              </div>
              <div className="mt-0.5 text-sm font-semibold font-mono-num text-teal-700 dark:text-teal-400">
                {product.commissionRate !== null
                  ? `${product.commissionRate}%${
                      product.commissionThb !== null
                        ? ` · ฿${product.commissionThb.toLocaleString()}`
                        : ''
                    }`
                  : '—'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelect(product)}
            className="mt-4 w-full h-11 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#131B24]"
          >
            <span>{isSaved ? t.card.openSavedPlan : t.card.createPlan}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
