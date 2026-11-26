import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TRANSLATIONS } from '../src/i18n.ts';
import {
  adaptRawKalodataRowToValidatedMetrics,
  computeSyntheticCommissionThb,
  computeSyntheticRevenueEstimate,
  refreshProductValidatedMetricsFreshness,
  validateNumericMetric,
  validatePriceThbMetric,
  validateUnverifiedNumericMetric,
} from '../src/lib/metricFoundation.ts';
import {
  ALL_STRATEGY_IDS,
  buildProductIntelligenceView,
  ensureProductV2Intelligence,
  sortProductsByV2Overall,
} from '../src/lib/productIntelligenceView.ts';
import { evaluateProductCommercialV2 } from '../src/lib/scoringEngineV2.ts';
import { hydrateProductFromStorage } from '../src/lib/storage.ts';
import { sanitizeProductPayloadForAi } from '../server/productSanitizer.ts';
import {
  extractMetricsFromRawRow,
  parseRawProductRow,
} from '../server/kalodata.ts';
import { TopBar } from '../src/components/TopBar.tsx';
import { CompactFilterBar } from '../src/components/CompactFilterBar.tsx';
import { KalodataBar } from '../src/components/KalodataBar.tsx';
import { ProductCard } from '../src/components/ProductCard.tsx';
import { ScoreDetailContent } from '../src/components/ScoreDetailDialog.tsx';
import { VideoStudioView } from '../src/components/VideoStudioView.tsx';
import { HistoryView } from '../src/components/HistoryView.tsx';
import { SearchHistoryView } from '../src/components/SearchHistoryView.tsx';
import type {
  HistoricalMetricSnapshot,
  KalodataCategoryItem,
  KalodataLimitSettings,
  KalodataStatus,
  ProductItem,
  ProductValidatedMetrics,
  RecentSearchEntry,
  SavedHistoryEntry,
  ValidatedMetric,
} from '../src/types.ts';

const NOW_ISO = '2026-11-25T03:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

interface ProfileSeed {
  id: string;
  thaiTitle: string;
  priceThb?: number | null;
  commissionRate?: number | null;
  commissionUnit?: 'PERCENT' | 'UNVERIFIED';
  salesVolume7d?: number | null;
  revenueThb7d?: number | null;
  revenueSynthetic?: boolean;
  videoRevenueThb7d?: number | null;
  liveRevenueThb7d?: number | null;
  revenueGrowthRate?: number | null;
  growthUnit?: 'PERCENT' | 'UNVERIFIED';
  growthDateRange?: string | null;
  creatorCount?: number | null;
  creatorUnit?: 'COUNT' | 'UNVERIFIED';
  rating?: number | null;
  ratingUnit?: 'RATING_5' | 'UNVERIFIED';
  reviewCount?: number | null;
  reviewUnit?: 'COUNT' | 'UNVERIFIED';
  fetchedAt?: string;
  nowMs?: number;
  v1Total?: number;
}

function makeValidatedFromSeed(seed: ProfileSeed): ProductValidatedMetrics {
  const fetchedAt = seed.fetchedAt ?? NOW_ISO;
  const evalNowMs = seed.nowMs ?? NOW_MS;
  const dateRange = 'last7Day';

  const priceThb = validatePriceThbMetric(
    seed.priceThb === undefined ? 299 : seed.priceThb,
    { fetchedAt, dateRange, nowMs: evalNowMs }
  );

  const commRateVal = seed.commissionRate === undefined ? 15 : seed.commissionRate;
  const commissionRate =
    seed.commissionUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(commRateVal, {
          unverifiedNote: 'UNVERIFIED commission unit',
          context: { fetchedAt, dateRange, nowMs: evalNowMs },
        })
      : validateNumericMetric({
          rawInput: commRateVal,
          unit: 'PERCENT',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: evalNowMs,
          allowZero: true,
          allowNegative: false,
        });

  const commissionThb = computeSyntheticCommissionThb(priceThb, commissionRate);

  const salesVolume7d = validateNumericMetric({
    rawInput: seed.salesVolume7d === undefined ? 1000 : seed.salesVolume7d,
    unit: 'COUNT',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: evalNowMs,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const revenueThb7d: ValidatedMetric<number> = seed.revenueSynthetic
    ? computeSyntheticRevenueEstimate(salesVolume7d, priceThb)
    : validateNumericMetric({
        rawInput: seed.revenueThb7d === undefined ? 300_000 : seed.revenueThb7d,
        unit: 'THB',
        provenance: 'SOURCE',
        fetchedAt,
        dateRange,
        nowMs: evalNowMs,
        allowZero: true,
        allowNegative: false,
        integerOnly: true,
      });

  const videoRevenueThb7d = validateNumericMetric({
    rawInput: seed.videoRevenueThb7d === undefined ? 180_000 : seed.videoRevenueThb7d,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: evalNowMs,
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
    nowMs: evalNowMs,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const revenueGrowthRate =
    seed.growthUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(seed.revenueGrowthRate ?? 20, {
          allowNegative: true,
          unverifiedNote: 'UNVERIFIED_GROWTH_UNIT',
          context: { fetchedAt, dateRange: seed.growthDateRange ?? 'last7Day', nowMs: evalNowMs },
        })
      : validateNumericMetric({
          rawInput: seed.revenueGrowthRate === undefined ? 28 : seed.revenueGrowthRate,
          unit: 'PERCENT',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange: seed.growthDateRange ?? 'last7Day vs prev7Day',
          nowMs: evalNowMs,
          allowZero: true,
          allowNegative: true,
        });

  const creatorCount =
    seed.creatorUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(seed.creatorCount ?? 15, {
          unverifiedNote: 'UNVERIFIED_CREATOR_DEFINITION',
          context: { fetchedAt, dateRange, nowMs: evalNowMs },
        })
      : validateNumericMetric({
          rawInput: seed.creatorCount === undefined ? 15 : seed.creatorCount,
          unit: 'COUNT',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: evalNowMs,
          allowZero: true,
          allowNegative: false,
          integerOnly: true,
        });

  const rating =
    seed.ratingUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(seed.rating ?? 4.7, {
          minValue: 0,
          maxValue: 5,
          unverifiedNote: 'UNVERIFIED_RATING_SEMANTICS',
          context: { fetchedAt, dateRange, nowMs: evalNowMs },
        })
      : validateNumericMetric({
          rawInput: seed.rating === undefined ? 4.7 : seed.rating,
          unit: 'RATING_5',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: evalNowMs,
          allowZero: true,
          allowNegative: false,
          minValue: 0,
          maxValue: 5,
        });

  const reviewCount =
    seed.reviewUnit === 'UNVERIFIED'
      ? validateUnverifiedNumericMetric(seed.reviewCount ?? 140, {
          unverifiedNote: 'UNVERIFIED_REVIEW_COUNT',
          context: { fetchedAt, dateRange, nowMs: evalNowMs },
        })
      : validateNumericMetric({
          rawInput: seed.reviewCount === undefined ? 140 : seed.reviewCount,
          unit: 'COUNT',
          provenance: 'SOURCE',
          fetchedAt,
          dateRange,
          nowMs: evalNowMs,
          allowZero: true,
          allowNegative: false,
          integerOnly: true,
        });

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
    unresolvedFields: [],
  };
}

function makeProductFromSeed(seed: ProfileSeed): ProductItem {
  const validatedMetrics = makeValidatedFromSeed(seed);
  return {
    id: seed.id,
    thaiTitle: seed.thaiTitle,
    clearTitle: {
      my: seed.thaiTitle,
      en: seed.thaiTitle,
    },
    whatItIs: {
      my: 'ထိုင်း TikTok Shop ပစ္စည်း',
      en: 'Thailand TikTok Shop affiliate product',
    },
    whySilentWorks: {
      my: 'Visual သက်သေပြနိုင်သည်',
      en: 'Demonstrates clearly on video',
    },
    category: 'beauty',
    categoryLabel: { my: 'အလှကုန်နှင့် အသားအရေ', en: 'Beauty & Personal Care' },
    shopName: `Shop ${seed.id}`,
    priceThb: validatedMetrics.priceThb.value,
    commissionRate: validatedMetrics.commissionRate.value,
    commissionThb: validatedMetrics.commissionThb.value,
    visualTags: ['macro', 'demo'],
    scoreBreakdown: {
      total: seed.v1Total ?? 70,
      grade: 'strong',
      visualDemo: 85,
      aiSuitability: 80,
      salesDemand: 65,
      commissionValue: 60,
      speechPenalty: 0,
    },
    kalodataMetrics: {
      salesVolume7d: validatedMetrics.salesVolume7d.value,
      revenueThb7d: validatedMetrics.revenueThb7d.value,
      videoRevenueThb7d: validatedMetrics.videoRevenueThb7d.value,
      liveRevenueThb7d: validatedMetrics.liveRevenueThb7d.value,
      revenueGrowthRate: validatedMetrics.revenueGrowthRate.value,
      creatorCount: validatedMetrics.creatorCount.value,
      rating: validatedMetrics.rating.value,
      reviewCount: validatedMetrics.reviewCount.value,
      dateRange: 'last7Day',
      fetchedAt: validatedMetrics.fetchedAt ?? NOW_ISO,
    },
    validatedMetrics,
  };
}

function makeSnapshot(
  timestampIso: string,
  revenueThb7d: number,
  salesVolume7d: number,
  creatorCount: number,
  videoRevenueThb7d: number
): HistoricalMetricSnapshot {
  const snapNowMs = Date.parse(timestampIso);
  const base = makeValidatedFromSeed({
    id: 'snap',
    thaiTitle: 'Snapshot Product',
    fetchedAt: timestampIso,
    nowMs: snapNowMs,
    revenueThb7d,
    salesVolume7d,
    creatorCount,
    videoRevenueThb7d,
    priceThb: 350,
    commissionRate: 18,
    revenueGrowthRate: 40,
    rating: 4.8,
    reviewCount: 220,
  });
  return {
    fetchedAt: timestampIso,
    dateRange: 'last7Day',
    revenueThb7d: base.revenueThb7d,
    salesVolume7d: base.salesVolume7d,
    creatorCount: base.creatorCount,
    revenueGrowthRate: base.revenueGrowthRate,
  };
}

describe('Phase 6 — Real-World Product Intelligence & Production Readiness', () => {
  it('validates all 11 realistic product profiles end-to-end without false classifications', () => {
    const profile1StrongWinner = makeProductFromSeed({
      id: 'p1_strong_winner',
      thaiTitle: 'เซรั่มวิตามินซีเข้มข้น 30ml',
      priceThb: 390,
      commissionRate: 20,
      salesVolume7d: 2600,
      revenueThb7d: 1_014_000,
      videoRevenueThb7d: 780_000,
      liveRevenueThb7d: 120_000,
      revenueGrowthRate: 42,
      creatorCount: 18,
      rating: 4.8,
      reviewCount: 310,
      v1Total: 62,
    });

    const profile2ExtremeComp = makeProductFromSeed({
      id: 'p2_extreme_comp',
      thaiTitle: 'ลิปทินท์แมทติดทนยอดฮิต',
      priceThb: 149,
      commissionRate: 10,
      salesVolume7d: 5500,
      revenueThb7d: 819_500,
      videoRevenueThb7d: 500_000,
      revenueGrowthRate: 8,
      creatorCount: 4500,
      rating: 4.7,
      reviewCount: 950,
      v1Total: 92,
    });

    const profile3LowDemandHighComm = makeProductFromSeed({
      id: 'p3_low_demand_high_comm',
      thaiTitle: 'ครีมบำรุงผิวสูตรพิเศษ',
      priceThb: 299,
      commissionRate: 30,
      salesVolume7d: 10,
      revenueThb7d: 2_990,
      videoRevenueThb7d: 1_500,
      revenueGrowthRate: 5,
      creatorCount: 2,
      rating: 4.9,
      reviewCount: 22,
      v1Total: 85,
    });

    const profile4PoorQuality = makeProductFromSeed({
      id: 'p4_poor_quality',
      thaiTitle: 'เครื่องหนีบผมราคาประหยัด',
      priceThb: 249,
      commissionRate: 15,
      salesVolume7d: 1800,
      revenueThb7d: 448_200,
      videoRevenueThb7d: 280_000,
      revenueGrowthRate: 12,
      creatorCount: 24,
      rating: 2.7,
      reviewCount: 260,
    });

    const profile5FewCreatorsHighRev = makeProductFromSeed({
      id: 'p5_few_creators_high_rev',
      thaiTitle: 'เครื่องดูดฝุ่นไร้สายมินิ Pro',
      priceThb: 590,
      commissionRate: 16,
      salesVolume7d: 850,
      revenueThb7d: 501_500,
      videoRevenueThb7d: 390_000,
      revenueGrowthRate: 34,
      creatorCount: 5,
      rating: 4.75,
      reviewCount: 165,
    });

    const profile6ManyCreatorsLowRev = makeProductFromSeed({
      id: 'p6_many_creators_low_rev',
      thaiTitle: 'พวงกุญแจแฟชั่นทั่วไป',
      priceThb: 89,
      commissionRate: 8,
      salesVolume7d: 600,
      revenueThb7d: 53_400,
      videoRevenueThb7d: 20_000,
      revenueGrowthRate: 2,
      creatorCount: 1500,
      rating: 4.4,
      reviewCount: 110,
    });

    const profile7ZeroCommission = makeProductFromSeed({
      id: 'p7_zero_commission',
      thaiTitle: 'มือถือรุ่นเรือธง (0% Comm)',
      priceThb: 4990,
      commissionRate: 0,
      salesVolume7d: 400,
      revenueThb7d: 1_996_000,
      videoRevenueThb7d: 1_200_000,
      revenueGrowthRate: 50,
      creatorCount: 8,
      rating: 4.9,
      reviewCount: 500,
      v1Total: 95,
    });

    const rawUnverifiedRow = adaptRawKalodataRowToValidatedMetrics(
      {
        product_id: 'p8_unverified_kalodata',
        product_name: 'สินค้า Phase 0 ยังไม่ยืนยัน Unit',
        unit_price: 350,
        commission_rate: 15, // Phase 0 unverified non-zero
        sales_volumn: 900,
        revenue: 315_000,
        video_revenue: 210_000,
        revenue_growth_rate: 0.35, // unverified
        creator_count: 14, // unverified
        product_rating: 4.8, // unverified
        review_count: 190, // unverified
      },
      { fetchedAt: NOW_ISO, dateRange: 'last7Day', sourceEndpoint: 'rank', nowMs: NOW_MS }
    );
    const profile8MissingUnverified: ProductItem = {
      ...makeProductFromSeed({ id: 'p8_unverified_kalodata', thaiTitle: 'สินค้า Phase 0 ยังไม่ยืนยัน Unit' }),
      priceThb: 350,
      commissionRate: 15,
      commissionThb: 52.5,
      validatedMetrics: rawUnverifiedRow,
    };

    const profile9SyntheticRevenue = makeProductFromSeed({
      id: 'p9_synthetic_rev',
      thaiTitle: 'สเปรย์กันน้ำรองเท้า (Synthetic Rev)',
      priceThb: 299,
      commissionRate: 15,
      salesVolume7d: 900,
      revenueSynthetic: true,
      videoRevenueThb7d: null,
      revenueGrowthRate: 18,
      creatorCount: 12,
      rating: 4.6,
      reviewCount: 95,
    });

    const profile10VerifiedSnapshots = makeProductFromSeed({
      id: 'p10_with_snapshots',
      thaiTitle: 'เจลล้างหน้าลดสิว (Verified Snapshots)',
      priceThb: 350,
      commissionRate: 18,
      salesVolume7d: 1400,
      revenueThb7d: 490_000,
      videoRevenueThb7d: 310_000,
      revenueGrowthRate: 40,
      creatorCount: 14,
      rating: 4.8,
      reviewCount: 220,
    });

    const profile11NoSnapshots = makeProductFromSeed({
      id: 'p11_no_snapshots',
      thaiTitle: 'เซรั่มคิ้ว (No Snapshot History)',
      priceThb: 280,
      commissionRate: 18,
      salesVolume7d: 1100,
      revenueThb7d: 308_000,
      videoRevenueThb7d: 210_000,
      revenueGrowthRate: 45,
      creatorCount: 11,
      rating: 4.7,
      reviewCount: 180,
    });

    const pool = [
      profile7ZeroCommission,
      profile2ExtremeComp,
      profile3LowDemandHighComm,
      profile4PoorQuality,
      profile6ManyCreatorsLowRev,
      profile8MissingUnverified,
      profile9SyntheticRevenue,
      profile11NoSnapshots,
      profile10VerifiedSnapshots,
      profile5FewCreatorsHighRev,
      profile1StrongWinner,
    ];

    const historicalSnapshotsByProductId: Record<string, HistoricalMetricSnapshot[]> = {
      p10_with_snapshots: [
        makeSnapshot('2026-11-22T03:00:00.000Z', 250_000, 714, 10, 150_000),
        makeSnapshot('2026-11-23T15:00:00.000Z', 310_000, 886, 12, 195_000),
        makeSnapshot('2026-11-25T03:00:00.000Z', 490_000, 1400, 14, 310_000),
      ],
    };

    const overallView = buildProductIntelligenceView(pool, 'overall', {
      nowMs: NOW_MS,
      historicalSnapshotsByProductId,
    });
    const byId = new Map(overallView.rankedEntries.map((e) => [e.product.id, e]));

    // 1. Strong winner ranks at/near top cleanly above high-V1 extreme competition & 0% commission
    const p1 = byId.get('p1_strong_winner')!;
    const p2 = byId.get('p2_extreme_comp')!;
    const p3 = byId.get('p3_low_demand_high_comm')!;
    const p4 = byId.get('p4_poor_quality')!;
    const p5 = byId.get('p5_few_creators_high_rev')!;
    const p6 = byId.get('p6_many_creators_low_rev')!;
    const p7 = byId.get('p7_zero_commission')!;
    const p8 = byId.get('p8_unverified_kalodata')!;
    const p9 = byId.get('p9_synthetic_rev')!;

    assert.ok(p1.commercialOpportunityScore! >= 70);
    assert.ok(p1.rank < p2.rank, 'Strong low-competition winner must outrank extreme-competition item');
    assert.ok(p2.riskTags.includes('EXTREME_COMPETITION'));
    assert.equal(p3.commercialEligibilityStatus, 'RESTRICTED_WEAK_DEMAND');
    assert.ok(p3.commercialOpportunityScore! < 55);
    assert.equal(p4.commercialEligibilityStatus, 'RESTRICTED_POOR_QUALITY');
    assert.ok(p4.riskTags.includes('POOR_CUSTOMER_QUALITY'));
    assert.ok(
      p5.commercialScore.competitionScore.score! > p6.commercialScore.competitionScore.score!,
      'Few creators + high revenue must score much higher on Competition than crowded low-RPC listing'
    );
    assert.equal(p7.opportunityClassification, 'NOT_MONETIZABLE');
    assert.equal(p7.commercialOpportunityScore, 0);
    assert.equal(p7.rank, overallView.rankedEntries.length, '0% commission must sink to bottom');

    // 8. Unverified Phase 0 metrics must NOT leak into qualified strategies & must lower confidence
    assert.equal(p8.provenanceSummary.hasUnverifiedCoreMetrics, true);
    assert.equal(p8.qualifiedStrategyIds.length, 0);
    assert.ok(p8.dataConfidence.score < p1.dataConfidence.score);

    // 9. Synthetic vs SOURCE revenue conflict check
    assert.equal(p9.provenanceSummary.hasSyntheticRevenue, true);
    assert.ok(p9.riskTags.includes('SYNTHETIC_REVENUE'));
    const conflictCheck = evaluateProductCommercialV2(
      {
        ...p1.product.validatedMetrics!,
        revenueThb7d: validateNumericMetric({
          rawInput: 900_000,
          unit: 'THB',
          provenance: 'SOURCE',
          fetchedAt: NOW_ISO,
          dateRange: 'last7Day',
          nowMs: NOW_MS,
        }),
      },
      { nowMs: NOW_MS }
    );
    assert.ok(conflictCheck.demandScore.subcomponents.revenueScore! > 80);

    // 10 & 11. Historical snapshot strategy behavior
    const fastRisingWithSnaps = buildProductIntelligenceView(pool, 'fast_rising_products', {
      nowMs: NOW_MS,
      historicalSnapshotsByProductId,
    });
    assert.ok(
      fastRisingWithSnaps.rankedEntries.some((e) => e.product.id === 'p10_with_snapshots'),
      'Verified multi-snapshot accelerating product must qualify for fast_rising_products'
    );
    assert.ok(
      fastRisingWithSnaps.excludedEntries.some(
        (e) => e.product.id === 'p11_no_snapshots' && e.eligibilityStatus === 'DATA_UNAVAILABLE'
      ),
      'Product without snapshot history must be DATA_UNAVAILABLE in fast_rising_products'
    );
  });

  it('validates all 8 strategies individually including Video Proven non-guarantee and DATA_UNAVAILABLE', () => {
    const pStrong = makeProductFromSeed({
      id: 's_strong',
      thaiTitle: 'เซรั่มผิวใส Pro',
      priceThb: 420,
      commissionRate: 20, // 84 THB payout
      salesVolume7d: 2500,
      revenueThb7d: 1_050_000,
      videoRevenueThb7d: 720_000,
      revenueGrowthRate: 45,
      creatorCount: 16,
      rating: 4.85,
      reviewCount: 280,
    });
    const pUnderserved = makeProductFromSeed({
      id: 's_underserved',
      thaiTitle: 'โคมไฟโซลาร์เซลล์กันน้ำ',
      priceThb: 390,
      commissionRate: 15,
      salesVolume7d: 700,
      revenueThb7d: 273_000,
      videoRevenueThb7d: 180_000,
      revenueGrowthRate: 25,
      creatorCount: 4,
      rating: 4.65,
      reviewCount: 90,
    });
    const pCrowdedVideo = makeProductFromSeed({
      id: 's_crowded_video',
      thaiTitle: 'แผ่นมาส์กหน้าขายดีมาก',
      priceThb: 199,
      commissionRate: 14,
      salesVolume7d: 4000,
      revenueThb7d: 796_000,
      videoRevenueThb7d: 620_000,
      revenueGrowthRate: 15,
      creatorCount: 95,
      rating: 4.7,
      reviewCount: 450,
    });

    const snaps: Record<string, HistoricalMetricSnapshot[]> = {
      s_strong: [
        makeSnapshot('2026-11-22T03:00:00.000Z', 600_000, 1429, 12, 360_000),
        makeSnapshot('2026-11-23T15:00:00.000Z', 710_000, 1690, 14, 460_000),
        makeSnapshot('2026-11-25T03:00:00.000Z', 1_050_000, 2500, 16, 720_000),
      ],
    };

    const pool = [pStrong, pUnderserved, pCrowdedVideo];

    // Check all 8 strategy IDs exist and evaluate cleanly
    for (const strategyId of ALL_STRATEGY_IDS) {
      const view = buildProductIntelligenceView(pool, strategyId, {
        nowMs: NOW_MS,
        historicalSnapshotsByProductId: snaps,
      });
      assert.equal(view.activeView, strategyId);
      assert.ok(view.rankedEntries.length >= 1, `Expected >=1 qualified for ${strategyId}`);
    }

    // Without snapshots, both historical strategies MUST return DATA_UNAVAILABLE & 0 qualified
    for (const histId of ['fast_rising_products', 'trend_timing_opportunity'] as const) {
      const noSnapView = buildProductIntelligenceView(pool, histId, { nowMs: NOW_MS });
      assert.equal(noSnapView.rankedEntries.length, 0);
      assert.equal(noSnapView.isHistoricalDataUnavailable, true);
    }

    // Video Proven Winners must qualify proven short-video sellers without promising future conversion
    const videoView = buildProductIntelligenceView(pool, 'video_proven_winners', { nowMs: NOW_MS });
    assert.ok(videoView.rankedEntries.some((e) => e.product.id === 's_crowded_video'));
    assert.match(
      TRANSLATIONS.en.v2.conversionDisclaimerShort,
      /do(?:es)? not guarantee/i
    );
  });

  it('fixes Phase 6 defects: 0% commission sanitization, >60% commission parsing, /detail metric extraction without title, rank deduplication, and live stale detection', () => {
    // 1. Server AI payload sanitizer preserves 0% commission & ฿0 payout (never fabricates 0.1% / ฿1)
    const zeroCommProduct = makeProductFromSeed({
      id: 'zero_sanitizer',
      thaiTitle: 'มือถือ 0% คอมมิชชั่น',
      priceThb: 3990,
      commissionRate: 0,
    });
    const sanitizedAnalyze = sanitizeProductPayloadForAi(zeroCommProduct, { forVideoPlan: false });
    const sanitizedVideo = sanitizeProductPayloadForAi(zeroCommProduct, { forVideoPlan: true });
    assert.equal(sanitizedAnalyze.commissionRate, 0);
    assert.equal(sanitizedAnalyze.commissionThb, 0);
    assert.equal(sanitizedVideo.commissionRate, 0);
    assert.equal(sanitizedVideo.commissionThb, 0);

    // Also supports >60% up to 100% and decimal commissionThb
    const highCommProduct = makeProductFromSeed({
      id: 'high_comm_sanitizer',
      thaiTitle: 'สินค้า 75% คอม',
      priceThb: 199,
      commissionRate: 75,
    });
    const sanitizedHigh = sanitizeProductPayloadForAi(highCommProduct);
    assert.equal(sanitizedHigh.commissionRate, 75);
    assert.equal(sanitizedHigh.commissionThb, 149.25);

    // 2. kalodata.ts extractMetricsFromRawRow & parseRawProductRow
    const highCommRow = parseRawProductRow(
      {
        product_id: '777',
        product_name: 'สินค้าคอม 75%',
        unit_price: 200,
        commission_rate: 75,
        revenue: 50000,
        sales_volumn: 250,
      },
      '777',
      'rank',
      NOW_ISO,
      { nowMs: NOW_MS }
    );
    assert.ok(highCommRow);
    assert.equal(highCommRow.commissionRate, 75);

    // /detail response omitting product_name still extracts metrics cleanly via extractMetricsFromRawRow
    const detailNoTitle = extractMetricsFromRawRow(
      {
        unit_price: 399,
        commission_rate: 0.18,
        revenue: 120_000,
        sales_volumn: 300,
        video_revenue: 85_000,
      },
      'detail',
      NOW_ISO,
      { nowMs: NOW_MS }
    );
    assert.equal(detailNoTitle.hasAnyRawMetricField, true);
    assert.equal(detailNoTitle.kalodataMetrics.revenueThb7d, 120_000);
    assert.equal(detailNoTitle.validatedMetrics.revenueThb7d.state, 'OK');

    // 3. Stale data (>24h) detection with live nowMs vs omitted nowMs
    const freshCandidate = makeProductFromSeed({
      id: 'stale_prod',
      thaiTitle: 'เซรั่มเก่าเกิน 24 ชม',
      fetchedAt: NOW_ISO,
    });
    const futureNowMs = NOW_MS + 48 * 3_600_000; // 48 hours later
    // Without nowMs: stays deterministic (pre-attached V2 preserved as OK)
    const hydratedNoClock = hydrateProductFromStorage(
      ensureProductV2Intelligence(freshCandidate)
    );
    assert.equal(hydratedNoClock.validatedMetrics!.revenueThb7d.state, 'OK');

    // With live nowMs (>24h later): transitions to STALE + emits STALE_DATA risk & drops confidence
    const hydratedWithClock = hydrateProductFromStorage(
      ensureProductV2Intelligence(freshCandidate),
      { nowMs: futureNowMs }
    );
    assert.equal(hydratedWithClock.validatedMetrics!.revenueThb7d.state, 'STALE');
    assert.equal(hydratedWithClock.commercialScoreV2!.eligibilityStatus, 'INSUFFICIENT_DATA');
    assert.ok(hydratedWithClock.commercialScoreV2!.riskTags.includes('STALE_DATA'));

    const refreshedDirect = refreshProductValidatedMetricsFreshness(
      freshCandidate.validatedMetrics!,
      { nowMs: futureNowMs }
    );
    assert.equal(refreshedDirect.priceThb.state, 'STALE');
    assert.equal(refreshedDirect.commissionThb.state, 'STALE');
  });

  it('renders all primary components cleanly in Myanmar and English without crashing', () => {
    const prod = ensureProductV2Intelligence(
      makeProductFromSeed({
        id: 'ssr_1',
        thaiTitle: 'ครีมกันแดด SPF50+ PA++++',
        priceThb: 299,
        commissionRate: 18,
      }),
      { nowMs: NOW_MS }
    );
    const categories: KalodataCategoryItem[] = [
      { id: '', label: { my: 'အားလုံး', en: 'All' }, visualGroup: 'beauty', source: 'official' },
      { id: '601450', label: { my: 'အလှကုန်', en: 'Beauty' }, visualGroup: 'beauty', source: 'official' },
    ];
    const status: KalodataStatus = {
      connected: false,
      keySource: 'none',
      maskedKey: null,
      balance: null,
    };
    const limits: KalodataLimitSettings = {
      maxSpendCredits: 20,
      minBalanceReserve: 5,
      trackedSpentCredits: 1.4,
    };
    const recent: RecentSearchEntry = {
      id: 'srch_1',
      searchedAt: NOW_ISO,
      query: 'กันแดด',
      cateIds: ['601450'],
      cateLabels: [{ my: 'အလှကုန်', en: 'Beauty' }],
      mode: 'rank',
      products: [prod],
      creditsUsed: 0.2,
    };
    const savedEntry: SavedHistoryEntry = {
      id: 'hist_1',
      savedAt: NOW_ISO,
      product: prod,
    };

    for (const lang of ['my', 'en'] as const) {
      const t = TRANSLATIONS[lang];
      const viewModel = buildProductIntelligenceView([prod], 'overall', { nowMs: NOW_MS });
      const topHtml = renderToStaticMarkup(
        React.createElement(TopBar, {
          activeTab: 'discover',
          onNavigate: () => {},
          language: lang,
          onToggleLanguage: () => {},
          theme: 'light',
          onToggleTheme: () => {},
          searchHistoryCount: 1,
          savedCount: 1,
          kalodataStatus: status,
          kalodataLimits: limits,
          isKalodataPanelOpen: false,
          onToggleKalodataPanel: () => {},
          t,
        })
      );
      assert.ok(topHtml.includes('SiamVisual'));

      const compactHtml = renderToStaticMarkup(
        React.createElement(CompactFilterBar, {
          isVisible: true,
          isHeaderHidden: false,
          headerHeight: 60,
          categories,
          selectedCateIds: [],
          categoryMatchCounts: new Map([['', 1]]),
          language: lang,
          query: '',
          searchPageSize: 100,
          isSearching: false,
          isSingleLinkValid: false,
          isLinkOrId: false,
          t,
          onToggleCategory: () => {},
          onOpenSearchDrawer: () => {},
        })
      );
      assert.ok(compactHtml.includes('Beauty') || compactHtml.includes('အလှကုန်'));

      const kaloHtml = renderToStaticMarkup(
        React.createElement(KalodataBar, {
          status,
          limits,
          isConnecting: false,
          isRefreshingBalance: false,
          connectError: null,
          t,
          onConnect: async () => true,
          onDisconnect: async () => {},
          onRefreshBalance: async () => {},
          onSaveLimits: () => {},
        })
      );
      assert.ok(kaloHtml.includes('Kalodata'));

      for (const [viewMode, density] of [
        ['grid', 'spacious'],
        ['grid', 'compact'],
        ['grid', 'micro'],
        ['list', 'spacious'],
        ['list', 'compact'],
        ['list', 'micro'],
      ] as const) {
        const cardHtml = renderToStaticMarkup(
          React.createElement(ProductCard, {
            product: prod,
            intelligenceItem: viewModel.rankedEntries[0],
            index: 0,
            language: lang,
            isSaved: true,
            viewMode,
            density,
            nowMs: NOW_MS,
            t,
            onSelect: () => {},
            onToggleSave: () => {},
            onOpenScoreDetails: () => {},
          })
        );
        assert.ok(cardHtml.includes('ครีมกันแดด'));
      }

      const detailHtml = renderToStaticMarkup(
        React.createElement(ScoreDetailContent, {
          product: prod,
          language: lang,
          nowMs: NOW_MS,
          t,
          onClose: () => {},
        })
      );
      assert.ok(detailHtml.includes('sticky') || detailHtml.includes('shrink-0'));

      const studioHtml = renderToStaticMarkup(
        React.createElement(VideoStudioView, {
          product: prod,
          isSaved: true,
          plan: null,
          style: 'cinematic',
          savedStyles: [],
          isGenerating: false,
          isEnrichingProduct: false,
          isAnalyzingProduct: false,
          enrichError: null,
          analysisError: null,
          error: null,
          cameFromHistory: false,
          language: lang,
          nowMs: NOW_MS,
          kalodataStatus: status,
          kalodataLimits: limits,
          t,
          onBack: () => {},
          onToggleSave: () => {},
          onSelectStyle: () => {},
          onConfirmGenerate: () => {},
          onFetchDeepInsights: async () => {},
          onAnalyzeProduct: async () => {},
          onOpenScoreDetails: () => {},
        })
      );
      assert.ok(studioHtml.includes('ครีมกันแดด'));

      const historyHtml = renderToStaticMarkup(
        React.createElement(HistoryView, {
          entries: [savedEntry],
          language: lang,
          nowMs: NOW_MS,
          t,
          onOpenEntry: () => {},
          onDeleteEntry: () => {},
          onExportBackup: () => {},
          onImportBackupFile: () => {},
          onGoDiscover: () => {},
        })
      );
      assert.ok(historyHtml.includes('ครีมกันแดด'));

      const searchHistoryHtml = renderToStaticMarkup(
        React.createElement(SearchHistoryView, {
          entries: [recent],
          activeRecentId: recent.id,
          language: lang,
          t,
          onOpenEntry: () => {},
          onDeleteEntry: () => {},
          onClearAll: () => {},
          onGoDiscover: () => {},
        })
      );
      assert.ok(searchHistoryHtml.includes('กันแดด'));
    }

    // Verify sortProductsByV2Overall handles duplicate IDs cleanly
    const dedupSorted = sortProductsByV2Overall([prod, prod], { nowMs: NOW_MS });
    assert.equal(dedupSorted.length, 1);
  });
});
