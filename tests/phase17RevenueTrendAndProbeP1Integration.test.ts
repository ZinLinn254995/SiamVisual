import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clearKalodataCachesForTests,
  enrichSingleKalodataProduct,
  extractMetricsFromRawRow,
  parseRawProductRow,
  setSessionKalodataKey,
  clearSessionKalodataKey,
} from '../server/kalodata.ts';
import { buildProductEvidenceSummary } from '../src/lib/productEvidenceSummary.ts';
import {
  analyzeDetailRevenueTrend,
  sanitizeRevenueTrendArray,
} from '../src/lib/revenueTrendAnalyzer.ts';
import { evaluateProductCommercialV2 } from '../src/lib/scoringEngineV2.ts';
import { mergeKalodataMetrics } from '../src/lib/storage.ts';
import type { ProductItem } from '../src/types.ts';

const NOW_ISO = '2026-11-26T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

// Exact live-captured 30-day daily THB revenue_trend from Phase 16 Probe P1
// Target: Solomon Pyla Plus 9" Spring Mattress (1731299385569545105), 2026-11-26T11:57:41Z
const PROBE_P1_SOLOMON_30D_TREND = [
  675656, 424482, 618117, 608377, 729717, 680208, 569126, 899010, 942962, 1375192,
  1034222, 1180377, 1006091, 532565, 596020, 741046, 713040, 418998, 664299, 1002877,
  966135, 1029652, 1160085, 858925, 1265091, 842218, 786781, 863226, 1198493, 885432,
];

describe('Phase 17 — Verified Daily revenue_trend Intelligence & Probe P1 Integration', () => {
  it('1. Reconciles real Probe P1 30-day revenue_trend and computes exact 7d-vs-prev-7d growth', () => {
    const res = analyzeDetailRevenueTrend({
      dailyValues: PROBE_P1_SOLOMON_30D_TREND,
      reportedRevenueThb: 25268420.01,
      dateRange: 'last30Day',
    });

    assert.equal(res.status, 'VERIFIED_30D');
    assert.equal(res.daysCount, 30);
    assert.equal(res.sumThb, 25268420);
    assert.equal(res.reconciliationDiffThb, 0.01);
    assert.equal(res.reconciledWithRevenue, true);
    assert.equal(res.activeRevenueDays, 30);
    assert.equal(res.zeroRevenueDays, 0);
    assert.equal(res.minDayThb, 418998);
    assert.equal(res.maxDayThb, 1375192);
    assert.equal(res.last7dSumThb, 6700166);
    assert.equal(res.prev7dSumThb, 5955086);
    assert.equal(res.growth7dAbsThb, 745080);
    assert.equal(res.growth7dPct, 12.51);
    assert.equal(res.growth7dBaselineStatus, 'VALID');
    assert.equal(res.firstHalfSumThb, 11872122);
    assert.equal(res.secondHalfSumThb, 13396298);
    assert.equal(res.halfWindowGrowthPct, 12.84);
    assert.equal(res.classification, 'RISING');
  });

  it('2. Handles 7-day detail window honestly without fabricating 7d-vs-prev-7d growth', () => {
    const sevenDays = PROBE_P1_SOLOMON_30D_TREND.slice(-7);
    const res = analyzeDetailRevenueTrend({
      dailyValues: sevenDays,
      reportedRevenueThb: 6700166,
      dateRange: 'last7Day',
    });

    assert.equal(res.status, 'VERIFIED_7D');
    assert.equal(res.daysCount, 7);
    assert.equal(res.reconciledWithRevenue, true);
    assert.equal(res.last7dSumThb, 6700166);
    assert.equal(res.prev7dSumThb, null);
    assert.equal(res.growth7dPct, null);
    assert.equal(res.growth7dBaselineStatus, 'INSUFFICIENT_WINDOW');
    assert.equal(res.classification, 'INSUFFICIENT_HISTORY');
  });

  it('3. Handles ZERO_BASELINE, ALL_ZERO, DECLINING, STABLE, VOLATILE, and mismatch safely', () => {
    // ZERO_BASELINE (prev 7d = 0, last 7d > 0)
    const zeroBaseArr = [
      0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0,
      10000, 12000, 11000, 13000, 15000, 14000, 15000,
    ];
    const zeroBase = analyzeDetailRevenueTrend({
      dailyValues: zeroBaseArr,
      reportedRevenueThb: 90000,
      dateRange: 'last30Day',
    });
    assert.equal(zeroBase.status, 'VERIFIED_30D');
    assert.equal(zeroBase.growth7dBaselineStatus, 'ZERO_BASELINE');
    assert.equal(zeroBase.growth7dPct, null);
    assert.equal(zeroBase.growth7dAbsThb, 90000);
    assert.equal(zeroBase.classification, 'RISING');

    // ALL_ZERO
    const allZero = analyzeDetailRevenueTrend({
      dailyValues: Array(30).fill(0),
      reportedRevenueThb: 0,
      dateRange: 'last30Day',
    });
    assert.equal(allZero.growth7dBaselineStatus, 'ALL_ZERO');
    assert.equal(allZero.growth7dPct, null);
    assert.equal(allZero.classification, 'STABLE');

    // DECLINING (-30%)
    const decliningArr = [...Array(23).fill(100000), ...Array(7).fill(70000)];
    const declining = analyzeDetailRevenueTrend({
      dailyValues: decliningArr,
      reportedRevenueThb: 23 * 100000 + 7 * 70000,
      dateRange: 'last30Day',
    });
    assert.equal(declining.growth7dPct, -30);
    assert.equal(declining.classification, 'DECLINING');

    // STABLE (+2%)
    const stableArr = [...Array(23).fill(100000), ...Array(7).fill(102000)];
    const stable = analyzeDetailRevenueTrend({
      dailyValues: stableArr,
      reportedRevenueThb: 23 * 100000 + 7 * 102000,
      dateRange: 'last30Day',
    });
    assert.equal(stable.classification, 'STABLE');

    // VOLATILE (extreme spikes & zeros)
    const volatileArr = [
      0, 0, 500000, 0, 0, 0, 450000,
      0, 0, 0, 600000, 0, 0, 0,
      500000, 0, 0, 0, 0, 450000, 0,
      0, 0, 480000, 0, 0, 0, 520000, 0, 0,
    ];
    const volatile = analyzeDetailRevenueTrend({
      dailyValues: volatileArr,
      reportedRevenueThb: volatileArr.reduce((a, b) => a + b, 0),
      dateRange: 'last30Day',
    });
    assert.equal(volatile.classification, 'VOLATILE');

    // Reconciliation mismatch (> 2% divergence) -> INCOMPARABLE_DATA
    const mismatch = analyzeDetailRevenueTrend({
      dailyValues: PROBE_P1_SOLOMON_30D_TREND,
      reportedRevenueThb: 5000000,
      dateRange: 'last30Day',
    });
    assert.equal(mismatch.status, 'INCOMPARABLE_DATA');
    assert.equal(mismatch.reconciledWithRevenue, false);
    assert.equal(mismatch.classification, 'INCOMPARABLE_DATA');
    assert.equal(mismatch.incomparabilityReason, 'REVENUE_SUM_MISMATCH');

    // Invalid inputs -> null / INSUFFICIENT_DATA
    assert.equal(sanitizeRevenueTrendArray([]), null);
    assert.equal(sanitizeRevenueTrendArray([100, -5, 200]), null);
    assert.equal(sanitizeRevenueTrendArray([100, Number.NaN, 200]), null);
    assert.equal(sanitizeRevenueTrendArray(['100', '200']), null);
    const invalid = analyzeDetailRevenueTrend({
      dailyValues: [100, -1, 200],
      reportedRevenueThb: 300,
    });
    assert.equal(invalid.status, 'INSUFFICIENT_DATA');
    assert.equal(invalid.classification, 'INSUFFICIENT_HISTORY');
  });

  it('4. Extracts /detail revenue_trend & metadata while keeping scoringEngineV2 Competition & Quality strictly INSUFFICIENT', () => {
    const rawDetailRow: Record<string, unknown> = {
      product_id: '1731299385569545105',
      product_name: 'PAYDAY Solomon Pyla Plus 9 inch Spring Mattress',
      revenue: 25268420.01,
      video_revenue: 18788032.55,
      live_revenue: 6421598.33,
      shopping_mall_revenue: 58789.13,
      sales_volumn: 12071,
      unit_price: 2093.32,
      commission_rate: 7.000000000000001,
      creator_number: 860,
      video_number: 1518,
      live_number: 5237,
      product_review_count: 59540,
      launch_date: '2024-11-17',
      delivery_type: 'local',
      revenue_trend: PROBE_P1_SOLOMON_30D_TREND,
    };

    const extracted = extractMetricsFromRawRow(rawDetailRow, 'detail', NOW_ISO, {
      dateRange: 'last30Day',
      nowMs: NOW_MS,
    });
    assert.deepEqual(extracted.kalodataMetrics.revenueTrendThb, PROBE_P1_SOLOMON_30D_TREND);
    assert.equal(extracted.kalodataMetrics.videoCount, 1518);
    assert.equal(extracted.kalodataMetrics.liveCount, 5237);
    assert.equal(extracted.kalodataMetrics.launchDate, '2024-11-17');
    assert.equal(extracted.kalodataMetrics.deliveryType, 'local');
    assert.equal(extracted.kalodataMetrics.dateRange, 'last30Day');

    // Commercial V2 MUST NOT weaken Competition or Customer Quality gates
    const commercial = evaluateProductCommercialV2(extracted.validatedMetrics, { nowMs: NOW_MS });
    assert.equal(commercial.competitionScore.status, 'INSUFFICIENT');
    assert.equal(commercial.competitionScore.score, null);
    assert.equal(commercial.customerQualityScore.status, 'INSUFFICIENT');
    assert.equal(commercial.customerQualityScore.score, null);
    assert.equal(commercial.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(commercial.commercialOpportunityScore, null);

    // Product Evidence Summary surfaces verified 30d trend + Probe P1 honest provenance notes
    const parsed = parseRawProductRow(rawDetailRow, '1731299385569545105', 'detail', NOW_ISO, {
      dateRange: 'last30Day',
      nowMs: NOW_MS,
    });
    assert.ok(parsed);
    const product: ProductItem = {
      id: parsed.id,
      thaiTitle: parsed.thaiTitle,
      clearTitle: { en: parsed.thaiTitle, my: parsed.thaiTitle },
      whatItIs: { en: parsed.thaiTitle, my: parsed.thaiTitle },
      whySilentWorks: { en: '', my: '' },
      category: 'home',
      categoryLabel: { en: 'Home', my: 'အိမ်သုံး' },
      shopName: parsed.shopName,
      priceThb: parsed.priceThb,
      commissionRate: parsed.commissionRate,
      commissionThb: 146.53,
      visualTags: [],
      kalodataMetrics: parsed.kalodataMetrics,
      validatedMetrics: parsed.validatedMetrics,
      commercialScoreV2: commercial,
    };

    const summary = buildProductEvidenceSummary({
      product,
      validated: extracted.validatedMetrics,
      commercialScore: commercial,
      nowMs: NOW_MS,
    });

    assert.equal(summary.detailRevenueTrend.status, 'VERIFIED_30D');
    assert.equal(summary.detailRevenueTrend.growth7dPct, 12.51);
    assert.ok(summary.derivedCalculations.some((d) => d.id === 'derived_30d_revenue_trend'));

    const compNote = summary.unavailableEvidence.find((u) => u.id === 'competition_unavailable');
    assert.ok(compNote);
    assert.match(compNote.detail.en, /Window-verified 30d active creators \(860\)/);
    assert.match(compNote.detail.en, /excluded from Competition Score/);

    const qualityNote = summary.unavailableEvidence.find((u) => u.id === 'quality_unavailable');
    assert.ok(qualityNote);
    assert.match(qualityNote.detail.en, /Cumulative lifetime PDP reviews \(59,540\)/);
    assert.match(qualityNote.detail.en, /Star Rating is confirmed UNAVAILABLE/);
  });

  it('5. Preserves revenueTrendThb across coherent merges and isolates last7Day vs last30Day enrich caches', async () => {
    const merged = mergeKalodataMetrics(
      {
        salesVolume7d: 3257,
        revenueThb7d: 6929654,
        dateRange: 'last7Day',
        fetchedAt: '2026-11-26T11:55:00.000Z',
      },
      {
        salesVolume7d: 3257,
        revenueThb7d: 6929654,
        creatorCount: 343,
        reviewCount: 59540,
        revenueTrendThb: PROBE_P1_SOLOMON_30D_TREND.slice(-7),
        videoCount: 465,
        liveCount: 1413,
        launchDate: '2024-11-17',
        deliveryType: 'local',
        dateRange: 'last7Day',
        fetchedAt: '2026-11-26T11:50:00.000Z',
      }
    );
    assert.equal(merged?.revenueTrendThb?.length, 7);
    assert.equal(merged?.videoCount, 465);
    assert.equal(merged?.launchDate, '2024-11-17');

    // Mocked fetch test (0 live credits) for dateRange cache isolation on enrichSingleKalodataProduct
    clearKalodataCachesForTests();
    const prevEnvKey = process.env.KALODATA_API_KEY;
    delete process.env.KALODATA_API_KEY;
    setSessionKalodataKey('test-phase17-mock-key-000001');

    const requestedRanges: string[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/credit/balance')) {
        return new Response(
          JSON.stringify({ success: true, data: { totalRemain: 8.3, mainRemain: 8.3 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};
      requestedRanges.push(String(parsedBody.date_range));
      const is30 = parsedBody.date_range === 'last30Day';
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            product_id: '1731299385569545105',
            product_name: 'Solomon Mattress',
            revenue: is30 ? 25268420.01 : 6700166,
            sales_volumn: is30 ? 12071 : 3200,
            unit_price: 2093.32,
            commission_rate: 7,
            creator_number: is30 ? 860 : 343,
            product_review_count: 59540,
            revenue_trend: is30
              ? PROBE_P1_SOLOMON_30D_TREND
              : PROBE_P1_SOLOMON_30D_TREND.slice(-7),
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const r7 = await enrichSingleKalodataProduct('1731299385569545105', {
        includeDetails: true,
        includeSpecs: false,
        includeComments: false,
        dateRange: 'last7Day',
      });
      assert.equal(r7.kalodataMetrics?.dateRange, 'last7Day');
      assert.equal(r7.kalodataMetrics?.revenueTrendThb?.length, 7);

      // Same 7d call hits cache (0 extra upstream call)
      await enrichSingleKalodataProduct('1731299385569545105', {
        includeDetails: true,
        includeSpecs: false,
        includeComments: false,
        dateRange: 'last7Day',
      });
      assert.deepEqual(requestedRanges, ['last7Day']);

      // 30d call uses isolated cache key & returns 30-day revenue_trend
      const r30 = await enrichSingleKalodataProduct('1731299385569545105', {
        includeDetails: true,
        includeSpecs: false,
        includeComments: false,
        dateRange: 'last30Day',
      });
      assert.equal(r30.kalodataMetrics?.dateRange, 'last30Day');
      assert.equal(r30.kalodataMetrics?.revenueTrendThb?.length, 30);
      assert.deepEqual(requestedRanges, ['last7Day', 'last30Day']);
    } finally {
      globalThis.fetch = origFetch;
      clearSessionKalodataKey();
      clearKalodataCachesForTests();
      if (prevEnvKey !== undefined) {
        process.env.KALODATA_API_KEY = prevEnvKey;
      }
    }
  });
});
