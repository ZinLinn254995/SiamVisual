import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProductCard } from '../src/components/ProductCard.tsx';
import { ScoreDetailContent } from '../src/components/ScoreDetailDialog.tsx';
import { TRANSLATIONS } from '../src/i18n.ts';
import {
  applyDiscoveryFiltersAndSort,
  DEFAULT_DISCOVERY_FILTER_STATE,
  RECOMMENDED_DISCOVERY_FILTER_STATE,
} from '../src/lib/discoveryFilterEngine.ts';
import { buildProductIntelligenceView } from '../src/lib/productIntelligenceView.ts';
import {
  evaluateSearchOpportunityScore,
  SEARCH_SCORE_WEIGHTS,
} from '../src/lib/searchScoreEngine.ts';
import type {
  ProductItem,
  ProductValidatedMetrics,
  ValidatedMetric,
} from '../src/types.ts';

const NOW_ISO = '2026-11-26T00:00:00.000Z';
const NOW_MS = Date.parse('2026-11-26T01:00:00.000Z');

function makeMetric(
  value: number | null,
  unit: ValidatedMetric<number>['unit'],
  state: ValidatedMetric<number>['state'] = value === 0 ? 'ZERO' : value === null ? 'MISSING' : 'OK'
): ValidatedMetric<number> {
  return {
    value,
    state,
    provenance: 'SOURCE',
    rawInput: value,
    unit,
    fetchedAt: NOW_ISO,
    dateRange: 'last7Day',
    note: null,
    sourceEndpoint: 'rank',
  };
}

function makeRankOnlyProduct(opts: {
  id: string;
  priceThb: number;
  commissionRate: number;
  revenueThb7d: number;
  salesVolume7d: number;
  videoRevenueThb7d: number | null;
  liveRevenueThb7d?: number;
  showcaseRevenueThb7d?: number;
}): ProductItem {
  const payout = Math.round(opts.priceThb * (opts.commissionRate / 100) * 100) / 100;
  const liveRev = opts.liveRevenueThb7d ?? 0;
  const showcaseRev = opts.showcaseRevenueThb7d ?? 0;

  const validated: ProductValidatedMetrics = {
    priceThb: makeMetric(opts.priceThb, 'THB'),
    commissionRate: makeMetric(opts.commissionRate, 'PERCENT'),
    commissionThb: {
      value: payout,
      state: payout === 0 ? 'ZERO' : 'OK',
      provenance: 'SYNTHETIC',
      rawInput: payout,
      unit: 'THB',
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
      note: 'Derived payout',
      sourceEndpoint: 'rank',
    },
    salesVolume7d: makeMetric(opts.salesVolume7d, 'COUNT'),
    revenueThb7d: makeMetric(opts.revenueThb7d, 'THB'),
    videoRevenueThb7d: makeMetric(opts.videoRevenueThb7d, 'THB'),
    liveRevenueThb7d: makeMetric(liveRev, 'THB'),
    shoppingMallRevenueThb7d: makeMetric(showcaseRev, 'THB'),
    revenueGrowthRate: makeMetric(null, 'UNVERIFIED', 'MISSING'),
    creatorCount: makeMetric(null, 'UNVERIFIED', 'MISSING'),
    rating: makeMetric(null, 'RATING_5', 'UNAVAILABLE'),
    reviewCount: makeMetric(null, 'COUNT', 'UNAVAILABLE'),
    fetchedAt: NOW_ISO,
    dateRange: 'last7Day',
    sourceEndpoint: 'rank',
    unresolvedFields: ['creatorCount', 'rating', 'reviewCount'],
  };

  return {
    id: opts.id,
    thaiTitle: `สินค้าทดสอบ ${opts.id}`,
    clearTitle: { en: `Test Product ${opts.id}`, my: `စမ်းသပ်ပစ္စည်း ${opts.id}` },
    whatItIs: { en: 'Rank-only item', my: 'Search Data ပစ္စည်း' },
    whySilentWorks: { en: 'Clear visual demo', my: 'မြင်သာသည်' },
    category: 'beauty',
    categoryLabel: { en: 'Beauty', my: 'အလှကုန်' },
    shopName: 'TH Affiliate Shop',
    priceThb: opts.priceThb,
    commissionRate: opts.commissionRate,
    commissionThb: payout,
    visualTags: ['Before/After'],
    kalodataMetrics: {
      salesVolume7d: opts.salesVolume7d,
      revenueThb7d: opts.revenueThb7d,
      videoRevenueThb7d: opts.videoRevenueThb7d ?? undefined,
      liveRevenueThb7d: liveRev,
      shoppingMallRevenueThb7d: showcaseRev,
      dateRange: 'last7Day',
      fetchedAt: NOW_ISO,
    },
    validatedMetrics: validated,
  };
}

test('Phase 19: Weights sum to 1.0 and strong video-proven affiliate product scores TOP (>=80)', () => {
  const sum =
    SEARCH_SCORE_WEIGHTS.demand +
    SEARCH_SCORE_WEIGHTS.earning +
    SEARCH_SCORE_WEIGHTS.videoProof +
    SEARCH_SCORE_WEIGHTS.priceFit;
  assert.ok(Math.abs(sum - 1) < 1e-9);

  const winner = makeRankOnlyProduct({
    id: '1731000000000001001',
    priceThb: 390,
    commissionRate: 15,
    revenueThb7d: 2_200_000,
    salesVolume7d: 5_600,
    videoRevenueThb7d: 1_540_000,
    liveRevenueThb7d: 440_000,
    showcaseRevenueThb7d: 220_000,
  });

  const result = evaluateSearchOpportunityScore(winner, { nowMs: NOW_MS });
  assert.equal(result.status, 'SCORED');
  assert.equal(result.grade, 'TOP');
  assert.ok(result.score !== null && result.score >= 80 && result.score <= 100);
  assert.equal(result.capsApplied.length, 0);
  assert.equal(result.metrics.dominantChannel, 'VIDEO');
  assert.equal(result.metrics.videoSharePct, 70);
  assert.equal(result.metrics.payoutPerSaleThb, 58.5);
  assert.equal(result.metrics.videoCommissionPoolThb, 231_000);
});

test('Phase 19: Verified 0% commission hard-gates to score 0 (NOT_MONETIZABLE) despite massive revenue', () => {
  const zeroComm = makeRankOnlyProduct({
    id: '1731000000000001002',
    priceThb: 490,
    commissionRate: 0,
    revenueThb7d: 8_500_000,
    salesVolume7d: 17_000,
    videoRevenueThb7d: 5_000_000,
  });

  const result = evaluateSearchOpportunityScore(zeroComm, { nowMs: NOW_MS });
  assert.equal(result.status, 'NOT_MONETIZABLE');
  assert.equal(result.grade, 'NOT_MONETIZABLE');
  assert.equal(result.score, 0);
  assert.equal(result.pillars.earning.score, 0);
  assert.equal(result.metrics.videoCommissionPoolThb, 0);
});

test('Phase 19: Guardrail caps enforce WEAK_DEMAND_CAP (<=42), NO_VIDEO_SALES_CAP (<=58), and LIVE_DEPENDENT_CAP (<=68)', () => {
  const weakDemandHighComm = makeRankOnlyProduct({
    id: '1731000000000001003',
    priceThb: 399,
    commissionRate: 25,
    revenueThb7d: 1_800,
    salesVolume7d: 4,
    videoRevenueThb7d: 1_500,
  });
  const weakRes = evaluateSearchOpportunityScore(weakDemandHighComm, { nowMs: NOW_MS });
  assert.equal(weakRes.status, 'SCORED');
  assert.ok(weakRes.capsApplied.includes('WEAK_DEMAND_CAP'));
  assert.ok(weakRes.score !== null && weakRes.score <= 42);

  const noVideoSales = makeRankOnlyProduct({
    id: '1731000000000001004',
    priceThb: 390,
    commissionRate: 18,
    revenueThb7d: 2_500_000,
    salesVolume7d: 6_400,
    videoRevenueThb7d: 0,
    liveRevenueThb7d: 2_000_000,
    showcaseRevenueThb7d: 500_000,
  });
  const noVidRes = evaluateSearchOpportunityScore(noVideoSales, { nowMs: NOW_MS });
  assert.equal(noVidRes.status, 'SCORED');
  assert.ok(noVidRes.capsApplied.includes('NO_VIDEO_SALES_CAP'));
  assert.ok(noVidRes.score !== null && noVidRes.score <= 58);

  const liveDependent = makeRankOnlyProduct({
    id: '1731000000000001005',
    priceThb: 450,
    commissionRate: 16,
    revenueThb7d: 2_000_000,
    salesVolume7d: 4_400,
    videoRevenueThb7d: 120_000, // 6% video
    liveRevenueThb7d: 1_500_000, // 75% live
    showcaseRevenueThb7d: 380_000,
  });
  const liveRes = evaluateSearchOpportunityScore(liveDependent, { nowMs: NOW_MS });
  assert.equal(liveRes.status, 'SCORED');
  assert.equal(liveRes.metrics.dominantChannel, 'LIVE');
  assert.ok(liveRes.capsApplied.includes('LIVE_DEPENDENT_CAP'));
  assert.ok(liveRes.score !== null && liveRes.score <= 68);
});

test('Phase 19: Higher Video Commission Pool THB lifts videoProofScore cleanly', () => {
  const lowPool = makeRankOnlyProduct({
    id: '1731000000000001006',
    priceThb: 350,
    commissionRate: 3,
    revenueThb7d: 600_000,
    salesVolume7d: 1_700,
    videoRevenueThb7d: 300_000,
  });
  const highPool = makeRankOnlyProduct({
    id: '1731000000000001007',
    priceThb: 350,
    commissionRate: 18,
    revenueThb7d: 600_000,
    salesVolume7d: 1_700,
    videoRevenueThb7d: 300_000,
  });

  const lowRes = evaluateSearchOpportunityScore(lowPool, { nowMs: NOW_MS });
  const highRes = evaluateSearchOpportunityScore(highPool, { nowMs: NOW_MS });

  assert.equal(lowRes.metrics.videoCommissionPoolThb, 9_000);
  assert.equal(highRes.metrics.videoCommissionPoolThb, 54_000);
  assert.ok(
    (highRes.pillars.videoProof.score ?? 0) > (lowRes.pillars.videoProof.score ?? 0),
    'Higher video commission pool should lift videoProof score'
  );
});

test('Phase 19: search_score_desc sorts highest Search Score first and sinks 0% commission items', () => {
  const zeroComm = makeRankOnlyProduct({
    id: 'p_zero',
    priceThb: 400,
    commissionRate: 0,
    revenueThb7d: 5_000_000,
    salesVolume7d: 12_000,
    videoRevenueThb7d: 2_000_000,
  });
  const midItem = makeRankOnlyProduct({
    id: 'p_mid',
    priceThb: 390,
    commissionRate: 8,
    revenueThb7d: 300_000,
    salesVolume7d: 770,
    videoRevenueThb7d: 0,
    liveRevenueThb7d: 200_000,
  });
  const topItem = makeRankOnlyProduct({
    id: 'p_top',
    priceThb: 390,
    commissionRate: 15,
    revenueThb7d: 1_800_000,
    salesVolume7d: 4_600,
    videoRevenueThb7d: 1_200_000,
  });

  const view = buildProductIntelligenceView([zeroComm, midItem, topItem], 'overall', {
    nowMs: NOW_MS,
  });

  const allSorted = applyDiscoveryFiltersAndSort(view.rankedEntries, {
    ...DEFAULT_DISCOVERY_FILTER_STATE,
    sortMode: 'search_score_desc',
  });
  assert.deepEqual(
    allSorted.entries.map((e) => e.product.id),
    ['p_top', 'p_mid', 'p_zero']
  );

  const recommended = applyDiscoveryFiltersAndSort(
    view.rankedEntries,
    RECOMMENDED_DISCOVERY_FILTER_STATE
  );
  assert.deepEqual(
    recommended.entries.map((e) => e.product.id),
    ['p_top', 'p_mid']
  );
});

test('Phase 19: ProductCard and visual ScoreDetailContent render unified Search Score cleanly in my and en with zero legacy clutter', () => {
  const rankProduct = makeRankOnlyProduct({
    id: '1731000000000001099',
    priceThb: 390,
    commissionRate: 15,
    revenueThb7d: 2_000_000,
    salesVolume7d: 5_100,
    videoRevenueThb7d: 1_300_000,
  });

  const view = buildProductIntelligenceView([rankProduct], 'overall', { nowMs: NOW_MS });
  const entry = view.rankedEntries[0];
  assert.equal(entry.commercialOpportunityScore, null);
  assert.ok(entry.searchScore.score !== null && entry.searchScore.score >= 80);

  for (const lang of ['my', 'en'] as const) {
    const t = TRANSLATIONS[lang];
    const cardHtml = renderToStaticMarkup(
      React.createElement(ProductCard, {
        product: entry.product,
        intelligenceItem: entry,
        index: 0,
        language: lang,
        isSaved: false,
        viewMode: 'grid',
        density: 'spacious',
        nowMs: NOW_MS,
        t,
        onSelect: () => {},
        onToggleSave: () => {},
        onOpenScoreDetails: () => {},
      })
    );

    assert.ok(cardHtml.includes(String(entry.searchScore.score)));
    assert.ok(cardHtml.includes(t.v2.searchScore.badgeShort));
    assert.ok(cardHtml.includes(t.v2.searchScore.grades[entry.searchScore.grade]));
    assert.ok(cardHtml.includes(t.card.price));
    assert.ok(cardHtml.includes(t.card.commission));
    assert.ok(!cardHtml.includes('Data Confidence'));
    assert.ok(!cardHtml.includes('Insufficient Data'));

    const dialogHtml = renderToStaticMarkup(
      React.createElement(ScoreDetailContent, {
        product: entry.product,
        language: lang,
        nowMs: NOW_MS,
        t,
        onClose: () => {},
      })
    );

    assert.ok(dialogHtml.includes(`${entry.searchScore.score}/100`));
    assert.ok(dialogHtml.includes(t.v2.searchScore.compositionTitle));
    assert.ok(dialogHtml.includes(t.v2.searchScore.channelsTitle));
    assert.ok(dialogHtml.includes(t.v2.searchScore.priceSweetSpotTitle));
    assert.ok(dialogHtml.includes(t.v2.searchScore.earningSnapshotTitle));
    assert.ok(dialogHtml.includes(t.v2.searchScore.videoPoolLabel));
    assert.ok(!dialogHtml.includes('Insufficient Data'));
    assert.ok(!dialogHtml.includes('Data Confidence'));
    assert.ok(!dialogHtml.includes('Studio Visual Reference'));
    assert.ok(!dialogHtml.includes('Metric Provenance'));
  }
});
