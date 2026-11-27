import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import type { Translations } from '../i18n';
import { buildExternalAiChatPrompt } from '../lib/aiChatPromptBuilder';
import type { ProductItem } from '../types';

interface AiChatPromptCardProps {
  product: ProductItem;
  t: Translations;
  onNotifyToast?: (text: string, tone?: 'neutral' | 'error') => void;
}

export function AiChatPromptCard({ product, t, onNotifyToast }: AiChatPromptCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [product.id]);

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
    onNotifyToast?.(t.studio.chatPrompt.copiedBtn, 'neutral');
    window.setTimeout(() => setCopied(false), 2200);
  }

  const cp = t.studio.chatPrompt;

  return (
    <section className="mt-3.5 rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 overflow-hidden">
      <div className="p-3 sm:p-3.5 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowPreview((prev) => !prev)}
          className="h-10 sm:h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
          className="h-10 sm:h-9 flex-1 sm:flex-none px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Copy className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{copied ? cp.copiedBtn : cp.copyBtn}</span>
        </button>
      </div>

      {/* Optional Live Prompt Preview */}
      {showPreview && (
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1117] p-3 max-h-72 overflow-y-auto overscroll-contain">
            <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed select-text">
              {builtPrompt}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
