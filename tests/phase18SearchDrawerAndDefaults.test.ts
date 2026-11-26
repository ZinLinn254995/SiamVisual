import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildKalodataRankCacheKey,
  normalizeKalodataPageSize,
} from '../server/kalodata.ts';
import { SearchConfigDrawer } from '../src/components/SearchConfigDrawer.tsx';
import { TRANSLATIONS } from '../src/i18n.ts';
import {
  applyDiscoveryFiltersAndSort,
  createRecommendedSearchConfigDraft,
  DEFAULT_DISCOVERY_FILTER_STATE,
  DEFAULT_SEARCH_DATE_RANGE,
  DEFAULT_SEARCH_PAGE_SIZE,
  RECOMMENDED_DISCOVERY_FILTER_STATE,
  resolveAppliedDiscoveryFilterAfterSearch,
  SEARCH_PAGE_SIZE_OPTIONS,
} from '../src/lib/discoveryFilterEngine.ts';
import { buildProductIntelligenceView } from '../src/lib/productIntelligenceView.ts';
import { inspectQueryLink } from '../src/lib/productLinkInspector.ts';
import type {
  KalodataCategoryItem,
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

function makeProduct(opts: {
  id: string;
  priceThb: number;
  commissionRate: number;
  revenueThb7d: number;
  videoRevenueThb7d: number;
  salesVolume7d: number;
}): ProductItem {
  const payout = Math.round(opts.priceThb * (opts.commissionRate / 100) * 100) / 100;
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
    liveRevenueThb7d: makeMetric(0, 'THB'),
    shoppingMallRevenueThb7d: makeMetric(0, 'THB'),
    revenueGrowthRate: makeMetric(null, 'UNVERIFIED', 'MISSING'),
    creatorCount: makeMetric(null, 'UNVERIFIED', 'MISSING'),
    rating: makeMetric(null, 'RATING_5', 'UNAVAILABLE'),
    reviewCount: makeMetric(null, 'COUNT', 'UNAVAILABLE'),
    fetchedAt: NOW_ISO,
    dateRange: 'last7Day',
    sourceEndpoint: 'rank',
    unresolvedFields: [],
  };

  return {
    id: opts.id,
    thaiTitle: `Product ${opts.id}`,
    clearTitle: { en: `Product ${opts.id}`, my: `ပစ္စည်း ${opts.id}` },
    whatItIs: { en: 'Sample item', my: 'နမူနာပစ္စည်း' },
    whySilentWorks: { en: 'Clear visual demo', my: 'မြင်သာသည်' },
    category: 'beauty',
    categoryLabel: { en: 'Beauty', my: 'အလှကုန်' },
    shopName: 'TH Shop',
    priceThb: opts.priceThb,
    commissionRate: opts.commissionRate,
    commissionThb: payout,
    visualTags: ['Before/After'],
    kalodataMetrics: {
      salesVolume7d: opts.salesVolume7d,
      revenueThb7d: opts.revenueThb7d,
      videoRevenueThb7d: opts.videoRevenueThb7d,
      liveRevenueThb7d: 0,
      dateRange: 'last7Day',
      fetchedAt: NOW_ISO,
    },
    validatedMetrics: validated,
  };
}

test('Phase 18: Recommended search defaults use 100 items, 7d window, and Monetizable filter', () => {
  assert.equal(DEFAULT_SEARCH_PAGE_SIZE, 100);
  assert.equal(DEFAULT_SEARCH_DATE_RANGE, 'last7Day');
  assert.deepEqual([...SEARCH_PAGE_SIZE_OPTIONS], [20, 50, 100]);
  assert.equal(RECOMMENDED_DISCOVERY_FILTER_STATE.preset, 'monetizable_only');
  assert.equal(RECOMMENDED_DISCOVERY_FILTER_STATE.sortMode, 'search_score_desc');
  assert.equal(DEFAULT_DISCOVERY_FILTER_STATE.preset, 'all');

  const draft = createRecommendedSearchConfigDraft();
  assert.equal(draft.query, '');
  assert.deepEqual(draft.cateIds, []);
  assert.equal(draft.pageSize, 100);
  assert.equal(draft.dateRange, 'last7Day');
  assert.deepEqual(draft.filterState, RECOMMENDED_DISCOVERY_FILTER_STATE);
});

test('Phase 18: Recommended default filter hides 0% commission items while preserving monetizable items', () => {
  const zeroComm = makeProduct({
    id: '1731000000000000001',
    priceThb: 9900,
    commissionRate: 0,
    revenueThb7d: 12_000_000,
    videoRevenueThb7d: 500_000,
    salesVolume7d: 1200,
  });
  const monetizable = makeProduct({
    id: '1731000000000000002',
    priceThb: 390,
    commissionRate: 12,
    revenueThb7d: 1_500_000,
    videoRevenueThb7d: 900_000,
    salesVolume7d: 3800,
  });

  const view = buildProductIntelligenceView([zeroComm, monetizable], 'overall', { nowMs: NOW_MS });
  const filtered = applyDiscoveryFiltersAndSort(
    view.rankedEntries,
    RECOMMENDED_DISCOVERY_FILTER_STATE
  );

  assert.equal(filtered.counts.totalCount, 2);
  assert.equal(filtered.counts.monetizableCount, 1);
  assert.equal(filtered.counts.notMonetizableCount, 1);
  assert.equal(filtered.entries.length, 1);
  assert.equal(filtered.entries[0].product.id, monetizable.id);
});

test('Phase 18: Single-link search bypasses monetizable filter so pasted 0% products remain visible', () => {
  const strictFilter = {
    ...RECOMMENDED_DISCOVERY_FILTER_STATE,
    minCommissionPct: 10,
  };
  const rankApplied = resolveAppliedDiscoveryFilterAfterSearch('rank', strictFilter);
  assert.deepEqual(rankApplied, strictFilter);

  const linkApplied = resolveAppliedDiscoveryFilterAfterSearch('single_link', strictFilter);
  assert.deepEqual(linkApplied, DEFAULT_DISCOVERY_FILTER_STATE);
});

test('Phase 18: inspectQueryLink detects keywords, product IDs, full URLs, and short links accurately', () => {
  assert.deepEqual(inspectQueryLink(''), {
    isLinkOrId: false,
    productId: null,
    isShortLink: false,
  });
  assert.deepEqual(inspectQueryLink('sunscreen'), {
    isLinkOrId: false,
    productId: null,
    isShortLink: false,
  });
  assert.deepEqual(inspectQueryLink('1731299385569545105'), {
    isLinkOrId: true,
    productId: '1731299385569545105',
    isShortLink: false,
  });
  assert.deepEqual(
    inspectQueryLink('https://shop.tiktok.com/view/product/1731299385569545105?region=TH'),
    {
      isLinkOrId: true,
      productId: '1731299385569545105',
      isShortLink: false,
    }
  );
  assert.deepEqual(
    inspectQueryLink('https://www.kalodata.com/product/detail?id=1731299385569545105'),
    {
      isLinkOrId: true,
      productId: '1731299385569545105',
      isShortLink: false,
    }
  );
  assert.deepEqual(inspectQueryLink('https://vt.tiktok.com/ZSAbCdEfG/'), {
    isLinkOrId: true,
    productId: null,
    isShortLink: true,
  });
});

test('Phase 18: Kalodata pageSize normalization and cache-key isolation respect hard max 100', () => {
  assert.equal(normalizeKalodataPageSize(undefined), 20);
  assert.equal(normalizeKalodataPageSize(20), 20);
  assert.equal(normalizeKalodataPageSize(50), 50);
  assert.equal(normalizeKalodataPageSize(100), 100);
  assert.equal(normalizeKalodataPageSize(200), 100);
  assert.equal(normalizeKalodataPageSize(0), 20);
  assert.equal(normalizeKalodataPageSize(1), 1);

  const key20 = buildKalodataRankCacheKey({
    keyPrefix: 'kalo_test',
    dateRange: 'last7Day',
    pageNumber: 1,
    pageSize: 20,
    cateIds: ['601450'],
    query: '',
  });
  const key50 = buildKalodataRankCacheKey({
    keyPrefix: 'kalo_test',
    dateRange: 'last7Day',
    pageNumber: 1,
    pageSize: 50,
    cateIds: ['601450'],
    query: '',
  });
  const key100 = buildKalodataRankCacheKey({
    keyPrefix: 'kalo_test',
    dateRange: 'last7Day',
    pageNumber: 1,
    pageSize: 100,
    cateIds: ['601450'],
    query: '',
  });

  assert.notEqual(key20, key50);
  assert.notEqual(key50, key100);
  assert.notEqual(key20, key100);
  assert.ok(key100.includes('|s100|'));
});

test('Phase 18: SearchConfigDrawer renders cleanly in both Burmese and English with 20/50/100 controls', () => {
  const categories: KalodataCategoryItem[] = [
    { id: '', label: { my: 'အားလုံး', en: 'All' }, visualGroup: 'home', source: 'official' },
    { id: '601450', label: { my: 'အလှကုန်', en: 'Beauty' }, visualGroup: 'beauty', source: 'official' },
  ];

  for (const lang of ['my', 'en'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(SearchConfigDrawer, {
        isOpen: true,
        initialConfig: createRecommendedSearchConfigDraft(),
        categories,
        categoryMatchCounts: new Map([['', 100]]),
        language: lang,
        isConnected: true,
        isSearching: false,
        isSyncingCategories: false,
        hasLiveSyncedCategories: false,
        searchLimitWarning: null,
        leanSearchCost: 0.2,
        t: TRANSLATIONS[lang],
        onClose: () => {},
        onSyncCategories: () => {},
        onSubmit: () => {},
      })
    );

    assert.ok(html.includes('role="dialog"'));
    assert.ok(html.includes('aria-haspopup="listbox"'));
    assert.equal(html.includes('<select'), false);
    assert.ok(html.includes('100'));
    assert.ok(html.includes('50'));
    assert.ok(html.includes('20'));
    assert.ok(html.includes('0.2'));
  }
});
