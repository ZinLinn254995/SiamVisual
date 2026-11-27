import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProductRankBoardView } from '../src/components/ProductRankBoardView.tsx';
import { TopBar } from '../src/components/TopBar.tsx';
import { TRANSLATIONS } from '../src/i18n.ts';
import {
  buildRankBoardCategoryMarket,
  buildRankBoardMarketSummary,
  buildRankBoardSnapshot,
  computeRankProductRow,
  filterAndSortRankBoardRows,
} from '../src/lib/rankBoardAnalytics.ts';
import type { ProductItem } from '../src/types.ts';

function makeSampleProduct(overrides: Partial<ProductItem> = {}): ProductItem {
  const priceThb = overrides.priceThb !== undefined ? overrides.priceThb : 299;
  const commissionRate = overrides.commissionRate !== undefined ? overrides.commissionRate : 15;
  const commissionThb =
    overrides.commissionThb !== undefined
      ? overrides.commissionThb
      : priceThb !== null && commissionRate !== null
        ? Math.round(priceThb * commissionRate) / 100
        : null;

  return {
    id: overrides.id ?? '172999000001',
    thaiTitle: overrides.thaiTitle ?? 'เซรั่มวิตามินซี หน้าใส ลดจุดด่างดำ 30ml',
    clearTitle: overrides.clearTitle ?? {
      my: 'Vitamin C Brightening Serum',
      en: 'Vitamin C Brightening Serum',
    },
    whatItIs: overrides.whatItIs ?? { my: '', en: '' },
    whySilentWorks: overrides.whySilentWorks ?? { my: '', en: '' },
    category: overrides.category ?? 'beauty',
    categoryLabel: overrides.categoryLabel ?? {
      my: 'အလှကုန်နှင့် အသားအရေ',
      en: 'Beauty & Personal Care',
    },
    kalodataCategoryId: overrides.kalodataCategoryId ?? '601450',
    shopName: overrides.shopName ?? 'GlowTH Official',
    priceThb,
    commissionRate,
    commissionThb,
    visualTags: overrides.visualTags ?? [],
    kalodataMetrics: overrides.kalodataMetrics ?? {
      salesVolume7d: 1200,
      revenueThb7d: 360000,
      videoRevenueThb7d: 240000,
      liveRevenueThb7d: 60000,
      shoppingMallRevenueThb7d: 60000,
      revenueGrowthRate: 18,
      dateRange: 'last7Day',
    },
    imageUrl: overrides.imageUrl ?? '',
    scoreBreakdown: overrides.scoreBreakdown ?? {
      total: 84,
      grade: 'top',
      visualDemo: 85,
      aiSuitability: 82,
      salesDemand: 80,
      commissionValue: 78,
      speechPenalty: 0,
    },
  };
}

test('buildRankBoardMarketSummary computes macro GMV, channel splits, and sweet spot counts accurately', () => {
  const products: ProductItem[] = [
    // Sweet spot (฿299, 15%), Video-led
    makeSampleProduct({
      id: 'p1',
      priceThb: 299,
      commissionRate: 15,
      kalodataMetrics: {
        salesVolume7d: 1000,
        revenueThb7d: 300000,
        videoRevenueThb7d: 210000,
        liveRevenueThb7d: 60000,
        shoppingMallRevenueThb7d: 30000,
      },
    }),
    // High price (฿1200, 5%), Live-led, not sweet spot
    makeSampleProduct({
      id: 'p2',
      thaiTitle: 'เครื่องดูดฝุ่นไร้สาย พลังดูดแรง',
      category: 'home',
      kalodataCategoryId: '600001',
      categoryLabel: { my: 'အိမ်သုံးပစ္စည်း', en: 'Home Supplies' },
      priceThb: 1200,
      commissionRate: 5,
      kalodataMetrics: {
        salesVolume7d: 200,
        revenueThb7d: 200000,
        videoRevenueThb7d: 20000,
        liveRevenueThb7d: 160000,
        shoppingMallRevenueThb7d: 20000,
      },
    }),
  ];

  const summary = buildRankBoardMarketSummary(products);
  assert.equal(summary.totalRevenueThb, 500000);
  assert.equal(summary.totalSalesVolume, 1200);
  assert.equal(summary.videoRevenueThb, 230000);
  assert.equal(summary.liveRevenueThb, 220000);
  assert.equal(summary.shopRevenueThb, 50000);
  assert.equal(summary.videoSharePct, 46);
  assert.equal(summary.liveSharePct, 44);
  assert.equal(summary.shopSharePct, 10);
  assert.equal(summary.avgCommissionRate, 10);
  assert.equal(summary.monetizableCount, 2);
  assert.equal(summary.sweetSpotCount, 1);
});

test('buildRankBoardCategoryMarket prefers live Kalodata category rank and falls back honestly to Top 100 aggregate', () => {
  const products = [
    makeSampleProduct({ id: 'p1', kalodataCategoryId: '601450' }),
    makeSampleProduct({
      id: 'p2',
      thaiTitle: 'กระทะเคลือบหินอ่อน ไม่ติดกระทะ',
      category: 'home',
      kalodataCategoryId: '600024',
      categoryLabel: { my: 'မီးဖိုချောင်သုံး', en: 'Kitchenware' },
      kalodataMetrics: {
        salesVolume7d: 500,
        revenueThb7d: 150000,
        videoRevenueThb7d: 90000,
      },
    }),
  ];

  const live = buildRankBoardCategoryMarket(products, [
    {
      id: '601450',
      nameEn: 'Beauty & Personal Care',
      nameMy: 'အလှကုန်နှင့် အသားအရေ',
      visualGroup: 'beauty',
      revenueThb: 8000000,
      salesVolume: 40000,
      revenueSharePct: null,
    },
    {
      id: '600024',
      nameEn: 'Kitchenware',
      nameMy: 'မီးဖိုချောင်သုံး',
      visualGroup: 'home',
      revenueThb: 2000000,
      salesVolume: 10000,
      revenueSharePct: null,
    },
  ]);

  assert.equal(live.source, 'kalodata_category_rank');
  assert.equal(live.items[0].id, '601450');
  assert.equal(live.items[0].marketSharePct, 80);
  assert.equal(live.items[0].productCountInTop100, 1);

  const fallback = buildRankBoardCategoryMarket(products, []);
  assert.equal(fallback.source, 'top100_aggregate');
  assert.equal(fallback.items.length, 2);
  assert.ok(fallback.items[0].marketSharePct > fallback.items[1].marketSharePct);
});

test('filterAndSortRankBoardRows supports category cross-filter, channel filter, quick filter, search, and sorting', () => {
  const p1 = makeSampleProduct({
    id: 'p1',
    priceThb: 299,
    commissionRate: 15,
    kalodataCategoryId: '601450',
    kalodataMetrics: {
      salesVolume7d: 1000,
      revenueThb7d: 300000,
      videoRevenueThb7d: 240000,
      liveRevenueThb7d: 30000,
      shoppingMallRevenueThb7d: 30000,
    },
  });
  const p2 = makeSampleProduct({
    id: 'p2',
    thaiTitle: 'หูฟังบลูทูธไร้สาย ตัดเสียงรบกวน',
    shopName: 'SoundTH',
    category: 'gadget',
    kalodataCategoryId: '601739',
    categoryLabel: { my: 'ဖုန်းနှင့် စမတ်ပစ္စည်း', en: 'Phones & Electronics' },
    priceThb: 890,
    commissionRate: 8,
    kalodataMetrics: {
      salesVolume7d: 600,
      revenueThb7d: 540000,
      videoRevenueThb7d: 40000,
      liveRevenueThb7d: 450000,
      shoppingMallRevenueThb7d: 50000,
    },
  });

  const rows = [computeRankProductRow(p1, 0), computeRankProductRow(p2, 1)];

  const sweet = filterAndSortRankBoardRows(rows, {
    selectedCategory: null,
    quickFilter: 'sweet_spot',
    channelFilter: 'all',
    searchQuery: '',
    sortBy: 'rank',
  });
  assert.equal(sweet.length, 1);
  assert.equal(sweet[0].product.id, 'p1');

  const liveLed = filterAndSortRankBoardRows(rows, {
    selectedCategory: null,
    quickFilter: 'all',
    channelFilter: 'live',
    searchQuery: '',
    sortBy: 'rank',
  });
  assert.equal(liveLed.length, 1);
  assert.equal(liveLed[0].product.id, 'p2');

  const sortedByRevenue = filterAndSortRankBoardRows(rows, {
    selectedCategory: null,
    quickFilter: 'all',
    channelFilter: 'all',
    searchQuery: '',
    sortBy: 'revenue',
  });
  assert.equal(sortedByRevenue[0].product.id, 'p2');

  const searched = filterAndSortRankBoardRows(rows, {
    selectedCategory: null,
    quickFilter: 'all',
    channelFilter: 'all',
    searchQuery: 'หูฟัง',
    sortBy: 'rank',
  });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].product.id, 'p2');
});

test('TopBar renders Rank Board tab right beside Discover in both Myanmar and English', () => {
  const baseProps = {
    activeTab: 'rank_board' as const,
    onNavigate: () => {},
    onToggleLanguage: () => {},
    theme: 'light' as const,
    onToggleTheme: () => {},
    searchHistoryCount: 2,
    savedCount: 3,
    kalodataStatus: {
      connected: true,
      keySource: 'ui' as const,
      maskedKey: null,
      balance: {
        available: 12.5,
        mainRemain: 12.5,
        subRemain: null,
        accountType: 'main' as const,
        unit: 'credits',
        checkedAt: '2026-11-26T12:00:00.000Z',
      },
    },
    kalodataLimits: {
      maxSpendCredits: null,
      minBalanceReserve: null,
      trackedSpentCredits: 0,
    },
    isKalodataPanelOpen: false,
    onToggleKalodataPanel: () => {},
  };

  const myHtml = renderToStaticMarkup(
    React.createElement(TopBar, { ...baseProps, language: 'my', t: TRANSLATIONS.my })
  );
  assert.ok(myHtml.includes('အဆင့်ဇယား'));
  assert.ok(myHtml.includes('grid-cols-4'));

  const enHtml = renderToStaticMarkup(
    React.createElement(TopBar, { ...baseProps, language: 'en', t: TRANSLATIONS.en })
  );
  assert.ok(enHtml.includes('Rank Board'));
});

test('ProductRankBoardView renders empty state, loading state, and populated dashboard without throwing in MY & EN', () => {
  const snapshot = buildRankBoardSnapshot({
    products: [makeSampleProduct()],
    liveCategories: [
      {
        id: '601450',
        nameEn: 'Beauty & Personal Care',
        nameMy: 'အလှကုန်နှင့် အသားအရေ',
        visualGroup: 'beauty',
        revenueThb: 5200000,
        salesVolume: 22000,
        revenueSharePct: 34.5,
      },
    ],
    dateRange: 'last7Day',
    syncedAt: '2026-11-26T12:00:00.000Z',
    creditsUsed: 0.4,
  });

  const commonProps = {
    dateRange: 'last7Day' as const,
    syncError: null,
    limitWarning: null,
    kalodataStatus: {
      connected: true,
      keySource: 'ui' as const,
      maskedKey: null,
      balance: {
        available: 10,
        mainRemain: 10,
        subRemain: null,
        accountType: 'main' as const,
        unit: 'credits',
        checkedAt: '2026-11-26T12:00:00.000Z',
      },
    },
    savedProductIds: new Set<string>(),
    nowMs: Date.parse('2026-11-26T13:00:00.000Z'),
    onChangeDateRange: () => {},
    onSync: () => {},
    onOpenConnectPanel: () => {},
    onSelectProduct: () => {},
    onToggleSaveProduct: () => {},
  };

  const emptyHtml = renderToStaticMarkup(
    React.createElement(ProductRankBoardView, {
      ...commonProps,
      snapshot: null,
      isSyncing: false,
      language: 'my',
      t: TRANSLATIONS.my,
    })
  );
  assert.ok(emptyHtml.includes(TRANSLATIONS.my.rankBoard.emptyCtaBtn(0.4)));
  assert.ok(!emptyHtml.includes(TRANSLATIONS.my.rankBoard.emptyDesc));

  const loadingHtml = renderToStaticMarkup(
    React.createElement(ProductRankBoardView, {
      ...commonProps,
      snapshot: null,
      isSyncing: true,
      language: 'en',
      t: TRANSLATIONS.en,
    })
  );
  assert.ok(loadingHtml.includes(TRANSLATIONS.en.rankBoard.loadingNote));

  const myPopulatedRankingsHtml = renderToStaticMarkup(
    React.createElement(ProductRankBoardView, {
      ...commonProps,
      snapshot,
      isSyncing: false,
      language: 'my',
      initialSubpage: 'rankings',
      t: TRANSLATIONS.my,
    })
  );
  assert.ok(myPopulatedRankingsHtml.includes('เซรั่มวิตามินซี หน้าใส ลดจุดด่างดำ 30ml'));
  assert.ok(myPopulatedRankingsHtml.includes(TRANSLATIONS.my.rankBoard.subpages.rankings));
  assert.ok(myPopulatedRankingsHtml.includes(TRANSLATIONS.my.rankBoard.subpages.analytics));
  assert.ok(!myPopulatedRankingsHtml.includes(TRANSLATIONS.my.rankBoard.matrixSectionTitle));

  const myPopulatedAnalyticsHtml = renderToStaticMarkup(
    React.createElement(ProductRankBoardView, {
      ...commonProps,
      snapshot,
      isSyncing: false,
      language: 'my',
      initialSubpage: 'analytics',
      t: TRANSLATIONS.my,
    })
  );
  assert.ok(myPopulatedAnalyticsHtml.includes(TRANSLATIONS.my.rankBoard.channelSectionTitle));
  assert.ok(myPopulatedAnalyticsHtml.includes(TRANSLATIONS.my.rankBoard.matrixSectionTitle));
  assert.ok(!myPopulatedAnalyticsHtml.includes('Open Video Studio'));

  const enPopulatedHtml = renderToStaticMarkup(
    React.createElement(ProductRankBoardView, {
      ...commonProps,
      snapshot,
      isSyncing: false,
      language: 'en',
      t: TRANSLATIONS.en,
    })
  );
  assert.ok(enPopulatedHtml.includes('Thailand TikTok Shop Rank Board'));
  assert.ok(enPopulatedHtml.includes(TRANSLATIONS.en.rankBoard.openStudioAction));

  const enPopulatedAnalyticsHtml = renderToStaticMarkup(
    React.createElement(ProductRankBoardView, {
      ...commonProps,
      snapshot,
      isSyncing: false,
      language: 'en',
      initialSubpage: 'analytics',
      t: TRANSLATIONS.en,
    })
  );
  assert.ok(enPopulatedAnalyticsHtml.includes('Open Video Studio'));

  // Verify 10-row client-side pagination on Rankings subpage
  const manyProducts = Array.from({ length: 15 }, (_, idx) =>
    makeSampleProduct({
      id: `p_page_${idx + 1}`,
      thaiTitle: `Product Row ${idx + 1}`,
      kalodataMetrics: {
        ...makeSampleProduct().kalodataMetrics,
        revenueThb7d: 500000 - idx * 10000,
      },
    })
  );
  const pagedSnapshot = buildRankBoardSnapshot({
    products: manyProducts,
    liveCategories: [],
    dateRange: 'last7Day',
    syncedAt: '2026-11-26T12:00:00.000Z',
    creditsUsed: 0.4,
  });
  const pagedHtml = renderToStaticMarkup(
    React.createElement(ProductRankBoardView, {
      ...commonProps,
      snapshot: pagedSnapshot,
      isSyncing: false,
      language: 'en',
      t: TRANSLATIONS.en,
    })
  );
  assert.ok(pagedHtml.includes('Product Row 1'));
  assert.ok(pagedHtml.includes('Product Row 10'));
  assert.ok(!pagedHtml.includes('Product Row 11'));
  assert.ok(pagedHtml.includes('aria-label="Pagination"'));
});

