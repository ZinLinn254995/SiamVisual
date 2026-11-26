import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Translations } from '../i18n';
import { analyzeDetailRevenueTrend } from '../lib/revenueTrendAnalyzer.ts';
import { adaptProductItemToValidatedMetrics } from '../lib/metricFoundation.ts';
import {
  evaluateSearchOpportunityScore,
  type SearchScoreGrade,
} from '../lib/searchScoreEngine.ts';
import type {
  Language,
  ProductItem,
  ProductObservationSnapshot,
  ScoreGrade,
} from '../types';
import { ScoreRing } from './ScoreRing';

interface ScoreDetailDialogProps {
  product: ProductItem | null;
  snapshots?: ProductObservationSnapshot[];
  language: Language;
  nowMs?: number;
  t: Translations;
  onClose: () => void;
}

function searchGradeToScoreGrade(grade: SearchScoreGrade): ScoreGrade {
  switch (grade) {
    case 'TOP':
      return 'top';
    case 'STRONG':
      return 'strong';
    case 'MODERATE':
      return 'fair';
    case 'WEAK':
    case 'NOT_MONETIZABLE':
    case 'INSUFFICIENT':
    default:
      return 'low';
  }
}

function searchGradeToTextClass(grade: SearchScoreGrade): string {
  switch (grade) {
    case 'TOP':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'STRONG':
      return 'text-teal-700 dark:text-teal-400';
    case 'MODERATE':
      return 'text-amber-700 dark:text-amber-400';
    case 'WEAK':
    case 'NOT_MONETIZABLE':
      return 'text-rose-700 dark:text-rose-400';
    case 'INSUFFICIENT':
    default:
      return 'text-slate-600 dark:text-slate-400';
  }
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

/**
 * Maps a THB price onto a 0..100 visual scale (฿0 to ฿1,500+) so the
 * ฿150–฿790 TikTok impulse sweet spot sits clearly in the center-left visual zone.
 */
function priceToScalePercent(priceThb: number): number {
  if (!Number.isFinite(priceThb) || priceThb <= 0) return 0;
  return Math.max(2, Math.min(98, (Math.min(priceThb, 1500) / 1500) * 100));
}

function getPriceZoneKey(priceThb: number | null): 'sweet' | 'mid' | 'low' | 'high' | null {
  if (priceThb === null || !Number.isFinite(priceThb) || priceThb <= 0) return null;
  if (priceThb >= 150 && priceThb <= 790) return 'sweet';
  if (priceThb >= 80 && priceThb < 150) return 'low';
  if (priceThb > 790 && priceThb <= 1500) return 'mid';
  if (priceThb < 80) return 'low';
  return 'high';
}

export function ScoreDetailContent({
  product,
  language,
  nowMs,
  t,
  onClose,
}: {
  product: ProductItem;
  snapshots?: ProductObservationSnapshot[];
  language: Language;
  nowMs?: number;
  t: Translations;
  onClose: () => void;
}) {
  const validated =
    product.validatedMetrics ??
    adaptProductItemToValidatedMetrics(product, nowMs !== undefined ? { nowMs } : undefined);
  const searchScore = evaluateSearchOpportunityScore(
    validated,
    nowMs !== undefined ? { nowMs } : undefined
  );
  const detailTrend = analyzeDetailRevenueTrend(product.kalodataMetrics);

  const copy = t.v2.searchScore;
  const gradeToneClass = searchGradeToTextClass(searchScore.grade);
  const ringGrade = searchGradeToScoreGrade(searchScore.grade);
  const m = searchScore.metrics;

  const isCapped =
    searchScore.capsApplied.length > 0 &&
    searchScore.rawWeightedScore !== null &&
    searchScore.score !== null &&
    Math.round(searchScore.rawWeightedScore) > searchScore.score;

  const priceZone = getPriceZoneKey(m.priceThb);

  const pillars = [
    {
      key: 'demand' as const,
      label: copy.pillars.demand.label,
      weightLabel: copy.pillars.demand.weightLabel,
      score: searchScore.pillars.demand.score,
      pts: searchScore.pillars.demand.weightedPoints,
      barClass: 'bg-emerald-500 dark:bg-emerald-400',
      dotClass: 'bg-emerald-500 dark:bg-emerald-400',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      fact: [
        m.revenueThb !== null ? formatCompactThb(m.revenueThb) : null,
        m.salesVolume !== null ? `${formatCompactCount(m.salesVolume)}${t.card.unitsSuffix}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      key: 'earning' as const,
      label: copy.pillars.earning.label,
      weightLabel: copy.pillars.earning.weightLabel,
      score: searchScore.pillars.earning.score,
      pts: searchScore.pillars.earning.weightedPoints,
      barClass: 'bg-teal-500 dark:bg-teal-400',
      dotClass: 'bg-teal-500 dark:bg-teal-400',
      textClass: 'text-teal-700 dark:text-teal-400',
      fact: [
        m.commissionRatePct !== null ? `${m.commissionRatePct}%` : null,
        m.payoutPerSaleThb !== null
          ? `฿${m.payoutPerSaleThb.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      key: 'videoProof' as const,
      label: copy.pillars.videoProof.label,
      weightLabel: copy.pillars.videoProof.weightLabel,
      score: searchScore.pillars.videoProof.score,
      pts: searchScore.pillars.videoProof.weightedPoints,
      barClass: 'bg-sky-500 dark:bg-sky-400',
      dotClass: 'bg-sky-500 dark:bg-sky-400',
      textClass: 'text-sky-700 dark:text-sky-400',
      fact: [
        m.videoSharePct !== null ? `Video ${Math.round(m.videoSharePct)}%` : null,
        m.videoRevenueThb !== null ? formatCompactThb(m.videoRevenueThb) : null,
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      key: 'priceFit' as const,
      label: copy.pillars.priceFit.label,
      weightLabel: copy.pillars.priceFit.weightLabel,
      score: searchScore.pillars.priceFit.score,
      pts: searchScore.pillars.priceFit.weightedPoints,
      barClass: 'bg-indigo-500 dark:bg-indigo-400',
      dotClass: 'bg-indigo-500 dark:bg-indigo-400',
      textClass: 'text-indigo-700 dark:text-indigo-400',
      fact: [
        m.priceThb !== null ? `฿${m.priceThb.toLocaleString()}` : null,
        priceZone ? copy.priceZones[priceZone] : null,
      ]
        .filter(Boolean)
        .join(' · '),
    },
  ];

  // Channel split visual widths (normalized to sum <= 100%)
  const videoPct = m.videoSharePct !== null ? Math.max(0, Math.min(100, Math.round(m.videoSharePct))) : 0;
  const livePct =
    m.liveSharePct !== null
      ? Math.max(0, Math.min(100 - videoPct, Math.round(m.liveSharePct)))
      : 0;
  const mallPct =
    m.videoSharePct !== null || m.liveSharePct !== null || m.showcaseSharePct !== null
      ? Math.max(0, 100 - videoPct - livePct)
      : 0;
  const hasChannelData =
    m.videoSharePct !== null || m.liveSharePct !== null || m.showcaseSharePct !== null;

  const est100SalesThb =
    m.payoutPerSaleThb !== null && m.payoutPerSaleThb > 0
      ? Math.round(m.payoutPerSaleThb * 100)
      : m.commissionRatePct === 0
        ? 0
        : null;

  const hasVerifiedSparkline =
    (detailTrend.status === 'VERIFIED_30D' || detailTrend.status === 'VERIFIED_7D') &&
    detailTrend.reconciledWithRevenue &&
    detailTrend.dailyValuesThb.length > 1;

  const priceMarkerLeftPct = m.priceThb !== null ? priceToScalePercent(m.priceThb) : null;
  // Sweet spot zone on 0..1500 scale: ฿150 (10%) to ฿790 (52.7%), peak ฿220 (14.7%) to ฿590 (39.3%)
  const sweetLeftPct = (150 / 1500) * 100;
  const sweetWidthPct = ((790 - 150) / 1500) * 100;
  const peakLeftPct = (220 / 1500) * 100;
  const peakWidthPct = ((590 - 220) / 1500) * 100;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Clean Visual Header */}
      <div className="p-4 sm:p-6 shrink-0 border-b border-slate-100 dark:border-slate-800/90 bg-white dark:bg-[#131B24]">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <ScoreRing
              score={searchScore.score}
              grade={ringGrade}
              size={64}
              strokeWidth={4.5}
              className="w-14 h-14 sm:w-16 sm:h-16 shrink-0"
            />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className={`font-semibold ${gradeToneClass}`}>
                  {copy.grades[searchScore.grade]}
                </span>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono-num tabular-nums font-bold text-slate-900 dark:text-slate-100">
                  {searchScore.score !== null ? `${searchScore.score}/100` : '—'}
                </span>
                {isCapped && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono-num tabular-nums text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      {Math.round(searchScore.rawWeightedScore!)} → {searchScore.score}
                    </span>
                  </>
                )}
              </div>

              <h2
                id="score-dialog-title"
                className="mt-1 font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2"
              >
                {product.thaiTitle}
              </h2>

              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-mono-num tabular-nums text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {m.priceThb !== null ? `฿${m.priceThb.toLocaleString()}` : '—'}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    m.commissionRatePct === 0
                      ? 'font-semibold text-rose-700 dark:text-rose-400'
                      : 'font-semibold text-teal-700 dark:text-teal-400'
                  }
                >
                  {m.commissionRatePct !== null ? `${m.commissionRatePct}%` : '—'}
                  {m.payoutPerSaleThb !== null && m.payoutPerSaleThb > 0
                    ? ` (฿${m.payoutPerSaleThb.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
                    : ''}
                </span>
                {m.salesVolume !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {formatCompactCount(m.salesVolume)}
                      {t.card.unitsSuffix}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.score.closeBtn}
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Visual Breakdown Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/90">
        {/* Active Cap / 0% Commission Notice (Only when triggered) */}
        {(searchScore.status === 'NOT_MONETIZABLE' || searchScore.capsApplied.length > 0) && (
          <div className="px-4 sm:px-6 py-3 bg-amber-50/55 dark:bg-amber-950/20 flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-0.5">
              {searchScore.status === 'NOT_MONETIZABLE' ? (
                <p className="font-medium text-rose-700 dark:text-rose-400">
                  {language === 'my'
                    ? 'ကော်မရှင် 0% ဖြစ်သောကြောင့် Affiliate အမြတ်မရနိုင်၍ 0 မှတ်သတ်မှတ်ထားသည်'
                    : '0% verified commission — non-monetizable for affiliates (Score 0)'}
                </p>
              ) : (
                searchScore.capsApplied.map((capCode) => (
                  <p key={capCode} className="font-medium text-amber-800 dark:text-amber-300">
                    {copy.caps[capCode]}
                  </p>
                ))
              )}
            </div>
          </div>
        )}

        {/* Visual Block 1: 100-Point Stacked Composition Bar + 4 Pillar Gauges */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {copy.compositionTitle}
              </h3>
              <span className="font-mono-num tabular-nums text-xs font-semibold text-slate-800 dark:text-slate-200">
                {searchScore.rawWeightedScore !== null
                  ? `${Math.round(searchScore.rawWeightedScore)} / 100`
                  : '—'}
              </span>
            </div>

            {/* 100-Point Stacked Horizontal Composition Bar */}
            <div
              className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800/90 overflow-hidden flex gap-0.5"
              role="img"
              aria-label={`${copy.compositionTitle}: ${searchScore.score ?? 0} of 100`}
            >
              {pillars.map((pillar) => {
                const widthPct =
                  pillar.pts !== null && pillar.pts > 0 ? Math.min(100, pillar.pts) : 0;
                if (widthPct <= 0) return null;
                return (
                  <div
                    key={pillar.key}
                    className={`h-full first:rounded-l-full last:rounded-r-full ${pillar.barClass}`}
                    style={{ width: `${widthPct}%` }}
                    title={`${pillar.label}: +${pillar.pts?.toFixed(1)}`}
                  />
                );
              })}
            </div>

            {/* Quiet 1-Line Point Contribution Legend */}
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] font-mono-num tabular-nums text-slate-500 dark:text-slate-400">
              {pillars.map((pillar) => (
                <span key={pillar.key} className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-xs shrink-0 ${pillar.dotClass}`} />
                  <span className="font-sans text-slate-600 dark:text-slate-300">
                    {copy.pillars[pillar.key].short}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {pillar.pts !== null ? `+${Math.round(pillar.pts)}` : '—'}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* 4 Visual Pillar Bars (2x2 Grid, Flat Surface, Zero Nested Card Clutter) */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {pillars.map((pillar) => {
              const barPct =
                pillar.score !== null ? Math.max(4, Math.min(100, Math.round(pillar.score))) : 0;

              return (
                <div key={pillar.key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {pillar.label}
                      </span>
                      <span className="font-mono-num text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                        {pillar.weightLabel}
                      </span>
                    </div>
                    <span
                      className={`font-mono-num tabular-nums text-sm font-bold shrink-0 ${pillar.textClass}`}
                    >
                      {pillar.score !== null ? Math.round(pillar.score) : '—'}
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800/90 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${pillar.barClass}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  <div className="flex items-baseline justify-between gap-2 text-[11px] font-mono-num tabular-nums text-slate-500 dark:text-slate-400">
                    <span className="truncate">{pillar.fact || '—'}</span>
                    {pillar.pts !== null && (
                      <span className="shrink-0">+{pillar.pts.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Visual Block 2: Sales Channel Split Bar + Price Sweet-Spot Gauge */}
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Left: Sales Channels Visual Bar */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {copy.channelsTitle}
              </h3>
              <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 truncate">
                {copy.channels[m.dominantChannel]}
              </span>
            </div>

            {hasChannelData ? (
              <>
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex gap-0.5">
                  {videoPct > 0 && (
                    <div
                      className="h-full bg-teal-500 dark:bg-teal-400 first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${videoPct}%` }}
                    />
                  )}
                  {livePct > 0 && (
                    <div
                      className="h-full bg-amber-400 dark:bg-amber-400/90 first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${livePct}%` }}
                    />
                  )}
                  {mallPct > 0 && (
                    <div
                      className="h-full bg-slate-400 dark:bg-slate-600 first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${mallPct}%` }}
                    />
                  )}
                </div>

                <div className="space-y-1.5 text-xs font-mono-num tabular-nums">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-300">
                      <span className="w-2 h-2 rounded-xs bg-teal-500 dark:bg-teal-400" />
                      {copy.channelShort.video}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {videoPct}%
                      {m.videoRevenueThb !== null ? ` · ${formatCompactThb(m.videoRevenueThb)}` : ''}
                    </span>
                  </div>

                  {(livePct > 0 || (m.liveRevenueThb !== null && m.liveRevenueThb > 0)) && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-300">
                        <span className="w-2 h-2 rounded-xs bg-amber-400" />
                        {copy.channelShort.live}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {livePct}%
                        {m.liveRevenueThb !== null ? ` · ${formatCompactThb(m.liveRevenueThb)}` : ''}
                      </span>
                    </div>
                  )}

                  {(mallPct > 0 || (m.showcaseRevenueThb !== null && m.showcaseRevenueThb > 0)) && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-300">
                        <span className="w-2 h-2 rounded-xs bg-slate-400 dark:bg-slate-600" />
                        {copy.channelShort.mall}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {mallPct}%
                        {m.showcaseRevenueThb !== null
                          ? ` · ${formatCompactThb(m.showcaseRevenueThb)}`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 dark:text-slate-500">—</div>
            )}
          </div>

          {/* Right: Price Sweet-Spot Visual Scale */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {copy.priceSweetSpotTitle}
              </h3>
              <span className="font-mono-num tabular-nums text-xs font-bold text-slate-900 dark:text-slate-100">
                {m.priceThb !== null ? `฿${m.priceThb.toLocaleString()}` : '—'}
                {priceZone && (
                  <span
                    className={`ml-1.5 font-sans font-semibold text-[11px] ${
                      priceZone === 'sweet'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    · {copy.priceZones[priceZone]}
                  </span>
                )}
              </span>
            </div>

            {/* Visual Range Track with Highlighted Sweet Spot (฿150–฿790) & Pin */}
            <div className="pt-2 pb-1">
              <div className="relative h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                {/* Outer Sweet Spot ฿150–฿790 */}
                <div
                  className="absolute inset-y-0 rounded-full bg-emerald-200/80 dark:bg-emerald-900/60"
                  style={{ left: `${sweetLeftPct}%`, width: `${sweetWidthPct}%` }}
                />
                {/* Peak Impulse Zone ฿220–฿590 */}
                <div
                  className="absolute inset-y-0 rounded-full bg-emerald-500/75 dark:bg-emerald-400/75"
                  style={{ left: `${peakLeftPct}%`, width: `${peakWidthPct}%` }}
                />
                {/* Exact Product Price Marker Pin */}
                {priceMarkerLeftPct !== null && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-900 dark:bg-white border-2 border-white dark:border-slate-900 shadow-xs"
                    style={{ left: `${priceMarkerLeftPct}%` }}
                    title={m.priceThb !== null ? `฿${m.priceThb.toLocaleString()}` : undefined}
                  />
                )}
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] font-mono-num tabular-nums text-slate-400 dark:text-slate-500">
                <span>฿0</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  ฿150 – ฿790
                </span>
                <span>฿1.5K+</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Block 3: Affiliate Earning Snapshot (3 Clean Big Numbers) */}
        <div className="p-4 sm:p-6">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {copy.earningSnapshotTitle}
          </h3>
          <div className="grid grid-cols-3 gap-3 sm:gap-5 font-mono-num tabular-nums">
            <div className="min-w-0">
              <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {copy.payoutPerSaleLabel}
              </div>
              <div className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                {m.payoutPerSaleThb !== null
                  ? `฿${m.payoutPerSaleThb.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}`
                  : '—'}
              </div>
            </div>

            <div className="min-w-0 border-l border-slate-100 dark:border-slate-800/90 pl-3 sm:pl-5">
              <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {copy.est100SalesLabel}
              </div>
              <div className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                {est100SalesThb !== null ? formatCompactThb(est100SalesThb) : '—'}
              </div>
            </div>

            <div className="min-w-0 border-l border-slate-100 dark:border-slate-800/90 pl-3 sm:pl-5">
              <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {copy.videoPoolLabel}
              </div>
              <div className="mt-1 text-base sm:text-lg font-bold text-teal-700 dark:text-teal-400 truncate">
                {m.videoCommissionPoolThb !== null
                  ? formatCompactThb(m.videoCommissionPoolThb)
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Optional Visual Block 4: Daily Revenue Sparkline (ONLY when /detail Deep Data already exists) */}
        {hasVerifiedSparkline && (() => {
          const values = detailTrend.dailyValuesThb;
          const maxVal = Math.max(...values, 1);
          const svgW = 280;
          const svgH = 48;
          const padX = 3;
          const padY = 4;
          const plotW = svgW - padX * 2;
          const plotH = svgH - padY * 2;
          const points = values
            .map((v, idx) => {
              const x = padX + (idx / (values.length - 1)) * plotW;
              const y = padY + plotH - (v / maxVal) * plotH;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
          const areaPoints = `${padX},${(padY + plotH).toFixed(1)} ${points} ${(
            padX + plotW
          ).toFixed(1)},${(padY + plotH).toFixed(1)}`;

          const rawCreators =
            typeof product.kalodataMetrics?.creatorCount === 'number' &&
            product.kalodataMetrics.creatorCount >= 0
              ? product.kalodataMetrics.creatorCount
              : null;

          return (
            <div className="p-4 sm:p-6 space-y-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {copy.dailyTrendTitle} ({detailTrend.daysCount}d)
                </h3>
                <div className="flex items-center gap-2.5 text-xs font-mono-num tabular-nums">
                  {detailTrend.growth7dPct !== null && (
                    <span
                      className={`font-semibold ${
                        detailTrend.growth7dPct >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {detailTrend.growth7dPct > 0 ? '+' : ''}
                      {detailTrend.growth7dPct}%
                    </span>
                  )}
                  {rawCreators !== null && (
                    <span className="text-slate-500 dark:text-slate-400">
                      {copy.activeCreatorsShort}:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {rawCreators.toLocaleString()}
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full h-12 overflow-visible"
                role="img"
                aria-label={`${detailTrend.daysCount}-day daily revenue trend`}
              >
                <polygon
                  points={areaPoints}
                  className="fill-teal-500/15 dark:fill-teal-400/15"
                />
                <polyline
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                  className="stroke-teal-600 dark:stroke-teal-400"
                />
              </svg>
            </div>
          );
        })()}
      </div>

      {/* Minimal Footer */}
      <div className="px-4 sm:px-6 py-3 shrink-0 border-t border-slate-100 dark:border-slate-800/90 flex items-center justify-between gap-3 bg-white dark:bg-[#131B24]">
        <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
          {copy.rankDataOnlyNote}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {t.score.closeBtn}
        </button>
      </div>
    </div>
  );
}

export function ScoreDetailDialog({
  product,
  snapshots,
  language,
  nowMs,
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

  return (
    <AnimatePresence>
      {product && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="score-dialog-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 shadow-xl"
          >
            <ScoreDetailContent
              product={product}
              snapshots={snapshots}
              language={language}
              nowMs={nowMs}
              t={t}
              onClose={onClose}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
