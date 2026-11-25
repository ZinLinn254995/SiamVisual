import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Eye, EyeOff, MessageSquareShare } from 'lucide-react';
import type { Translations } from '../i18n';
import {
  buildExternalAiChatPrompt,
  getIncludedDataInventory,
} from '../lib/aiChatPromptBuilder';
import type { ProductItem } from '../types';

interface AiChatPromptCardProps {
  product: ProductItem;
  t: Translations;
}

export function AiChatPromptCard({ product, t }: AiChatPromptCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [product.id]);

  const inventory = useMemo(() => getIncludedDataInventory(product), [product]);
  const builtPrompt = useMemo(() => buildExternalAiChatPrompt(product), [product]);

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(builtPrompt);
    } catch {
      const area = document.createElement('textarea');
      area.value = builtPrompt;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  const cp = t.studio.chatPrompt;

  return (
    <section className="mt-6 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden">
      {/* Header Row — Zero Settings, Instant Copy */}
      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <MessageSquareShare className="w-4 h-4 mt-0.5 text-teal-600 dark:text-teal-400 shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                {cp.title}
              </h2>
              <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
                {cp.compatibleTag}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              {cp.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {showPreview ? (
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Eye className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{showPreview ? cp.hidePreviewBtn : cp.previewBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPrompt}
            className="h-10 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{copied ? cp.copiedBtn : cp.copyBtn}</span>
          </button>
        </div>
      </div>

      {/* Live Snapshot Strip: Always shows the latest Kalodata data packed into the prompt */}
      <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800/90 bg-slate-50/50 dark:bg-slate-900/30 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">
          {cp.packedDataLabel}:
        </span>
        <span
          className={
            inventory.hasSalesMetrics
              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
              : 'text-slate-500 dark:text-slate-400'
          }
        >
          {t.studio.analysisSrcSales}:{' '}
          {inventory.hasSalesMetrics ? `✓ ${cp.includedShort}` : cp.notYetShort}
        </span>
        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
          ·
        </span>
        <span
          className={
            inventory.hasDetails
              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
              : 'text-slate-500 dark:text-slate-400'
          }
        >
          {t.studio.analysisSrcDetails}:{' '}
          {inventory.hasDetails ? `✓ ${cp.includedShort}` : cp.notYetShort}
        </span>
        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
          ·
        </span>
        <span
          className={
            inventory.hasSpecs
              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
              : 'text-slate-500 dark:text-slate-400'
          }
        >
          {t.studio.analysisSrcSpecs}:{' '}
          {inventory.hasSpecs ? `✓ ${cp.includedShort}` : cp.notYetShort}
        </span>
        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
          ·
        </span>
        <span
          className={
            inventory.hasReviews
              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
              : 'text-slate-500 dark:text-slate-400'
          }
        >
          {t.studio.analysisSrcReviews}:{' '}
          {inventory.hasReviews ? `✓ ${cp.includedShort}` : cp.notYetShort}
        </span>
        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
          ·
        </span>
        <span className="text-teal-700 dark:text-teal-400 font-medium">
          {cp.benchmarkDefault}
        </span>
      </div>

      {/* Optional Live Prompt Preview */}
      {showPreview && (
        <div className="p-5 border-t border-slate-100 dark:border-slate-800">
          <div className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1117] p-4 max-h-80 overflow-y-auto">
            <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed select-all">
              {builtPrompt}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
