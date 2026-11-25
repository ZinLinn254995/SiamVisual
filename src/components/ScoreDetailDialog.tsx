import { useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Translations } from '../i18n';
import type { Language, ProductItem } from '../types';
import { getEffectiveScoreBreakdown, getScoreTone, ScoreRing } from './ScoreRing';

interface ScoreDetailDialogProps {
  product: ProductItem | null;
  language: Language;
  t: Translations;
  onClose: () => void;
}

export function ScoreDetailDialog({
  product,
  language,
  t,
  onClose,
}: ScoreDetailDialogProps) {
  useEffect(() => {
    if (!product) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [product, onClose]);

  const breakdown = product ? getEffectiveScoreBreakdown(product) : null;

  const metrics = breakdown
    ? [
        {
          key: 'visualDemo',
          label: t.score.metricVisualLabel,
          desc: t.score.metricVisualDesc,
          weight: '42%',
          value: breakdown.visualDemo,
          barClass: 'bg-emerald-500 dark:bg-emerald-400',
          valueClass: 'text-emerald-700 dark:text-emerald-400',
        },
        {
          key: 'aiSuitability',
          label: t.score.metricAiLabel,
          desc: t.score.metricAiDesc,
          weight: '26%',
          value: breakdown.aiSuitability,
          barClass: 'bg-sky-500 dark:bg-sky-400',
          valueClass: 'text-sky-700 dark:text-sky-400',
        },
        {
          key: 'salesDemand',
          label: t.score.metricDemandLabel,
          desc: t.score.metricDemandDesc,
          weight: '18%',
          value: breakdown.salesDemand,
          barClass: 'bg-violet-500 dark:bg-violet-400',
          valueClass: 'text-violet-700 dark:text-violet-400',
        },
        {
          key: 'commissionValue',
          label: t.score.metricCommissionLabel,
          desc: t.score.metricCommissionDesc,
          weight: '14%',
          value: breakdown.commissionValue,
          barClass: 'bg-amber-500 dark:bg-amber-400',
          valueClass: 'text-amber-700 dark:text-amber-400',
        },
      ]
    : [];

  return (
    <AnimatePresence>
      {product && breakdown && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="score-dialog-title"
        >
          {/* Minimalist Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />

          {/* Centered Minimalist Score Details Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 shadow-xl"
          >
            {/* Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800/90">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <ScoreRing
                    score={breakdown.total}
                    grade={breakdown.grade}
                    size={64}
                    strokeWidth={4.5}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`font-semibold ${getScoreTone(breakdown.grade).labelClass}`}>
                        {t.score.grades[breakdown.grade]}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono-num">
                        {breakdown.total}/100
                      </span>
                    </div>
                    <h2
                      id="score-dialog-title"
                      className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2"
                    >
                      {product.thaiTitle}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t.score.closeBtn}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.score.dialogSubtitle}
              </p>
            </div>

            {/* Minimalist Color-Coded Progressive Bars */}
            <div className="p-5 sm:p-6 space-y-4">
              {metrics.map((metric, idx) => (
                <div key={metric.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex items-baseline gap-1.5">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {metric.label}
                      </span>
                      <span className="text-[11px] font-mono-num text-slate-400 dark:text-slate-500">
                        ({metric.weight})
                      </span>
                    </div>
                    <span className={`text-sm font-mono-num font-semibold shrink-0 ${metric.valueClass}`}>
                      {metric.value}%
                    </span>
                  </div>

                  {/* Clean Progressive Bar (compositor scaleX animation) */}
                  <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800/90 overflow-hidden">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: Math.max(0.02, Math.min(1, metric.value / 100)) }}
                      transition={{
                        duration: 0.38,
                        delay: 0.04 + idx * 0.04,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className={`h-full w-full origin-left rounded-full ${metric.barClass}`}
                    />
                  </div>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {metric.desc}
                  </p>
                </div>
              ))}

              {/* Speech-Reliance Penalty (shown transparently when > 0) */}
              {breakdown.speechPenalty > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/90">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {t.score.penaltyLabel}
                    </span>
                    <span className="text-sm font-mono-num font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                      -{breakdown.speechPenalty} {t.score.ptsUnit}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800/90 overflow-hidden">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{
                        scaleX: Math.max(0.05, Math.min(1, breakdown.speechPenalty / 20)),
                      }}
                      transition={{ duration: 0.35, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full w-full origin-left rounded-full bg-rose-500 dark:bg-rose-400"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.score.penaltyDesc}
                  </p>
                </div>
              )}

              {/* Concise Silent-Visual Summary */}
              {product.whySilentWorks[language] && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/90">
                  <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    {t.card.silentEdge}
                  </div>
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {product.whySilentWorks[language]}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 dark:border-slate-800/90 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 font-mono-num">
                <span className="text-emerald-600 dark:text-emerald-400">85+ {t.score.grades.top}</span>
                <span className="text-teal-600 dark:text-teal-400">70+ {t.score.grades.strong}</span>
                <span className="text-amber-600 dark:text-amber-400">55+ {t.score.grades.fair}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.score.closeBtn}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
