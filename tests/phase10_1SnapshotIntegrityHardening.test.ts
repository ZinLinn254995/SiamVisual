import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractMetricsFromRawRow } from '../server/kalodata.ts';
import {
  adaptProductItemToValidatedMetrics,
  adaptRawKalodataRowToValidatedMetrics,
  validateNumericMetric,
} from '../src/lib/metricFoundation.ts';
import { evaluateProductCommercialV2 } from '../src/lib/scoringEngineV2.ts';
import {
  PRODUCT_SNAPSHOTS_STORAGE_KEY,
  appendObservationSnapshot,
  buildStrategySnapshotsMap,
  createObservationSnapshotFromProduct,
  deriveSnapshotTrend,
  loadProductSnapshotsFromStorage,
  mergeRestoredProductSnapshots,
  recordProductSnapshotsInStorage,
  sanitizeImportedProductSnapshotsMap,
  sanitizeProductSnapshotsMap,
  toStrategyHistoricalSnapshots,
  type StorageLike,
} from '../src/lib/snapshotStore.ts';
import {
  buildBackupPayload,
  mergeKalodataMetrics,
  mergeValidatedMetricsSnapshots,
  parseBackupFile,
} from '../src/lib/storage.ts';
import { evaluateProductStrategiesV2 } from '../src/lib/strategyEngineV2.ts';
import type {
  HistoricalMetricSnapshot,
  ProductItem,
  ProductObservationSnapshot,
  ProductValidatedMetrics,
  SavedHistoryEntry,
} from '../src/types.ts';

const NOW_ISO = '2026-04-20T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

function createMemoryStorage(initial?: Record<string, string>): StorageLike {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
  };
}

function makeVerifiedValidatedMetrics(params: {
  id: string;
  fetchedAt: string;
  revenueThb7d: number;
  salesVolume7d?: number;
  videoRevenueThb7d?: number;
  commissionRate?: number;
  priceThb?: number;
  creatorCount?: number;
  revenueGrowthRate?: number;
  rating?: number;
  reviewCount?: number;
  dateRange?: string;
  sourceEndpoint?: 'rank' | 'detail' | 'legacy_product' | 'unknown';
}): ProductValidatedMetrics {
  const ts = params.fetchedAt;
  const ms = Date.parse(ts);
  const dateRange = params.dateRange ?? 'last7Day';
  const sourceEndpoint = params.sourceEndpoint ?? 'detail';
  const priceThb = params.priceThb ?? 390;
  const commissionRate = params.commissionRate ?? 15;
  const salesVolume7d = params.salesVolume7d ?? Math.round(params.revenueThb7d / priceThb);
  const videoRevenueThb7d = params.videoRevenueThb7d ?? Math.round(params.revenueThb7d * 0.65);

  return {
    dateRange,
    fetchedAt: ts,
    sourceEndpoint,
    priceThb: validateNumericMetric({
      rawInput: priceThb,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
      minValue: 0,
    }),
    commissionRate: validateNumericMetric({
      rawInput: commissionRate,
      unit: 'PERCENT',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
      minValue: 0,
      maxValue: 100,
    }),
    commissionThb: validateNumericMetric({
      rawInput: Math.round(priceThb * (commissionRate / 100) * 100) / 100,
      unit: 'THB',
      provenance: 'SYNTHETIC',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
      minValue: 0,
    }),
    salesVolume7d: validateNumericMetric({
      rawInput: salesVolume7d,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
      minValue: 0,
    }),
    revenueThb7d: validateNumericMetric({
      rawInput: params.revenueThb7d,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
      minValue: 0,
    }),
    videoRevenueThb7d: validateNumericMetric({
      rawInput: videoRevenueThb7d,
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
      minValue: 0,
    }),
    liveRevenueThb7d: validateNumericMetric({
      rawInput: Math.round(params.revenueThb7d * 0.15),
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
      minValue: 0,
    }),
    shoppingMallRevenueThb7d: validateNumericMetric({
      rawInput: Math.round(params.revenueThb7d * 0.2),
      unit: 'THB',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
      minValue: 0,
    }),
    revenueGrowthRate: validateNumericMetric({
      rawInput: params.revenueGrowthRate ?? 28,
      unit: 'PERCENT',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
    }),
    creatorCount: validateNumericMetric({
      rawInput: params.creatorCount ?? 10,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
      minValue: 0,
    }),
    rating: validateNumericMetric({
      rawInput: params.rating ?? 4.7,
      unit: 'RATING_5',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
      minValue: 0,
      maxValue: 5,
    }),
    reviewCount: validateNumericMetric({
      rawInput: params.reviewCount ?? 120,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: ts,
      dateRange,
      sourceEndpoint,
      nowMs: ms,
      minValue: 0,
    }),
    unresolvedFields: [],
  };
}

function makeProductItem(
  id: string,
  validatedMetrics: ProductValidatedMetrics
): ProductItem {
  const score = evaluateProductCommercialV2(validatedMetrics, { nowMs: NOW_MS });
  return {
    id,
    thaiTitle: `สินค้าทดสอบ ${id}`,
    clearTitle: { my: `စမ်းသပ်ပစ္စည်း ${id}`, en: `Test Product ${id}` },
    whatItIs: { my: 'စမ်းသပ်ပစ္စည်း', en: 'Test product' },
    whySilentWorks: { my: 'ပြသရလွယ်', en: 'Easy visual demo' },
    category: 'beauty',
    categoryLabel: { my: 'အလှကုန်', en: 'Beauty' },
    priceThb: validatedMetrics.priceThb.value ?? 390,
    commissionRate: validatedMetrics.commissionRate.value ?? 15,
    commissionThb: validatedMetrics.commissionThb.value ?? 58.5,
    scoreBreakdown: {
      total: 70,
      grade: 'strong',
      visualDemo: 70,
      aiSuitability: 70,
      salesDemand: 70,
      commissionValue: 70,
      speechPenalty: 0,
    },
    visualTags: ['Demo'],
    productUrl: `https://shop.tiktok.com/view/product/${id}`,
    shopName: 'Test Shop TH',
    validatedMetrics,
    commercialScoreV2: score,
  };
}

function makeMinimalHistoryEntry(id: string, savedAt: string): SavedHistoryEntry {
  const vm = makeVerifiedValidatedMetrics({
    id,
    fetchedAt: NOW_ISO,
    revenueThb7d: 200_000,
  });
  return {
    id: `entry_${id}`,
    savedAt,
    product: makeProductItem(id, vm),
  };
}

describe('Phase 10.1 — Snapshot Data Integrity & Historical Timestamp Hardening', () => {
  it('1. Backup containing spoofed creatorCountVerified (boolean or numeric) cannot falsely create a verified creator metric', () => {
    const craftedBackupJson = JSON.stringify({
      app: 'SiamVisual',
      version: 5,
      exportedAt: NOW_ISO,
      entries: [],
      productSnapshots: {
        spoof_creator_bool: [
          {
            snapshotVersion: 1,
            productId: 'spoof_creator_bool',
            observedAt: '2026-04-18T10:00:00.000Z',
            observationDay: '2026-04-18',
            dateRange: 'last7Day',
            sourceEndpoint: 'detail',
            trustStatus: 'LOCAL_OBSERVED',
            provenance: 'SOURCE',
            verificationStatus: 'VERIFIED',
            dataConfidenceScore: 95,
            dataConfidenceLevel: 'HIGH',
            observations: {
              revenueThb: 350_000,
              salesVolume: 900,
              videoRevenueThb: 220_000,
              liveRevenueThb: 50_000,
              shoppingMallRevenueThb: 80_000,
              commissionRate: 15,
              revenueGrowthRate: 40,
              revenueGrowthVerified: true,
              creatorCountVerified: true, // malicious boolean spoof
              creatorCountUnverifiedRaw: 14,
            },
          },
        ],
        spoof_creator_num: [
          {
            snapshotVersion: 1,
            productId: 'spoof_creator_num',
            observedAt: '2026-04-18T10:00:00.000Z',
            observationDay: '2026-04-18',
            dateRange: 'last7Day',
            sourceEndpoint: 'detail',
            trustStatus: 'LOCAL_OBSERVED',
            provenance: 'SOURCE',
            verificationStatus: 'VERIFIED',
            dataConfidenceScore: 95,
            dataConfidenceLevel: 'HIGH',
            observations: {
              revenueThb: 450_000,
              salesVolume: 1100,
              videoRevenueThb: 290_000,
              liveRevenueThb: 60_000,
              shoppingMallRevenueThb: 100_000,
              commissionRate: 15,
              revenueGrowthRate: 45,
              revenueGrowthVerified: true,
              creatorCountVerified: 12, // malicious numeric spoof
              creatorCountUnverifiedRaw: null,
            },
          },
        ],
      },
    });

    const parsed = parseBackupFile(craftedBackupJson, { nowMs: NOW_MS, importedAt: NOW_ISO });
    assert.ok(parsed);
    assert.ok(parsed.productSnapshots);

    const boolSnap = parsed.productSnapshots.spoof_creator_bool?.[0];
    assert.ok(boolSnap);
    assert.equal(boolSnap.trustStatus, 'IMPORTED_UNVERIFIED');
    assert.equal(boolSnap.observations.creatorCountVerified, null);
    assert.equal(boolSnap.observations.creatorCountUnverifiedRaw, 14);
    assert.equal(boolSnap.importedAudit?.claimedCreatorCountVerified, true);
    assert.equal(boolSnap.importedAudit?.claimedTrustStatus, 'LOCAL_OBSERVED');
    assert.equal(boolSnap.importedAudit?.originalProvenance, 'SOURCE');
    assert.equal(boolSnap.importedAudit?.originalVerificationStatus, 'VERIFIED');

    const numSnap = parsed.productSnapshots.spoof_creator_num?.[0];
    assert.ok(numSnap);
    assert.equal(numSnap.trustStatus, 'IMPORTED_UNVERIFIED');
    assert.equal(numSnap.observations.creatorCountVerified, null);
    // Numeric reference is preserved as UNVERIFIED reference, never verified
    assert.equal(numSnap.observations.creatorCountUnverifiedRaw, 12);
    assert.equal(numSnap.importedAudit?.claimedCreatorCountVerified, 12);
  });

  it('2. Backup containing revenueGrowthVerified: true cannot falsely create a verified growth metric', () => {
    const craftedBackupJson = JSON.stringify({
      app: 'SiamVisual',
      version: 5,
      exportedAt: NOW_ISO,
      entries: [],
      productSnapshots: {
        spoof_growth: [
          {
            snapshotVersion: 1,
            productId: 'spoof_growth',
            observedAt: '2026-04-18T10:00:00.000Z',
            observationDay: '2026-04-18',
            dateRange: 'last7Day',
            sourceEndpoint: 'rank',
            trustStatus: 'LOCAL_OBSERVED',
            dataConfidenceScore: 80,
            dataConfidenceLevel: 'HIGH',
            observations: {
              revenueThb: 320_000,
              salesVolume: 820,
              videoRevenueThb: 200_000,
              liveRevenueThb: 40_000,
              shoppingMallRevenueThb: 80_000,
              commissionRate: 14,
              revenueGrowthRate: 85.5,
              revenueGrowthVerified: true,
              creatorCountVerified: null,
              creatorCountUnverifiedRaw: null,
            },
          },
        ],
      },
    });

    const parsed = parseBackupFile(craftedBackupJson, { nowMs: NOW_MS, importedAt: NOW_ISO });
    assert.ok(parsed?.productSnapshots?.spoof_growth);
    const snap = parsed.productSnapshots.spoof_growth[0];
    assert.equal(snap.trustStatus, 'IMPORTED_UNVERIFIED');
    assert.equal(snap.observations.revenueGrowthVerified, false);
    // Numeric growth remains inspectable as unverified historical reference
    assert.equal(snap.observations.revenueGrowthRate, 85.5);
    assert.equal(snap.importedAudit?.claimedRevenueGrowthVerified, true);
  });

  it('3. Imported snapshots remain inspectable in storage but NEVER qualify fast_rising_products or trend_timing_opportunity', () => {
    const spoofedMultiDayBackup = JSON.stringify({
      app: 'SiamVisual',
      version: 5,
      exportedAt: NOW_ISO,
      entries: [],
      productSnapshots: {
        imported_rising: [
          {
            snapshotVersion: 1,
            productId: 'imported_rising',
            observedAt: '2026-04-17T10:00:00.000Z',
            observationDay: '2026-04-17',
            dateRange: 'last7Day',
            sourceEndpoint: 'detail',
            trustStatus: 'LOCAL_OBSERVED',
            dataConfidenceScore: 90,
            dataConfidenceLevel: 'HIGH',
            observations: {
              revenueThb: 200_000,
              salesVolume: 500,
              videoRevenueThb: 140_000,
              liveRevenueThb: 30_000,
              shoppingMallRevenueThb: 30_000,
              commissionRate: 15,
              revenueGrowthRate: 25,
              revenueGrowthVerified: true,
              creatorCountVerified: 6,
              creatorCountUnverifiedRaw: null,
            },
          },
          {
            snapshotVersion: 1,
            productId: 'imported_rising',
            observedAt: '2026-04-18T22:00:00.000Z',
            observationDay: '2026-04-18',
            dateRange: 'last7Day',
            sourceEndpoint: 'detail',
            trustStatus: 'LOCAL_OBSERVED',
            dataConfidenceScore: 90,
            dataConfidenceLevel: 'HIGH',
            observations: {
              revenueThb: 300_000,
              salesVolume: 760,
              videoRevenueThb: 210_000,
              liveRevenueThb: 45_000,
              shoppingMallRevenueThb: 45_000,
              commissionRate: 15,
              revenueGrowthRate: 50,
              revenueGrowthVerified: true,
              creatorCountVerified: 7,
              creatorCountUnverifiedRaw: null,
            },
          },
          {
            snapshotVersion: 1,
            productId: 'imported_rising',
            observedAt: '2026-04-20T10:00:00.000Z',
            observationDay: '2026-04-20',
            dateRange: 'last7Day',
            sourceEndpoint: 'detail',
            trustStatus: 'LOCAL_OBSERVED',
            dataConfidenceScore: 92,
            dataConfidenceLevel: 'HIGH',
            observations: {
              revenueThb: 520_000,
              salesVolume: 1300,
              videoRevenueThb: 360_000,
              liveRevenueThb: 80_000,
              shoppingMallRevenueThb: 80_000,
              commissionRate: 15,
              revenueGrowthRate: 73,
              revenueGrowthVerified: true,
              creatorCountVerified: 8,
              creatorCountUnverifiedRaw: null,
            },
          },
        ],
      },
    });

    const storage = createMemoryStorage();
    const parsed = parseBackupFile(spoofedMultiDayBackup, {
      nowMs: NOW_MS,
      importedAt: NOW_ISO,
    });
    assert.ok(parsed?.productSnapshots);

    const { merged, addedSnapshots } = mergeRestoredProductSnapshots(
      {},
      parsed.productSnapshots,
      storage,
      { nowMs: NOW_MS, importedAt: NOW_ISO }
    );

    // Restored history IS preserved & visible in storage for user inspection
    assert.equal(addedSnapshots, 3);
    const storedList = loadProductSnapshotsFromStorage(storage, { nowMs: NOW_MS }).imported_rising;
    assert.equal(storedList?.length, 3);
    assert.ok(storedList.every((s) => s.trustStatus === 'IMPORTED_UNVERIFIED'));
    assert.ok(storedList.every((s) => s.observations.creatorCountVerified === null));
    assert.ok(storedList.every((s) => s.observations.revenueGrowthVerified === false));

    // Default deriveSnapshotTrend excludes IMPORTED_UNVERIFIED
    assert.equal(deriveSnapshotTrend(storedList, { nowMs: NOW_MS }), null);
    // Optional reference mode is clearly labeled INCLUDES_IMPORTED_UNVERIFIED and omits verifiedCreatorDeltaPct
    const refTrend = deriveSnapshotTrend(storedList, {
      nowMs: NOW_MS,
      includeImportedReference: true,
    });
    assert.ok(refTrend);
    assert.equal(refTrend.trustScope, 'INCLUDES_IMPORTED_UNVERIFIED');
    assert.equal(refTrend.verifiedCreatorDeltaPct, null);

    // Strategy conversion emits ZERO snapshots for imported unverified records
    const strategySnaps = toStrategyHistoricalSnapshots(merged.imported_rising, {
      nowMs: NOW_MS,
    });
    assert.equal(strategySnaps.length, 0);

    const product = makeProductItem(
      'imported_rising',
      makeVerifiedValidatedMetrics({
        id: 'imported_rising',
        fetchedAt: NOW_ISO,
        revenueThb7d: 520_000,
        creatorCount: 8,
      })
    );
    const evalViaStore = evaluateProductStrategiesV2(product, undefined, {
      scoringConfig: { nowMs: NOW_MS },
      historicalSnapshots: strategySnaps,
    });
    assert.equal(
      evalViaStore.strategies.fast_rising_products.eligibilityStatus,
      'DATA_UNAVAILABLE'
    );
    assert.equal(
      evalViaStore.strategies.trend_timing_opportunity.eligibilityStatus,
      'DATA_UNAVAILABLE'
    );

    // Direct defense-in-depth in strategyEngineV2: even if a caller constructs HistoricalMetricSnapshot[]
    // with trustStatus: 'IMPORTED_UNVERIFIED', strategyEngineV2 rejects them
    const directImportedHistorical: HistoricalMetricSnapshot[] = [
      '2026-04-17T10:00:00.000Z',
      '2026-04-18T22:00:00.000Z',
      '2026-04-20T10:00:00.000Z',
    ].map((iso, idx) => ({
      fetchedAt: iso,
      dateRange: 'last7Day',
      trustStatus: 'IMPORTED_UNVERIFIED',
      revenueThb7d: validateNumericMetric({
        rawInput: [200_000, 300_000, 520_000][idx],
        unit: 'THB',
        provenance: 'SOURCE',
        fetchedAt: iso,
        nowMs: Date.parse(iso),
      }),
      creatorCount: validateNumericMetric({
        rawInput: [6, 7, 8][idx],
        unit: 'COUNT',
        provenance: 'SOURCE',
        fetchedAt: iso,
        nowMs: Date.parse(iso),
      }),
    }));
    const evalDirect = evaluateProductStrategiesV2(product, undefined, {
      scoringConfig: { nowMs: NOW_MS },
      historicalSnapshots: directImportedHistorical,
    });
    assert.equal(
      evalDirect.strategies.fast_rising_products.eligibilityStatus,
      'DATA_UNAVAILABLE'
    );
    assert.equal(
      evalDirect.strategies.trend_timing_opportunity.eligibilityStatus,
      'DATA_UNAVAILABLE'
    );
  });

  it('4. Re-exporting and re-importing preserves trust status on export and NEVER upgrades imported trust', () => {
    const storage = createMemoryStorage();
    const localProd = makeProductItem(
      'p_roundtrip',
      makeVerifiedValidatedMetrics({
        id: 'p_roundtrip',
        fetchedAt: '2026-04-19T10:00:00.000Z',
        revenueThb7d: 300_000,
        creatorCount: 10,
      })
    );
    const localRec = recordProductSnapshotsInStorage([localProd], {
      storage,
      nowMs: NOW_MS,
    });
    assert.equal(
      localRec.snapshotsByProductId.p_roundtrip[0].trustStatus,
      'LOCAL_OBSERVED'
    );

    // Export #1 preserves LOCAL_OBSERVED in exported JSON
    const export1 = buildBackupPayload({
      entries: [],
      productSnapshots: localRec.snapshotsByProductId,
      deepInsightsCache: {},
      productAnalysisCache: {},
      exportedAt: NOW_ISO,
    });
    assert.equal(export1.version, 5);
    assert.equal(
      export1.productSnapshots?.p_roundtrip?.[0].trustStatus,
      'LOCAL_OBSERVED'
    );

    // Import #1 onto a fresh device MUST downgrade to IMPORTED_UNVERIFIED
    const freshStorage = createMemoryStorage();
    const parsed1 = parseBackupFile(JSON.stringify(export1), {
      nowMs: NOW_MS,
      importedAt: NOW_ISO,
    });
    assert.ok(parsed1?.productSnapshots);
    const merged1 = mergeRestoredProductSnapshots(
      {},
      parsed1.productSnapshots,
      freshStorage,
      { nowMs: NOW_MS, importedAt: NOW_ISO }
    );
    const snapAfterImport1 = merged1.merged.p_roundtrip[0];
    assert.equal(snapAfterImport1.trustStatus, 'IMPORTED_UNVERIFIED');
    assert.equal(snapAfterImport1.observations.creatorCountVerified, null);
    assert.equal(snapAfterImport1.observations.creatorCountUnverifiedRaw, 10);
    assert.equal(snapAfterImport1.observations.revenueGrowthVerified, false);

    // Export #2 from fresh device preserves IMPORTED_UNVERIFIED (never upgrades)
    const export2 = buildBackupPayload({
      entries: [],
      productSnapshots: loadProductSnapshotsFromStorage(freshStorage, { nowMs: NOW_MS }),
      deepInsightsCache: {},
      productAnalysisCache: {},
      exportedAt: NOW_ISO,
    });
    assert.equal(
      export2.productSnapshots?.p_roundtrip?.[0].trustStatus,
      'IMPORTED_UNVERIFIED'
    );

    // Re-import #2 still remains IMPORTED_UNVERIFIED with audit metadata intact
    const parsed2 = parseBackupFile(JSON.stringify(export2), {
      nowMs: NOW_MS,
      importedAt: NOW_ISO,
    });
    const snapAfterImport2 = parsed2?.productSnapshots?.p_roundtrip?.[0];
    assert.ok(snapAfterImport2);
    assert.equal(snapAfterImport2.trustStatus, 'IMPORTED_UNVERIFIED');
    assert.equal(snapAfterImport2.observations.creatorCountVerified, null);
    assert.equal(snapAfterImport2.observations.revenueGrowthVerified, false);
    assert.equal(snapAfterImport2.observations.creatorCountUnverifiedRaw, 10);
  });

  it('5. Legitimate local snapshots (Phase 10.1 and pre-10.1 legacy local storage) still qualify historical strategies', () => {
    // Part A: Pre-10.1 legacy local storage records (missing trustStatus & metricMeta)
    const legacyLocalRaw = {
      legacy_rising: [
        {
          snapshotVersion: 1,
          productId: 'legacy_rising',
          observedAt: '2026-04-17T10:00:00.000Z',
          observationDay: '2026-04-17',
          dateRange: 'last7Day',
          sourceEndpoint: 'detail',
          dataConfidenceScore: 90,
          dataConfidenceLevel: 'HIGH',
          observations: {
            revenueThb: 200_000,
            salesVolume: 500,
            videoRevenueThb: 140_000,
            liveRevenueThb: 30_000,
            shoppingMallRevenueThb: 30_000,
            commissionRate: 15,
            revenueGrowthRate: 25,
            revenueGrowthVerified: true,
            creatorCountVerified: 6,
            creatorCountUnverifiedRaw: null,
          },
        },
        {
          snapshotVersion: 1,
          productId: 'legacy_rising',
          observedAt: '2026-04-18T22:00:00.000Z',
          observationDay: '2026-04-18',
          dateRange: 'last7Day',
          sourceEndpoint: 'detail',
          dataConfidenceScore: 90,
          dataConfidenceLevel: 'HIGH',
          observations: {
            revenueThb: 300_000,
            salesVolume: 760,
            videoRevenueThb: 210_000,
            liveRevenueThb: 45_000,
            shoppingMallRevenueThb: 45_000,
            commissionRate: 15,
            revenueGrowthRate: 50,
            revenueGrowthVerified: true,
            creatorCountVerified: 7,
            creatorCountUnverifiedRaw: null,
          },
        },
        {
          snapshotVersion: 1,
          productId: 'legacy_rising',
          observedAt: '2026-04-20T10:00:00.000Z',
          observationDay: '2026-04-20',
          dateRange: 'last7Day',
          sourceEndpoint: 'detail',
          dataConfidenceScore: 92,
          dataConfidenceLevel: 'HIGH',
          observations: {
            revenueThb: 520_000,
            salesVolume: 1300,
            videoRevenueThb: 360_000,
            liveRevenueThb: 80_000,
            shoppingMallRevenueThb: 80_000,
            commissionRate: 15,
            revenueGrowthRate: 73,
            revenueGrowthVerified: true,
            creatorCountVerified: 8,
            creatorCountUnverifiedRaw: null,
          },
        },
      ],
    };

    const legacyStorage = createMemoryStorage({
      [PRODUCT_SNAPSHOTS_STORAGE_KEY]: JSON.stringify(legacyLocalRaw),
    });
    const loadedLegacy = loadProductSnapshotsFromStorage(legacyStorage, {
      nowMs: NOW_MS,
    });
    assert.equal(loadedLegacy.legacy_rising?.length, 3);
    assert.ok(loadedLegacy.legacy_rising.every((s) => s.trustStatus === 'LOCAL_OBSERVED'));

    const legacyHistMap = buildStrategySnapshotsMap(loadedLegacy, { nowMs: NOW_MS });
    assert.equal(legacyHistMap.legacy_rising?.length, 3);
    // Legacy snapshot fallback is explicitly noted rather than silently faking per-metric precision
    assert.equal(
      legacyHistMap.legacy_rising[0].revenueThb7d?.note,
      'SNAPSHOT_LEVEL_TIMESTAMP_FALLBACK'
    );

    const prod = makeProductItem(
      'legacy_rising',
      makeVerifiedValidatedMetrics({
        id: 'legacy_rising',
        fetchedAt: NOW_ISO,
        revenueThb7d: 520_000,
        creatorCount: 8,
      })
    );
    const legacyEval = evaluateProductStrategiesV2(prod, undefined, {
      scoringConfig: { nowMs: NOW_MS },
      historicalSnapshots: legacyHistMap.legacy_rising,
    });
    assert.equal(legacyEval.strategies.fast_rising_products.eligibilityStatus, 'QUALIFIED');
    assert.equal(
      legacyEval.strategies.trend_timing_opportunity.eligibilityStatus,
      'QUALIFIED'
    );

    // Part B: Fresh Phase 10.1 LOCAL_OBSERVED records via recordProductSnapshotsInStorage
    const freshStorage = createMemoryStorage();
    const d1 = makeProductItem(
      'local_new',
      makeVerifiedValidatedMetrics({
        id: 'local_new',
        fetchedAt: '2026-04-17T08:00:00.000Z',
        revenueThb7d: 200_000,
        creatorCount: 6,
      })
    );
    const d2 = makeProductItem(
      'local_new',
      makeVerifiedValidatedMetrics({
        id: 'local_new',
        fetchedAt: '2026-04-18T20:00:00.000Z',
        revenueThb7d: 300_000,
        creatorCount: 7,
      })
    );
    const d3 = makeProductItem(
      'local_new',
      makeVerifiedValidatedMetrics({
        id: 'local_new',
        fetchedAt: '2026-04-20T09:00:00.000Z',
        revenueThb7d: 520_000,
        creatorCount: 8,
      })
    );
    recordProductSnapshotsInStorage([d1], { storage: freshStorage, nowMs: NOW_MS });
    recordProductSnapshotsInStorage([d2], { storage: freshStorage, nowMs: NOW_MS });
    const finalRes = recordProductSnapshotsInStorage([d3], {
      storage: freshStorage,
      nowMs: NOW_MS,
    });

    const trend = deriveSnapshotTrend(finalRes.snapshotsByProductId.local_new, {
      nowMs: NOW_MS,
    });
    assert.ok(trend);
    assert.equal(trend.trustScope, 'LOCAL_OBSERVED_ONLY');
    assert.equal(trend.revenueDeltaPct, 160);
    assert.equal(trend.verifiedCreatorDeltaPct, 33.3);

    const histMap = buildStrategySnapshotsMap(finalRes.snapshotsByProductId, {
      nowMs: NOW_MS,
    });
    const newEval = evaluateProductStrategiesV2(d3, undefined, {
      scoringConfig: { nowMs: NOW_MS },
      historicalSnapshots: histMap.local_new,
    });
    assert.equal(newEval.strategies.fast_rising_products.eligibilityStatus, 'QUALIFIED');
    assert.equal(newEval.strategies.trend_timing_opportunity.eligibilityStatus, 'QUALIFIED');
  });

  it('6. Rank (T1) and detail (T2) metrics retain separate per-metric timestamps and source endpoints across merges and snapshots', () => {
    const T1 = '2026-04-20T06:00:00.000Z';
    const T2 = '2026-04-20T09:30:00.000Z';

    // /rank has revenue + growth (captured at T1), no creatorCount
    const rankValidated = adaptRawKalodataRowToValidatedMetrics(
      {
        id: 'combo_1',
        price: 350,
        commission_rate: 15,
        revenue: 410_000,
        sales_volumn: 1170,
        video_revenue: 280_000,
        revenue_growth_rate: 32,
        dateRange: 'last7Day',
      },
      {
        fetchedAt: T1,
        nowMs: Date.parse(T1),
        sourceEndpoint: 'rank',
        dateRange: 'last7Day',
      }
    );

    // /detail has creator_number + updated sales (captured at T2), no revenue_growth_rate
    const detailValidated = adaptRawKalodataRowToValidatedMetrics(
      {
        id: 'combo_1',
        price: 350,
        commission_rate: 15,
        revenue: 420_000,
        sales_volumn: 1200,
        video_revenue: 290_000,
        creator_number: 9,
        rating: 4.8,
        product_review_count: 140,
        dateRange: 'last7Day',
      },
      {
        fetchedAt: T2,
        nowMs: Date.parse(T2),
        sourceEndpoint: 'detail',
        dateRange: 'last7Day',
      }
    );

    // Part A: mergeValidatedMetricsSnapshots keeps T1 on /rank-only revenueGrowthRate and T2 on /detail metrics
    const mergedVm = mergeValidatedMetricsSnapshots(detailValidated, rankValidated);
    assert.ok(mergedVm);
    assert.equal(mergedVm.revenueGrowthRate.fetchedAt, T1);
    assert.equal(mergedVm.revenueGrowthRate.sourceEndpoint, 'rank');
    assert.equal(mergedVm.creatorCount.fetchedAt, T2);
    assert.equal(mergedVm.creatorCount.sourceEndpoint, 'detail');
    assert.equal(mergedVm.revenueThb7d.fetchedAt, T2);
    assert.equal(mergedVm.revenueThb7d.sourceEndpoint, 'detail');

    // Part B: mergeKalodataMetrics preserves per-metric metricTimestamps
    const mergedKalo = mergeKalodataMetrics(
      {
        revenueThb7d: 420_000,
        salesVolume7d: 1200,
        creatorCount: 9,
        revenueGrowthRate: null,
        dateRange: 'last7Day',
        fetchedAt: T2,
      },
      {
        revenueThb7d: 410_000,
        salesVolume7d: 1170,
        creatorCount: null,
        revenueGrowthRate: 32,
        dateRange: 'last7Day',
        fetchedAt: T1,
      }
    );
    assert.ok(mergedKalo);
    assert.equal(mergedKalo.metricTimestamps?.revenueGrowthRate, T1);
    assert.equal(mergedKalo.metricTimestamps?.creatorCount, T2);
    assert.equal(mergedKalo.metricTimestamps?.revenueThb7d, T2);

    // Part C: createObservationSnapshotFromProduct preserves T1 & T2 separately in metricMeta (raw unverified creator_number stays unverified)
    const combinedSnap = createObservationSnapshotFromProduct(
      makeProductItem('combo_1', mergedVm),
      { nowMs: NOW_MS }
    );
    assert.ok(combinedSnap);
    assert.equal(combinedSnap.metricMeta?.revenueGrowthRate?.fetchedAt, T1);
    assert.equal(combinedSnap.metricMeta?.revenueGrowthRate?.sourceEndpoint, 'rank');
    assert.equal(combinedSnap.observations.creatorCountVerified, null);
    assert.equal(combinedSnap.observations.creatorCountUnverifiedRaw, 9);
    assert.equal(combinedSnap.metricMeta?.creatorCountUnverifiedRaw?.fetchedAt, T2);
    assert.equal(combinedSnap.metricMeta?.creatorCountUnverifiedRaw?.sourceEndpoint, 'detail');

    // Part D: Same-day appendObservationSnapshot (/rank at T1 followed by /detail at T2) with verified metrics preserves both T1 and T2
    const verifiedRankVm = makeVerifiedValidatedMetrics({
      id: 'combo_verified',
      fetchedAt: T1,
      revenueThb7d: 410_000,
      revenueGrowthRate: 32,
      sourceEndpoint: 'rank',
    });
    verifiedRankVm.creatorCount = validateNumericMetric({
      rawInput: null,
      unit: 'COUNT',
      provenance: 'SOURCE',
      fetchedAt: T1,
      dateRange: 'last7Day',
      sourceEndpoint: 'rank',
      nowMs: Date.parse(T1),
    });

    const verifiedDetailVm = makeVerifiedValidatedMetrics({
      id: 'combo_verified',
      fetchedAt: T2,
      revenueThb7d: 420_000,
      creatorCount: 9,
      sourceEndpoint: 'detail',
    });
    verifiedDetailVm.revenueGrowthRate = validateNumericMetric({
      rawInput: null,
      unit: 'PERCENT',
      provenance: 'SOURCE',
      fetchedAt: T2,
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      nowMs: Date.parse(T2),
    });

    const snapRank = createObservationSnapshotFromProduct(
      makeProductItem('combo_verified', verifiedRankVm),
      { nowMs: NOW_MS }
    );
    const snapDetail = createObservationSnapshotFromProduct(
      makeProductItem('combo_verified', verifiedDetailVm),
      { nowMs: NOW_MS }
    );
    assert.ok(snapRank && snapDetail);
    const sameDayRes = appendObservationSnapshot([snapRank], snapDetail, 90, {
      nowMs: NOW_MS,
    });
    assert.equal(sameDayRes.snapshots.length, 1);
    const mergedDaySnap = sameDayRes.snapshots[0];
    assert.equal(mergedDaySnap.metricMeta?.revenueGrowthRate?.fetchedAt, T1);
    assert.equal(mergedDaySnap.metricMeta?.revenueGrowthRate?.sourceEndpoint, 'rank');
    assert.equal(mergedDaySnap.metricMeta?.creatorCountVerified?.fetchedAt, T2);
    assert.equal(mergedDaySnap.metricMeta?.creatorCountVerified?.sourceEndpoint, 'detail');
    assert.equal(mergedDaySnap.metricMeta?.revenueThb?.fetchedAt, T2);

    // Part E: toStrategyHistoricalSnapshots propagates distinct per-metric timestamps (never collapsed)
    const histSnaps = toStrategyHistoricalSnapshots(sameDayRes.snapshots, {
      nowMs: NOW_MS,
    });
    assert.equal(histSnaps.length, 1);
    assert.equal(histSnaps[0].revenueGrowthRate?.fetchedAt, T1);
    assert.equal(histSnaps[0].revenueGrowthRate?.sourceEndpoint, 'rank');
    assert.equal(histSnaps[0].creatorCount?.fetchedAt, T2);
    assert.equal(histSnaps[0].creatorCount?.sourceEndpoint, 'detail');
    assert.notEqual(
      histSnaps[0].revenueGrowthRate?.fetchedAt,
      histSnaps[0].creatorCount?.fetchedAt
    );
  });

  it('7. Missing timestamps remain explicitly unknown (null / UNKNOWN) and are never fabricated', () => {
    // Part A: server/kalodata extractMetricsFromRawRow without fetchedAt keeps fetchedAt = null
    const rawExtracted = extractMetricsFromRawRow({
      id: 'no_ts_1',
      revenue: 150_000,
      sales_volumn: 500,
      commission_rate: 12,
    });
    assert.equal(rawExtracted.kalodataMetrics.fetchedAt, undefined);
    assert.equal(rawExtracted.validatedMetrics.fetchedAt, null);
    assert.equal(rawExtracted.validatedMetrics.revenueThb7d.fetchedAt, null);

    // Part B: adaptRawKalodataRowToValidatedMetrics without fetchedAt keeps fetchedAt = null
    const adaptedRaw = adaptRawKalodataRowToValidatedMetrics(
      {
        id: 'no_ts_2',
        revenue: 180_000,
        sales_volumn: 450,
      },
      {
        dateRange: 'last7Day',
        sourceEndpoint: 'rank',
      }
    );
    assert.equal(adaptedRaw.fetchedAt, null);
    assert.equal(adaptedRaw.revenueThb7d.fetchedAt, null);
    assert.equal(adaptedRaw.salesVolume7d.fetchedAt, null);

    // Part C: adaptProductItemToValidatedMetrics does NOT borrow deepInsights.fetchedAt for numeric metrics
    const legacyProduct: ProductItem = {
      id: 'no_ts_3',
      thaiTitle: 'สินค้าเก่า',
      clearTitle: { my: 'ဟောင်း', en: 'Legacy' },
      whatItIs: { my: 'ဟောင်း', en: 'Legacy' },
      whySilentWorks: { my: 'ဟောင်း', en: 'Legacy' },
      category: 'home',
      categoryLabel: { my: 'အိမ်သုံး', en: 'Home' },
      priceThb: 299,
      commissionRate: 10,
      commissionThb: 29.9,
      scoreBreakdown: {
        total: 50,
        grade: 'low',
        visualDemo: 50,
        aiSuitability: 50,
        salesDemand: 50,
        commissionValue: 50,
        speechPenalty: 0,
      },
      shopName: 'Legacy Shop TH',
      visualTags: [],
      productUrl: 'https://shop.tiktok.com/view/product/no_ts_3',
      kalodataMetrics: {
        revenueThb7d: 120_000,
        salesVolume7d: 400,
        dateRange: 'last7Day',
        // fetchedAt intentionally omitted
      },
      deepInsights: {
        fetchedDetails: true,
        fetchedAt: '2026-04-20T10:00:00.000Z',
      },
    };
    const adaptedLegacy = adaptProductItemToValidatedMetrics(legacyProduct, {
      nowMs: NOW_MS,
    });
    assert.equal(adaptedLegacy.fetchedAt, null);
    assert.equal(adaptedLegacy.revenueThb7d.fetchedAt, null);
    assert.equal(adaptedLegacy.salesVolume7d.fetchedAt, null);

    // Part D: createObservationSnapshotFromProduct refuses to fabricate observedAt when no timestamp exists
    assert.equal(
      createObservationSnapshotFromProduct(legacyProduct, { nowMs: NOW_MS }),
      null
    );

    // Part E: If one metric has an explicit timestamp and another has null, the missing metric stays UNKNOWN
    const mixedVm = makeVerifiedValidatedMetrics({
      id: 'mixed_ts',
      fetchedAt: '2026-04-20T08:00:00.000Z',
      revenueThb7d: 300_000,
      creatorCount: 10,
    });
    mixedVm.salesVolume7d = {
      ...mixedVm.salesVolume7d,
      fetchedAt: null,
    };
    const mixedSnap = createObservationSnapshotFromProduct(
      makeProductItem('mixed_ts', mixedVm),
      { nowMs: NOW_MS }
    );
    assert.ok(mixedSnap);
    assert.equal(mixedSnap.metricMeta?.salesVolume?.fetchedAt, null);
    assert.equal(mixedSnap.metricMeta?.salesVolume?.timestampPrecision, 'UNKNOWN');
    assert.equal(mixedSnap.metricMeta?.revenueThb?.fetchedAt, '2026-04-20T08:00:00.000Z');
    assert.equal(mixedSnap.metricMeta?.revenueThb?.timestampPrecision, 'EXACT_METRIC');

    const converted = toStrategyHistoricalSnapshots([mixedSnap], { nowMs: NOW_MS });
    assert.equal(converted.length, 1);
    assert.equal(converted[0].salesVolume7d?.fetchedAt, null);
    assert.equal(converted[0].salesVolume7d?.note, 'METRIC_TIMESTAMP_UNKNOWN');
    assert.equal(converted[0].revenueThb7d?.fetchedAt, '2026-04-20T08:00:00.000Z');
  });

  it('8. Future timestamps are rejected across snapshot creation, storage, backup import, trends, and strategies', () => {
    const FUTURE_ISO = '2026-04-25T12:00:00.000Z';

    // Part A: createObservationSnapshotFromProduct rejects future envelope timestamp
    const futureProd = makeProductItem(
      'future_1',
      makeVerifiedValidatedMetrics({
        id: 'future_1',
        fetchedAt: FUTURE_ISO,
        revenueThb7d: 400_000,
        creatorCount: 8,
      })
    );
    assert.equal(
      createObservationSnapshotFromProduct(futureProd, { nowMs: NOW_MS }),
      null
    );

    // Part B: appendObservationSnapshot rejects future observedAt
    const futureSnapshot: ProductObservationSnapshot = {
      snapshotVersion: 1,
      productId: 'future_1',
      observedAt: FUTURE_ISO,
      observationDay: '2026-04-25',
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      trustStatus: 'LOCAL_OBSERVED',
      dataConfidenceScore: 90,
      dataConfidenceLevel: 'HIGH',
      observations: {
        revenueThb: 900_000,
        salesVolume: 2000,
        videoRevenueThb: 600_000,
        liveRevenueThb: 100_000,
        shoppingMallRevenueThb: 200_000,
        commissionRate: 15,
        revenueGrowthRate: 90,
        revenueGrowthVerified: true,
        creatorCountVerified: 5,
        creatorCountUnverifiedRaw: null,
      },
    };
    const appendRes = appendObservationSnapshot([], futureSnapshot, 90, {
      nowMs: NOW_MS,
    });
    assert.equal(appendRes.added, false);
    assert.equal(appendRes.snapshots.length, 0);
    assert.match(appendRes.rejectedReason ?? '', /future/i);

    // Part C: parseBackupFile and sanitizeProductSnapshotsMap reject future snapshots
    const futureBackupJson = JSON.stringify({
      app: 'SiamVisual',
      version: 5,
      exportedAt: NOW_ISO,
      entries: [],
      productSnapshots: {
        future_1: [futureSnapshot],
      },
    });
    const parsed = parseBackupFile(futureBackupJson, { nowMs: NOW_MS });
    assert.ok(parsed);
    assert.equal(parsed.productSnapshots, undefined);
    assert.deepEqual(
      sanitizeProductSnapshotsMap({ future_1: [futureSnapshot] }, { nowMs: NOW_MS }),
      {}
    );

    // Part D: deriveSnapshotTrend & strategyEngineV2 ignore future snapshots
    const validPastSnap: ProductObservationSnapshot = {
      ...futureSnapshot,
      observedAt: '2026-04-18T10:00:00.000Z',
      observationDay: '2026-04-18',
      observations: { ...futureSnapshot.observations, revenueThb: 200_000 },
    };
    assert.equal(
      deriveSnapshotTrend([validPastSnap, futureSnapshot], { nowMs: NOW_MS }),
      null
    );

    const prodNow = makeProductItem(
      'future_1',
      makeVerifiedValidatedMetrics({
        id: 'future_1',
        fetchedAt: NOW_ISO,
        revenueThb7d: 400_000,
        creatorCount: 8,
      })
    );
    const evalFuture = evaluateProductStrategiesV2(prodNow, undefined, {
      scoringConfig: { nowMs: NOW_MS },
      historicalSnapshots: [
        {
          fetchedAt: '2026-04-18T10:00:00.000Z',
          dateRange: 'last7Day',
          trustStatus: 'LOCAL_OBSERVED',
          revenueThb7d: validateNumericMetric({
            rawInput: 200_000,
            unit: 'THB',
            provenance: 'SOURCE',
            fetchedAt: '2026-04-18T10:00:00.000Z',
            nowMs: NOW_MS,
          }),
          creatorCount: validateNumericMetric({
            rawInput: 6,
            unit: 'COUNT',
            provenance: 'SOURCE',
            fetchedAt: '2026-04-18T10:00:00.000Z',
            nowMs: NOW_MS,
          }),
        },
        {
          fetchedAt: FUTURE_ISO,
          dateRange: 'last7Day',
          trustStatus: 'LOCAL_OBSERVED',
          revenueThb7d: validateNumericMetric({
            rawInput: 900_000,
            unit: 'THB',
            provenance: 'SOURCE',
            fetchedAt: FUTURE_ISO,
            nowMs: Date.parse(FUTURE_ISO),
          }),
          creatorCount: validateNumericMetric({
            rawInput: 6,
            unit: 'COUNT',
            provenance: 'SOURCE',
            fetchedAt: FUTURE_ISO,
            nowMs: Date.parse(FUTURE_ISO),
          }),
        },
      ],
    });
    assert.equal(
      evalFuture.strategies.fast_rising_products.eligibilityStatus,
      'DATA_UNAVAILABLE'
    );
  });

  it('9. Duplicate and near-duplicate snapshots do not inflate counts or fabricate trends', () => {
    const snapA = createObservationSnapshotFromProduct(
      makeProductItem(
        'dup_1',
        makeVerifiedValidatedMetrics({
          id: 'dup_1',
          fetchedAt: '2026-04-19T08:00:00.000Z',
          revenueThb7d: 250_000,
          creatorCount: 8,
        })
      ),
      { nowMs: NOW_MS }
    )!;
    const snapASameDayLater = createObservationSnapshotFromProduct(
      makeProductItem(
        'dup_1',
        makeVerifiedValidatedMetrics({
          id: 'dup_1',
          fetchedAt: '2026-04-19T22:00:00.000Z',
          revenueThb7d: 450_000,
          creatorCount: 8,
        })
      ),
      { nowMs: NOW_MS }
    )!;

    // appendObservationSnapshot deduplicates same UTC day into 1 bucket
    const r1 = appendObservationSnapshot([snapA], snapA, 90, { nowMs: NOW_MS });
    assert.equal(r1.snapshots.length, 1);
    assert.equal(r1.added, false);
    assert.equal(r1.updated, false);
    assert.equal(r1.deduplicated, true);

    const r2 = appendObservationSnapshot([snapA], snapASameDayLater, 90, {
      nowMs: NOW_MS,
    });
    assert.equal(r2.snapshots.length, 1);

    // deriveSnapshotTrend deduplicates raw duplicate arrays on the same UTC day
    assert.equal(
      deriveSnapshotTrend([snapA, snapA, snapASameDayLater], { nowMs: NOW_MS }),
      null
    );

    // strategyEngineV2 rejects exact & near-duplicate (< 6h) snapshots from satisfying minSnapshots: 3
    const prod = makeProductItem(
      'dup_1',
      makeVerifiedValidatedMetrics({
        id: 'dup_1',
        fetchedAt: NOW_ISO,
        revenueThb7d: 500_000,
        creatorCount: 8,
      })
    );
    const makeHist = (iso: string, rev: number, creators: number): HistoricalMetricSnapshot => ({
      fetchedAt: iso,
      dateRange: 'last7Day',
      trustStatus: 'LOCAL_OBSERVED',
      revenueThb7d: validateNumericMetric({
        rawInput: rev,
        unit: 'THB',
        provenance: 'SOURCE',
        fetchedAt: iso,
        nowMs: Date.parse(iso),
      }),
      creatorCount: validateNumericMetric({
        rawInput: creators,
        unit: 'COUNT',
        provenance: 'SOURCE',
        fetchedAt: iso,
        nowMs: Date.parse(iso),
      }),
    });

    const evalWithNearDup = evaluateProductStrategiesV2(prod, undefined, {
      scoringConfig: { nowMs: NOW_MS },
      historicalSnapshots: [
        makeHist('2026-04-18T10:00:00.000Z', 200_000, 6),
        makeHist('2026-04-18T10:05:00.000Z', 260_000, 6), // near-duplicate 5m later
        makeHist('2026-04-18T10:05:00.000Z', 260_000, 6), // exact duplicate
        makeHist('2026-04-20T10:00:00.000Z', 500_000, 7),
      ],
    });
    // Only 2 distinct time-separated snapshots remain -> trend_timing_opportunity (minSnapshots: 3) stays DATA_UNAVAILABLE
    assert.equal(
      evalWithNearDup.strategies.trend_timing_opportunity.eligibilityStatus,
      'DATA_UNAVAILABLE'
    );
    // Identical timestamps only -> fast_rising_products also stays DATA_UNAVAILABLE
    const evalOnlyExactDup = evaluateProductStrategiesV2(prod, undefined, {
      scoringConfig: { nowMs: NOW_MS },
      historicalSnapshots: [
        makeHist('2026-04-18T10:00:00.000Z', 200_000, 6),
        makeHist('2026-04-18T10:00:00.000Z', 500_000, 6),
      ],
    });
    assert.equal(
      evalOnlyExactDup.strategies.fast_rising_products.eligibilityStatus,
      'DATA_UNAVAILABLE'
    );
  });

  it('10. Imported records cannot overwrite trusted local observations, while distinct days restore and fresh local supersedes imported', () => {
    const storage = createMemoryStorage();
    const localDay2 = createObservationSnapshotFromProduct(
      makeProductItem(
        'guard_1',
        makeVerifiedValidatedMetrics({
          id: 'guard_1',
          fetchedAt: '2026-04-19T08:00:00.000Z',
          revenueThb7d: 310_000,
          creatorCount: 11,
        })
      ),
      { nowMs: NOW_MS }
    )!;

    const importedSameDayHigherTs: ProductObservationSnapshot = {
      snapshotVersion: 1,
      productId: 'guard_1',
      observedAt: '2026-04-19T23:00:00.000Z', // later on same UTC day
      observationDay: '2026-04-19',
      dateRange: 'last7Day',
      sourceEndpoint: 'detail',
      trustStatus: 'LOCAL_OBSERVED', // spoofed in backup
      dataConfidenceScore: 99,
      dataConfidenceLevel: 'HIGH',
      observations: {
        revenueThb: 999_999,
        salesVolume: 5000,
        videoRevenueThb: 800_000,
        liveRevenueThb: 100_000,
        shoppingMallRevenueThb: 99_999,
        commissionRate: 25,
        revenueGrowthRate: 200,
        revenueGrowthVerified: true,
        creatorCountVerified: 2,
        creatorCountUnverifiedRaw: null,
      },
    };
    const importedEarlierDay: ProductObservationSnapshot = {
      ...importedSameDayHigherTs,
      observedAt: '2026-04-17T09:00:00.000Z',
      observationDay: '2026-04-17',
      observations: {
        ...importedSameDayHigherTs.observations,
        revenueThb: 180_000,
      },
    };

    const { merged, addedSnapshots } = mergeRestoredProductSnapshots(
      { guard_1: [localDay2] },
      { guard_1: [importedEarlierDay, importedSameDayHigherTs] },
      storage,
      { nowMs: NOW_MS, importedAt: NOW_ISO }
    );

    // Distinct day (Apr 17) WAS restored as IMPORTED_UNVERIFIED reference
    assert.equal(addedSnapshots, 1);
    assert.equal(merged.guard_1.length, 2);

    const day1 = merged.guard_1.find((s) => s.observationDay === '2026-04-17')!;
    const day2 = merged.guard_1.find((s) => s.observationDay === '2026-04-19')!;

    assert.equal(day1.trustStatus, 'IMPORTED_UNVERIFIED');
    assert.equal(day1.observations.creatorCountVerified, null);

    // Trusted local Apr 19 record is 100% UNCHANGED
    assert.equal(day2.trustStatus, 'LOCAL_OBSERVED');
    assert.equal(day2.observations.revenueThb, 310_000);
    assert.equal(day2.observations.creatorCountVerified, 11);
    assert.equal(day2.observedAt, '2026-04-19T08:00:00.000Z');

    // Fresh local observation on Apr 17 cleanly supersedes the IMPORTED_UNVERIFIED reference
    const freshLocalDay1 = createObservationSnapshotFromProduct(
      makeProductItem(
        'guard_1',
        makeVerifiedValidatedMetrics({
          id: 'guard_1',
          fetchedAt: '2026-04-17T14:00:00.000Z',
          revenueThb7d: 210_000,
          creatorCount: 9,
        })
      ),
      { nowMs: NOW_MS }
    )!;
    const superseded = appendObservationSnapshot(merged.guard_1, freshLocalDay1, 90, {
      nowMs: NOW_MS,
    });
    assert.equal(superseded.updated, true);
    const updatedDay1 = superseded.snapshots.find(
      (s) => s.observationDay === '2026-04-17'
    )!;
    assert.equal(updatedDay1.trustStatus, 'LOCAL_OBSERVED');
    assert.equal(updatedDay1.observations.revenueThb, 210_000);
    assert.equal(updatedDay1.observations.creatorCountVerified, 9);
    assert.equal(updatedDay1.importedAudit, undefined);
  });

  it('11. Backup versions v1, v2, v3, v4, v5 and bare legacy array format all restore safely', () => {
    const entry = makeMinimalHistoryEntry('compat_1', NOW_ISO);

    // Bare legacy array
    const parsedBare = parseBackupFile(JSON.stringify([entry]), { nowMs: NOW_MS });
    assert.equal(parsedBare?.entries.length, 1);
    assert.equal(parsedBare?.productSnapshots, undefined);

    // v1 (entries only)
    const parsedV1 = parseBackupFile(
      JSON.stringify({ app: 'SiamVisual', version: 1, exportedAt: NOW_ISO, entries: [entry] }),
      { nowMs: NOW_MS }
    );
    assert.equal(parsedV1?.entries.length, 1);

    // v2 (entries + limits + recentSearches)
    const parsedV2 = parseBackupFile(
      JSON.stringify({
        app: 'SiamVisual',
        version: 2,
        exportedAt: NOW_ISO,
        entries: [entry],
        limits: { maxSpendCredits: 50, minBalanceReserve: 10, trackedSpentCredits: 4.5 },
        recentSearches: [
          {
            id: 'rs_1',
            searchedAt: NOW_ISO,
            query: 'serum',
            cateIds: ['601450'],
            products: [entry.product],
          },
        ],
      }),
      { nowMs: NOW_MS }
    );
    assert.equal(parsedV2?.entries.length, 1);
    assert.equal(parsedV2?.limits?.maxSpendCredits, 50);
    assert.equal(parsedV2?.recentSearches?.length, 1);

    // v3 (+ deepInsightsCache)
    const parsedV3 = parseBackupFile(
      JSON.stringify({
        app: 'SiamVisual',
        version: 3,
        exportedAt: NOW_ISO,
        entries: [entry],
        deepInsightsCache: {
          compat_1: {
            deepInsights: { fetchedDetails: true, fetchedAt: NOW_ISO },
            savedAt: NOW_ISO,
          },
        },
      }),
      { nowMs: NOW_MS }
    );
    assert.equal(parsedV3?.entries.length, 1);
    assert.ok(parsedV3?.deepInsightsCache?.compat_1);

    // v4 (+ productAnalysisCache)
    const parsedV4 = parseBackupFile(
      JSON.stringify({
        app: 'SiamVisual',
        version: 4,
        exportedAt: NOW_ISO,
        entries: [entry],
        productAnalysisCache: {
          compat_1: {
            cleanName: { my: 'စမ်း', en: 'Test' },
            analyzedAt: NOW_ISO,
          },
        },
      }),
      { nowMs: NOW_MS }
    );
    assert.equal(parsedV4?.entries.length, 1);
    assert.ok(parsedV4?.productAnalysisCache?.compat_1);

    // v5 (+ productSnapshots sanitized safely as IMPORTED_UNVERIFIED)
    const snap = createObservationSnapshotFromProduct(entry.product, { nowMs: NOW_MS })!;
    const parsedV5 = parseBackupFile(
      JSON.stringify(
        buildBackupPayload({
          entries: [entry],
          limits: { maxSpendCredits: 100, minBalanceReserve: 20, trackedSpentCredits: 3 },
          recentSearches: [],
          deepInsightsCache: {},
          productAnalysisCache: {},
          productSnapshots: { compat_1: [snap] },
          exportedAt: NOW_ISO,
        })
      ),
      { nowMs: NOW_MS, importedAt: NOW_ISO }
    );
    assert.equal(parsedV5?.entries.length, 1);
    assert.equal(parsedV5?.limits?.maxSpendCredits, 100);
    assert.equal(parsedV5?.productSnapshots?.compat_1?.length, 1);
    assert.equal(
      parsedV5?.productSnapshots?.compat_1?.[0].trustStatus,
      'IMPORTED_UNVERIFIED'
    );
  });

  it('12. Commercial scoring and non-historical strategy evaluations remain identical and unaffected', () => {
    const vm = makeVerifiedValidatedMetrics({
      id: 'commercial_stable',
      fetchedAt: NOW_ISO,
      revenueThb7d: 480_000,
      salesVolume7d: 1200,
      videoRevenueThb7d: 340_000,
      commissionRate: 16,
      priceThb: 400,
      creatorCount: 12,
      revenueGrowthRate: 35,
      rating: 4.8,
      reviewCount: 160,
    });

    const commercialA = evaluateProductCommercialV2(vm, { nowMs: NOW_MS });
    const commercialB = evaluateProductCommercialV2(vm, { nowMs: NOW_MS });
    assert.deepEqual(commercialA, commercialB);
    assert.equal(commercialA.eligibilityStatus, 'ELIGIBLE');
    assert.ok(
      commercialA.commercialOpportunityScore !== null &&
        commercialA.commercialOpportunityScore >= 60
    );

    // Non-historical strategies are completely unaffected by whether imported snapshots exist
    const importedSnaps = sanitizeImportedProductSnapshotsMap(
      {
        commercial_stable: [
          {
            snapshotVersion: 1,
            productId: 'commercial_stable',
            observedAt: '2026-04-17T10:00:00.000Z',
            observationDay: '2026-04-17',
            dateRange: 'last7Day',
            sourceEndpoint: 'detail',
            trustStatus: 'LOCAL_OBSERVED',
            dataConfidenceScore: 90,
            dataConfidenceLevel: 'HIGH',
            observations: {
              revenueThb: 180_000,
              salesVolume: 450,
              videoRevenueThb: 120_000,
              liveRevenueThb: 30_000,
              shoppingMallRevenueThb: 30_000,
              commissionRate: 16,
              revenueGrowthRate: 20,
              revenueGrowthVerified: true,
              creatorCountVerified: 8,
              creatorCountUnverifiedRaw: null,
            },
          },
          {
            snapshotVersion: 1,
            productId: 'commercial_stable',
            observedAt: '2026-04-19T10:00:00.000Z',
            observationDay: '2026-04-19',
            dateRange: 'last7Day',
            sourceEndpoint: 'detail',
            trustStatus: 'LOCAL_OBSERVED',
            dataConfidenceScore: 90,
            dataConfidenceLevel: 'HIGH',
            observations: {
              revenueThb: 480_000,
              salesVolume: 1200,
              videoRevenueThb: 340_000,
              liveRevenueThb: 70_000,
              shoppingMallRevenueThb: 70_000,
              commissionRate: 16,
              revenueGrowthRate: 35,
              revenueGrowthVerified: true,
              creatorCountVerified: 10,
              creatorCountUnverifiedRaw: null,
            },
          },
        ],
      },
      { nowMs: NOW_MS, importedAt: NOW_ISO }
    );

    const strategyWithoutSnaps = evaluateProductStrategiesV2(vm, commercialA, {
      scoringConfig: { nowMs: NOW_MS },
    });
    const strategyWithImportedSnaps = evaluateProductStrategiesV2(vm, commercialA, {
      scoringConfig: { nowMs: NOW_MS },
      historicalSnapshots: toStrategyHistoricalSnapshots(
        importedSnaps.commercial_stable,
        { nowMs: NOW_MS }
      ),
    });

    assert.deepEqual(
      strategyWithoutSnaps.strategies.early_market_opportunity,
      strategyWithImportedSnaps.strategies.early_market_opportunity
    );
    assert.deepEqual(
      strategyWithoutSnaps.strategies.underserved_demand,
      strategyWithImportedSnaps.strategies.underserved_demand
    );
    assert.deepEqual(
      strategyWithoutSnaps.strategies.creator_yield_opportunity,
      strategyWithImportedSnaps.strategies.creator_yield_opportunity
    );
    assert.deepEqual(
      strategyWithoutSnaps.strategies.profit_maximizer,
      strategyWithImportedSnaps.strategies.profit_maximizer
    );
    assert.deepEqual(
      strategyWithoutSnaps.strategies.video_proven_winners,
      strategyWithImportedSnaps.strategies.video_proven_winners
    );
    assert.deepEqual(
      strategyWithoutSnaps.strategies.trust_based_winners,
      strategyWithImportedSnaps.strategies.trust_based_winners
    );
    assert.equal(
      strategyWithImportedSnaps.strategies.fast_rising_products.eligibilityStatus,
      'DATA_UNAVAILABLE'
    );
    assert.equal(
      strategyWithImportedSnaps.strategies.trend_timing_opportunity.eligibilityStatus,
      'DATA_UNAVAILABLE'
    );
  });
});
