import { useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Translations } from '../i18n';
import {
  ALL_STRATEGY_IDS,
  ensureProductV2Intelligence,
  getClassificationTone,
  getDimensionBarClass,
  getProductMetricProvenanceList,
  getToneClasses,
  summarizeProductProvenance,
} from '../lib/productIntelligenceView.ts';
import type { Language, ProductItem, ScoreGrade, StrategyEligibilityStatus } from '../types';
import { getEffectiveScoreBreakdown, ScoreRing } from './ScoreRing';

interface ScoreDetailDialogProps {
  product: ProductItem | null;
  language: Language;
  nowMs?: number;
  t: Translations;
  onClose: () => void;
}

function scoreToGrade(score: number | null): ScoreGrade {
  if (score === null) return 'low';
  if (score >= 75) return 'top';
  if (score >= 58) return 'strong';
  if (score >= 40) return 'fair';
  return 'low';
}

function formatMetricValue(key: string, val: number | null): string {
  if (val === null || !Number.isFinite(val)) return '—';
  if (key === 'priceThb' || key === 'commissionThb' || key.includes('Revenue')) {
    return `฿${Math.round(val).toLocaleString()}`;
  }
  if (key === 'commissionRate') return `${val}%`;
  if (key === 'revenueGrowthRate') return `${val > 0 ? '+' : ''}${val}%`;
  if (key === 'rating') return `${val.toFixed(2)}/5`;
  return val.toLocaleString();
}

function getStrategyStatusTone(status: StrategyEligibilityStatus): string {
  switch (status) {
    case 'QUALIFIED':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'PARTIAL_EVIDENCE':
      return 'text-amber-700 dark:text-amber-400';
    case 'DATA_UNAVAILABLE':
      return 'text-amber-700 dark:text-amber-300';
    case 'INSUFFICIENT_DATA':
      return 'text-slate-600 dark:text-slate-400';
    case 'NOT_ELIGIBLE':
    default:
      return 'text-rose-700 dark:text-rose-400';
  }
}

export function ScoreDetailContent({
  product: rawProduct,
  language,
  nowMs,
  t,
  onClose,
}: {
  product: ProductItem;
  language: Language;
  nowMs?: number;
  t: Translations;
  onClose: () => void;
}) {
  const product = ensureProductV2Intelligence(
    rawProduct,
    nowMs !== undefined ? { nowMs } : undefined
  );
  const commercial = product.commercialScoreV2!;
  const strategyReport = product.strategyIntelligenceV2!;
  const validated = product.validatedMetrics!;
  const provenanceItems = getProductMetricProvenanceList(validated);
  const provenanceSummary = summarizeProductProvenance(validated);

  const classification = strategyReport.opportunityClassification;
  const classTone = getToneClasses(getClassificationTone(classification));
  const overallScore = commercial.commercialOpportunityScore;
  const scoreGrade = scoreToGrade(overallScore);

  const v1StudioRef = getEffectiveScoreBreakdown(product);

  const dimensionRows = [
    {
      key: 'demand',
      title: t.v2.dimensions.demand.label,
      desc: t.v2.dimensions.demand.desc,
      score: commercial.demandScore.score,
      status: commercial.demandScore.status,
      used: commercial.demandScore.usedMetrics,
      excluded: commercial.demandScore.excludedMetrics,
      notes: commercial.demandScore.notes,
      submetrics: [
        {
          label: t.v2.dialog.dimensionSubmetrics.revenueScore,
          value:
            commercial.demandScore.subcomponents.revenueScore !== null
              ? `${Math.round(commercial.demandScore.subcomponents.revenueScore)}/100`
              : '—',
        },
        {
          label: t.v2.dialog.dimensionSubmetrics.salesScore,
          value:
            commercial.demandScore.subcomponents.salesVolumeScore !== null
              ? `${Math.round(commercial.demandScore.subcomponents.salesVolumeScore)}/100`
              : '—',
        },
        {
          label: t.v2.dialog.dimensionSubmetrics.absDemand,
          value:
            commercial.demandScore.subcomponents.absoluteDemandScore !== null
              ? `${Math.round(commercial.demandScore.subcomponents.absoluteDemandScore)}/100`
              : '—',
        },
        {
          label: t.v2.dialog.dimensionSubmetrics.growthRate,
          value:
            commercial.demandScore.growthStatus === 'VERIFIED' &&
            commercial.demandScore.subcomponents.verifiedGrowthPercent !== null
              ? `${commercial.demandScore.subcomponents.verifiedGrowthPercent > 0 ? '+' : ''}${commercial.demandScore.subcomponents.verifiedGrowthPercent.toFixed(1)}%`
              : commercial.demandScore.growthStatus,
        },
      ],
    },
    {
      key: 'earning',
      title: t.v2.dimensions.earning.label,
      desc: t.v2.dimensions.earning.desc,
      score: commercial.earningScore.score,
      status: commercial.earningScore.status,
      used: commercial.earningScore.usedMetrics,
      excluded: commercial.earningScore.excludedMetrics,
      notes: commercial.earningScore.notes,
      submetrics: [
        {
          label: t.v2.dialog.dimensionSubmetrics.commissionRate,
          value:
            commercial.earningScore.verifiedCommissionPercent !== null
              ? `${commercial.earningScore.verifiedCommissionPercent}%`
              : '—',
        },
        {
          label: t.v2.dialog.dimensionSubmetrics.payoutPerSale,
          value:
            commercial.earningScore.payoutPerSaleThb !== null
              ? `฿${commercial.earningScore.payoutPerSaleThb.toFixed(2)} (${
                  commercial.earningScore.payoutProvenance === 'SYNTHETIC'
                    ? t.v2.provenance.derivedTag
                    : t.v2.provenance.sourceTag
                })`
              : '—',
        },
      ],
    },
    {
      key: 'competition',
      title: t.v2.dimensions.competition.label,
      desc: t.v2.dimensions.competition.desc,
      score: commercial.competitionScore.score,
      status: commercial.competitionScore.status,
      used: commercial.competitionScore.usedMetrics,
      excluded: commercial.competitionScore.excludedMetrics,
      notes: commercial.competitionScore.notes,
      submetrics: [
        {
          label: t.v2.dialog.dimensionSubmetrics.creators,
          value:
            commercial.competitionScore.creatorCount !== null
              ? commercial.competitionScore.creatorCount.toLocaleString()
              : validated.creatorCount.unit === 'UNVERIFIED'
                ? t.v2.metricsShort.unverified
                : '—',
        },
        {
          label: t.v2.dialog.dimensionSubmetrics.rawRpc,
          value:
            commercial.rawRpcThb !== null
              ? `฿${Math.round(commercial.rawRpcThb).toLocaleString()}`
              : '—',
        },
        {
          label: t.v2.dialog.dimensionSubmetrics.adjustedRpc,
          value:
            commercial.adjustedRpcThb !== null
              ? `฿${Math.round(commercial.adjustedRpcThb).toLocaleString()}`
              : '—',
        },
      ],
    },
    {
      key: 'quality',
      title: t.v2.dimensions.quality.label,
      desc: t.v2.dimensions.quality.desc,
      score: commercial.customerQualityScore.score,
      status: commercial.customerQualityScore.status,
      used: commercial.customerQualityScore.usedMetrics,
      excluded: commercial.customerQualityScore.excludedMetrics,
      notes: commercial.customerQualityScore.notes,
      submetrics: [
        {
          label: t.v2.dialog.dimensionSubmetrics.bayesianRating,
          value:
            commercial.customerQualityScore.bayesianRating !== null
              ? `${commercial.customerQualityScore.bayesianRating.toFixed(2)}/5`
              : '—',
        },
        {
          label: t.v2.dialog.dimensionSubmetrics.rawRating,
          value:
            commercial.customerQualityScore.rawRating !== null
              ? `${commercial.customerQualityScore.rawRating.toFixed(2)}/5`
              : validated.rating.unit === 'UNVERIFIED'
                ? t.v2.metricsShort.unverified
                : '—',
        },
        {
          label: t.v2.dialog.dimensionSubmetrics.reviews,
          value:
            commercial.customerQualityScore.reviewCount !== null
              ? commercial.customerQualityScore.reviewCount.toLocaleString()
              : validated.reviewCount.unit === 'UNVERIFIED'
                ? t.v2.metricsShort.unverified
                : '—',
        },
      ],
    },
  ];

  const conv = commercial.conversionEvidence;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Compact Sticky Header so Close button & Score stay accessible without crowding mobile screens */}
      <div className="p-3.5 sm:p-6 shrink-0 border-b border-slate-100 dark:border-slate-800/90 bg-white dark:bg-[#131B24]">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <ScoreRing
              score={overallScore}
              grade={scoreGrade}
              size={60}
              strokeWidth={4.5}
              className="w-12 h-12 sm:w-16 sm:h-16"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className={`font-semibold ${classTone.text}`}>
                  {t.v2.classifications[classification]}
                </span>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono-num tabular-nums text-slate-600 dark:text-slate-300">
                  {overallScore !== null
                    ? `${overallScore}/100`
                    : commercial.eligibilityStatus === 'NOT_MONETIZABLE'
                      ? t.v2.withheldZeroCommLabel
                      : t.v2.withheldLabel}
                </span>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {t.v2.commercialEligibility[commercial.eligibilityStatus]}
                </span>
              </div>

              <h2
                id="score-dialog-title"
                className="mt-1 font-display text-sm sm:text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2"
              >
                {product.thaiTitle}
              </h2>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono-num tabular-nums text-slate-500 dark:text-slate-400">
                <span>
                  {t.v2.confidenceLabel}:{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {Math.round(commercial.dataConfidence.score)}/100 (
                    {t.v2.confidenceLevels[commercial.dataConfidence.level]})
                  </strong>
                </span>
                {strategyReport.bestStrategyId && (
                  <span>
                    {t.v2.strategyExplorer.bestMatchLabel}:{' '}
                    <strong className="text-teal-700 dark:text-teal-400 font-sans">
                      {t.v2.strategies[strategyReport.bestStrategyId].name}
                    </strong>
                  </span>
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

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/90">
        {/* Section 1: Gate Decisions, Transparency Distinctions & Overall Summary */}
        <div className="p-4 sm:p-6 space-y-3 text-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.v2.dialog.v2Subtitle}
          </p>

          {provenanceSummary.hasUnverifiedCoreMetrics && (
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t.v2.provenance.unverifiedCoreBanner(provenanceSummary.unverifiedCount)}</span>
            </div>
          )}

          <div className="pt-1 font-semibold text-slate-900 dark:text-slate-100">
            {t.v2.dialog.gateDecisionsTitle}
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {commercial.scoreExplanation.summary}
          </p>

          {commercial.scoreExplanation.gateDecisions.length > 0 && (
            <ul className="space-y-1 text-slate-600 dark:text-slate-300 list-disc pl-4">
              {commercial.scoreExplanation.gateDecisions.map((gate, i) => (
                <li key={i}>{gate}</li>
              ))}
            </ul>
          )}

          {commercial.riskTags.length > 0 && (
            <div className="flex items-start gap-2 pt-1 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {commercial.riskTags
                  .map((tag) => t.v2.riskLabels[tag] ?? t.v2.formatRiskTag(tag))
                  .join(' · ')}
              </span>
            </div>
          )}

          {/* Clear 4-Signal Separation & Non-Guarantee Transparency Note */}
          <div className="mt-2 p-3 rounded-xl bg-slate-50/75 dark:bg-slate-900/45 border border-slate-200/75 dark:border-slate-800 space-y-1.5">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {t.v2.dialog.pillarsSummaryTitle}
            </div>
            <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-4 leading-relaxed">
              <li>{t.v2.dialog.pillarCommercial}</li>
              <li>{t.v2.dialog.pillarConversion}</li>
              <li>{t.v2.dialog.pillarVideo}</li>
              <li>{t.v2.dialog.pillarConfidence}</li>
            </ul>
            <p className="pt-1 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{t.v2.dialog.nonGuaranteeDisclaimer}</span>
            </p>
          </div>
        </div>

      {/* Section 2: 4 Independent Commercial Dimensions */}
      <div className="p-4 sm:p-6 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t.v2.dimensionsHeading}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dimensionRows.map((dim) => {
            const tone = getDimensionBarClass(dim.score, dim.status);
            const barWidth =
              dim.score !== null && dim.status !== 'INSUFFICIENT' && dim.status !== 'INVALID'
                ? Math.max(3, Math.min(100, dim.score))
                : 0;

            return (
              <div
                key={dim.key}
                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/25 space-y-2.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {dim.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.v2.dimensionStatus[dim.status]}
                    </div>
                  </div>
                  <div className={`text-base font-mono-num tabular-nums font-bold ${tone.textClass}`}>
                    {dim.score !== null ? `${Math.round(dim.score)}/100` : '—'}
                  </div>
                </div>

                <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${tone.barClass}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {dim.desc}
                </p>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                  {dim.submetrics.map((sub) => (
                    <div key={sub.label}>
                      <div className="text-slate-400 dark:text-slate-500">{sub.label}</div>
                      <div className="font-mono-num tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {sub.value}
                      </div>
                    </div>
                  ))}
                </div>

                {dim.notes.length > 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {dim.notes[0]}
                  </p>
                )}

                {dim.excluded.length > 0 && (
                  <div className="text-[10px] font-mono-num text-amber-700 dark:text-amber-400">
                    {t.v2.dialog.excludedMetricsLabel}: {dim.excluded.join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Data Confidence Breakdown & Metric Provenance */}
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t.v2.provenance.sectionTitle}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {t.v2.provenance.sectionSubtitle}
            </p>
          </div>
          <div className="text-xs font-mono-num tabular-nums font-semibold text-slate-800 dark:text-slate-200 shrink-0">
            {t.v2.confidenceLabel}: {Math.round(commercial.dataConfidence.score)}/100
          </div>
        </div>

        {/* Confidence Subscores */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-[11px] font-mono-num tabular-nums">
          {(
            [
              ['completeness', commercial.dataConfidence.breakdown.completeness],
              ['provenance', commercial.dataConfidence.breakdown.provenance],
              ['freshness', commercial.dataConfidence.breakdown.freshness],
              ['validity', commercial.dataConfidence.breakdown.validity],
              ['dimensionCoverage', commercial.dataConfidence.breakdown.dimensionCoverage],
            ] as const
          ).map(([k, val]) => (
            <div
              key={k}
              className="p-2 rounded-lg border border-slate-200/75 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30"
            >
              <div className="font-sans text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {t.v2.confidenceBreakdown[k]}
              </div>
              <div className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {Math.round(val)}/100
              </div>
            </div>
          ))}
        </div>

        {/* Field Provenance Table */}
        <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-2 px-3 font-medium">{t.v2.provenance.metricCol}</th>
                <th className="py-2 px-3 font-medium text-right">{t.v2.provenance.valueCol}</th>
                <th className="py-2 px-3 font-medium">{t.v2.provenance.statusCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {provenanceItems.map((item) => {
                const statusColor =
                  item.category === 'verified_source'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : item.category === 'derived'
                      ? 'text-sky-700 dark:text-sky-400'
                      : item.category === 'unverified' ||
                          item.category === 'stale' ||
                          item.category === 'invalid'
                        ? 'text-amber-700 dark:text-amber-400'
                        : item.category === 'zero'
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-slate-500 dark:text-slate-400';

                return (
                  <tr key={item.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30">
                    <td className="py-1.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {t.v2.provenance.fields[item.key]}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono-num tabular-nums text-slate-900 dark:text-slate-100">
                      {formatMetricValue(item.key, item.metric.value)}
                    </td>
                    <td className={`py-1.5 px-3 text-[11px] font-medium ${statusColor}`}>
                      {t.v2.provenance.categories[item.category]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Separate Conversion Evidence */}
      <div className="p-4 sm:p-6 space-y-2.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.v2.dialog.conversionSectionTitle}
          </h3>
          <span className="font-semibold text-teal-700 dark:text-teal-400">
            {t.v2.conversionLevels[conv.evidenceLevel]} ·{' '}
            {t.v2.conversionChannels[conv.dominantChannel]}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-num tabular-nums">
          <div>
            <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
              {t.card.videoRev7d}
            </div>
            <div className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
              {conv.videoRevenueThb.value !== null
                ? `฿${Math.round(conv.videoRevenueThb.value).toLocaleString()}`
                : '—'}
            </div>
          </div>
          <div>
            <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
              {t.studio.deepMetricLiveRev7d}
            </div>
            <div className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
              {conv.liveRevenueThb.value !== null
                ? `฿${Math.round(conv.liveRevenueThb.value).toLocaleString()}`
                : '—'}
            </div>
          </div>
          <div>
            <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
              {t.v2.dialog.videoShareLabel}
            </div>
            <div className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
              {conv.videoRevenueShare !== null
                ? `${Math.round(conv.videoRevenueShare * 100)}%`
                : '—'}
            </div>
          </div>
          <div>
            <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
              {t.v2.dialog.liveShareLabel}
            </div>
            <div className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
              {conv.liveRevenueShare !== null
                ? `${Math.round(conv.liveRevenueShare * 100)}%`
                : '—'}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {conv.consistencyNote}
        </p>
        <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>{conv.disclaimer}</span>
        </p>
      </div>

      {/* Section 5: 8-Strategy Eligibility Matrix */}
      <div className="p-4 sm:p-6 space-y-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.v2.dialog.strategyMatrixTitle}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {t.v2.dialog.strategyMatrixSub}
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
          {ALL_STRATEGY_IDS.map((sid) => {
            const evalRes = strategyReport.strategies[sid];
            const statusClass = getStrategyStatusTone(evalRes.eligibilityStatus);
            const isQualified = evalRes.eligibilityStatus === 'QUALIFIED';
            const isUnavailable = evalRes.eligibilityStatus === 'DATA_UNAVAILABLE';

            return (
              <div key={sid} className="p-3 text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isQualified ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : isUnavailable ? (
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {t.v2.strategies[sid].name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-num tabular-nums shrink-0">
                    <span className={`font-semibold ${statusClass}`}>
                      {t.v2.strategyEligibility[evalRes.eligibilityStatus]}
                    </span>
                    {evalRes.strategyScore !== null && (
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">
                        {Math.round(evalRes.strategyScore)}/100
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pl-5">
                  {evalRes.explanation}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 6: Secondary Video Studio Reference (Strictly Separated) */}
      <div className="p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/30 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <Video className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>{t.v2.dialog.studioVisualRefTitle}</span>
          </div>
          <span className="font-mono-num tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
            {t.v2.dialog.v1SilentScoreLabel}: {v1StudioRef.total}/100
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {t.v2.dialog.studioVisualRefNotice}
        </p>
        {product.whySilentWorks[language] && (
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {product.whySilentWorks[language]}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 py-3.5 flex items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {t.score.closeBtn}
        </button>
      </div>
      </div>
    </div>
  );
}

export function ScoreDetailDialog({
  product,
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
            className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 shadow-xl"
          >
            <ScoreDetailContent
              product={product}
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
