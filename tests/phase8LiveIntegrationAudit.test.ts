import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearKalodataCachesForTests,
  clearSessionKalodataKey,
  enrichSingleKalodataProduct,
  fetchSingleKalodataProductById,
  parseRawProductRow,
  setSessionKalodataKey,
} from '../server/kalodata.ts';
import { computeDirectKalodataScore } from '../server/scoreEngine.ts';
import { sanitizeProductPayloadForAi } from '../server/productSanitizer.ts';
import {
  isUsableScoringMetric,
  validateCommissionRateMetric,
} from '../src/lib/metricFoundation.ts';
import {
  evaluateProductCommercialV2,
  rankCommercialOpportunitiesV2,
} from '../src/lib/scoringEngineV2.ts';
import { evaluateProductStrategiesV2 } from '../src/lib/strategyEngineV2.ts';
import {
  classifyMetricProvenance,
  summarizeProductProvenance,
} from '../src/lib/productIntelligenceView.ts';
import {
  mergeKalodataMetrics,
  mergeValidatedMetricsSnapshots,
} from '../src/lib/storage.ts';
import { buildExternalAiChatPrompt } from '../src/lib/aiChatPromptBuilder.ts';
import type { ProductItem } from '../src/types.ts';

const NOW_ISO = '2026-11-25T10:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

/**
 * Sanitized live Phase 0 captured fixtures (2026-11-25) for product 1731661332013680750
 * from POST /openapi/v1/tiktok/product/rank and POST /openapi/v1/tiktok/product/detail.
 */
const CAPTURED_RANK_ROW: Record<string, unknown> = {
  product_id: '1731661332013680750',
  product_name: 'Sample Live Health Supplement Pack TH',
  unit_price: 491.32,
  min_price: 459,
  max_price: 990,
  commission_rate: 10,
  sales_volumn: 16965,
  revenue: 8335227.33,
  video_revenue: 6017972.18,
  live_revenue: 2317032.28,
  showcase_revenue: 222.87,
  revenue_growth_rate: -44.25,
  pri_category: {
    category_id: '700645',
    category_name: 'Health',
  },
};

const CAPTURED_DETAIL_ROW: Record<string, unknown> = {
  product_id: '1731661332013680750',
  product_name: 'Sample Live Health Supplement Pack TH',
  shop_name: 'Sample Official Store TH',
  unit_price: 491.32,
  commission_rate: 10,
  sales_volumn: 16965,
  revenue: 8335227.33,
  video_revenue: 6017972.18,
  live_revenue: 2317032.28,
  shopping_mall_revenue: 222.87,
  creator_number: 1824,
  product_review_count: 44372,
  product_description: 'Official Thailand TikTok Shop supplement listing.',
};

const CAPTURED_POSITIVE_GROWTH_RANK_ROW: Record<string, unknown> = {
  product_id: '1731661332013680751',
  product_name: 'Sample Live Beauty Serum TH',
  unit_price: 299,
  commission_rate: 15,
  sales_volumn: 8420,
  revenue: 2517580.5,
  video_revenue: 1950000.25,
  live_revenue: 420000.25,
  showcase_revenue: 147580,
  revenue_growth_rate: 17.75,
  pri_category: {
    category_id: '601450',
    category_name: 'Beauty & Personal Care',
  },
};

describe('Phase 8: Live Data Integration Audit & Scoring Revalidation', () => {
  it('1. Maps all 9 live Kalodata fields + nested pri_category accurately across /rank and /detail', () => {
    const rankRaw = parseRawProductRow(CAPTURED_RANK_ROW, 'fallback-1', 'rank', NOW_ISO);
    const detailRaw = parseRawProductRow(CAPTURED_DETAIL_ROW, 'fallback-1', 'detail', NOW_ISO);

    assert.ok(rankRaw, 'rank row parsed');
    assert.ok(detailRaw, 'detail row parsed');

    // Nested pri_category object extracted cleanly on /rank
    assert.equal(rankRaw.rawCategoryId, '700645');
    assert.equal(rankRaw.categoryHint, 'Health');

    // Verified THB revenue channel reconciliation: video + live + showcase/shopping_mall == total revenue
    assert.equal(rankRaw.validatedMetrics.revenueThb7d.value, 8335227.33);
    assert.equal(rankRaw.validatedMetrics.videoRevenueThb7d.value, 6017972.18);
    assert.equal(rankRaw.validatedMetrics.liveRevenueThb7d.value, 2317032.28);
    assert.equal(rankRaw.validatedMetrics.shoppingMallRevenueThb7d?.value, 222.87);
    assert.equal(detailRaw.validatedMetrics.shoppingMallRevenueThb7d?.value, 222.87);
    assert.equal(rankRaw.kalodataMetrics.shoppingMallRevenueThb7d, 222.87);
    assert.equal(detailRaw.kalodataMetrics.shoppingMallRevenueThb7d, 222.87);

    const channelSum =
      (rankRaw.validatedMetrics.videoRevenueThb7d.value ?? 0) +
      (rankRaw.validatedMetrics.liveRevenueThb7d.value ?? 0) +
      (rankRaw.validatedMetrics.shoppingMallRevenueThb7d?.value ?? 0);
    assert.ok(Math.abs(channelSum - 8335227.33) < 0.01);

    // Verified sales_volumn
    assert.equal(rankRaw.validatedMetrics.salesVolume7d.state, 'OK');
    assert.equal(rankRaw.validatedMetrics.salesVolume7d.value, 16965);

    // Verified commission_rate percentage-point unit (10 -> 10%) unlocks synthetic commissionThb
    assert.equal(rankRaw.commissionRate, 10);
    assert.equal(rankRaw.validatedMetrics.commissionRate.state, 'OK');
    assert.equal(rankRaw.validatedMetrics.commissionRate.unit, 'PERCENT');
    assert.equal(rankRaw.validatedMetrics.commissionRate.value, 10);
    assert.equal(rankRaw.validatedMetrics.commissionThb.state, 'OK');
    assert.equal(rankRaw.validatedMetrics.commissionThb.provenance, 'SYNTHETIC');
    assert.equal(rankRaw.validatedMetrics.commissionThb.value, 49.13);

    // Verified revenue_growth_rate percentage-point unit on /rank, while comparison period remains UNVERIFIED
    assert.equal(rankRaw.validatedMetrics.revenueGrowthRate.state, 'OK');
    assert.equal(rankRaw.validatedMetrics.revenueGrowthRate.unit, 'PERCENT');
    assert.equal(rankRaw.validatedMetrics.revenueGrowthRate.value, -44.25);
    assert.match(
      rankRaw.validatedMetrics.revenueGrowthRate.note ?? '',
      /UNVERIFIED_COMPARISON_PERIOD/
    );
    assert.equal(detailRaw.validatedMetrics.revenueGrowthRate.state, 'MISSING');

    // creator_number mapped on /detail, absent on /rank, time-window scope stays UNVERIFIED
    assert.equal(rankRaw.kalodataMetrics.creatorCount, null);
    assert.equal(detailRaw.kalodataMetrics.creatorCount, 1824);
    assert.equal(detailRaw.validatedMetrics.creatorCount.rawInput, 1824);
    assert.equal(detailRaw.validatedMetrics.creatorCount.state, 'UNAVAILABLE');
    assert.equal(detailRaw.validatedMetrics.creatorCount.unit, 'UNVERIFIED');
    assert.equal(detailRaw.validatedMetrics.creatorCount.value, null);

    // product_review_count mapped on /detail, absent on /rank, time-window semantics stay UNVERIFIED
    assert.equal(rankRaw.kalodataMetrics.reviewCount, null);
    assert.equal(detailRaw.kalodataMetrics.reviewCount, 44372);
    assert.equal(detailRaw.validatedMetrics.reviewCount.rawInput, 44372);
    assert.equal(detailRaw.validatedMetrics.reviewCount.state, 'UNAVAILABLE');
    assert.equal(detailRaw.validatedMetrics.reviewCount.unit, 'UNVERIFIED');
    assert.equal(detailRaw.validatedMetrics.reviewCount.value, null);

    // rating strictly UNAVAILABLE on tested /rank and /detail endpoints
    assert.equal(rankRaw.kalodataMetrics.rating, null);
    assert.equal(detailRaw.kalodataMetrics.rating, null);
    assert.equal(rankRaw.validatedMetrics.rating.state, 'UNAVAILABLE');
    assert.equal(detailRaw.validatedMetrics.rating.state, 'UNAVAILABLE');
    assert.equal(rankRaw.validatedMetrics.rating.value, null);
    assert.equal(detailRaw.validatedMetrics.rating.value, null);
  });

  it('2. Never multiplies sub-1 commission_rate by 100 or fabricates missing/unverified values into zeros', () => {
    const subOne = validateCommissionRateMetric(0.5, { fetchedAt: NOW_ISO, nowMs: NOW_MS });
    assert.equal(subOne.state, 'UNAVAILABLE');
    assert.equal(subOne.unit, 'UNVERIFIED');
    assert.equal(subOne.value, null);
    assert.equal(subOne.rawInput, 0.5);
    assert.equal(isUsableScoringMetric(subOne), false);

    const parsedSubOne = parseRawProductRow(
      {
        product_id: '1731661332013680999',
        product_name: 'Sub-1 Commission Probe',
        unit_price: 200,
        commission_rate: 0.5,
      },
      'fallback',
      'rank',
      NOW_ISO
    );
    assert.ok(parsedSubOne);
    // Must never inflate 0.5 to 50%
    assert.equal(parsedSubOne.commissionRate, null);
    assert.equal(parsedSubOne.validatedMetrics.commissionRate.state, 'UNAVAILABLE');
    assert.equal(parsedSubOne.validatedMetrics.commissionThb.state, 'UNAVAILABLE');
    // Missing revenue & sales must remain MISSING / null, never fabricated as 0
    assert.equal(parsedSubOne.kalodataMetrics.revenueThb7d, null);
    assert.equal(parsedSubOne.kalodataMetrics.salesVolume7d, null);
    assert.equal(parsedSubOne.validatedMetrics.revenueThb7d.state, 'MISSING');
    assert.equal(parsedSubOne.validatedMetrics.salesVolume7d.state, 'MISSING');

    // Explicit 0% commission stays ZERO (NOT_MONETIZABLE)
    const zeroComm = validateCommissionRateMetric(0, { fetchedAt: NOW_ISO, nowMs: NOW_MS });
    assert.equal(zeroComm.state, 'ZERO');
    assert.equal(zeroComm.unit, 'PERCENT');
    assert.equal(zeroComm.value, 0);
  });

  it('3. Revalidates all 4 commercial dimensions, Data Confidence, Conversion Evidence, and all 8 strategies on live captured data', () => {
    const rankRow = parseRawProductRow(CAPTURED_POSITIVE_GROWTH_RANK_ROW, 'f', 'rank', NOW_ISO)!;
    const detailRow = parseRawProductRow(CAPTURED_DETAIL_ROW, 'f', 'detail', NOW_ISO)!;

    const rankScore = evaluateProductCommercialV2(rankRow.validatedMetrics, { nowMs: NOW_MS });
    const detailScore = evaluateProductCommercialV2(detailRow.validatedMetrics, { nowMs: NOW_MS });

    // Demand & Earning now score cleanly using verified THB, COUNT, and PERCENT commission_rate
    assert.equal(rankScore.demandScore.status, 'SCORED');
    assert.ok((rankScore.demandScore.score ?? 0) > 60);
    // Growth (+17.75%) is kept UNVERIFIED until comparison baseline is verified
    assert.equal(rankScore.demandScore.growthStatus, 'UNVERIFIED');
    assert.equal(rankScore.demandScore.subcomponents.growthScore, null);
    assert.equal(rankScore.demandScore.subcomponents.verifiedGrowthPercent, null);

    assert.equal(rankScore.earningScore.status, 'SCORED');
    assert.equal(rankScore.earningScore.verifiedCommissionPercent, 15);
    assert.equal(rankScore.earningScore.payoutPerSaleThb, 44.85);
    assert.ok((rankScore.earningScore.score ?? 0) > 60);

    // Competition MUST stay INSUFFICIENT (null) even when /detail returns creator_number: 1824,
    // so missing/unverified creator metrics NEVER produce an unjustifiably high competition score
    assert.equal(rankScore.competitionScore.status, 'INSUFFICIENT');
    assert.equal(rankScore.competitionScore.score, null);
    assert.equal(detailScore.competitionScore.status, 'INSUFFICIENT');
    assert.equal(detailScore.competitionScore.score, null);

    // Customer Quality MUST stay INSUFFICIENT because rating is UNAVAILABLE and review scope is UNVERIFIED
    assert.equal(rankScore.customerQualityScore.status, 'INSUFFICIENT');
    assert.equal(rankScore.customerQualityScore.score, null);
    assert.equal(detailScore.customerQualityScore.status, 'INSUFFICIENT');
    assert.equal(detailScore.customerQualityScore.score, null);

    // Only 2/4 dimensions scored (Demand + Earning) -> Gate 2 keeps Commercial Opportunity INSUFFICIENT_DATA (null)
    assert.equal(rankScore.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(rankScore.commercialOpportunityScore, null);
    assert.equal(detailScore.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(detailScore.commercialOpportunityScore, null);

    // Conversion Evidence remains strictly tracked and separated from Commercial Opportunity
    assert.equal(rankScore.conversionEvidence.evidenceLevel, 'STRONG');
    assert.equal(rankScore.conversionEvidence.dominantChannel, 'VIDEO');
    assert.ok(
      (rankScore.conversionEvidence.videoRevenueShare ?? 0) > 0.7 &&
        (rankScore.conversionEvidence.videoRevenueShare ?? 0) < 0.85
    );
    assert.match(rankScore.conversionEvidence.disclaimer, /does not guarantee/i);

    // Data Confidence reflects the honest gap (4/8 verified SOURCE inputs; missing/unverified competition, growth baseline, quality)
    assert.ok(rankScore.dataConfidence.score < 55);
    assert.equal(rankScore.dataConfidence.level, 'LOW');

    // UI provenance recognizes unverified growth comparison period
    assert.equal(classifyMetricProvenance(rankRow.validatedMetrics.revenueGrowthRate), 'unverified');
    const provSummary = summarizeProductProvenance(rankRow.validatedMetrics);
    assert.equal(provSummary.hasUnverifiedCoreMetrics, true);

    // Strategy eligibility revalidation on real unverified-creator/rating live rows:
    // No strategy should falsely QUALIFY without verified competition / quality / growth baseline.
    const strategies = evaluateProductStrategiesV2(rankRow.validatedMetrics, rankScore, {
      scoringConfig: { nowMs: NOW_MS },
    });
    assert.equal(strategies.qualifiedStrategyIds.length, 0);
    for (const strat of Object.values(strategies.strategies)) {
      assert.notEqual(strat.eligibilityStatus, 'QUALIFIED');
    }
    assert.equal(strategies.strategies.early_market_opportunity.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(strategies.strategies.underserved_demand.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(strategies.strategies.creator_yield_opportunity.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(strategies.strategies.trust_based_winners.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(strategies.strategies.fast_rising_products.eligibilityStatus, 'DATA_UNAVAILABLE');
    assert.equal(strategies.strategies.trend_timing_opportunity.eligibilityStatus, 'DATA_UNAVAILABLE');

    // Pool ranking remains deterministic with 0% commission demoted to NOT_MONETIZABLE
    const zeroCommRow = parseRawProductRow(
      { ...CAPTURED_RANK_ROW, product_id: '1731661332013680799', commission_rate: 0 },
      'f',
      'rank',
      NOW_ISO
    )!;
    const ranked = rankCommercialOpportunitiesV2(
      [zeroCommRow.validatedMetrics, rankRow.validatedMetrics],
      { nowMs: NOW_MS }
    );
    assert.equal(ranked.results[0].score.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.equal(ranked.results[1].score.eligibilityStatus, 'NOT_MONETIZABLE');
  });

  it('4. Fixes 100x growth formatting bug in prompt builder & V1 scoreEngine percentage-point threshold', () => {
    const product: ProductItem = {
      id: '1731661332013680750',
      thaiTitle: 'เซรั่มบำรุงผิวหน้า',
      clearTitle: { my: 'မျက်နှာဆီရမ်', en: 'Facial Serum' },
      whatItIs: { my: 'အသားအရေထိန်းသိမ်းပစ္စည်း', en: 'Skincare serum' },
      whySilentWorks: { my: 'ရလဒ်မြင်သာ', en: 'Clear visual demo' },
      category: 'beauty',
      categoryLabel: { my: 'အလှကုန်', en: 'Beauty' },
      shopName: 'Sample Shop',
      priceThb: 299,
      commissionRate: 10,
      commissionThb: 29.9,
      visualTags: [],
      kalodataMetrics: {
        salesVolume7d: 500,
        revenueThb7d: 149500,
        videoRevenueThb7d: 110000,
        liveRevenueThb7d: 39000,
        shoppingMallRevenueThb7d: 500,
        revenueGrowthRate: -1.8,
        creatorCount: 1824,
        rating: null,
        reviewCount: 44372,
        dateRange: 'last7Day',
        fetchedAt: NOW_ISO,
      },
    };

    const prompt = buildExternalAiChatPrompt(product);
    // Must render -1.8%, NOT -180%
    assert.match(prompt, /-1\.8%/);
    assert.doesNotMatch(prompt, /-180%/);
    assert.match(prompt, /Comparison Baseline Unverified/i);
    assert.match(prompt, /Time-Window Scope Unverified/i);
    assert.match(prompt, /Rating Unavailable on Tested Endpoints/i);

    // Product sanitizer preserves shoppingMallRevenueThb7d
    const sanitized = sanitizeProductPayloadForAi(product);
    assert.equal(sanitized.kalodataMetrics?.shoppingMallRevenueThb7d, 500);

    // Legacy V1 scoreEngine treats revenueGrowthRate as percentage points (>= 20 -> +6, 1..19 -> +3)
    const smallGrowthScore = computeDirectKalodataScore({
      thaiTitle: 'เซรั่ม',
      category: 'beauty',
      priceThb: 299,
      commissionRate: 10,
      commissionThb: 29.9,
      salesVolume7d: 100,
      revenueThb7d: 29900,
      videoRevenueThb7d: 20000,
      revenueGrowthRate: 2.5,
      hasImage: true,
    });
    const highGrowthScore = computeDirectKalodataScore({
      thaiTitle: 'เซรั่ม',
      category: 'beauty',
      priceThb: 299,
      commissionRate: 10,
      commissionThb: 29.9,
      salesVolume7d: 100,
      revenueThb7d: 29900,
      videoRevenueThb7d: 20000,
      revenueGrowthRate: 25,
      hasImage: true,
    });
    assert.ok(highGrowthScore.salesDemand > smallGrowthScore.salesDemand);
  });

  it('5. Complements /rank + /detail within 6h coherent window without mixing >6h stale snapshots', () => {
    const rankTs = '2026-11-25T10:00:00.000Z';
    const detailSameSessionTs = '2026-11-25T10:03:00.000Z';
    const staleDetailTs = '2026-11-24T01:00:00.000Z';

    const rankRow = parseRawProductRow(CAPTURED_RANK_ROW, 'f', 'rank', rankTs)!;
    const detailRow = parseRawProductRow(CAPTURED_DETAIL_ROW, 'f', 'detail', detailSameSessionTs)!;
    const staleDetailRow = parseRawProductRow(CAPTURED_DETAIL_ROW, 'f', 'detail', staleDetailTs)!;

    // Coherent 3-minute enrichment preserves /rank's revenueGrowthRate AND /detail's creator_number & product_review_count
    const mergedKalo = mergeKalodataMetrics(detailRow.kalodataMetrics, rankRow.kalodataMetrics);
    const mergedVal = mergeValidatedMetricsSnapshots(
      detailRow.validatedMetrics,
      rankRow.validatedMetrics
    );
    assert.equal(mergedKalo?.revenueGrowthRate, -44.25);
    assert.equal(mergedKalo?.creatorCount, 1824);
    assert.equal(mergedKalo?.reviewCount, 44372);
    assert.equal(mergedKalo?.shoppingMallRevenueThb7d, 222.87);

    assert.equal(mergedVal?.revenueGrowthRate.value, -44.25);
    assert.equal(mergedVal?.creatorCount.rawInput, 1824);
    assert.equal(mergedVal?.reviewCount.rawInput, 44372);
    assert.equal(mergedVal?.rating.state, 'UNAVAILABLE');
    assert.ok(mergedVal?.unresolvedFields.includes('revenueGrowthRate'));
    assert.ok(mergedVal?.unresolvedFields.includes('creatorCount'));
    assert.ok(mergedVal?.unresolvedFields.includes('reviewCount'));
    assert.ok(mergedVal?.unresolvedFields.includes('rating'));

    // >6h older snapshot must NOT leak creatorCount into newer /rank snapshot
    const nonMixedKalo = mergeKalodataMetrics(
      rankRow.kalodataMetrics,
      staleDetailRow.kalodataMetrics
    );
    const nonMixedVal = mergeValidatedMetricsSnapshots(
      rankRow.validatedMetrics,
      staleDetailRow.validatedMetrics
    );
    assert.equal(nonMixedKalo?.creatorCount, null);
    assert.equal(nonMixedVal?.creatorCount.rawInput, null);
  });

  describe('6. Server-side per-layer enrichment cache eliminates duplicate /detail billing (0 live credits)', () => {
    const originalFetch = globalThis.fetch;
    const originalEnvKey = process.env.KALODATA_API_KEY;
    let detailPostCount = 0;

    beforeEach(() => {
      detailPostCount = 0;
      delete process.env.KALODATA_API_KEY;
      clearSessionKalodataKey();
      clearKalodataCachesForTests();
      setSessionKalodataKey('test-only-dummy-key-1234567890');

      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/credit/balance')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { totalRemain: 9.9, mainRemain: 9.9, subRemain: null },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.endsWith('/tiktok/product/detail')) {
          detailPostCount += 1;
          return new Response(
            JSON.stringify({
              success: true,
              data: CAPTURED_DETAIL_ROW,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`Unexpected mocked fetch URL: ${url}`);
      }) as typeof fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      clearSessionKalodataKey();
      clearKalodataCachesForTests();
      if (originalEnvKey !== undefined) {
        process.env.KALODATA_API_KEY = originalEnvKey;
      } else {
        delete process.env.KALODATA_API_KEY;
      }
    });

    it('Reuses cached /tiktok/product/detail from single-link lookup when Studio enrichment requests includeDetails', async () => {
      const single = await fetchSingleKalodataProductById({
        productId: '1731661332013680750',
        forceRefresh: true,
      });
      assert.equal(single.products.length, 1);
      assert.equal(detailPostCount, 1);

      // Immediately calling enrichSingleKalodataProduct({ includeDetails: true }) should hit the 30-min layer cache (0 extra upstream calls, 0 credits)
      const enriched = await enrichSingleKalodataProduct('1731661332013680750', {
        includeDetails: true,
        includeSpecs: false,
        includeComments: false,
      });
      assert.equal(detailPostCount, 1);
      assert.equal(enriched.creditsUsed, 0);
      assert.equal(enriched.deepInsights.fetchedDetails, true);
      assert.equal(enriched.kalodataMetrics?.creatorCount, 1824);
      assert.equal(enriched.kalodataMetrics?.reviewCount, 44372);
      assert.equal(enriched.validatedMetrics?.rating.state, 'UNAVAILABLE');
    });

    it('Caches repeated enrichSingleKalodataProduct calls within TTL with 0 extra upstream requests', async () => {
      const first = await enrichSingleKalodataProduct('1731661332013680750', {
        includeDetails: true,
        includeSpecs: false,
        includeComments: false,
      });
      assert.equal(detailPostCount, 1);
      assert.equal(first.deepInsights.fetchedDetails, true);

      const second = await enrichSingleKalodataProduct('1731661332013680750', {
        includeDetails: true,
        includeSpecs: false,
        includeComments: false,
      });
      assert.equal(detailPostCount, 1);
      assert.equal(second.creditsUsed, 0);
      assert.equal(second.kalodataMetrics?.creatorCount, 1824);
    });
  });
});
