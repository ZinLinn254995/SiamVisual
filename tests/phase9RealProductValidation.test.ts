import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRawProductRow } from '../server/kalodata.ts';
import { rankCommercialOpportunitiesV2 } from '../src/lib/scoringEngineV2.ts';
import { rankProductIntelligenceV2 } from '../src/lib/strategyEngineV2.ts';

const NOW_ISO = '2026-11-25T15:30:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

/**
 * Sanitized live Phase 9 Thailand /rank subset (2026-11-25) reproducing the confirmed
 * tie-breaker defect where INSUFFICIENT_DATA products with identical Data Confidence (42)
 * previously sorted by ascending product_id instead of verified Demand + Earning evidence.
 */
const LIVE_PHASE9_SAMPLE_ROWS: Array<Record<string, unknown>> = [
  // Lower numeric ID (1729...) with weak earning (7%, ฿12.74 payout -> Earning 36)
  {
    product_id: '1729424092832893836',
    product_name: 'Maybelline Superstay Matte Ink Lipstick',
    unit_price: 182,
    commission_rate: 7,
    sales_volumn: 19418,
    revenue: 3541046.88,
    video_revenue: 3019914.93,
    live_revenue: 521131.95,
    showcase_revenue: 0,
    revenue_growth_rate: -13.67,
    pri_category: { category_id: '601450', category_name: 'Beauty & Personal Care' },
  },
  // Higher numeric ID (1731...) with strongest earning (7%, ฿148.96 payout -> Earning 70)
  {
    product_id: '1731299385569545105',
    product_name: 'Solomon Pyla Plus 9-inch Spring Mattress',
    unit_price: 2128,
    commission_rate: 7,
    sales_volumn: 3257,
    revenue: 6929653.68,
    video_revenue: 5276828.25,
    live_revenue: 1640069.62,
    showcase_revenue: 12755.81,
    revenue_growth_rate: -11.76,
    pri_category: { category_id: '604453', category_name: 'Furniture' },
  },
  // Higher numeric ID (1732...) with strong 20% commission (฿28.40 payout -> Earning 59)
  {
    product_id: '1732462917435950190',
    product_name: 'INZENT Vitamin C + Gluta Collagen 2-Jar Set',
    unit_price: 142,
    commission_rate: 20,
    sales_volumn: 29324,
    revenue: 4163665.25,
    video_revenue: 3978070.6,
    live_revenue: 185594.64,
    showcase_revenue: 0,
    revenue_growth_rate: 41.11,
    pri_category: { category_id: '700645', category_name: 'Health' },
  },
  // Low 1% commission soybean oil (฿7.53 payout -> Earning 15)
  {
    product_id: '1733396495220901248',
    product_name: 'Soybean Oil 1L x 12 Bottles Case',
    unit_price: 753,
    commission_rate: 1,
    sales_volumn: 4978,
    revenue: 3750815.63,
    video_revenue: 1274433.14,
    live_revenue: 2148638.07,
    showcase_revenue: 327744.42,
    revenue_growth_rate: 19.16,
    pri_category: { category_id: '700437', category_name: 'Food & Beverages' },
  },
  // Higher numeric ID (1736...) with strong 18% commission (฿26.28 payout -> Earning 57)
  {
    product_id: '1736401558606284552',
    product_name: 'NAWANNA Ginseng Turmeric Pearl Cream',
    unit_price: 146,
    commission_rate: 18,
    sales_volumn: 24042,
    revenue: 3519141.43,
    video_revenue: 3399068.71,
    live_revenue: 120018.94,
    showcase_revenue: 53.78,
    revenue_growth_rate: -38.19,
    pri_category: { category_id: '601450', category_name: 'Beauty & Personal Care' },
  },
  // Zero-commission electronics item returned by live /rank despite is_affiliate: 1
  {
    product_id: '1732077377460865234',
    product_name: 'iPad A16 Gen 11 Wi-Fi Tablet',
    unit_price: 16760,
    commission_rate: 0,
    sales_volumn: 299,
    revenue: 5011279.69,
    video_revenue: 1993839.44,
    live_revenue: 2399109.61,
    showcase_revenue: 618330.64,
    revenue_growth_rate: -35.96,
    pri_category: { category_id: '601739', category_name: 'Phones & Electronics' },
  },
];

describe('Phase 9 Regression: Real-World INSUFFICIENT_DATA Ranking Order', () => {
  it('Orders equal-confidence INSUFFICIENT_DATA candidates by verified Demand+Earning evidence instead of ascending productId', () => {
    const parsed = LIVE_PHASE9_SAMPLE_ROWS.map((row, idx) => {
      const p = parseRawProductRow(row, `fb-${idx}`, 'rank', NOW_ISO, { nowMs: NOW_MS });
      assert.ok(p);
      return { id: p.id, validatedMetrics: p.validatedMetrics };
    });

    const commercialRanked = rankCommercialOpportunitiesV2(parsed, { nowMs: NOW_MS });
    const strategyRanked = rankProductIntelligenceV2(
      parsed.map((p) => ({ item: p, productId: p.id, validatedMetrics: p.validatedMetrics })),
      { scoringConfig: { nowMs: NOW_MS } }
    );

    const expectedOrder = [
      '1731299385569545105', // D=80, E=70 (avg 75.0)
      '1732462917435950190', // D=80, E=59 (avg 69.5)
      '1736401558606284552', // D=80, E=57 (avg 68.5)
      '1729424092832893836', // D=80, E=36 (avg 58.0)
      '1733396495220901248', // D=80, E=15 (avg 47.5)
      '1732077377460865234', // NOT_MONETIZABLE (0% commission)
    ];

    assert.deepEqual(
      commercialRanked.results.map((r) => r.productId),
      expectedOrder
    );
    assert.deepEqual(
      strategyRanked.overallRanking.map((r) => r.productId),
      expectedOrder
    );

    // Must preserve strict INSUFFICIENT_DATA / null composite score / 0 qualified strategies
    for (const r of commercialRanked.results.slice(0, 5)) {
      assert.equal(r.score.eligibilityStatus, 'INSUFFICIENT_DATA');
      assert.equal(r.score.commercialOpportunityScore, null);
      assert.equal(r.score.competitionScore.score, null);
      assert.equal(r.score.customerQualityScore.score, null);
    }
    assert.equal(commercialRanked.results[5].score.eligibilityStatus, 'NOT_MONETIZABLE');
    assert.equal(commercialRanked.results[5].score.commercialOpportunityScore, 0);

    for (const entry of strategyRanked.overallRanking) {
      assert.equal(entry.qualifiedStrategyIds.length, 0);
    }

    // Order must remain 100% deterministic & input-order independent
    const reversed = [...parsed].reverse();
    const reversedRanked = rankCommercialOpportunitiesV2(reversed, { nowMs: NOW_MS });
    assert.deepEqual(
      reversedRanked.results.map((r) => r.productId),
      expectedOrder
    );
  });
});
