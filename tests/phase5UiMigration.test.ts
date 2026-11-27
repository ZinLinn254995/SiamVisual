import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TRANSLATIONS } from '../src/i18n.ts';
import {
  ALL_STRATEGY_IDS,
  buildProductIntelligenceView,
  classifyMetricProvenance,
  ensureProductV2Intelligence,
  getProductMetricProvenanceList,
  sortProductsByV2Overall,
} from '../src/lib/productIntelligenceView.ts';
import {
  computeSyntheticCommissionThb,
  validateNumericMetric,
  validatePriceThbMetric,
  validateUnverifiedNumericMetric,
} from '../src/lib/metricFoundation.ts';
import { hydrateProductFromStorage } from '../src/lib/storage.ts';
import { ProductCard } from '../src/components/ProductCard.tsx';
import { ScoreDetailContent } from '../src/components/ScoreDetailDialog.tsx';
import { VideoStudioView } from '../src/components/VideoStudioView.tsx';
import { HistoryView } from '../src/components/HistoryView.tsx';
import type {
  HistoricalMetricSnapshot,
  ProductItem,
  ProductValidatedMetrics,
  ValidatedMetric,
} from '../src/types.ts';

const NOW_ISO = '2026-11-25T03:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

interface VerifiedSeed {
  id: string;
  thaiTitle?: string;
  v1TotalScore?: number;
  visualScore?: number;
  aiScore?: number;
  priceThb?: number | null;
  commissionRate?: number | null;
  commissionUnit?: 'PERCENT' | 'UNVERIFIED';
  salesVolume7d?: number | null;
  revenueThb7d?: number | null;
  videoRevenueThb7d?: number | null;
  liveRevenueThb7d?: number | null;
  revenueGrowthRate?: number | null;
  growthUnit?: 'PERCENT' | 'RATIO' | 'UNVERIFIED';
  growthDateRange?: string | null;
  creatorCount?: number | null;
  creatorUnit?: 'COUNT' | 'UNVERIFIED';
  rating?: number | null;
  ratingUnit?: 'RATING_5' | 'UNVERIFIED';
  reviewCount?: number | null;
  reviewUnit?: 'COUNT' | 'UNVERIFIED';
}

function buildValidated(seed: VerifiedSeed): ProductValidatedMetrics {
  const fetchedAt = NOW_ISO;
  const dateRange = 'last7Day';

  const priceThb = validatePriceThbMetric(
    seed.priceThb === undefined ? 299 : seed.priceThb,
    { fetchedAt, dateRange, nowMs: NOW_MS }
  );

  const commRateVal = seed.commissionRate === undefined ? 15 : seed.commissionRate;
  const commissionRate =
    seed.commissionUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(commRateVal, {
          unverifiedNote: 'UNVERIFIED commission unit',
          context: { fetchedAt, dateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: commRateVal,
          unit: 'PERCENT',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: NOW_MS,
          allowZero: true,
          allowNegative: false,
        });

  const commissionThb = computeSyntheticCommissionThb(priceThb, commissionRate);

  const salesVolume7d = validateNumericMetric({
    rawInput: seed.salesVolume7d === undefined ? 1200 : seed.salesVolume7d,
    unit: 'COUNT',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: NOW_MS,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const revenueThb7d = validateNumericMetric({
    rawInput: seed.revenueThb7d === undefined ? 358_800 : seed.revenueThb7d,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: NOW_MS,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const videoRevenueThb7d = validateNumericMetric({
    rawInput: seed.videoRevenueThb7d === undefined ? 240_000 : seed.videoRevenueThb7d,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: NOW_MS,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const liveRevenueThb7d = validateNumericMetric({
    rawInput: seed.liveRevenueThb7d === undefined ? 60_000 : seed.liveRevenueThb7d,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: NOW_MS,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const growthUnit = seed.growthUnit ?? 'PERCENT';
  const rawGrowth = seed.revenueGrowthRate === undefined ? 45 : seed.revenueGrowthRate;
  const revenueGrowthRate: ValidatedMetric<number> =
    growthUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawGrowth, {
          allowNegative: true,
          unverifiedNote: 'UNVERIFIED_GROWTH_UNIT',
          context: { fetchedAt, dateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: rawGrowth,
          unit: growthUnit,
          provenance: 'SOURCE',
          fetchedAt,
          dateRange: seed.growthDateRange ?? 'last7Day_vs_prev7Day',
          nowMs: NOW_MS,
          allowZero: true,
          allowNegative: true,
        });

  const creatorUnit = seed.creatorUnit ?? 'COUNT';
  const rawCreators = seed.creatorCount === undefined ? 12 : seed.creatorCount;
  const creatorCount: ValidatedMetric<number> =
    creatorUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawCreators, {
          allowNegative: false,
          unverifiedNote: 'UNVERIFIED_CREATOR_DEFINITION',
          context: { fetchedAt, dateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: rawCreators,
          unit: 'COUNT',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: NOW_MS,
          allowZero: true,
          allowNegative: false,
          integerOnly: true,
        });

  const ratingUnit = seed.ratingUnit ?? 'RATING_5';
  const rawRating = seed.rating === undefined ? 4.8 : seed.rating;
  const rating: ValidatedMetric<number> =
    ratingUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawRating, {
          allowNegative: false,
          minValue: 0,
          maxValue: 5,
          unverifiedNote: 'UNVERIFIED_RATING_SEMANTICS',
          context: { fetchedAt, dateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: rawRating,
          unit: 'RATING_5',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: NOW_MS,
          allowZero: false,
          allowNegative: false,
          minValue: 0,
          maxValue: 5,
        });

  const reviewUnit = seed.reviewUnit ?? 'COUNT';
  const rawReviews = seed.reviewCount === undefined ? 320 : seed.reviewCount;
  const reviewCount: ValidatedMetric<number> =
    reviewUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(rawReviews, {
          allowNegative: false,
          unverifiedNote: 'UNVERIFIED_REVIEW_COUNT',
          context: { fetchedAt, dateRange, nowMs: NOW_MS },
        })
      : validateNumericMetric({
          rawInput: rawReviews,
          unit: 'COUNT',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: NOW_MS,
          allowZero: true,
          allowNegative: false,
          integerOnly: true,
        });

  const unresolvedFields: string[] = [];
  if (revenueGrowthRate.unit === 'UNVERIFIED') unresolvedFields.push('revenueGrowthRate');
  if (creatorCount.unit === 'UNVERIFIED') unresolvedFields.push('creatorCount');
  if (rating.unit === 'UNVERIFIED') unresolvedFields.push('rating');
  if (reviewCount.unit === 'UNVERIFIED') unresolvedFields.push('reviewCount');
  if (commissionRate.unit === 'UNVERIFIED') unresolvedFields.push('commissionRate');

  return {
    priceThb,
    commissionRate,
    commissionThb,
    salesVolume7d,
    revenueThb7d,
    videoRevenueThb7d,
    liveRevenueThb7d,
    revenueGrowthRate,
    creatorCount,
    rating,
    reviewCount,
    fetchedAt,
    dateRange,
    sourceEndpoint: 'rank',
    unresolvedFields,
  };
}

function makeProduct(seed: VerifiedSeed): ProductItem {
  const validatedMetrics = buildValidated(seed);
  const commissionThbVal =
    validatedMetrics.commissionThb.state === 'OK' ||
    validatedMetrics.commissionThb.state === 'ZERO'
      ? validatedMetrics.commissionThb.value
      : null;

  const base: ProductItem = {
    id: seed.id,
    thaiTitle: seed.thaiTitle ?? `สินค้าทดสอบ ${seed.id}`,
    clearTitle: {
      my: `စမ်းသပ်ပစ္စည်း ${seed.id}`,
      en: `Test Commercial Product ${seed.id}`,
    },
    whatItIs: {
      my: 'စမ်းသပ်ဖော်ပြချက်',
      en: 'Commercial validation test fixture.',
    },
    whySilentWorks: {
      my: 'Studio Reference Only',
      en: 'Studio reference only — zero commercial weight.',
    },
    category: 'beauty',
    categoryLabel: { my: 'အလှကုန်', en: 'Beauty & Personal Care' },
    priceThb: seed.priceThb === undefined ? 299 : seed.priceThb,
    commissionRate: seed.commissionRate === undefined ? 15 : seed.commissionRate,
    commissionThb: commissionThbVal,
    shopName: `Shop ${seed.id}`,
    visualTags: ['Demo', 'Studio'],
    kalodataMetrics: {
      salesVolume7d: seed.salesVolume7d === undefined ? 1200 : seed.salesVolume7d,
      revenueThb7d: seed.revenueThb7d === undefined ? 358_800 : seed.revenueThb7d,
      videoRevenueThb7d:
        seed.videoRevenueThb7d === undefined ? 240_000 : seed.videoRevenueThb7d,
      liveRevenueThb7d: seed.liveRevenueThb7d === undefined ? 60_000 : seed.liveRevenueThb7d,
      revenueGrowthRate:
        seed.revenueGrowthRate === undefined ? 45 : seed.revenueGrowthRate,
      creatorCount: seed.creatorCount === undefined ? 12 : seed.creatorCount,
      rating: seed.rating === undefined ? 4.8 : seed.rating,
      reviewCount: seed.reviewCount === undefined ? 320 : seed.reviewCount,
      fetchedAt: NOW_ISO,
      dateRange: 'last7Day',
    },
    validatedMetrics,
    scoreBreakdown: {
      visualDemo: seed.visualScore ?? 40,
      aiSuitability: seed.aiScore ?? 30,
      salesDemand: 15,
      commissionValue: 14,
      speechPenalty: 0,
      total: seed.v1TotalScore ?? 70,
      grade: (seed.v1TotalScore ?? 70) >= 80 ? 'top' : 'fair',
    },
  };

  return ensureProductV2Intelligence(base, { nowMs: NOW_MS });
}

describe('Phase 5 — UI Migration & Product Intelligence V2 Release', () => {
  it('replaces V1 visual-suitability sorting with V2 Commercial Opportunity ranking', () => {
    // Product A: High V1 visual score (98) but 0% commission (NOT_MONETIZABLE) -> withheld / excluded
    const highVisualZeroComm = makeProduct({
      id: 'v1_bait_zero_comm',
      v1TotalScore: 98,
      visualScore: 49,
      aiScore: 49,
      commissionRate: 0,
      revenueThb7d: 900_000,
      salesVolume7d: 3000,
    });

    // Product B: Low V1 visual score (42) but strong V2 commercial fundamentals
    const strongCommercialLowVisual = makeProduct({
      id: 'v2_strong_low_visual',
      v1TotalScore: 42,
      visualScore: 10,
      aiScore: 8,
      priceThb: 450,
      commissionRate: 18,
      revenueThb7d: 820_000,
      salesVolume7d: 1820,
      creatorCount: 10,
      revenueGrowthRate: 62,
      rating: 4.85,
      reviewCount: 410,
      videoRevenueThb7d: 580_000,
    });

    // Product C: Extreme competition saturation despite high revenue & high V1 score
    const extremeCompetition = makeProduct({
      id: 'v2_extreme_comp',
      v1TotalScore: 91,
      priceThb: 299,
      commissionRate: 12,
      revenueThb7d: 950_000,
      salesVolume7d: 3177,
      creatorCount: 420,
      revenueGrowthRate: 18,
      rating: 4.7,
      reviewCount: 900,
    });

    const sorted = sortProductsByV2Overall(
      [highVisualZeroComm, extremeCompetition, strongCommercialLowVisual],
      { nowMs: NOW_MS }
    );

    assert.equal(sorted[0].id, 'v2_strong_low_visual');
    assert.equal(sorted[sorted.length - 1].id, 'v1_bait_zero_comm');

    const vm = buildProductIntelligenceView(sorted, 'overall', { nowMs: NOW_MS });
    assert.equal(vm.rankedEntries.length, 3);
    assert.equal(vm.rankedEntries[0].product.id, 'v2_strong_low_visual');
    assert.equal(vm.rankedEntries[2].product.id, 'v1_bait_zero_comm');
    assert.equal(vm.rankedEntries[2].commercialOpportunityScore, 0);
    assert.equal(vm.rankedEntries[2].commercialEligibilityStatus, 'NOT_MONETIZABLE');
    assert.equal(
      vm.rankedEntries[1].riskTags.includes('EXTREME_COMPETITION'),
      true,
      'Extreme competition risk tag must be preserved to UI view model'
    );
  });

  it('evaluates and renders all 8 strategy views including historical DATA_UNAVAILABLE and snapshot-backed qualification', () => {
    const hero = makeProduct({
      id: 'hero_multi',
      priceThb: 450,
      commissionRate: 20,
      revenueThb7d: 620_000,
      salesVolume7d: 1380,
      creatorCount: 9,
      revenueGrowthRate: 58,
      rating: 4.85,
      reviewCount: 520,
      videoRevenueThb7d: 440_000,
      liveRevenueThb7d: 40_000,
    });

    const poorQuality = makeProduct({
      id: 'poor_quality',
      priceThb: 199,
      commissionRate: 10,
      revenueThb7d: 180_000,
      salesVolume7d: 900,
      creatorCount: 80,
      revenueGrowthRate: -15,
      rating: 3.6,
      reviewCount: 45,
      videoRevenueThb7d: 15_000,
    });

    const unverifiedProduct = ensureProductV2Intelligence(
      {
        id: 'phase0_unverified',
        thaiTitle: 'สินค้า Phase 0 ยังไม่ยืนยันหน่วย',
        clearTitle: { my: 'Phase 0 Unverified', en: 'Phase 0 Unverified Product' },
        whatItIs: { my: 'Unverified test', en: 'Unverified test' },
        whySilentWorks: { my: 'Ref', en: 'Ref' },
        category: 'home',
        categoryLabel: { my: 'Home', en: 'Home Supplies' },
        priceThb: 250,
        commissionRate: 12,
        commissionThb: 30,
        shopName: 'Phase0 Shop',
        visualTags: [],
        kalodataMetrics: {
          salesVolume7d: 850,
          revenueThb7d: 212_500,
          videoRevenueThb7d: 140_000,
          liveRevenueThb7d: 10_000,
          revenueGrowthRate: 35,
          creatorCount: 15,
          rating: 4.7,
          reviewCount: 120,
          fetchedAt: NOW_ISO,
          dateRange: 'last7Day',
        },
      },
      { nowMs: NOW_MS }
    );

    const pool = [hero, poorQuality, unverifiedProduct];

    // Check every strategy view calculation in the intelligence engine
    for (const strategyId of ALL_STRATEGY_IDS) {
      const vm = buildProductIntelligenceView(pool, strategyId, { nowMs: NOW_MS });
      assert.equal(vm.poolSize, 3);
      assert.equal(vm.strategySummaries.length, 8);

      if (strategyId === 'fast_rising_products' || strategyId === 'trend_timing_opportunity') {
        assert.equal(vm.isHistoricalDataUnavailable, true);
        assert.equal(vm.rankedEntries.length, 0);
        assert.equal(vm.excludedEntries.length, 3);
      } else {
        assert.ok(
          vm.rankedEntries.length >= 1,
          `Expected hero product to qualify for ${strategyId}`
        );
      }
    }

    // Verify fast_rising_products becomes active cleanly when historical snapshots are provided
    const prevValidated = buildValidated({
      id: 'hero_t1',
      revenueThb7d: 320_000,
      salesVolume7d: 710,
      creatorCount: 6,
    });
    const snapshotsByProduct: Record<string, HistoricalMetricSnapshot[]> = {
      hero_multi: [
        {
          fetchedAt: '2026-11-18T03:00:00.000Z',
          dateRange: 'last7Day',
          revenueThb7d: {
            ...prevValidated.revenueThb7d,
            fetchedAt: '2026-11-18T03:00:00.000Z',
          },
          salesVolume7d: {
            ...prevValidated.salesVolume7d,
            fetchedAt: '2026-11-18T03:00:00.000Z',
          },
          creatorCount: {
            ...prevValidated.creatorCount,
            fetchedAt: '2026-11-18T03:00:00.000Z',
          },
          revenueGrowthRate: {
            ...prevValidated.revenueGrowthRate,
            fetchedAt: '2026-11-18T03:00:00.000Z',
          },
        },
        {
          fetchedAt: '2026-11-25T03:00:00.000Z',
          dateRange: 'last7Day',
          revenueThb7d: hero.validatedMetrics!.revenueThb7d,
          salesVolume7d: hero.validatedMetrics!.salesVolume7d,
          creatorCount: hero.validatedMetrics!.creatorCount,
          revenueGrowthRate: hero.validatedMetrics!.revenueGrowthRate,
        },
      ],
    };

    const vmWithHistory = buildProductIntelligenceView(pool, 'fast_rising_products', {
      nowMs: NOW_MS,
      historicalSnapshotsByProductId: snapshotsByProduct,
    });
    assert.equal(vmWithHistory.isHistoricalDataUnavailable, false);
    assert.equal(vmWithHistory.rankedEntries.length, 1);
    assert.equal(vmWithHistory.rankedEntries[0].product.id, 'hero_multi');
  });

  it('renders Phase 0 UNVERIFIED & MISSING provenance explicitly without fabricating values', () => {
    // Raw legacy product adapted without verified Phase 0 fields (no prebuilt validatedMetrics)
    const legacyRaw: ProductItem = {
      id: 'legacy_unverified_card',
      thaiTitle: 'สินค้าเก่า Phase 0',
      clearTitle: { my: 'Legacy Unverified', en: 'Legacy Unverified Item' },
      whatItIs: { my: 'Desc', en: 'Desc' },
      whySilentWorks: { my: 'Ref', en: 'Ref' },
      category: 'gadget',
      categoryLabel: { my: 'Gadget', en: 'Phones & Electronics' },
      priceThb: 390,
      commissionRate: 15,
      commissionThb: 58.5,
      shopName: 'Legacy Shop',
      visualTags: [],
      kalodataMetrics: {
        salesVolume7d: 500,
        revenueThb7d: 195_000,
        videoRevenueThb7d: 110_000,
        liveRevenueThb7d: null,
        revenueGrowthRate: 42,
        creatorCount: 14,
        rating: 4.8,
        reviewCount: 95,
        fetchedAt: NOW_ISO,
        dateRange: 'last7Day',
      },
      scoreBreakdown: {
        visualDemo: 45,
        aiSuitability: 40,
        salesDemand: 8,
        commissionValue: 5,
        speechPenalty: 0,
        total: 98,
        grade: 'top',
      },
    };

    const hydrated = hydrateProductFromStorage(legacyRaw);
    assert.ok(hydrated.validatedMetrics);
    assert.ok(hydrated.commercialScoreV2);
    assert.ok(hydrated.strategyIntelligenceV2);

    const provList = getProductMetricProvenanceList(hydrated.validatedMetrics!);
    const creatorProv = provList.find((p) => p.key === 'creatorCount');
    assert.equal(creatorProv?.category, 'unverified');
    assert.equal(creatorProv?.isUnverifiedPhase0, true);
    const liveProv = provList.find((p) => p.key === 'liveRevenueThb7d');
    assert.equal(classifyMetricProvenance(liveProv!.metric), 'missing');

    const vm = buildProductIntelligenceView([hydrated], 'overall', { nowMs: NOW_MS });
    const cardHtml = renderToStaticMarkup(
      React.createElement(ProductCard, {
        product: vm.rankedEntries[0].product,
        intelligenceItem: vm.rankedEntries[0],
        index: 0,
        language: 'en',
        isSaved: false,
        viewMode: 'grid',
        density: 'spacious',
        nowMs: NOW_MS,
        t: TRANSLATIONS.en,
        onSelect: () => {},
        onToggleSave: () => {},
        onOpenScoreDetails: () => {},
      })
    );

    assert.ok(cardHtml.includes(TRANSLATIONS.en.card.price));
    assert.ok(cardHtml.includes(TRANSLATIONS.en.card.commission));
    assert.ok(cardHtml.includes(TRANSLATIONS.en.card.createPlan));
    assert.ok(!cardHtml.includes('Data Confidence'));

    const dialogHtml = renderToStaticMarkup(
      React.createElement(ScoreDetailContent, {
        product: hydrated,
        language: 'en',
        nowMs: NOW_MS,
        t: TRANSLATIONS.en,
        onClose: () => {},
      })
    );

    assert.ok(dialogHtml.includes(TRANSLATIONS.en.v2.searchScore.compositionTitle));
    assert.ok(dialogHtml.includes(TRANSLATIONS.en.v2.searchScore.channelsTitle));
    assert.ok(dialogHtml.includes(TRANSLATIONS.en.v2.searchScore.priceSweetSpotTitle));
    assert.ok(dialogHtml.includes(TRANSLATIONS.en.v2.searchScore.earningSnapshotTitle));
    assert.ok(!dialogHtml.includes('Metric Provenance'));
    assert.ok(!dialogHtml.includes('Studio Visual Reference'));
  });

  it('renders extreme competition warning, withheld 0% commission card, list/micro densities, VideoStudioView, HistoryView, and empty pool safely', () => {
    const emptyVm = buildProductIntelligenceView([], 'overall', { nowMs: NOW_MS });
    assert.equal(emptyVm.poolSize, 0);
    assert.equal(emptyVm.rankedEntries.length, 0);

    const extremeComp = makeProduct({
      id: 'extreme_comp_ui',
      priceThb: 299,
      commissionRate: 12,
      revenueThb7d: 880_000,
      salesVolume7d: 2943,
      creatorCount: 450,
      rating: 4.8,
      reviewCount: 600,
      revenueGrowthRate: 25,
    });

    const zeroComm = makeProduct({
      id: 'zero_comm_ui',
      commissionRate: 0,
      revenueThb7d: 500_000,
      salesVolume7d: 1670,
    });

    const vm = buildProductIntelligenceView([extremeComp, zeroComm], 'early_market_opportunity', {
      nowMs: NOW_MS,
    });
    assert.equal(vm.rankedEntries.length, 0);
    assert.equal(vm.excludedEntries.length, 2);

    const listHtml = renderToStaticMarkup(
      React.createElement(ProductCard, {
        product: vm.excludedEntries[0].product,
        intelligenceItem: vm.excludedEntries[0],
        index: 0,
        language: 'en',
        isSaved: true,
        viewMode: 'list',
        density: 'spacious',
        nowMs: NOW_MS,
        t: TRANSLATIONS.en,
        onSelect: () => {},
        onToggleSave: () => {},
        onOpenScoreDetails: () => {},
      })
    );
    assert.ok(listHtml.includes(TRANSLATIONS.en.v2.searchScore.badgeShort));

    const microZeroHtml = renderToStaticMarkup(
      React.createElement(ProductCard, {
        product: vm.excludedEntries[1].product,
        intelligenceItem: vm.excludedEntries[1],
        index: 1,
        language: 'my',
        isSaved: false,
        viewMode: 'grid',
        density: 'micro',
        nowMs: NOW_MS,
        t: TRANSLATIONS.my,
        onSelect: () => {},
        onToggleSave: () => {},
        onOpenScoreDetails: () => {},
      })
    );
    assert.ok(microZeroHtml.length > 0);

    const studioBaseProps = {
      product: extremeComp,
      isSaved: false,
      plan: null,
      style: 'cinematic' as const,
      savedStyles: [],
      isGenerating: false,
      isEnrichingProduct: false,
      isAnalyzingProduct: false,
      enrichError: null,
      analysisError: null,
      error: null,
      cameFromHistory: false,
      language: 'en' as const,
      nowMs: NOW_MS,
      kalodataStatus: { connected: false, keySource: 'none' as const, maskedKey: null, balance: null },
      kalodataLimits: { maxSpendCredits: null, minBalanceReserve: null, trackedSpentCredits: 0 },
      t: TRANSLATIONS.en,
      onBack: () => {},
      onToggleSave: () => {},
      onSelectStyle: () => {},
      onConfirmGenerate: () => {},
      onFetchDeepInsights: async () => {},
      onAnalyzeProduct: async () => {},
      onOpenScoreDetails: () => {},
    };

    const studioDataHtml = renderToStaticMarkup(
      React.createElement(VideoStudioView, { ...studioBaseProps, initialSubpage: 'data' })
    );
    assert.ok(!studioDataHtml.includes(TRANSLATIONS.en.v2.confidenceLabel));
    assert.ok(studioDataHtml.includes(TRANSLATIONS.en.studio.deepToggleTitle));

    const studioIdeasHtml = renderToStaticMarkup(
      React.createElement(VideoStudioView, { ...studioBaseProps, initialSubpage: 'ideas' })
    );
    assert.ok(studioIdeasHtml.includes(TRANSLATIONS.en.studio.analysisBtn));

    const studioKitHtml = renderToStaticMarkup(
      React.createElement(VideoStudioView, { ...studioBaseProps, initialSubpage: 'kit' })
    );
    assert.ok(studioKitHtml.includes(TRANSLATIONS.en.studio.generateNowBtn));

    const historyHtml = renderToStaticMarkup(
      React.createElement(HistoryView, {
        entries: [
          {
            id: 'hist_1',
            savedAt: NOW_ISO,
            product: extremeComp,
            plan: undefined,
          },
        ],
        language: 'en',
        nowMs: NOW_MS,
        t: TRANSLATIONS.en,
        onOpenEntry: () => {},
        onDeleteEntry: () => {},
        onExportBackup: () => {},
        onImportBackupFile: () => {},
        onGoDiscover: () => {},
      })
    );
    assert.ok(historyHtml.includes('/100'));
    assert.ok(!historyHtml.includes('V2 '));
  });
});
