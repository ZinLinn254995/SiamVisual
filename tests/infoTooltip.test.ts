import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiChatPromptCard } from '../src/components/AiChatPromptCard.tsx';
import { DiscoveryFilterBar } from '../src/components/DiscoveryFilterBar.tsx';
import { HistoryView } from '../src/components/HistoryView.tsx';
import { InfoTooltip } from '../src/components/InfoTooltip.tsx';
import { KalodataBar } from '../src/components/KalodataBar.tsx';
import { ProductRankBoardView } from '../src/components/ProductRankBoardView.tsx';
import { ScoreDetailContent } from '../src/components/ScoreDetailDialog.tsx';
import { SearchHistoryView } from '../src/components/SearchHistoryView.tsx';
import { VideoStudioView } from '../src/components/VideoStudioView.tsx';
import { TRANSLATIONS } from '../src/i18n.ts';
import { DEFAULT_DISCOVERY_FILTER_STATE } from '../src/lib/discoveryFilterEngine.ts';
import type { ProductItem } from '../src/types.ts';

function makeProduct(): ProductItem {
  return {
    id: '172999888777',
    thaiTitle: 'เซรั่มบำรุงผิวหน้า วิตามินซี 30ml',
    clearTitle: { my: 'Vitamin C Serum', en: 'Vitamin C Serum' },
    whatItIs: { my: '', en: '' },
    whySilentWorks: { my: '', en: '' },
    category: 'beauty',
    categoryLabel: { my: 'အလှကုန်', en: 'Beauty & Personal Care' },
    kalodataCategoryId: '601450',
    shopName: 'GlowTH',
    priceThb: 299,
    commissionRate: 15,
    commissionThb: 44.85,
    visualTags: [],
    kalodataMetrics: {
      salesVolume7d: 850,
      revenueThb7d: 254150,
      videoRevenueThb7d: 180000,
      liveRevenueThb7d: 40000,
      shoppingMallRevenueThb7d: 34150,
      revenueGrowthRate: 14.5,
      dateRange: 'last7Day',
    },
    imageUrl: '',
    scoreBreakdown: {
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

test('InfoTooltip renders SSR-safe trigger and accessible sr-only explanation for content, bullets, and footer', () => {
  const html = renderToStaticMarkup(
    React.createElement(InfoTooltip, {
      title: 'Guide Title',
      content: ['Primary explanation', 'Secondary note'],
      bullets: ['Point one', 'Point two'],
      footer: 'Footer disclaimer',
      ariaLabel: 'Open guide',
      size: 'md',
    })
  );

  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(html.includes('aria-label="Open guide"'));
  assert.ok(html.includes('role="tooltip"'));
  assert.ok(html.includes('Guide Title'));
  assert.ok(html.includes('Primary explanation'));
  assert.ok(html.includes('Secondary note'));
  assert.ok(html.includes('Point one'));
  assert.ok(html.includes('Point two'));
  assert.ok(html.includes('Footer disclaimer'));

  const emptyHtml = renderToStaticMarkup(
    React.createElement(InfoTooltip, { content: '   ' })
  );
  assert.equal(emptyHtml, '');
});

test('Simplified SiamVisual views omit InfoTooltip clutter and retain primary controls in MY & EN', () => {
  const product = makeProduct();

  for (const lang of ['my', 'en'] as const) {
    const t = TRANSLATIONS[lang];

    const kalodataHtml = renderToStaticMarkup(
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
    assert.ok(!kalodataHtml.includes('role="tooltip"'));
    assert.ok(!kalodataHtml.includes(t.kalodata.subtitle));
    assert.ok(kalodataHtml.includes(t.kalodata.connectBtn));

    const filterHtml = renderToStaticMarkup(
      React.createElement(DiscoveryFilterBar, {
        state: DEFAULT_DISCOVERY_FILTER_STATE,
        counts: {
          totalCount: 10,
          filteredCount: 8,
          monetizableCount: 9,
          notMonetizableCount: 1,
          videoProvenCount: 6,
          strongEarningsCount: 5,
          risingTrendCount: 4,
          activeFilterCount: 0,
        },
        t,
        onChange: () => {},
      })
    );
    assert.ok(!filterHtml.includes('role="tooltip"'));
    assert.ok(filterHtml.includes(t.v2.discoveryFilter.presets.all));
    assert.ok(filterHtml.includes(t.v2.discoveryFilter.sortOptions.search_score_desc));

    const historyHtml = renderToStaticMarkup(
      React.createElement(HistoryView, {
        entries: [],
        recentSearchesCount: 0,
        language: lang,
        t,
        onOpenEntry: () => {},
        onDeleteEntry: () => {},
        onExportBackup: () => {},
        onImportBackupFile: () => {},
        onGoDiscover: () => {},
      })
    );
    assert.ok(!historyHtml.includes('role="tooltip"'));
    assert.ok(!historyHtml.includes(t.history.subtitle));
    assert.ok(historyHtml.includes(t.history.goDiscover));

    const searchHistoryHtml = renderToStaticMarkup(
      React.createElement(SearchHistoryView, {
        entries: [],
        activeRecentId: null,
        language: lang,
        t,
        onOpenEntry: () => {},
        onDeleteEntry: () => {},
        onClearAll: () => {},
        onGoDiscover: () => {},
      })
    );
    assert.ok(!searchHistoryHtml.includes('role="tooltip"'));
    assert.ok(!searchHistoryHtml.includes(t.searchHistoryPage.subtitle));
    assert.ok(searchHistoryHtml.includes(t.searchHistoryPage.goDiscover));

    const promptHtml = renderToStaticMarkup(
      React.createElement(AiChatPromptCard, { product, t })
    );
    assert.ok(!promptHtml.includes('role="tooltip"'));
    assert.ok(!promptHtml.includes(t.studio.chatPrompt.subtitle));
    assert.ok(promptHtml.includes(t.studio.chatPrompt.copyBtn));

    const scoreHtml = renderToStaticMarkup(
      React.createElement(ScoreDetailContent, {
        product,
        language: lang,
        nowMs: Date.UTC(2026, 10, 26, 12, 0, 0),
        t,
        onClose: () => {},
      })
    );
    assert.ok(!scoreHtml.includes('role="tooltip"'));
    assert.ok(!scoreHtml.includes(t.score.dialogSubtitle));
    assert.ok(scoreHtml.includes(t.v2.searchScore.compositionTitle));

    const rankBoardHtml = renderToStaticMarkup(
      React.createElement(ProductRankBoardView, {
        snapshot: null,
        dateRange: 'last7Day',
        isSyncing: false,
        syncError: null,
        limitWarning: null,
        kalodataStatus: { connected: false, keySource: 'none', maskedKey: null, balance: null },
        savedProductIds: new Set<string>(),
        language: lang,
        nowMs: Date.UTC(2026, 10, 26, 12, 0, 0),
        t,
        onChangeDateRange: () => {},
        onSync: () => {},
        onOpenConnectPanel: () => {},
        onSelectProduct: () => {},
        onToggleSaveProduct: () => {},
      })
    );
    assert.ok(!rankBoardHtml.includes('role="tooltip"'));
    assert.ok(!rankBoardHtml.includes(t.rankBoard.subtitle));
    assert.ok(rankBoardHtml.includes(t.nav.connectApiShort));

    const studioProps = {
      product,
      isSaved: false,
      ideaPlans: {},
      generatingIdeaIndex: null,
      planErrorByIdea: {},
      isEnrichingProduct: false,
      isAnalyzingProduct: false,
      enrichError: null,
      analysisError: null,
      cameFromHistory: false,
      language: lang,
      nowMs: Date.UTC(2026, 10, 26, 12, 0, 0),
      kalodataStatus: { connected: true, keySource: 'ui' as const, maskedKey: 'kalo***', balance: null },
      kalodataLimits: { maxSpendCredits: null, minBalanceReserve: null, trackedSpentCredits: 0 },
      t,
      onBack: () => {},
      onToggleSave: () => {},
      onGenerateIdeaPlan: () => {},
      onFetchDeepInsights: async () => {},
      onAnalyzeProduct: async () => {},
      onOpenScoreDetails: () => {},
    };

    const studioIdeasHtml = renderToStaticMarkup(
      React.createElement(VideoStudioView, { ...studioProps, initialSubpage: 'ideas' })
    );
    assert.ok(!studioIdeasHtml.includes('role="tooltip"'));
    assert.ok(!studioIdeasHtml.includes(t.studio.commercialStudioNotice));
    assert.ok(!studioIdeasHtml.includes(t.studio.analysisSubtitle));
    assert.ok(studioIdeasHtml.includes(t.studio.analysisBtn));

    const studioPromptHtml = renderToStaticMarkup(
      React.createElement(VideoStudioView, { ...studioProps, initialSubpage: 'prompt' })
    );
    assert.ok(!studioPromptHtml.includes('role="tooltip"'));
    assert.ok(studioPromptHtml.includes(t.studio.chatPrompt.copyBtn));
  }
});

