import { type FormEvent, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  SlidersHorizontal,
  Unlink,
  X,
} from 'lucide-react';
import type { Translations } from '../i18n';
import type { KalodataLimitSettings, KalodataStatus } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface KalodataBarProps {
  status: KalodataStatus;
  limits: KalodataLimitSettings;
  isConnecting: boolean;
  isRefreshingBalance: boolean;
  connectError: string | null;
  t: Translations;
  onConnect: (apiKey: string) => Promise<boolean>;
  onDisconnect: () => Promise<void>;
  onRefreshBalance: () => Promise<void>;
  onSaveLimits: (next: KalodataLimitSettings) => void;
  onClose?: () => void;
}

export function KalodataBar({
  status,
  limits,
  isConnecting,
  isRefreshingBalance,
  connectError,
  t,
  onConnect,
  onDisconnect,
  onRefreshBalance,
  onSaveLimits,
  onClose,
}: KalodataBarProps) {
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [pasteHint, setPasteHint] = useState<string | null>(null);

  const [maxSpendInput, setMaxSpendInput] = useState(
    limits.maxSpendCredits !== null ? String(limits.maxSpendCredits) : ''
  );
  const [minReserveInput, setMinReserveInput] = useState(
    limits.minBalanceReserve !== null ? String(limits.minBalanceReserve) : ''
  );

  const showForm = !status.connected || isEditingKey;

  async function handlePasteClick() {
    setPasteHint(null);
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setKeyInput(text.trim());
      }
    } catch {
      setPasteHint(t.kalodata.pasteDeniedNote);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    const ok = await onConnect(keyInput.trim());
    if (ok) {
      setKeyInput('');
      setShowKey(false);
      setIsEditingKey(false);
      setPasteHint(null);
    }
  }

  function openLimitEditor() {
    setMaxSpendInput(limits.maxSpendCredits !== null ? String(limits.maxSpendCredits) : '');
    setMinReserveInput(limits.minBalanceReserve !== null ? String(limits.minBalanceReserve) : '');
    setIsEditingLimit((prev) => !prev);
  }

  function handleSaveLimitSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedMax = Number.parseFloat(maxSpendInput);
    const parsedMin = Number.parseFloat(minReserveInput);

    onSaveLimits({
      maxSpendCredits:
        Number.isFinite(parsedMax) && parsedMax > 0
          ? Math.round(parsedMax * 100) / 100
          : null,
      minBalanceReserve:
        Number.isFinite(parsedMin) && parsedMin >= 0
          ? Math.round(parsedMin * 100) / 100
          : null,
      trackedSpentCredits: limits.trackedSpentCredits,
    });
    setIsEditingLimit(false);
  }

  function formatNumber(n: number): string {
    return Number.isInteger(n)
      ? n.toLocaleString()
      : n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }

  const hasAnyLimit = limits.maxSpendCredits !== null || limits.minBalanceReserve !== null;

  if (!showForm) {
    const bal = status.balance;
    const balanceValue =
      bal && bal.available !== null
        ? `${formatNumber(bal.available)} ${t.kalodata.creditsUnit}`
        : t.kalodata.balanceUnavailable;

    return (
      <div className="bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden text-left shadow-xs">
        {/* Main Connected Status & Credit Balance Row */}
        <div className="px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{t.kalodata.connectedBadge}</span>
            </span>

            {status.maskedKey && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                  {status.maskedKey}
                  {bal?.accountType
                    ? ` (${bal.accountType === 'sub' ? t.kalodata.subAccount : t.kalodata.mainAccount})`
                    : ''}
                </span>
              </>
            )}

            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>

            <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t.kalodata.creditBalanceLabel}:
              </span>
              <span className="font-mono-num text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {balanceValue}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isRefreshingBalance}
              onClick={onRefreshBalance}
              aria-label={t.kalodata.refreshBalance}
              className="h-10 sm:h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center gap-1.5 transition-all active:scale-[0.98] duration-150 whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
              <span>{t.kalodata.refreshBalance}</span>
            </button>

            <button
              type="button"
              onClick={openLimitEditor}
              className={`h-10 sm:h-9 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-all active:scale-[0.98] duration-150 whitespace-nowrap cursor-pointer ${
                isEditingLimit || hasAnyLimit
                  ? 'border-teal-600 dark:border-teal-400 text-teal-700 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-950/30'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{t.kalodata.limitBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsEditingKey(true);
                setIsEditingLimit(false);
                setKeyInput('');
                setPasteHint(null);
              }}
              className="h-10 sm:h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-[0.98] duration-150 whitespace-nowrap cursor-pointer"
            >
              {t.kalodata.changeKey}
            </button>

            {status.keySource === 'ui' && (
              <button
                type="button"
                onClick={onDisconnect}
                aria-label={t.kalodata.disconnect}
                title={t.kalodata.disconnect}
                className="h-10 w-10 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900/60 transition-all active:scale-[0.98] duration-150 shrink-0 cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t.kalodata.closeBtn}
                title={t.kalodata.closeBtn}
                className="h-10 w-10 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all active:scale-95 duration-150 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Active Limit Summary Row */}
        {hasAnyLimit && !isEditingLimit && (
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/90 bg-slate-50/60 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-num">
              {limits.maxSpendCredits !== null && (
                <span>
                  {t.kalodata.spentCounterLabel}: {formatNumber(limits.trackedSpentCredits)} /{' '}
                  {formatNumber(limits.maxSpendCredits)} {t.kalodata.creditsUnit}
                </span>
              )}
              {limits.maxSpendCredits !== null && limits.minBalanceReserve !== null && (
                <span aria-hidden="true">·</span>
              )}
              {limits.minBalanceReserve !== null && (
                <span>
                  {t.kalodata.minReserveLabel}: {formatNumber(limits.minBalanceReserve)}{' '}
                  {t.kalodata.creditsUnit}
                </span>
              )}
            </div>

            {limits.trackedSpentCredits > 0 && (
              <button
                type="button"
                onClick={() => onSaveLimits({ ...limits, trackedSpentCredits: 0 })}
                className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap cursor-pointer"
              >
                {t.kalodata.resetSpentBtn}
              </button>
            )}
          </div>
        )}

        {/* Inline Credit Limit Editor */}
        {isEditingLimit && (
          <form
            onSubmit={handleSaveLimitSubmit}
            className="px-4 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-xs font-semibold text-slate-900 dark:text-slate-100">
                {t.kalodata.limitTitle}
              </h3>
              <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                {t.kalodata.spentCounterLabel}: {formatNumber(limits.trackedSpentCredits)}{' '}
                {t.kalodata.creditsUnit}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t.kalodata.maxSpendLabel}
                </span>
                <input
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={maxSpendInput}
                  onChange={(e) => setMaxSpendInput(e.target.value)}
                  placeholder={t.kalodata.maxSpendPlaceholder}
                  className="mt-1 w-full h-11 sm:h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1117] font-mono-num text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t.kalodata.minReserveLabel}
                </span>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={minReserveInput}
                  onChange={(e) => setMinReserveInput(e.target.value)}
                  placeholder={t.kalodata.minReservePlaceholder}
                  className="mt-1 w-full h-11 sm:h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1117] font-mono-num text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-3">
                {hasAnyLimit && (
                  <button
                    type="button"
                    onClick={() => {
                      setMaxSpendInput('');
                      setMinReserveInput('');
                      onSaveLimits({
                        maxSpendCredits: null,
                        minBalanceReserve: null,
                        trackedSpentCredits: 0,
                      });
                      setIsEditingLimit(false);
                    }}
                    className="text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 cursor-pointer"
                  >
                    {t.kalodata.clearLimitBtn}
                  </button>
                )}
                {limits.trackedSpentCredits > 0 && (
                  <button
                    type="button"
                    onClick={() => onSaveLimits({ ...limits, trackedSpentCredits: 0 })}
                    className="text-xs text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    {t.kalodata.resetSpentBtn}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingLimit(false)}
                  className="h-10 sm:h-9 px-3 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] cursor-pointer"
                >
                  {t.kalodata.cancel}
                </button>
                <button
                  type="submit"
                  className="h-10 sm:h-9 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-semibold active:scale-[0.98] transition-transform cursor-pointer whitespace-nowrap"
                >
                  {t.kalodata.saveLimitBtn}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 text-left shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <KeyRound className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t.kalodata.title}
          </h2>
          <InfoTooltip content={t.kalodata.subtitle} ariaLabel={t.kalodata.title} size="md" />
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://www.kalodata.com/open-center/account"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
          >
            {t.kalodata.openCenterLink} ↗
          </a>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t.kalodata.closeBtn}
              className="h-9 w-9 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row items-stretch gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={t.kalodata.inputPlaceholder}
            autoComplete="off"
            spellCheck={false}
            className="w-full h-11 pl-3.5 pr-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0B1117] font-mono text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="button"
            onClick={() => setShowKey((prev) => !prev)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 cursor-pointer"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePasteClick}
            className="h-11 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 inline-flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-[0.98] transition-transform cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>{t.kalodata.pasteBtn}</span>
          </button>

          <button
            type="submit"
            disabled={isConnecting || !keyInput.trim()}
            className="h-11 flex-1 sm:flex-none px-5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] duration-150 whitespace-nowrap disabled:opacity-55 cursor-pointer"
          >
            {isConnecting ? t.kalodata.connectingBtn : t.kalodata.connectBtn}
          </button>

          {status.connected && (
            <button
              type="button"
              onClick={() => {
                setIsEditingKey(false);
                setKeyInput('');
                setPasteHint(null);
              }}
              className="h-11 px-3 rounded-lg text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap cursor-pointer"
            >
              {t.kalodata.cancel}
            </button>
          )}
        </div>
      </form>

      {pasteHint && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{pasteHint}</p>
      )}
      {connectError && (
        <p className="mt-2.5 text-xs font-medium text-red-600 dark:text-red-400">
          {connectError}
        </p>
      )}
    </div>
  );
}
