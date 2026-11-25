import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TRANSLATIONS } from '../src/i18n.ts';
import {
  buildProductIntelligenceView,
  ensureProductV2Intelligence,
} from '../src/lib/productIntelligenceView.ts';
import {
  computeSyntheticCommissionThb,
  validateNumericMetric,
  validatePriceThbMetric,
  validateUnverifiedNumericMetric,
} from '../src/lib/metricFoundation.ts';
import { mergeRestoredRecentSearches } from '../src/lib/storage.ts';
import { TopBar } from '../src/components/TopBar.tsx';
import { StrategyExplorerBar } from '../src/components/StrategyExplorerBar.tsx';
import { ProductCard } from '../src/components/ProductCard.tsx';
import { ScoreDetailContent } from '../src/components/ScoreDetailDialog.tsx';
import { VideoStudioView } from '../src/components/VideoStudioView.tsx';
import { HistoryView } from '../src/components/HistoryView.tsx';
import { SearchHistoryView } from '../src/components/SearchHistoryView.tsx';
import { KalodataBar } from '../src/components/KalodataBar.tsx';
import { AiChatPromptCard } from '../src/components/AiChatPromptCard.tsx';
import type {
  ProductItem,
  ProductValidatedMetrics,
  RecentSearchEntry,
  VideoAdPlan,
} from '../src/types.ts';

const NOW_ISO = '2026-11-25T03:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

function buildTestValidatedMetrics(opts: {
  priceThb?: number | null;
  commissionRate?: number | null;
  salesVolume7d?: number | null;
  revenueThb7d?: number | null;
  videoRevenueThb7d?: number | null;
  creatorCount?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  unverifiedCore?: boolean;
} = {}): ProductValidatedMetrics {
  const fetchedAt = NOW_ISO;
  const dateRange = 'last7Day';

  const priceThb = validatePriceThbMetric(
    opts.priceThb === undefined ? 299 : opts.priceThb,
    { fetchedAt, dateRange, nowMs: NOW_MS }
  );

  const commRateVal = opts.commissionRate === undefined ? 15 : opts.commissionRate;
  const commissionRate = validateNumericMetric({
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
    rawInput: opts.salesVolume7d === undefined ? 1200 : opts.salesVolume7d,
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
    rawInput: opts.revenueThb7d === undefined ? 358_800 : opts.revenueThb7d,
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
    rawInput: opts.videoRevenueThb7d === undefined ? 240_000 : opts.videoRevenueThb7d,
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
    rawInput: 20_000,
    unit: 'THB',
    provenance: 'SOURCE',
    fetchedAt,
    dateRange,
    nowMs: NOW_MS,
    allowZero: true,
    allowNegative: false,
    integerOnly: true,
  });

  const revenueGrowthRate = validateUnverifiedNumericMetric(0.25, {
    unverifiedNote: 'UNVERIFIED growth field',
    context: { fetchedAt, dateRange, nowMs: NOW_MS },
  });

  const creatorCount = opts.unverifiedCore
    ? validateUnverifiedNumericMetric(opts.creatorCount ?? 18, {
        unverifiedNote: 'UNVERIFIED creator count',
        context: { fetchedAt, dateRange, nowMs: NOW_MS },
      })
    : validateNumericMetric({
        rawInput: opts.creatorCount === undefined ? 18 : opts.creatorCount,
        unit: 'COUNT',
        provenance: 'SOURCE',
        fetchedAt,
        dateRange,
        nowMs: NOW_MS,
        allowZero: true,
        allowNegative: false,
        integerOnly: true,
      });

  const rating = opts.unverifiedCore
    ? validateUnverifiedNumericMetric(opts.rating ?? 4.8, {
        unverifiedNote: 'UNVERIFIED rating',
        context: { fetchedAt, dateRange, nowMs: NOW_MS },
      })
    : validateNumericMetric({
        rawInput: opts.rating === undefined ? 4.8 : opts.rating,
        unit: 'RATING_5',
        provenance: 'SOURCE',
        fetchedAt,
        dateRange,
        nowMs: NOW_MS,
        allowZero: false,
        allowNegative: false,
      });

  const reviewCount = opts.unverifiedCore
    ? validateUnverifiedNumericMetric(opts.reviewCount ?? 420, {
        unverifiedNote: 'UNVERIFIED review count',
        context: { fetchedAt, dateRange, nowMs: NOW_MS },
      })
    : validateNumericMetric({
        rawInput: opts.reviewCount === undefined ? 420 : opts.reviewCount,
        unit: 'COUNT',
        provenance: 'SOURCE',
        fetchedAt,
        dateRange,
        nowMs: NOW_MS,
        allowZero: true,
        allowNegative: false,
        integerOnly: true,
      });

  return {
    fetchedAt,
    dateRange,
    sourceEndpoint: 'rank',
    unresolvedFields: opts.unverifiedCore
      ? ['revenueGrowthRate', 'creatorCount', 'rating', 'reviewCount']
      : ['revenueGrowthRate'],
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
  };
}

function buildTestProduct(
  id: string,
  opts: Parameters<typeof buildTestValidatedMetrics>[0] = {},
  overrides: Partial<ProductItem> = {}
): ProductItem {
  const validatedMetrics = buildTestValidatedMetrics(opts);
  const raw: ProductItem = {
    id,
    thaiTitle: `สินค้าทดสอบ ${id}`,
    clearTitle: {
      en: `Test Product ${id}`,
      my: `စမ်းသပ်ပစ္စည်း ${id}`,
    },
    whatItIs: {
      en: 'Test product overview.',
      my: 'စမ်းသပ်ပစ္စည်း ရှင်းလင်းချက်။',
    },
    whySilentWorks: {
      en: 'Clear texture demonstration works without voiceover.',
      my: 'စကားမပြောဘဲ ရုပ်ပုံသက်သက်ဖြင့် ပြသနိုင်သည်။',
    },
    category: 'beauty',
    categoryLabel: {
      en: 'Beauty & Personal Care',
      my: 'Beauty & Personal Care', // Intentionally untranslated to verify Myanmar localization fallback
    },
    priceThb: validatedMetrics.priceThb.value,
    commissionRate: validatedMetrics.commissionRate.value,
    commissionThb: validatedMetrics.commissionThb.value,
    shopName: 'Siam Test Shop',
    imageUrl: '',
    visualTags: ['Before/After', 'Macro Texture'],
    scoreBreakdown: {
      total: 82,
      grade: 'strong',
      visualDemo: 88,
      aiSuitability: 85,
      salesDemand: 80,
      commissionValue: 78,
      speechPenalty: 0,
    },
    validatedMetrics,
    ...overrides,
  };
  return ensureProductV2Intelligence(raw, { nowMs: NOW_MS });
}

function buildTestVideoPlan(productId: string): VideoAdPlan {
  return {
    id: `plan_${productId}`,
    productId,
    style: 'cinematic',
    createdAt: NOW_ISO,
    conceptTitle: { en: 'Silent Visual Demo', my: 'အသံမဲ့ ရုပ်ပုံပြသမှု' },
    conceptSummary: {
      en: 'Show immediate transformation.',
      my: 'ချက်ချင်းပြောင်းလဲမှုကို ပြသမည်။',
    },
    visualDirection: {
      en: 'Macro daylight shots.',
      my: 'အနီးကပ် အလင်းရောင်ကောင်း ရိုက်ကူးမှု။',
    },
    hooks: [
      {
        title: { en: 'Before/After Reveal', my: 'မတိုင်ခင်/ပြီးနောက်' },
        visualAction: { en: 'Swipe wipe reveal', my: 'လက်ဖြင့် ပွတ်ပြမည်' },
        onScreenTextTh: 'เห็นผลทันที',
        onScreenTextMeaning: { en: 'Visible immediately', my: 'ချက်ချင်းမြင်သာသည်' },
      },
    ],
    storyboard: [
      {
        timeRange: '0-3s',
        sceneVisual: { en: 'Close up texture', my: 'အသားအရည် အနီးကပ်' },
        cameraMove: { en: 'Slow push in', my: 'ဖြည်းဖြည်းချင်း ချဲ့ရိုက်' },
        soundDesign: { en: 'Soft ASMR click', my: 'ASMR အသံတိုးတိုး' },
        onScreenTextTh: 'ลองแล้วชอบมาก',
        onScreenTextMeaning: { en: 'Tried and loved it', my: 'စမ်းသုံးပြီး ကြိုက်တယ်' },
      },
    ],
    masterVideoPrompt: {
      en: 'Vertical 9:16 macro studio video showing smooth cream application in warm Bangkok daylight, no speech.',
      my: 'နေရောင်ခြည်နွေးနွေးအောက်တွင် ခရင်မ်လိမ်းပြသည့် ၉:၁၆ ဗီဒီယို။',
    },
    aiVideoPrompts: [
      {
        label: { en: 'Opening Shot', my: 'အဖွင့်ရှော့' },
        prompt: 'Macro 9:16 shot of matte serum bottle on travertine stone.',
      },
    ],
    aiImagePrompts: [
      {
        label: { en: 'Hero Frame', my: 'အဓိကပုံ' },
        prompt: 'High key commercial still life of serum bottle.',
      },
    ],
    seo: {
      captionTh: 'ของดีต้องบอกต่อ',
      captionMeaning: {
        en: 'Good product worth sharing',
        my: 'ပစ္စည်းကောင်းလို့ မျှဝေပေးတာပါ',
      },
      hashtags: ['#tiktokshopth', '#รีวิวของดี'],
      keywords: ['serum', 'skincare'],
      postingTip: {
        en: 'Post at 7 PM ICT',
        my: 'ထိုင်းစံတော်ချိန် ည ၇ နာရီ တင်ပါ',
      },
    },
  };
}

describe('Phase 7 UX & Mobile Audit Regression Suite', () => {
  it('merges restored recent searches without overwriting existing entries', () => {
    const prodA = buildTestProduct('p-a');
    const prodB = buildTestProduct('p-b');
    const prodC = buildTestProduct('p-c');

    const current: RecentSearchEntry[] = [
      {
        id: 'srch_existing_1',
        searchedAt: '2026-11-25T02:00:00.000Z',
        query: 'serum',
        cateIds: [],
        cateLabels: [],
        mode: 'rank',
        products: [prodA],
        creditsUsed: 0.2,
      },
      {
        id: 'srch_shared',
        searchedAt: '2026-11-24T12:00:00.000Z',
        query: 'cleanser',
        cateIds: [],
        cateLabels: [],
        mode: 'rank',
        products: [prodB],
        creditsUsed: 0.2,
      },
    ];

    const imported: RecentSearchEntry[] = [
      {
        id: 'srch_shared',
        searchedAt: '2026-11-24T12:00:00.000Z',
        query: 'cleanser',
        cateIds: [],
        cateLabels: [],
        mode: 'rank',
        products: [prodB],
        creditsUsed: 0.2,
      },
      {
        id: 'srch_imported_new',
        searchedAt: '2026-11-25T03:00:00.000Z',
        query: 'sunscreen',
        cateIds: [],
        cateLabels: [],
        mode: 'rank',
        products: [prodC],
        creditsUsed: 0.2,
      },
    ];

    const { merged, addedCount } = mergeRestoredRecentSearches(current, imported);
    assert.equal(addedCount, 1);
    assert.equal(merged.length, 3);
    assert.equal(merged[0].id, 'srch_imported_new');
    assert.equal(merged[1].id, 'srch_existing_1');
    assert.equal(merged[2].id, 'srch_shared');
  });

  it('surfaces inline exclusion reason and verified metric count on ProductCard without requiring dialog clicks', () => {
    const strongProd = buildTestProduct('strong-1', {
      priceThb: 499,
      commissionRate: 20,
      salesVolume7d: 1800,
      revenueThb7d: 898_200,
      videoRevenueThb7d: 580_000,
      creatorCount: 14,
      rating: 4.8,
      reviewCount: 420,
    });
    const zeroCommProd = buildTestProduct('zero-comm', {
      priceThb: 299,
      commissionRate: 0,
      salesVolume7d: 800,
      revenueThb7d: 239_200,
      videoRevenueThb7d: 140_000,
      creatorCount: 15,
      rating: 4.7,
      reviewCount: 120,
    });

    const viewModel = buildProductIntelligenceView(
      [strongProd, zeroCommProd],
      'profit_maximizer',
      { nowMs: NOW_MS }
    );

    const rankedEntry = viewModel.rankedEntries[0];
    const excludedEntry = viewModel.excludedEntries.find((e) => e.product.id === 'zero-comm');
    assert.ok(rankedEntry, 'Expected strong product to qualify for profit_maximizer');
    assert.ok(excludedEntry, 'Expected 0% commission product to be excluded');

    const rankedHtml = renderToStaticMarkup(
      React.createElement(ProductCard, {
        product: rankedEntry.product,
        intelligenceItem: rankedEntry,
        activeStrategyView: 'profit_maximizer',
        index: 0,
        language: 'en',
        isSaved: false,
        viewMode: 'grid',
        density: 'standard',
        nowMs: NOW_MS,
        t: TRANSLATIONS.en,
        onSelect: () => {},
        onToggleSave: () => {},
        onOpenScoreDetails: () => {},
      })
    );

    assert.match(rankedHtml, /Verified \d+\/11/);
    assert.match(rankedHtml, /Strategy/);

    const excludedHtml = renderToStaticMarkup(
      React.createElement(ProductCard, {
        product: excludedEntry.product,
        intelligenceItem: excludedEntry,
        activeStrategyView: 'profit_maximizer',
        index: 0,
        language: 'en',
        isSaved: false,
        viewMode: 'grid',
        density: 'standard',
        nowMs: NOW_MS,
        t: TRANSLATIONS.en,
        onSelect: () => {},
        onToggleSave: () => {},
        onOpenScoreDetails: () => {},
      })
    );

    // Inline exclusion reason must be visible directly on the collapsed card
    const expectedReason =
      excludedEntry.failedRequirements[0]?.detail ||
      excludedEntry.missingEvidence[0] ||
      excludedEntry.explanation;
    assert.ok(expectedReason, 'Expected non-empty exclusion explanation');
    assert.ok(
      excludedHtml.includes(expectedReason),
      `Expected collapsed excluded card to display inline exclusion reason: ${expectedReason}`
    );
  });

  it('uses 2-column dimensions on compact mobile cards so labels do not crush into 4 columns', () => {
    const prod = buildTestProduct('compact-1');
    const html = renderToStaticMarkup(
      React.createElement(ProductCard, {
        product: prod,
        activeStrategyView: 'overall',
        index: 0,
        language: 'my',
        isSaved: false,
        viewMode: 'grid',
        density: 'compact',
        nowMs: NOW_MS,
        t: TRANSLATIONS.my,
        onSelect: () => {},
        onToggleSave: () => {},
        onOpenScoreDetails: () => {},
      })
    );

    assert.ok(html.includes('grid-cols-2'), 'Compact card dimensions should use grid-cols-2');
    assert.ok(!html.includes('grid-cols-4'), 'Compact card dimensions must not crush into grid-cols-4');
    assert.ok(!html.includes('xs:inline'), 'Dead Tailwind xs:inline class should be removed');
  });

  it('renders 4-signal distinction, non-guarantee disclaimer, and Myanmar table headers in ScoreDetailContent', () => {
    const prod = buildTestProduct('dialog-1', { unverifiedCore: true });

    const enHtml = renderToStaticMarkup(
      React.createElement(ScoreDetailContent, {
        product: prod,
        language: 'en',
        nowMs: NOW_MS,
        t: TRANSLATIONS.en,
        onClose: () => {},
      })
    );

    assert.ok(enHtml.includes(TRANSLATIONS.en.v2.dialog.pillarsSummaryTitle));
    assert.ok(enHtml.includes(TRANSLATIONS.en.v2.dialog.nonGuaranteeDisclaimer));
    assert.ok(enHtml.includes(TRANSLATIONS.en.v2.provenance.metricCol));
    assert.ok(enHtml.includes(TRANSLATIONS.en.v2.provenance.statusCol));

    const myHtml = renderToStaticMarkup(
      React.createElement(ScoreDetailContent, {
        product: prod,
        language: 'my',
        nowMs: NOW_MS,
        t: TRANSLATIONS.my,
        onClose: () => {},
      })
    );

    assert.ok(myHtml.includes(TRANSLATIONS.my.v2.dialog.pillarsSummaryTitle));
    assert.ok(myHtml.includes(TRANSLATIONS.my.v2.dialog.nonGuaranteeDisclaimer));
    assert.ok(myHtml.includes(TRANSLATIONS.my.v2.provenance.metricCol));
    assert.ok(myHtml.includes(TRANSLATIONS.my.v2.provenance.statusCol));
  });

  it('does not leak Burmese labels into English VideoStudioView and translates categories in Myanmar mode', () => {
    const prod = buildTestProduct('studio-1');
    const plan = buildTestVideoPlan('studio-1');

    const enHtml = renderToStaticMarkup(
      React.createElement(VideoStudioView, {
        product: prod,
        isSaved: false,
        plan,
        style: 'cinematic',
        savedStyles: ['cinematic'],
        isGenerating: false,
        isEnrichingProduct: false,
        isAnalyzingProduct: false,
        enrichError: null,
        analysisError: null,
        error: null,
        cameFromHistory: false,
        language: 'en',
        nowMs: NOW_MS,
        kalodataStatus: { connected: true, keySource: 'ui', maskedKey: 'kalo***', balance: null },
        kalodataLimits: { maxSpendCredits: null, minBalanceReserve: null, trackedSpentCredits: 0 },
        t: TRANSLATIONS.en,
        onBack: () => {},
        onToggleSave: () => {},
        onSelectStyle: () => {},
        onConfirmGenerate: () => {},
        onFetchDeepInsights: async () => {},
        onAnalyzeProduct: async () => {},
        onOpenScoreDetails: () => {},
      })
    );

    assert.ok(!enHtml.includes('အဓိပ္ပာယ်'), 'English VideoStudioView must not leak hardcoded Myanmar text');
    assert.ok(enHtml.includes(TRANSLATIONS.en.studio.commercialStudioNotice));
    assert.ok(enHtml.includes('scroll-mt-28 sm:scroll-mt-20'));

    const myHtml = renderToStaticMarkup(
      React.createElement(VideoStudioView, {
        product: prod,
        isSaved: false,
        plan,
        style: 'cinematic',
        savedStyles: ['cinematic'],
        isGenerating: false,
        isEnrichingProduct: false,
        isAnalyzingProduct: false,
        enrichError: null,
        analysisError: null,
        error: null,
        cameFromHistory: false,
        language: 'my',
        nowMs: NOW_MS,
        kalodataStatus: { connected: true, keySource: 'ui', maskedKey: 'kalo***', balance: null },
        kalodataLimits: { maxSpendCredits: null, minBalanceReserve: null, trackedSpentCredits: 0 },
        t: TRANSLATIONS.my,
        onBack: () => {},
        onToggleSave: () => {},
        onSelectStyle: () => {},
        onConfirmGenerate: () => {},
        onFetchDeepInsights: async () => {},
        onAnalyzeProduct: async () => {},
        onOpenScoreDetails: () => {},
      })
    );

    assert.ok(
      myHtml.includes('အလှကုန်နှင့် တစ်ကိုယ်ရေသုံး'),
      'Myanmar VideoStudioView should localize English-only categoryLabel'
    );
    assert.ok(myHtml.includes(TRANSLATIONS.my.studio.commercialStudioNotice));
    assert.ok(myHtml.includes(`${TRANSLATIONS.my.studio.meaningLabel}:`));
  });

  it('enables Backup JSON in HistoryView when recentSearches exist even if saved items list is empty', () => {
    const htmlWithSearches = renderToStaticMarkup(
      React.createElement(HistoryView, {
        entries: [],
        recentSearchesCount: 2,
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

    assert.ok(
      !htmlWithSearches.includes('disabled=""'),
      'Backup JSON button should be enabled when recentSearchesCount > 0'
    );

    const htmlAllEmpty = renderToStaticMarkup(
      React.createElement(HistoryView, {
        entries: [],
        recentSearchesCount: 0,
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

    assert.ok(
      htmlAllEmpty.includes('disabled=""'),
      'Backup JSON button should stay disabled when both saved items and recent searches are empty'
    );
  });

  it('renders TopBar, StrategyExplorerBar, SearchHistoryView, KalodataBar, and AiChatPromptCard cleanly in both languages', () => {
    const prod = buildTestProduct('smoke-1');
    const viewModel = buildProductIntelligenceView([prod], 'overall', { nowMs: NOW_MS });

    for (const lang of ['en', 'my'] as const) {
      const t = TRANSLATIONS[lang];

      const topBarHtml = renderToStaticMarkup(
        React.createElement(TopBar, {
          activeTab: 'discover',
          onNavigate: () => {},
          language: lang,
          onToggleLanguage: () => {},
          theme: 'light',
          onToggleTheme: () => {},
          searchHistoryCount: 2,
          savedCount: 3,
          kalodataStatus: {
            connected: true,
            keySource: 'ui',
            maskedKey: 'kalo***',
            balance: {
              available: 12345.6,
              unit: 'credits',
              checkedAt: NOW_ISO,
            },
          },
          kalodataLimits: {
            maxSpendCredits: 50,
            minBalanceReserve: 10,
            trackedSpentCredits: 2.4,
          },
          isKalodataPanelOpen: false,
          onToggleKalodataPanel: () => {},
          t,
        })
      );
      assert.ok(topBarHtml.includes('h-11'), 'TopBar mobile nav tabs should use 44px touch targets');

      const explorerHtml = renderToStaticMarkup(
        React.createElement(StrategyExplorerBar, {
          viewModel,
          activeView: 'overall',
          showExcluded: false,
          t,
          onSelectView: () => {},
          onToggleShowExcluded: () => {},
        })
      );
      assert.ok(explorerHtml.includes(t.v2.rankingTransparencyNote));

      const searchHistHtml = renderToStaticMarkup(
        React.createElement(SearchHistoryView, {
          entries: [
            {
              id: 'srch_1',
              searchedAt: NOW_ISO,
              query: 'serum',
              cateIds: [],
              cateLabels: [],
              mode: 'rank',
              products: [prod],
              creditsUsed: 0.2,
            },
          ],
          activeRecentId: 'srch_1',
          language: lang,
          t,
          onOpenEntry: () => {},
          onDeleteEntry: () => {},
          onClearAll: () => {},
          onGoDiscover: () => {},
        })
      );
      assert.ok(searchHistHtml.includes('flex-wrap'));

      const kaloHtml = renderToStaticMarkup(
        React.createElement(KalodataBar, {
          status: { connected: false, keySource: 'none', maskedKey: null, balance: null },
          limits: { maxSpendCredits: null, minBalanceReserve: null, trackedSpentCredits: 0 },
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
      assert.ok(kaloHtml.includes('flex-wrap'));

      const aiCardHtml = renderToStaticMarkup(
        React.createElement(AiChatPromptCard, {
          product: prod,
          t,
        })
      );
      assert.ok(aiCardHtml.includes('flex-wrap'));
    }
  });
});
