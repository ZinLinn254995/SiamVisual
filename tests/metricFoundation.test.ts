import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptProductItemToValidatedMetrics,
  adaptRawKalodataRowToValidatedMetrics,
  computeSyntheticCommissionThb,
  computeSyntheticRevenueEstimate,
  DEFAULT_METRIC_STALE_MS,
  isUsableScoringMetric,
  parseStrictFiniteNumber,
  parseStrictNumericInput,
  validateCommissionRateMetric,
  validateNumericMetric,
  validatePriceThbMetric,
  validateUnverifiedNumericMetric,
} from '../src/lib/metricFoundation.ts';
import { parseRawProductRow } from '../server/kalodata.ts';
import { computeDirectKalodataScore } from '../server/scoreEngine.ts';
import {
  hydrateProductFromStorage,
  saveAiExplanationsForProducts,
  saveDeepInsightForProduct,
} from '../src/lib/storage.ts';
import type { ProductItem } from '../src/types.ts';

const NOW_ISO = '2026-11-25T03:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

describe('Phase 1 — Unified ValidatedMetric & Normalization Foundation', () => {
  it('1. Distinguishes genuine numeric zero (ZERO) from missing', () => {
    const zeroCount = validateNumericMetric({
      rawInput: 0,
      unit: 'COUNT',
      fetchedAt: NOW_ISO,
      nowMs: NOW_MS,
      dateRange: 'last7Day',
    });
    assert.equal(zeroCount.state, 'ZERO');
    assert.equal(zeroCount.value, 0);
    assert.equal(zeroCount.rawInput, 0);
    assert.equal(zeroCount.provenance, 'SOURCE');

    const zeroFromString = validateNumericMetric({
      rawInput: '0',
      unit: 'THB',
      fetchedAt: NOW_ISO,
      nowMs: NOW_MS,
      dateRange: 'last7Day',
    });
    assert.equal(zeroFromString.state, 'ZERO');
    assert.equal(zeroFromString.value, 0);
    assert.equal(zeroFromString.rawInput, '0');

    const zeroCommission = validateCommissionRateMetric(0, {
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      nowMs: NOW_MS,
    });
    assert.equal(zeroCommission.state, 'ZERO');
    assert.equal(zeroCommission.value, 0);
    assert.equal(zeroCommission.unit, 'PERCENT');
  });

  it('2. Marks null, undefined, and blank string inputs as MISSING', () => {
    for (const rawInput of [null, undefined, '', '   ']) {
      const m = validateNumericMetric({
        rawInput,
        unit: 'THB',
        fetchedAt: NOW_ISO,
        nowMs: NOW_MS,
        dateRange: 'last7Day',
      });
      assert.equal(m.state, 'MISSING');
      assert.equal(m.value, null);
    }

    const unsupported = validateNumericMetric({
      rawInput: undefined,
      unit: 'COUNT',
      fetchedAt: NOW_ISO,
      nowMs: NOW_MS,
      missingAsUnavailable: true,
      unavailableReason: 'Endpoint does not supply metric.',
    });
    assert.equal(unsupported.state, 'UNAVAILABLE');
    assert.equal(unsupported.value, null);
  });

  it('3. Marks invalid numeric strings and range strings as INVALID without coercing to zero', () => {
    const badInputs = ['abc', '12abc', '1.2.3', 'NaN', 'Infinity', '฿199 - ฿299', '199-299', '199.00-299.00', {}, true];
    for (const bad of badInputs) {
      assert.equal(parseStrictFiniteNumber(bad), null);
      const metric = validatePriceThbMetric(bad, {
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        nowMs: NOW_MS,
      });
      assert.equal(metric.state, 'INVALID');
      assert.equal(metric.value, null);
      assert.deepEqual(metric.rawInput, bad);
    }

    const parsedRange = parseStrictNumericInput('฿199.50 - ฿299.50');
    assert.deepEqual(parsedRange, { kind: 'range', min: 199.5, max: 299.5 });
  });

  it('4. Rejects negative values where disallowed without coercing to zero, while permitting negatives when configured', () => {
    const negSales = validateNumericMetric({
      rawInput: -15,
      unit: 'COUNT',
      allowNegative: false,
      fetchedAt: NOW_ISO,
      nowMs: NOW_MS,
    });
    assert.equal(negSales.state, 'INVALID');
    assert.equal(negSales.value, null);
    assert.equal(negSales.rawInput, -15);

    const zeroPrice = validatePriceThbMetric(0, {
      fetchedAt: NOW_ISO,
      nowMs: NOW_MS,
    });
    assert.equal(zeroPrice.state, 'INVALID');
    assert.equal(zeroPrice.value, null);

    // Negative growth rate preserved in rawInput as UNAVAILABLE (unverified unit) rather than INVALID
    const negGrowth = validateUnverifiedNumericMetric(-0.42, {
      allowNegative: true,
      unverifiedNote: 'Unverified growth unit.',
      context: { fetchedAt: NOW_ISO, nowMs: NOW_MS },
    });
    assert.equal(negGrowth.state, 'UNAVAILABLE');
    assert.equal(negGrowth.value, null);
    assert.equal(negGrowth.rawInput, -0.42);
  });

  it('5. Normalizes valid numeric values cleanly with verified units', () => {
    const price = validatePriceThbMetric('฿1,290.50', {
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      nowMs: NOW_MS,
    });
    assert.equal(price.state, 'OK');
    assert.equal(price.value, 1290.5);
    assert.equal(price.unit, 'THB');
    assert.equal(price.provenance, 'SOURCE');

    const sales = validateNumericMetric({
      rawInput: 13853,
      unit: 'COUNT',
      integerOnly: true,
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      nowMs: NOW_MS,
    });
    assert.equal(sales.state, 'OK');
    assert.equal(sales.value, 13853);
  });

  it('6. Separates SYNTHETIC provenance from SOURCE provenance and avoids artificial 1 THB commission floor', () => {
    const price = validatePriceThbMetric(29, { fetchedAt: NOW_ISO, nowMs: NOW_MS });
    const verifiedRate = validateNumericMetric({
      rawInput: 2,
      unit: 'PERCENT',
      provenance: 'SOURCE',
      fetchedAt: NOW_ISO,
      nowMs: NOW_MS,
    });
    const payout = computeSyntheticCommissionThb(price, verifiedRate);
    assert.equal(payout.provenance, 'SYNTHETIC');
    assert.equal(payout.state, 'OK');
    assert.equal(payout.value, 0.58);
    assert.equal(payout.unit, 'THB');

    const zeroRate = validateCommissionRateMetric(0, { fetchedAt: NOW_ISO, nowMs: NOW_MS });
    const zeroPayout = computeSyntheticCommissionThb(price, zeroRate);
    assert.equal(zeroPayout.provenance, 'SYNTHETIC');
    assert.equal(zeroPayout.state, 'ZERO');
    assert.equal(zeroPayout.value, 0);

    const sales = validateNumericMetric({
      rawInput: 100,
      unit: 'COUNT',
      fetchedAt: NOW_ISO,
      nowMs: NOW_MS,
    });
    const syntheticRev = computeSyntheticRevenueEstimate(sales, price);
    assert.equal(syntheticRev.provenance, 'SYNTHETIC');
    assert.equal(syntheticRev.state, 'OK');
    assert.equal(syntheticRev.value, 2900);
  });

  it('7. Detects stale metrics based on fetchedAt timestamp vs TTL', () => {
    const oldFetchedAt = new Date(NOW_MS - DEFAULT_METRIC_STALE_MS - 60_000).toISOString();
    const staleRev = validateNumericMetric({
      rawInput: 50000,
      unit: 'THB',
      fetchedAt: oldFetchedAt,
      nowMs: NOW_MS,
      dateRange: 'last7Day',
    });
    assert.equal(staleRev.state, 'STALE');
    assert.equal(staleRev.value, 50000);
    assert.equal(staleRev.rawInput, 50000);
    assert.equal(isUsableScoringMetric(staleRev), false);

    const badTs = validateNumericMetric({
      rawInput: 50000,
      unit: 'THB',
      fetchedAt: 'not-a-timestamp',
      nowMs: NOW_MS,
    });
    assert.equal(badTs.state, 'STALE');
    assert.equal(badTs.value, null);
    assert.equal(isUsableScoringMetric(badTs), false);
  });

  it('8 & 9. Marks unverified Phase 0 metrics as UNAVAILABLE/UNVERIFIED while preserving rawInput across all states', () => {
    const validated = adaptRawKalodataRowToValidatedMetrics(
      {
        unit_price: 129,
        commission_rate: 0.1,
        sales_volumn: 13853,
        revenue: 1780423,
        video_revenue: 1743604,
        live_revenue: 36819,
        revenue_growth_rate: 0.35,
        creator_count: 14,
        product_rating: 4.8,
        review_count: 320,
      },
      {
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
        sourceEndpoint: 'detail',
        nowMs: NOW_MS,
      }
    );

    assert.equal(validated.priceThb.state, 'OK');
    assert.equal(validated.priceThb.value, 129);
    assert.equal(validated.salesVolume7d.state, 'OK');
    assert.equal(validated.revenueThb7d.state, 'OK');
    assert.equal(validated.videoRevenueThb7d.state, 'OK');
    assert.equal(validated.liveRevenueThb7d.state, 'OK');

    // Unverified upstream semantics must keep rawInput and stay withheld from scoring
    assert.equal(validated.commissionRate.state, 'UNAVAILABLE');
    assert.equal(validated.commissionRate.unit, 'UNVERIFIED');
    assert.equal(validated.commissionRate.rawInput, 0.1);
    assert.equal(validated.commissionRate.value, null);

    assert.equal(validated.commissionThb.state, 'UNAVAILABLE');
    assert.equal(validated.commissionThb.provenance, 'SYNTHETIC');
    assert.equal(validated.commissionThb.value, null);

    // Verified percentage-point unit for revenue_growth_rate, while comparison period stays UNVERIFIED
    assert.equal(validated.revenueGrowthRate.state, 'OK');
    assert.equal(validated.revenueGrowthRate.unit, 'PERCENT');
    assert.equal(validated.revenueGrowthRate.value, 0.35);
    assert.equal(validated.revenueGrowthRate.rawInput, 0.35);
    assert.match(validated.revenueGrowthRate.note ?? '', /UNVERIFIED_COMPARISON_PERIOD/);

    assert.equal(validated.creatorCount.state, 'UNAVAILABLE');
    assert.equal(validated.creatorCount.rawInput, 14);
    assert.equal(validated.rating.state, 'UNAVAILABLE');
    assert.equal(validated.rating.rawInput, 4.8);
    assert.equal(validated.reviewCount.state, 'UNAVAILABLE');
    assert.equal(validated.reviewCount.rawInput, 320);

    assert.ok(validated.unresolvedFields.includes('commissionRate'));
    assert.ok(validated.unresolvedFields.includes('revenueGrowthRate'));
    assert.ok(validated.unresolvedFields.includes('creatorCount'));
    assert.ok(validated.unresolvedFields.includes('rating'));
    assert.ok(validated.unresolvedFields.includes('reviewCount'));
  });

  it('10. Prevents invalid, missing, unavailable, stale, and synthetic metrics from entering scoring', () => {
    const sourceOk = validatePriceThbMetric(199, { fetchedAt: NOW_ISO, nowMs: NOW_MS });
    const sourceZero = validateNumericMetric({
      rawInput: 0,
      unit: 'THB',
      fetchedAt: NOW_ISO,
      nowMs: NOW_MS,
    });
    const missing = validateNumericMetric({
      rawInput: null,
      unit: 'THB',
      fetchedAt: NOW_ISO,
      nowMs: NOW_MS,
    });
    const invalid = validatePriceThbMetric('199-299', { fetchedAt: NOW_ISO, nowMs: NOW_MS });
    const verifiedCommission = validateCommissionRateMetric(15, { fetchedAt: NOW_ISO, nowMs: NOW_MS });
    const unavailable = validateCommissionRateMetric(0.15, { fetchedAt: NOW_ISO, nowMs: NOW_MS });
    const stale = validatePriceThbMetric(199, {
      fetchedAt: new Date(NOW_MS - DEFAULT_METRIC_STALE_MS - 1000).toISOString(),
      nowMs: NOW_MS,
    });
    const synthetic = computeSyntheticRevenueEstimate(
      validateNumericMetric({ rawInput: 10, unit: 'COUNT', fetchedAt: NOW_ISO, nowMs: NOW_MS }),
      sourceOk
    );

    assert.equal(isUsableScoringMetric(sourceOk), true);
    assert.equal(isUsableScoringMetric(sourceZero), true);
    assert.equal(isUsableScoringMetric(verifiedCommission), true);
    assert.equal(verifiedCommission.unit, 'PERCENT');
    assert.equal(verifiedCommission.value, 15);
    assert.equal(isUsableScoringMetric(missing), false);
    assert.equal(isUsableScoringMetric(invalid), false);
    assert.equal(isUsableScoringMetric(unavailable), false);
    assert.equal(isUsableScoringMetric(stale), false);
    assert.equal(isUsableScoringMetric(synthetic), false);
    assert.equal(isUsableScoringMetric(synthetic, { allowSynthetic: true }), true);
  });

  it('Integrates safely with Kalodata parser + V1 scoreEngine without synthesizing missing revenue in validatedMetrics', () => {
    const raw = parseRawProductRow(
      {
        product_id: '173755248421',
        product_name: 'เสื้อชั้นในไร้โครง',
        unit_price: 129,
        commission_rate: 0,
        sales_volumn: 250,
        // revenue intentionally omitted
        video_revenue: 0,
        product_rating: 0,
      },
      'fallback_1',
      'rank',
      NOW_ISO
    );

    assert.ok(raw);
    assert.equal(raw.commissionRate, 0);
    assert.equal(raw.kalodataMetrics.rating, 0);
    assert.equal(raw.kalodataMetrics.fetchedAt, NOW_ISO);

    // Phase 1 validatedMetrics does NOT fake revenue from sales * price
    assert.equal(raw.validatedMetrics.revenueThb7d.state, 'MISSING');
    assert.equal(raw.validatedMetrics.revenueThb7d.value, null);
    assert.equal(raw.validatedMetrics.videoRevenueThb7d.state, 'ZERO');
    assert.equal(raw.validatedMetrics.videoRevenueThb7d.value, 0);
    assert.equal(raw.validatedMetrics.commissionRate.state, 'ZERO');
    assert.equal(raw.validatedMetrics.commissionThb.state, 'ZERO');
    assert.equal(raw.validatedMetrics.commissionThb.value, 0);

    // V1 score engine remains operational and compatible
    const v1Score = computeDirectKalodataScore({
      thaiTitle: raw.thaiTitle,
      category: 'fashion',
      priceThb: raw.priceThb,
      commissionRate: raw.commissionRate,
      commissionThb: 0,
      salesVolume7d: raw.salesVolume7d,
      revenueThb7d: raw.revenueThb7d,
      videoRevenueThb7d: raw.videoRevenueThb7d,
      revenueGrowthRate: raw.revenueGrowthRate,
      hasImage: false,
    });
    assert.ok(v1Score.total >= 0 && v1Score.total <= 100);
  });

  it('Adapts legacy ProductItem cleanly when validatedMetrics is absent', () => {
    const legacyProduct: ProductItem = {
      id: 'legacy_1',
      thaiTitle: 'สินค้าทดสอบ',
      clearTitle: { my: 'Test', en: 'Test' },
      whatItIs: { my: 'Test', en: 'Test' },
      whySilentWorks: { my: 'Test', en: 'Test' },
      category: 'home',
      categoryLabel: { my: 'Home', en: 'Home' },
      shopName: 'Shop TH',
      priceThb: 299,
      commissionRate: null,
      commissionThb: null,
      visualTags: [],
      kalodataMetrics: {
        salesVolume7d: 40,
        revenueThb7d: null,
        videoRevenueThb7d: 0,
        dateRange: 'last7Day',
      },
    };

    const adapted = adaptProductItemToValidatedMetrics(legacyProduct, { nowMs: NOW_MS });
    assert.equal(adapted.sourceEndpoint, 'legacy_product');
    assert.equal(adapted.priceThb.state, 'OK');
    assert.equal(adapted.priceThb.value, 299);
    assert.equal(adapted.commissionRate.state, 'MISSING');
    assert.equal(adapted.revenueThb7d.state, 'MISSING');
    assert.equal(adapted.videoRevenueThb7d.state, 'ZERO');
    assert.equal(adapted.videoRevenueThb7d.value, 0);
  });

  it('Hydrates snapshots coherently by timestamp and prevents stale cached scores from overwriting fresh server scores', () => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    };

    const olderIso = '2026-11-24T00:00:00.000Z';
    const newerIso = '2026-11-25T03:00:00.000Z';

    saveDeepInsightForProduct('prod_sync_1', {
      deepInsights: { description: 'Older details', fetchedAt: olderIso },
      kalodataMetrics: {
        salesVolume7d: 100,
        revenueThb7d: 10000,
        creatorCount: 5,
        fetchedAt: olderIso,
        dateRange: 'last7Day',
      },
      validatedMetrics: adaptRawKalodataRowToValidatedMetrics(
        { unit_price: 100, sales_volumn: 100, revenue: 10000, creator_count: 5 },
        { fetchedAt: olderIso, dateRange: 'last7Day', sourceEndpoint: 'detail', nowMs: NOW_MS }
      ),
    });

    const staleProduct: ProductItem = {
      id: 'prod_sync_1',
      thaiTitle: 'สินค้าทดสอบ',
      clearTitle: { my: 'Old', en: 'Old' },
      whatItIs: { my: 'Old', en: 'Old' },
      whySilentWorks: { my: 'Old', en: 'Old' },
      category: 'home',
      categoryLabel: { my: 'Home', en: 'Home' },
      shopName: 'Shop TH',
      priceThb: 100,
      commissionRate: 10,
      commissionThb: 10,
      visualTags: [],
      aiEnriched: true,
      scoreBreakdown: {
        total: 44,
        grade: 'low',
        visualDemo: 40,
        aiSuitability: 40,
        salesDemand: 50,
        commissionValue: 50,
        speechPenalty: 0,
      },
    };
    saveAiExplanationsForProducts([staleProduct]);

    const freshValidated = adaptRawKalodataRowToValidatedMetrics(
      { unit_price: 120, sales_volumn: 300, revenue: 36000 },
      { fetchedAt: newerIso, dateRange: 'last7Day', sourceEndpoint: 'rank', nowMs: NOW_MS }
    );

    const freshSearchProduct: ProductItem = {
      ...staleProduct,
      aiEnriched: false,
      priceThb: 120,
      scoreBreakdown: {
        total: 81,
        grade: 'strong',
        visualDemo: 82,
        aiSuitability: 80,
        salesDemand: 85,
        commissionValue: 75,
        speechPenalty: 0,
      },
      kalodataMetrics: {
        salesVolume7d: 300,
        revenueThb7d: 36000,
        fetchedAt: newerIso,
        dateRange: 'last7Day',
      },
      validatedMetrics: freshValidated,
    };

    const hydrated = hydrateProductFromStorage(freshSearchProduct);
    // Fresh server score must not be overwritten by older ai_explanations scoreBreakdown
    assert.equal(hydrated.scoreBreakdown?.total, 81);
    // Newer rank snapshot must not inherit mismatched older creatorCount from an older fetch
    assert.equal(hydrated.kalodataMetrics?.salesVolume7d, 300);
    assert.equal(hydrated.kalodataMetrics?.creatorCount, undefined);
    assert.equal(hydrated.validatedMetrics?.fetchedAt, newerIso);
  });
});
