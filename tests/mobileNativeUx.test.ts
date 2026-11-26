import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CompactFilterBar } from '../src/components/CompactFilterBar.tsx';
import { CustomSelect } from '../src/components/CustomSelect.tsx';
import { InfoTooltip } from '../src/components/InfoTooltip.tsx';
import { ProductCard } from '../src/components/ProductCard.tsx';
import {
  findNearestScatterPointId,
  ProductRankBoardView,
} from '../src/components/ProductRankBoardView.tsx';
import { ScoreDetailContent } from '../src/components/ScoreDetailDialog.tsx';
import { SearchConfigDrawer } from '../src/components/SearchConfigDrawer.tsx';
import { TopBar } from '../src/components/TopBar.tsx';
import { VideoStudioView } from '../src/components/VideoStudioView.tsx';
import { TRANSLATIONS } from '../src/i18n.ts';
import { createRecommendedSearchConfigDraft } from '../src/lib/discoveryFilterEngine.ts';
import { buildRankBoardSnapshot } from '../src/lib/rankBoardAnalytics.ts';
import type { KalodataCategoryItem, ProductItem, VideoAdPlan } from '../src/types.ts';

function makeVideoPlan(productId = '172999888777'): VideoAdPlan {
  return {
    id: 'plan_1',
    productId,
    style: 'cinematic',
    createdAt: '2026-11-26T12:00:00.000Z',
    conceptTitle: { my: 'Concept Title MY', en: 'Concept Title EN' },
    conceptSummary: { my: 'Summary MY', en: 'Summary EN' },
    visualDirection: { my: 'Direction MY', en: 'Direction EN' },
    hooks: [
      {
        title: { my: 'Hook 1', en: 'Hook 1' },
        visualAction: { my: 'Close-up drop', en: 'Close-up drop' },
        onScreenTextTh: 'เซรั่มวิตามินซี',
        onScreenTextMeaning: { my: 'Vitamin C serum', en: 'Vitamin C serum' },
      },
    ],
    storyboard: [
      {
        timeRange: '0-3s',
        sceneVisual: { my: 'Scene 1', en: 'Scene 1' },
        cameraMove: { my: 'Push in', en: 'Push in' },
        soundDesign: { my: 'ASMR drop', en: 'ASMR drop' },
        onScreenTextTh: 'ข้อความตัวอย่าง',
        onScreenTextMeaning: { my: 'Sample text', en: 'Sample text' },
      },
    ],
    aiVideoPrompts: [{ label: { my: 'Video Prompt 1', en: 'Video Prompt 1' }, prompt: 'Cinematic macro bottle shot' }],
    aiImagePrompts: [{ label: { my: 'Image Prompt 1', en: 'Image Prompt 1' }, prompt: 'Studio vanity bottle lighting' }],
    seo: {
      captionTh: 'ตัวอย่างแคปชั่นสินค้า',
      captionMeaning: { my: 'Sample caption meaning', en: 'Sample caption meaning' },
      hashtags: ['#สกินแคร์', '#วิตามินซี'],
      keywords: ['เซรั่ม'],
      postingTip: { my: 'Post at 19:00 TH', en: 'Post at 19:00 TH' },
    },
  };
}

function makeProduct(overrides: Partial<ProductItem> = {}): ProductItem {
  return {
    id: overrides.id ?? '172999888777',
    thaiTitle: overrides.thaiTitle ?? 'เซรั่มบำรุงผิวหน้า วิตามินซี 30ml',
    clearTitle: overrides.clearTitle ?? { my: 'Vitamin C Serum', en: 'Vitamin C Serum' },
    whatItIs: overrides.whatItIs ?? { my: '', en: '' },
    whySilentWorks: overrides.whySilentWorks ?? { my: '', en: '' },
    category: overrides.category ?? 'beauty',
    categoryLabel: overrides.categoryLabel ?? { my: 'အလှကုန်', en: 'Beauty & Personal Care' },
    kalodataCategoryId: overrides.kalodataCategoryId ?? '601450',
    shopName: overrides.shopName ?? 'GlowTH',
    priceThb: overrides.priceThb ?? 299,
    commissionRate: overrides.commissionRate ?? 15,
    commissionThb: overrides.commissionThb ?? 44.85,
    visualTags: overrides.visualTags ?? [],
    kalodataMetrics: overrides.kalodataMetrics ?? {
      salesVolume7d: 850,
      revenueThb7d: 254150,
      videoRevenueThb7d: 180000,
      liveRevenueThb7d: 40000,
      shoppingMallRevenueThb7d: 34150,
      revenueGrowthRate: 14.5,
      dateRange: 'last7Day',
    },
    imageUrl: overrides.imageUrl ?? '',
    scoreBreakdown: overrides.scoreBreakdown ?? {
      total: 82,
      grade: 'top',
      visualDemo: 85,
      aiSuitability: 80,
      salesDemand: 80,
      commissionValue: 78,
      speechPenalty: 0,
    },
  };
}

test('Mobile Native UX: index.html and index.css enforce viewport-fit=cover, overscroll containment, and horizontal clip', () => {
  const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('viewport-fit=cover'));
  assert.ok(indexHtml.includes('apple-mobile-web-app-capable'));
  assert.ok(indexHtml.includes('name="theme-color"'));

  const indexCss = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
  assert.ok(indexCss.includes('overscroll-behavior-y: contain'));
  assert.ok(indexCss.includes('overflow-x: clip'));
  assert.ok(indexCss.includes('-webkit-overflow-scrolling: touch'));
});

test('Mobile Native UX: TopBar decouples fixed bottom tab bar from scroll-hide header with safe-area padding', () => {
  for (const lang of ['my', 'en'] as const) {
    const t = TRANSLATIONS[lang];
    const html = renderToStaticMarkup(
      React.createElement(TopBar, {
        activeTab: 'discover',
        onNavigate: () => {},
        language: lang,
        onToggleLanguage: () => {},
        theme: 'light',
        onToggleTheme: () => {},
        searchHistoryCount: 2,
        savedCount: 3,
        kalodataStatus: { connected: false, keySource: 'none', maskedKey: null, balance: null },
        kalodataLimits: { maxSpendCredits: null, minBalanceReserve: null, trackedSpentCredits: 0 },
        isKalodataPanelOpen: false,
        onToggleKalodataPanel: () => {},
        t,
      })
    );

    // Header closes before mobile fixed bottom nav opens so header transforms don't trap fixed positioning
    const headerCloseIdx = html.indexOf('</header>');
    const mobileNavIdx = html.indexOf('fixed bottom-0');
    assert.ok(headerCloseIdx > 0);
    assert.ok(mobileNavIdx > headerCloseIdx);
    assert.ok(html.includes('lg:hidden fixed bottom-0 inset-x-0'));
    assert.ok(html.includes('pb-[env(safe-area-inset-bottom)]'));
    assert.ok(html.includes('pt-[env(safe-area-inset-top)]'));
    assert.ok(html.includes('grid-cols-4'));
    assert.ok(html.includes('h-11'));
    assert.ok(html.includes(t.nav.discover));
    assert.ok(html.includes(t.nav.rankBoard));
    assert.ok(html.includes(t.nav.searchHistory));
    assert.ok(html.includes(t.nav.history));
    // Minimum 11px legible bottom tab bar labels with compact line-height
    assert.ok(html.includes('text-[11px]'));
    assert.ok(html.includes('leading-tight'));
  }

  const hiddenBottomNavHtml = renderToStaticMarkup(
    React.createElement(TopBar, {
      activeTab: 'discover',
      onNavigate: () => {},
      language: 'en',
      onToggleLanguage: () => {},
      theme: 'light',
      onToggleTheme: () => {},
      searchHistoryCount: 0,
      savedCount: 0,
      kalodataStatus: { connected: false, keySource: 'none', maskedKey: null, balance: null },
      kalodataLimits: { maxSpendCredits: null, minBalanceReserve: null, trackedSpentCredits: 0 },
      isKalodataPanelOpen: false,
      onToggleKalodataPanel: () => {},
      isBottomNavHidden: true,
      t: TRANSLATIONS.en,
    })
  );
  assert.ok(hiddenBottomNavHtml.includes('translate-y-full pointer-events-none'));
});

test('Mobile Native UX: SearchConfigDrawer & ScoreDetailDialog provide bottom-sheet ergonomics, safe-area footer, and 16px mobile inputs', () => {
  const categories: KalodataCategoryItem[] = [
    { id: '', label: { my: 'အားလုံး', en: 'All' }, visualGroup: 'home', source: 'official' },
  ];

  const drawerHtml = renderToStaticMarkup(
    React.createElement(SearchConfigDrawer, {
      isOpen: true,
      initialConfig: createRecommendedSearchConfigDraft(),
      categories,
      categoryMatchCounts: new Map([['', 100]]),
      language: 'my',
      isConnected: true,
      isSearching: false,
      isSyncingCategories: false,
      hasLiveSyncedCategories: false,
      searchLimitWarning: null,
      leanSearchCost: 0.2,
      t: TRANSLATIONS.my,
      onClose: () => {},
      onSyncCategories: () => {},
      onSubmit: () => {},
    })
  );

  assert.ok(drawerHtml.includes('rounded-t-3xl'));
  assert.ok(drawerHtml.includes('max-h-[90dvh]'));
  assert.ok(drawerHtml.includes('overscroll-contain'));
  assert.ok(drawerHtml.includes('text-base sm:text-sm'));
  assert.ok(drawerHtml.includes('pb-[max(0.875rem,env(safe-area-inset-bottom))]'));
  assert.ok(drawerHtml.includes('touch-none'));

  const scoreHtml = renderToStaticMarkup(
    React.createElement(ScoreDetailContent, {
      product: makeProduct(),
      language: 'en',
      nowMs: Date.UTC(2026, 10, 26, 12, 0, 0),
      t: TRANSLATIONS.en,
      onClose: () => {},
    })
  );
  assert.ok(scoreHtml.includes('overscroll-contain'));
  assert.ok(scoreHtml.includes('pb-[max(0.875rem,env(safe-area-inset-bottom))]'));
  assert.ok(scoreHtml.includes('h-10 sm:h-9'));

  const bottomSheetSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/BottomSheet.tsx'),
    'utf8'
  );
  assert.ok(bottomSheetSrc.includes('items-end sm:items-center'));
  assert.ok(bottomSheetSrc.includes('rounded-t-3xl sm:rounded-2xl max-h-[90dvh] sm:max-h-[88vh]'));
});

test('Mobile Native UX: ProductRankBoardView, InfoTooltip, and CustomSelect meet touch-target & iOS zoom prevention rules', () => {
  const snapshot = buildRankBoardSnapshot({
    products: [makeProduct()],
    liveCategories: [],
    dateRange: 'last7Day',
    syncedAt: '2026-11-26T12:00:00.000Z',
    creditsUsed: 0.4,
  });

  const boardHtml = renderToStaticMarkup(
    React.createElement(ProductRankBoardView, {
      snapshot,
      dateRange: 'last7Day',
      isSyncing: false,
      syncError: null,
      limitWarning: null,
      kalodataStatus: { connected: true, keySource: 'ui', maskedKey: 'kalo***', balance: null },
      savedProductIds: new Set<string>(),
      language: 'en',
      nowMs: Date.UTC(2026, 10, 26, 12, 0, 0),
      t: TRANSLATIONS.en,
      onChangeDateRange: () => {},
      onSync: () => {},
      onOpenConnectPanel: () => {},
      onSelectProduct: () => {},
      onToggleSaveProduct: () => {},
    })
  );

  // SVG-level pointer handling & prominent selected dot highlight (no per-dot transparent hitboxes)
  assert.ok(boardHtml.includes('touch-none'));
  assert.ok(boardHtml.includes('aria-pressed="true"'));
  // 16px mobile search input + CustomSelect mobile sheet sort control (no tiny native 12px select)
  assert.ok(boardHtml.includes('text-base sm:text-sm'));
  assert.ok(boardHtml.includes('aria-haspopup="listbox"'));
  assert.ok(boardHtml.includes('before:-inset-1'));
  // Mobile rank cards keep 44px+ touch targets
  assert.ok(boardHtml.includes('h-11 w-11'));
  assert.ok(boardHtml.includes('h-11 px-3.5'));

  // Exact ~24px screen-pixel nearest dot matching
  const nearest = findNearestScatterPointId({
    clientX: 192,
    clientY: 75,
    rect: { left: 0, top: 0, width: 380, height: 139 },
    viewBoxWidth: 760,
    viewBoxHeight: 278,
    points: [
      { id: 'far', cx: 100, cy: 100 },
      { id: 'near', cx: 400, cy: 140 },
    ],
    maxScreenRadiusPx: 24,
  });
  assert.equal(nearest, 'near');

  const outOfRange = findNearestScatterPointId({
    clientX: 300,
    clientY: 130,
    rect: { left: 0, top: 0, width: 380, height: 139 },
    viewBoxWidth: 760,
    viewBoxHeight: 278,
    points: [{ id: 'near', cx: 400, cy: 140 }],
    maxScreenRadiusPx: 24,
  });
  assert.equal(outOfRange, null);

  const tooltipHtml = renderToStaticMarkup(
    React.createElement(InfoTooltip, { content: 'Compact guide', size: 'sm' })
  );
  assert.ok(tooltipHtml.includes('before:-inset-2.5'));

  const selectHtml = renderToStaticMarkup(
    React.createElement(CustomSelect, {
      value: 'a',
      onChange: () => {},
      options: [{ value: 'a', label: 'Alpha' }],
      size: 'md',
    })
  );
  assert.ok(selectHtml.includes('h-11 sm:h-10'));
});

test('Phase 1 P0: CompactFilterBar applies notch safe-area padding & calc height without double-gap', () => {
  const html = renderToStaticMarkup(
    React.createElement(CompactFilterBar, {
      isVisible: true,
      isHeaderHidden: false,
      headerHeight: 104,
      headerSafeTop: 44,
      categories: [
        { id: '', label: { my: 'အားလုံး', en: 'All' }, visualGroup: 'beauty', source: 'official' },
      ],
      selectedCateIds: [],
      categoryMatchCounts: new Map([['', 12]]),
      language: 'en',
      query: '',
      searchPageSize: 100,
      isSearching: false,
      isSingleLinkValid: false,
      isLinkOrId: false,
      leanSearchCost: 0.2,
      isOffline: false,
      t: TRANSLATIONS.en,
      onToggleCategory: () => {},
      onOpenSearchDrawer: () => {},
    })
  );

  assert.ok(html.includes('pt-[env(safe-area-inset-top)]'));
  assert.ok(html.includes('h-[calc(52px+env(safe-area-inset-top))]'));
  // Docked offset subtracts headerSafeTop (104 - 44 = 60px) to eliminate double safe-area gap
  assert.ok(html.includes('translate3d(0, 60px, 0)'));
  assert.ok(html.includes('~0.2cr'));

  const offlineHtml = renderToStaticMarkup(
    React.createElement(CompactFilterBar, {
      isVisible: true,
      isHeaderHidden: false,
      headerHeight: 60,
      categories: [],
      selectedCateIds: [],
      categoryMatchCounts: new Map(),
      language: 'en',
      query: '',
      searchPageSize: 100,
      isSearching: false,
      isSingleLinkValid: false,
      isLinkOrId: false,
      leanSearchCost: 0.2,
      isOffline: true,
      t: TRANSLATIONS.en,
      onToggleCategory: () => {},
      onOpenSearchDrawer: () => {},
    })
  );
  assert.ok(offlineHtml.includes('disabled=""') || offlineHtml.includes('disabled'));

  const backHistorySrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/backHistory.ts'),
    'utf8'
  );
  assert.ok(backHistorySrc.includes('history.pushState'));
  assert.ok(backHistorySrc.includes('history.back'));
});

test('Phase 2 P1: BottomSheet provides nest-safe scroll lock, focus trap, visualViewport keyboard offset, and swipe dismiss', () => {
  const src = fs.readFileSync(path.resolve(process.cwd(), 'src/components/BottomSheet.tsx'), 'utf8');
  assert.ok(src.includes('bodyScrollLockCount'));
  assert.ok(src.includes('activeSheetStack'));
  assert.ok(src.includes('window.visualViewport'));
  assert.ok(src.includes('data-sheet-handle'));
  assert.ok(src.includes('data-sheet-scroll'));
  assert.ok(src.includes("e.key === 'Tab'"));
  assert.ok(src.includes("e.key === 'Escape'"));
  assert.ok(src.includes('useBackHistoryLayer'));

  const customSelectSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/CustomSelect.tsx'),
    'utf8'
  );
  assert.ok(customSelectSrc.includes('window.innerWidth < 640'));
  assert.ok(customSelectSrc.includes('<BottomSheet'));
  assert.ok(customSelectSrc.includes('min-h-[44px]'));
});

test('Phase 2 P1: ProductCard collapses secondary metrics below lg on spacious mobile cards & enables Myanmar typography + select-text opt-in', () => {
  const html = renderToStaticMarkup(
    React.createElement(ProductCard, {
      product: makeProduct(),
      index: 0,
      language: 'my',
      isSaved: false,
      viewMode: 'grid',
      density: 'spacious',
      nowMs: Date.UTC(2026, 10, 26, 12, 0, 0),
      t: TRANSLATIONS.my,
      onSelect: () => {},
      onToggleSave: () => {},
      onOpenScoreDetails: () => {},
    })
  );

  assert.ok(html.includes('hidden lg:block space-y-2.5'));
  assert.ok(html.includes(TRANSLATIONS.my.card.showDetailsToggle));
  assert.ok(html.includes('leading-[1.55]'));
  assert.ok(html.includes('select-text'));
  assert.ok(html.includes('before:-inset-1'));

  const indexCss = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
  assert.ok(indexCss.includes('.select-text'));
  assert.ok(indexCss.includes('[data-selectable="true"]'));
  assert.ok(indexCss.includes('html[data-lang="my"]'));
});

test('Phase 2 P1: VideoStudioView includes sticky section nav, busy Back guard, select-text (no select-all), and offline action states', () => {
  const prePlanHtml = renderToStaticMarkup(
    React.createElement(VideoStudioView, {
      product: makeProduct(),
      isSaved: false,
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
      returnTab: 'discover',
      language: 'my',
      nowMs: Date.UTC(2026, 10, 26, 12, 0, 0),
      kalodataStatus: { connected: true, keySource: 'ui', maskedKey: 'kalo***', balance: null },
      kalodataLimits: { maxSpendCredits: null, minBalanceReserve: null, trackedSpentCredits: 0 },
      isOffline: true,
      isBottomNavHidden: false,
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
  assert.ok(prePlanHtml.includes(TRANSLATIONS.my.kalodata.offlineNotice));

  const studioHtml = renderToStaticMarkup(
    React.createElement(VideoStudioView, {
      product: makeProduct(),
      isSaved: false,
      plan: makeVideoPlan(),
      style: 'cinematic',
      savedStyles: ['cinematic'],
      isGenerating: false,
      isEnrichingProduct: false,
      isAnalyzingProduct: false,
      enrichError: null,
      analysisError: null,
      error: null,
      cameFromHistory: false,
      returnTab: 'discover',
      language: 'my',
      nowMs: Date.UTC(2026, 10, 26, 12, 0, 0),
      kalodataStatus: { connected: true, keySource: 'ui', maskedKey: 'kalo***', balance: null },
      kalodataLimits: { maxSpendCredits: null, minBalanceReserve: null, trackedSpentCredits: 0 },
      isOffline: true,
      isBottomNavHidden: false,
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

  assert.ok(studioHtml.includes('sticky top-[calc(3.5rem+env(safe-area-inset-top))]'));
  assert.ok(studioHtml.includes('select-text'));
  assert.ok(!studioHtml.includes('select-all'));

  const studioSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/VideoStudioView.tsx'),
    'utf8'
  );
  assert.ok(studioSrc.includes('studio_busy_guard'));
  assert.ok(studioSrc.includes('studio_leave_confirm'));
  assert.ok(studioSrc.includes('showScrollTop'));
  assert.ok(studioSrc.includes('onNotifyToast'));

  const aiCardSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/AiChatPromptCard.tsx'),
    'utf8'
  );
  assert.ok(!aiCardSrc.includes('select-all'));
  assert.ok(aiCardSrc.includes('select-text'));
});

test('Phase 2 P1: App.tsx wires mobile 2-col default, floating Filter · Sort pill, offline guard, balance warning, and .select-text long-press opt-in', () => {
  const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.ok(appSrc.includes("viewportTier === 'mobile' ? 2"));
  assert.ok(appSrc.includes('.select-text, [data-selectable="true"]'));
  assert.ok(appSrc.includes('insufficientBalanceWarning'));
  assert.ok(appSrc.includes('floatingFilterBtn'));
  assert.ok(appSrc.includes("window.addEventListener('offline', handleOffline)"));
  assert.ok(appSrc.includes('t.kalodata.offlineNotice'));
});

