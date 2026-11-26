import type {
  CommercialEligibilityStatus,
  ConfidenceLevel,
  ConversionEvidenceLevel,
  DiscoveryShortlistCategory,
  DominantConversionChannel,
  HistoricalTrendClassification,
  HistoricalTrendMetricKey,
  Language,
  OpportunityClassification,
  StrategyEligibilityStatus,
  StrategyId,
  V2DimensionStatus,
  VisualStyle,
} from './types';
import type {
  DiscoveryPriceBand,
  DiscoveryShortlistPreset,
  DiscoverySortMode,
} from './lib/discoveryFilterEngine';
import type { MetricFieldKey, MetricProvenanceCategory } from './lib/productIntelligenceView';
import type {
  SearchDominantChannel,
  SearchScoreCapCode,
  SearchScoreGrade,
} from './lib/searchScoreEngine';

export interface Translations {
  nav: {
    discover: string;
    rankBoard: string;
    searchHistory: string;
    history: string;
    toggleThemeLight: string;
    toggleThemeDark: string;
    connectApiShort: string;
    creditsShort: string;
  };
  search: {
    placeholder: string;
    openSearchBoxBtn: string;
    closeSearchBoxBtn: string;
    searchButton: string;
    searchingButton: string;
    searchSingleButton: string;
    multiCategoryHint: string;
    selectedCount: (n: number) => string;
    clearCategories: string;
    syncCategoriesBtn: string;
    syncingCategoriesBtn: string;
    liveSyncedTag: string;
    linkModeNotice: (productId: string) => string;
    shortLinkNotice: string;
    invalidLinkNotice: string;
  };
  discover: {
    resultsHeading: string;
    singleResultHeading: string;
    resultsSubtext: string;
    singleResultSubtext: string;
    noResultsTitle: string;
    noResultsDesc: string;
    retry: string;
    loadingNote: string;
    loadingSingleNote: string;
    cachedNote: string;
    refreshLiveBtn: string;
    staleSnapshotNotice: string;
    aiFallbackNotice: string;
    retryAiBtn: string;
    retryingAiBtn: string;
    filteredEmptyTitle: string;
    filteredEmptyDesc: (total: number) => string;
    searchSelectedCategoryBtn: string;
    clearFilterBtn: string;
    filteredCountNote: (shown: number, total: number) => string;
    viewList: string;
    viewGrid: string;
    gridColsLabel: (n: number) => string;
    openStudioShort: string;
    zoomIn: string;
    zoomOut: string;
    pinchZoomHint: string;
    microViewTag: string;
    listCompactTag: string;
    listDetailedTag: string;
    emptyGuideTitle: string;
    emptyGuideDesc: string;
    emptyGuidePoints: string[];
    emptyGuideDisclaimer: string;
  };
  card: {
    thaiOriginal: string;
    whatItIs: string;
    silentEdge: string;
    price: string;
    commission: string;
    sales7d: string;
    videoRev7d: string;
    revenue7d: string;
    unitsSuffix: string;
    perSale: string;
    createPlan: string;
    openSavedPlan: string;
    savedTag: string;
    saveShort: string;
    saveProduct: string;
    unsaveProduct: string;
    savedProductToast: string;
    removedProductToast: string;
    analyzedTag: string;
    deepDataTag: string;
    copyThai: string;
    copyId: string;
    copiedShort: string;
    explainAiBtn: string;
    explainingAiBtn: string;
    explainAllBtn: string;
    explainingAllBtn: string;
    aiExplainedTag: string;
    openTikTokShop: string;
    openTikTokShort: string;
  };
  score: {
    tooltipBtn: string;
    dialogSubtitle: string;
    metricVisualLabel: string;
    metricVisualDesc: string;
    metricAiLabel: string;
    metricAiDesc: string;
    metricDemandLabel: string;
    metricDemandDesc: string;
    metricCommissionLabel: string;
    metricCommissionDesc: string;
    penaltyLabel: string;
    penaltyDesc: string;
    ptsUnit: string;
    closeBtn: string;
    grades: {
      top: string;
      strong: string;
      fair: string;
      low: string;
    };
  };
  recent: {
    heading: string;
    savedLocallyTag: string;
    clearAll: string;
    defaultBestLabel: string;
    linkLabel: string;
    itemsCount: (n: number) => string;
    loadedFromStorageNote: string;
    viewingOlderNote: string;
    backToLatestBtn: string;
    viewAllHistoryBtn: string;
    removeAria: string;
  };
  searchHistoryPage: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    totalCount: (n: number) => string;
    clearAllBtn: string;
    confirmClearAll: string;
    cancel: string;
    latestTag: string;
    modeCategory: string;
    modeKeyword: string;
    modeLink: string;
    modeDefault: string;
    openResultsBtn: string;
    deleteBtn: string;
    confirmDelete: string;
    emptyTitle: string;
    emptyDesc: string;
    noFilterMatches: string;
    goDiscover: string;
    creditsSpent: (c: number) => string;
  };
  studio: {
    backToResults: string;
    backToRankBoard: string;
    backToHistory: string;
    copyFullKit: string;
    copied: string;
    copy: string;
    regenerate: string;
    styleLabel: string;
    generatingTitle: string;
    generatingDesc: string;
    autoSaved: string;
    sectionConcept: string;
    sectionHooks: string;
    sectionStoryboard: string;
    sectionPrompts: string;
    sectionSeo: string;
    jumpConcept: string;
    jumpHooks: string;
    jumpScript: string;
    jumpPrompts: string;
    jumpSeo: string;
    jumpMaster?: string;
    masterPromptTitle: string;
    masterPromptSub: string;
    visualDirectionLabel: string;
    onScreenThaiLabel: string;
    meaningLabel: string;
    timeCol: string;
    visualCol: string;
    soundCol: string;
    screenTextCol: string;
    videoPromptsSub: string;
    imagePromptsSub: string;
    thaiCaptionLabel: string;
    hashtagsLabel: string;
    keywordsLabel: string;
    postingTipLabel: string;
    copyAllHashtags: string;
    noSpeechNote: string;
    copyThaiText: string;
    deepToggleTitle: string;
    deepToggleHint: string;
    deepOptDetailTitle: string;
    deepOptDetailDesc: string;
    deepOptSpecsTitle: string;
    deepOptSpecsDesc: string;
    deepOptCommentsTitle: string;
    deepOptCommentsDesc: string;
    deepFetchBtn: (cost: number) => string;
    deepFetchingBtn: string;
    deepFetchedBadge: string;
    deepHighlightsLabel: string;
    deepPainPointsLabel: string;
    deepUsageLabel: string;
    deepDescLabel: string;
    deepUpgradedToast: string;
    deepPartialWarning: (layers: string[]) => string;
    growthUnverifiedShort: string;
    deepSelectOneHint: string;
    deepSavedTag: string;
    deepSavedStorageNote: string;
    deepDataHeading: string;
    deepCopyDataBtn: string;
    deepManageFetchBtn: string;
    deepHideFetchBtn: string;
    deepMetricShop: string;
    deepMetricLiveRev7d: string;
    deepMetricCreators: string;
    deepMetricRating: string;
    deepNoDescReturned: string;
    deepNoSpecsReturned: string;
    deepNoCommentsReturned: string;
    deepShowMore: string;
    deepShowLess: string;
    readyTitle: string;
    readyDesc: string;
    generateNowBtn: string;
    confirmGenTitle: string;
    confirmRegenTitle: string;
    confirmGenDesc: string;
    confirmStyleLabel: string;
    confirmDeepIncluded: string;
    confirmDeepNotIncluded: string;
    confirmProceedBtn: string;
    confirmCancelBtn: string;
    savedStyleMark: string;
    videoSectionTitle: string;
    commercialStudioNotice: string;
    analysisTitle: string;
    analysisSubtitle: string;
    analysisBtn: string;
    analysisReBtn: string;
    analysisRunningBtn: string;
    analysisCopyBtn: string;
    analysisSavedTag: string;
    analysisStaleHint: string;
    analysisDataSourcesLabel: string;
    analysisSrcSales: string;
    analysisSrcDetails: string;
    analysisSrcSpecs: string;
    analysisSrcReviews: string;
    analysisAvailable: string;
    analysisNotAvailable: string;
    analysisMetricPrice: string;
    analysisMetricCommission: string;
    analysisMetricSales7d: string;
    analysisMetricRevenue7d: string;
    analysisMetricVideoRev7d: string;
    analysisMetricGrowth: string;
    analysisSecIdentity: string;
    analysisSecSalesPricing: string;
    analysisSecProfitMath: string;
    analysisSecSilentAd: string;
    analysisSecVisualAngles: string;
    analysisSecSpecs: string;
    analysisSecBuyers: string;
    analysisSecRisks: string;
    analysisSecMissing: string;
    analysisDecisions: {
      strong_go: string;
      test_carefully: string;
      need_more_data: string;
    };
    videoIdeas: {
      briefTitle: string;
      briefToggleShow: string;
      briefToggleHide: string;
      playbookLabel: string;
      playbooks: {
        problem_solving: string;
        impulse_trendy: string;
        aesthetic_lifestyle: string;
        high_ticket_trust: string;
        food_beverage: string;
      };
      awarenessLevels: {
        unaware: string;
        problem_aware: string;
        solution_aware: string;
        product_aware: string;
        most_aware: string;
      };
      frameworks: {
        PAS: string;
        BAB: string;
        AIDA: string;
        '3_REASONS_WHY': string;
      };
      featureLabel: string;
      benefitLabel: string;
      emotionLabel: string;
      uspLabel: string;
      visualProofLabel: string;
      audienceLabel: string;
      painLadderLabel: string;
      buyerVoiceLabel: string;
      ideaTabLabel: (index: number) => string;
      copyIdeaBtn: string;
      angleLabel: string;
      formatLabel: string;
      targetLabel: string;
      durationLabel: string;
      hookSectionLabel: string;
      visualHookLabel: string;
      verbalHookLabel: string;
      textHookLabel: string;
      bridgeSectionLabel: string;
      bodySectionLabel: string;
      ctaSectionLabel: string;
      muteTestLabel: string;
      extraHooksLabel: string;
      scalingTitle: string;
      commentMiningLabel: string;
      iterationRoadmapLabel: string;
      watchOutsLabel: string;
    };
    chatPrompt: {
      title: string;
      compatibleTag: string;
      subtitle: string;
      copyBtn: string;
      copiedBtn: string;
      previewBtn: string;
      hidePreviewBtn: string;
      expandAria: string;
      collapseAria: string;
      packedDataLabel: string;
      includedShort: string;
      notYetShort: string;
      benchmarkDefault: string;
      benchmarkWithRef: string;
      modeLabel: string;
      modes: {
        full: string;
        analysis: string;
        video_plan: string;
      };
      outputLangLabel: string;
      outputLangs: {
        bilingual: string;
        my: string;
        en: string;
      };
      competitorSectionTitle: string;
      competitorDefaultNote: string;
      addRefBtn: string;
      hideRefBtn: string;
      competitorUrlLabel: string;
      competitorUrlPlaceholder: string;
      competitorNotesLabel: string;
      competitorNotesPlaceholder: string;
      stepSyncHint: string;
    };
  };
  styles: Record<VisualStyle, string>;
  history: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    backupBtn: string;
    restoreBtn: string;
    emptyTitle: string;
    emptyDesc: string;
    goDiscover: string;
    openPlan: string;
    deleteBtn: string;
    confirmDelete: string;
    cancel: string;
    backupSuccess: string;
    restoreSuccessCount: (added: number, total: number) => string;
    restoreSuccessWithSearches: (added: number, total: number, searchesAdded: number) => string;
    restoreError: string;
    noFilterMatches: string;
    clearFilterAria: string;
    savedCount: (n: number) => string;
  };
  kalodata: {
    title: string;
    subtitle: string;
    openCenterLink: string;
    inputPlaceholder: string;
    pasteBtn: string;
    connectBtn: string;
    connectingBtn: string;
    connectedBadge: string;
    mainAccount: string;
    subAccount: string;
    creditBalanceLabel: string;
    creditsUnit: string;
    balanceUnavailable: string;
    refreshBalance: string;
    changeKey: string;
    disconnect: string;
    closeBtn: string;
    cancel: string;
    lastSearchUsed: string;
    connectRequiredError: string;
    pasteDeniedNote: string;
    connectedToast: string;
    disconnectedToast: string;
    refreshedToast: string;
    categoriesSyncedToast: string;
    limitBtn: string;
    limitTitle: string;
    maxSpendLabel: string;
    maxSpendPlaceholder: string;
    minReserveLabel: string;
    minReservePlaceholder: string;
    spentCounterLabel: string;
    resetSpentBtn: string;
    saveLimitBtn: string;
    clearLimitBtn: string;
    limitSavedToast: string;
    limitExceededMaxSpend: (spent: number, est: number, max: number) => string;
    limitExceededReserve: (balance: number, est: number, reserve: number) => string;
  };
  v2: {
    engineBadge: string;
    overallTabLabel: string;
    overallTabShort: string;
    overallDescription: string;
    commercialScoreLabel: string;
    commercialScoreShort: string;
    strategyScoreLabel: string;
    strategyScoreShort: string;
    rankingTransparencyNote: string;
    withheldLabel: string;
    withheldZeroCommLabel: string;
    dimensionsHeading: string;
    dimensions: {
      demand: { label: string; short: string; desc: string };
      earning: { label: string; short: string; desc: string };
      competition: { label: string; short: string; desc: string };
      quality: { label: string; short: string; desc: string };
    };
    dimensionStatus: Record<V2DimensionStatus, string>;
    classifications: Record<OpportunityClassification, string>;
    commercialEligibility: Record<CommercialEligibilityStatus, string>;
    strategyEligibility: Record<StrategyEligibilityStatus, string>;
    confidenceLabel: string;
    confidenceLevels: Record<ConfidenceLevel, string>;
    confidenceBreakdown: {
      completeness: string;
      provenance: string;
      freshness: string;
      validity: string;
      dimensionCoverage: string;
    };
    conversionLabel: string;
    conversionLevels: Record<ConversionEvidenceLevel, string>;
    conversionChannels: Record<DominantConversionChannel, string>;
    conversionDisclaimerShort: string;
    strategies: Record<
      StrategyId,
      {
        name: string;
        shortName: string;
        desc: string;
        minimumRule: string;
        exclusionRule: string;
      }
    >;
    strategyExplorer: {
      title: string;
      subtitle: string;
      overallCountLabel: (n: number) => string;
      qualifiedCountLabel: (n: number) => string;
      excludedCountLabel: (n: number) => string;
      showExcludedBtn: (n: number) => string;
      hideExcludedBtn: string;
      excludedSectionTitle: string;
      excludedSectionSub: string;
      noQualifiedTitle: string;
      noQualifiedDesc: string;
      historyUnavailableTitle: string;
      historyUnavailableBadge: string;
      historyUnavailableDesc: string;
      historyUnavailableNote: string;
      smallPoolWarning: (n: number) => string;
      bestMatchLabel: string;
      noStrategyQualified: string;
      whyRankedBtn: string;
      hideReasonsBtn: string;
      whyRankedTitle: string;
      cautionsTitle: string;
      missingOrUnverifiedTitle: string;
      failedRequirementsTitle: string;
      viewFullBreakdownBtn: string;
      requiresHistoryBadge: string;
      primaryStrategyTag: string;
    };
    provenance: {
      sectionTitle: string;
      sectionSubtitle: string;
      metricCol: string;
      valueCol: string;
      statusCol: string;
      derivedTag: string;
      sourceTag: string;
      verifiedCountLabel: (verified: number, total: number) => string;
      cardUnverifiedNotice: (count: number) => string;
      categories: Record<MetricProvenanceCategory, string>;
      fields: Record<MetricFieldKey, string>;
      unverifiedCoreBanner: (count: number) => string;
      syntheticRevenueBanner: string;
    };
    dialog: {
      v2Subtitle: string;
      gateDecisionsTitle: string;
      overallInsightsTitle: string;
      dimensionSubmetrics: {
        revenueScore: string;
        salesScore: string;
        absDemand: string;
        growthRate: string;
        payoutPerSale: string;
        commissionRate: string;
        creators: string;
        rawRpc: string;
        adjustedRpc: string;
        bayesianRating: string;
        rawRating: string;
        reviews: string;
      };
      usedMetricsLabel: string;
      excludedMetricsLabel: string;
      conversionSectionTitle: string;
      videoShareLabel: string;
      liveShareLabel: string;
      strategyMatrixTitle: string;
      strategyMatrixSub: string;
      studioVisualRefTitle: string;
      studioVisualRefNotice: string;
      v1SilentScoreLabel: string;
      pillarsSummaryTitle: string;
      pillarCommercial: string;
      pillarConversion: string;
      pillarVideo: string;
      pillarConfidence: string;
      nonGuaranteeDisclaimer: string;
      evidenceSummary: {
        sectionTitle: string;
        whyDiscoveredLabel: string;
        factsTitle: string;
        derivedTitle: string;
        unavailableTitle: string;
        heuristicsTitle: string;
        statusLabels: {
          QUALIFIED: string;
          PRELIMINARY: string;
          NOT_MONETIZABLE: string;
          INSUFFICIENT_DATA: string;
        };
      };
    };
    riskLabels: Record<string, string>;
    formatRiskTag: (tag: string) => string;
    metricsShort: {
      creators: string;
      adjRpc: string;
      growth: string;
      payout: string;
      rating: string;
      reviews: string;
      videoShare: string;
      liveRev: string;
      unverified: string;
      missing: string;
    };
    discoveryShortlist: {
      signalLabel: string;
      preliminaryTag: string;
      verifiedQualifiedTag: string;
      snapshotHistoryLabel: (count: number) => string;
      categories: Record<DiscoveryShortlistCategory, string>;
    };
    historicalTrend: {
      sectionTitle: string;
      sectionSubtitle: string;
      trustScopeLabel: string;
      metricCol: string;
      rangeCol: string;
      deltaCol: string;
      statusCol: string;
      zeroBaselineTag: string;
      allZeroTag: string;
      observationSpanLabel: (count: number, spanDays: number | null) => string;
      classifications: Record<HistoricalTrendClassification, string>;
      metrics: Record<HistoricalTrendMetricKey, string>;
    };
    detailTrend: {
      sectionTitle: string;
      sectionSubtitle: string;
      last7VsPrev7: string;
      dailyAvg: string;
      dailyRange: string;
      activeDays: string;
      activeCreatorsLabel: (windowTag: string) => string;
      revPerActiveCreatorLabel: string;
      lifetimeReviewsLabel: string;
      informationalScopeNote: string;
      detailWindowLabel: string;
      detailWindow7d: string;
      detailWindow30d: string;
    };
    discoveryFilter: {
      barAriaLabel: string;
      presets: Record<DiscoveryShortlistPreset, string>;
      sortLabel: string;
      sortOptions: Record<DiscoverySortMode, string>;
      minCommissionLabel: string;
      minVideoShareLabel: string;
      priceBandLabel: string;
      anyOption: string;
      priceBands: Record<DiscoveryPriceBand, string>;
      resetBtn: string;
      showingCount: (shown: number, total: number) => string;
      zeroCreditHint: string;
      emptyTitle: string;
      emptyDesc: string;
      loadMoreBtn: (nextPage: number, pageSize?: number) => string;
      loadingMoreBtn: string;
      loadedMoreToast: (added: number, page: number, fromCache: boolean) => string;
      cachedSearchToast: string;
      allLoadedNote: (count: number) => string;
    };
    searchDrawer: {
      title: string;
      subtitle: string;
      closeAria: string;
      keywordOrLinkLabel: string;
      keywordOrLinkPlaceholder: string;
      keywordOrLinkHint: string;
      categoriesLabel: string;
      categoriesDisabledInLinkMode: string;
      countLabel: string;
      countUnit: (n: number) => string;
      recommendedTag: string;
      countCostNote: string;
      windowLabel: string;
      window7d: string;
      window30d: string;
      windowNote: string;
      affiliateFiltersLabel: string;
      affiliateFiltersHint: string;
      affiliateFiltersDisabledInLinkMode: string;
      presetLabel: string;
      resetDefaultsBtn: string;
      cancelBtn: string;
      submitRankBtn: (count: number, cost: number) => string;
      submitLinkBtn: (cost: number) => string;
      summaryRank: (count: number, windowTag: string, presetLabel: string, cost: number) => string;
      summaryLink: (productId: string, cost: number) => string;
      summaryShortLink: (cost: number) => string;
      activeScopeSummary: (count: number, windowTag: string, presetLabel: string) => string;
      openDrawerBtn: string;
    };
    searchScore: {
      title: string;
      badgeShort: string;
      subtitle: string;
      rankDataOnlyNote: string;
      deepStudioHint: string;
      rawScoreLabel: string;
      videoPoolLabel: string;
      payoutPerSaleLabel: string;
      videoShareLabel: string;
      dominantChannelLabel: string;
      capsTitle: string;
      compositionTitle: string;
      channelsTitle: string;
      priceSweetSpotTitle: string;
      earningSnapshotTitle: string;
      est100SalesLabel: string;
      dailyTrendTitle: string;
      activeCreatorsShort: string;
      channelShort: {
        video: string;
        live: string;
        mall: string;
      };
      priceZones: {
        sweet: string;
        mid: string;
        low: string;
        high: string;
      };
      pillars: {
        demand: { label: string; short: string; weightLabel: string };
        earning: { label: string; short: string; weightLabel: string };
        videoProof: { label: string; short: string; weightLabel: string };
        priceFit: { label: string; short: string; weightLabel: string };
      };
      grades: Record<SearchScoreGrade, string>;
      channels: Record<SearchDominantChannel, string>;
      caps: Record<SearchScoreCapCode, string>;
    };
  };
  rankBoard: {
    title: string;
    subtitle: string;
    syncBtn: (cost: number) => string;
    syncingBtn: string;
    timeframe7d: string;
    timeframe30d: string;
    lastSyncedLabel: string;
    productsUnit: (n: number) => string;
    categoriesUnit: (n: number) => string;
    staleNotice: string;
    emptyTitle: string;
    emptyDesc: string;
    emptyBullets: string[];
    emptyCtaBtn: (cost: number) => string;
    connectPromptNote: string;
    loadingNote: string;
    syncedToast: (count: number, catCount: number) => string;
    kpiGmvTitle: string;
    kpiGmvSub: (windowTag: string) => string;
    kpiUnitsTitle: string;
    kpiUnitsSub: (monetizable: number, total: number) => string;
    kpiVideoShareTitle: string;
    kpiVideoShareSub: (provenCount: number) => string;
    kpiAvgCommTitle: string;
    kpiAvgCommSub: (avgPayout: string, sweetSpot: number) => string;
    channelSectionTitle: string;
    channelSectionSub: string;
    channelVideo: string;
    channelLive: string;
    channelShop: string;
    channelDominantLabel: string;
    channelClickHint: string;
    categorySectionTitle: string;
    categorySectionSubLive: string;
    categorySectionSubAgg: string;
    categorySourceLiveTag: string;
    categorySourceAggTag: string;
    categoryTop100Count: (n: number) => string;
    categoryClickHint: string;
    matrixSectionTitle: string;
    matrixSectionSub: string;
    matrixSweetSpotLabel: string;
    matrixLegendVideo: string;
    matrixLegendLive: string;
    matrixLegendOther: string;
    matrixAxisPrice: string;
    matrixAxisComm: string;
    matrixTapHint: string;
    matrixInspectorEmpty: string;
    matrixOpenStudioBtn: string;
    tableSectionTitle: string;
    tableSectionSub: (shown: number, total: number) => string;
    searchPlaceholder: string;
    filterAll: string;
    filterVideoProven: string;
    filterHighComm: string;
    filterSweetSpot: string;
    clearAllFilters: string;
    activeCategoryFilter: (name: string) => string;
    activeChannelFilter: (name: string) => string;
    colRank: string;
    colProduct: string;
    colPrice: string;
    colRevenue: string;
    colUnits: string;
    colCommission: string;
    colPayout: string;
    colChannels: string;
    colScore: string;
    openStudioAction: string;
    noMatchesTitle: string;
    noMatchesDesc: string;
    sortLabel: string;
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  my: {
    nav: {
      discover: 'ရှာဖွေမယ်',
      rankBoard: 'အဆင့်ဇယား',
      searchHistory: 'ရှာဖွေမှုမှတ်တမ်း',
      history: 'သိမ်းထားပစ္စည်းများ',
      toggleThemeLight: 'Light Mode ပြောင်းမယ်',
      toggleThemeDark: 'Dark Mode ပြောင်းမယ်',
      connectApiShort: 'Kalodata ချိတ်ဆက်',
      creditsShort: 'cr',
    },
    search: {
      placeholder: 'Keyword သို့မဟုတ် Product Link ထည့်ရှာပါ...',
      openSearchBoxBtn: 'Keyword / Link ရှာမယ်',
      closeSearchBoxBtn: 'Search Box ပိတ်မယ်',
      searchButton: 'ရှာဖွေမယ်',
      searchingButton: 'ရှာဖွေနေသည်...',
      searchSingleButton: 'Link ပစ္စည်းရှာမယ်',
      multiCategoryHint: 'Category နှိပ်၍ လက်ရှိရလဒ်ကို ချက်ချင်းစစ်ကြည့်နိုင်သလို (0 cr)၊ ရှာဖွေမယ် နှိပ်၍ Live အသစ်ရှာနိုင်သည်',
      selectedCount: (n: number) => `${n} ခု ရွေးထားသည်`,
      clearCategories: 'ပြန်ဖြုတ်မယ်',
      syncCategoriesBtn: 'Live Categories ယူမယ် (~0.2 cr)',
      syncingCategoriesBtn: 'စစ်ယူနေသည်...',
      liveSyncedTag: 'ထိုင်း Live Categories',
      linkModeNotice: (productId: string) =>
        `Product Link (ID: ${productId}) — ဒီပစ္စည်း ၁ ခုတည်းကိုသာ ရှာပေးပါမည် (~0.2 cr · Product Detail)`,
      shortLinkNotice:
        'TikTok Shop App Short Link တွေ့ရှိပြီး — ရှာဖွေနှိပ်လိုက်ပါက Product ID ကို အလိုအလျောက် ဖွင့်ထုတ်ပြီး ဒီပစ္စည်း ၁ ခုတည်းကိုသာ စစ်ပေးပါမည် (~0.2 cr)',
      invalidLinkNotice:
        'ဒီ Link ထဲမှာ TikTok Shop Product ID မတွေ့ပါ — Product ID ပါသော Link အပြည့်အစုံ (သို့) ဂဏန်း ID ထည့်ပေးပါ။',
    },
    discover: {
      resultsHeading: 'Affiliate Product Discovery',
      singleResultHeading: 'Link မှ ရှာတွေ့သော ပစ္စည်း',
      resultsSubtext:
        'ဝယ်လိုအား၊ ကော်မရှင်အမြတ်၊ Video ရောင်းအားသက်သေ နှင့် ဈေးနှုန်းသင့်တော်မှု ၄ ချက်ဖြင့် Search အမှတ် (0–100) စီပေးထားပါသည်။',
      singleResultSubtext: 'သင်ထည့်ထားသော Product Link မှ တိုက်ရိုက်ရယူထားသော အချက်အလက်ဖြစ်ပါသည်။',
      noResultsTitle: 'ကိုက်ညီသော ပစ္စည်းမတွေ့သေးပါ',
      noResultsDesc: 'အခြား Keyword၊ Category သို့မဟုတ် Product Link ဖြင့် ထပ်မံရှာဖွေကြည့်ပါ။',
      retry: 'ပြန်လည်ကြိုးစားမယ်',
      loadingNote: 'Kalodata Thailand TikTok Shop မှ အကောင်းဆုံး ပစ္စည်းများကို ရှာဖွေနေပါသည်...',
      loadingSingleNote: 'သင်ထည့်ထားသော Link မှ Product အချက်အလက်ကို ရှာဖွေနေပါသည်...',
      cachedNote: 'Cache မှ ပြသထားသည် (0 cr)',
      refreshLiveBtn: 'Live ပြန်ဆွဲမယ် (~0.2 cr)',
      staleSnapshotNotice: 'ဤရလဒ်သည် ၂၄ နာရီကျော်ကြာပြီဖြစ်၍ Stale ဖြစ်နေပါသည် — လက်ရှိဈေးကွက်အတွက် Live ပြန်ဆွဲပေးပါ။',
      aiFallbackNotice:
        'Kalodata ပစ္စည်းစာရင်း ရရှိပြီးပါပြီ (Credit မဆုံးရှုံးပါ) — AI ရှင်းပြချက် ခဏမအောင်မြင်၍ အခမဲ့ပြန်ထုတ်နိုင်ပါသည်။',
      retryAiBtn: 'AI ရှင်းပြချက် ပြန်ထုတ်မယ် (0 Kalodata cr)',
      retryingAiBtn: 'AI ရှင်းပြချက် ထုတ်နေသည်...',
      filteredEmptyTitle: 'လက်ရှိရလဒ်ထဲတွင် ရွေးထားသော Category ပစ္စည်း မတွေ့ပါ',
      filteredEmptyDesc: (total: number) =>
        `လက်ရှိပြသထားသော ပစ္စည်း ${total} ခုထဲတွင် မပါဝင်သေးပါ — ရွေးထားသော Category ဖြင့် Live အသစ်ရှာနိုင်သည် သို့မဟုတ် Filter ဖြုတ်၍ အားလုံးပြန်ကြည့်နိုင်ပါသည်။`,
      searchSelectedCategoryBtn: 'ရွေးထားသော Category ဖြင့် Live ရှာမယ်',
      clearFilterBtn: 'Filter ဖြုတ်ပြီး အားလုံးကြည့်မယ် (0 cr)',
      filteredCountNote: (shown: number, total: number) =>
        `Filter ဖြင့် ${shown} / ${total} ခု ပြသနေသည် (0 cr)`,
      viewList: 'List View',
      viewGrid: 'Grid View',
      gridColsLabel: (n: number) => `${n} ကော်လံ`,
      openStudioShort: 'Studio',
      zoomIn: 'ပုံကြီးချဲ့မယ်',
      zoomOut: 'ပုံသေးချုံ့မယ်',
      pinchZoomHint: 'လက်နှစ်ချောင်းဖြင့် Zoom ချဲ့/ချုံ့နိုင်သည်',
      microViewTag: 'ပုံ + နာမည်',
      listCompactTag: 'ကျစ်လစ်',
      listDetailedTag: 'အပြည့်အစုံ',
      emptyGuideTitle: 'Search အမှတ် (0–100) ဖြင့် Affiliate ပစ္စည်းရှာဖွေပါ',
      emptyGuideDesc:
        'Category၊ Keyword သို့မဟုတ် TikTok Shop Product Link ထည့်ရှာလိုက်သည်နှင့် 0.20 cr Search Data မှ အချက် ၄ ချက်ဖြင့် အလိုအလျောက် အမှတ်ပေးစီပေးပါမည်။',
      emptyGuidePoints: [
        'ဝယ်လိုအား (30%) နှင့် ကော်မရှင်အမြတ် (30%) — ရောင်းအား၊ ဝင်ငွေနှင့် ၁ ခုရောင်းရလျှင် ရမည့် ဘတ်ငွေကို တွက်ချက်သည်',
        'Video ရောင်းအားသက်သေ (25%) — Short Video ရောင်းအားအချိုးနှင့် Video ကော်မရှင်အိုးကို တိုင်းတာသည်',
        'ဈေးနှုန်းသင့်တော်မှု (15%) — TikTok Short Video ဝယ်ယူရလွယ်သော Sweet Spot (฿150–฿790) ကို စစ်ပေးသည်',
      ],
      emptyGuideDisclaimer:
        'သတိပြုရန် — Search အမှတ်သည် လက်ရှိ Kalodata ရောင်းအားအချက်အလက်အပေါ် အခြေခံထားပြီး အနာဂတ်ရောင်းအားကို အာမမခံပါ။',
    },
    card: {
      thaiOriginal: 'ထိုင်း TikTok နာမည်',
      whatItIs: 'ဒါဘာပစ္စည်းလဲ',
      silentEdge: 'Visual ဆွဲဆောင်ချက်',
      price: 'ဈေးနှုန်း',
      commission: 'ကော်မရှင်',
      sales7d: '7d ရောင်းအား',
      videoRev7d: '7d Video ဝင်ငွေ',
      revenue7d: '7d ဝင်ငွေ',
      unitsSuffix: ' ခု',
      perSale: '၁ ခုရောင်းရလျှင်',
      createPlan: 'အသေးစိတ်နှင့် Video Studio',
      openSavedPlan: 'Studio ဖွင့်မယ်',
      savedTag: 'သိမ်းပြီး',
      saveShort: 'သိမ်းမယ်',
      saveProduct: 'ပစ္စည်းသိမ်းမယ်',
      unsaveProduct: 'သိမ်းထားမှုဖြုတ်မယ်',
      savedProductToast: 'သိမ်းထားသော ပစ္စည်းများထဲသို့ သိမ်းဆည်းပြီးပါပြီ။',
      removedProductToast: 'သိမ်းထားသော ပစ္စည်းများထဲမှ ဖြုတ်လိုက်ပါပြီ။',
      analyzedTag: 'AI သုံးသပ်ပြီး',
      deepDataTag: 'Deep Data ရှိပြီး',
      copyThai: 'ထိုင်းနာမည်ကူး',
      copyId: 'ID ကူး',
      copiedShort: 'ကူးပြီး',
      explainAiBtn: 'AI ရှင်းပြချက်ထုတ်မယ်',
      explainingAiBtn: 'AI ရှင်းပြနေသည်...',
      explainAllBtn: 'အားလုံး AI ရှင်းပြမယ် (0 cr)',
      explainingAllBtn: 'အားလုံး AI ရှင်းပြနေသည်...',
      aiExplainedTag: 'AI ရှင်းပြပြီး',
      openTikTokShop: 'မူရင်း TikTok Shop တွင်ကြည့်မယ်',
      openTikTokShort: 'TikTok Shop',
    },
    score: {
      tooltipBtn: 'Search အမှတ် အသေးစိတ်ကြည့်ရန်',
      dialogSubtitle: '0.20 cr Search Data မှ အချက် ၄ ချက်ဖြင့် တွက်ချက်ထားသော အမှတ်အသေးစိတ်',
      metricVisualLabel: 'Visual ဖြင့် ဆွဲဆောင်နိုင်မှု',
      metricVisualDesc: 'စကားမပြောဘဲ မြင်ရုံဖြင့် ပစ္စည်းအသုံးဝင်ပုံကို ချက်ချင်းနားလည်နိုင်စွမ်း',
      metricAiLabel: 'AI Video ဖန်တီးရန် သင့်တော်မှု',
      metricAiDesc: 'Macro texture၊ ASMR၊ Before/After ပုံစံများဖြင့် လှပစွာ ဖန်တီးနိုင်စွမ်း',
      metricDemandLabel: 'ရောင်းအားနှင့် ဈေးနှုန်းသင့်တော်မှု',
      metricDemandDesc: 'ထိုင်း TikTok Shop ဝယ်လိုအားနှင့် ဝယ်ယူရလွယ်ကူသော ဈေးနှုန်းအနေအထား',
      metricCommissionLabel: 'ကော်မရှင် အကျိုးအမြတ်',
      metricCommissionDesc: 'ကော်မရှင်ရာခိုင်နှုန်းနှင့် တစ်ခုရောင်းရလျှင် ရမည့် ဘတ်ငွေပမာဏ',
      penaltyLabel: 'စကားဖြင့် ရှင်းပြရန် လိုအပ်ချက်',
      penaltyDesc: 'အသံ/စကားဖြင့် ရှင်းပြမှ နားလည်နိုင်မည့် ပစ္စည်းဖြစ်ပါက နုတ်မှတ်ပေးထားသည်',
      ptsUnit: 'မှတ်',
      closeBtn: 'ပိတ်မယ်',
      grades: {
        top: 'အကောင်းဆုံး',
        strong: 'ကောင်းမွန်',
        fair: 'သင့်တင့်',
        low: 'အားနည်း',
      },
    },
    recent: {
      heading: 'မကြာသေးမီ ရှာဖွေမှုများ',
      savedLocallyTag: 'Browser တွင် အလိုအလျောက်သိမ်းပြီး · 0 cr',
      clearAll: 'အားလုံးဖျက်',
      defaultBestLabel: 'အကောင်းဆုံး စုစည်းမှု',
      linkLabel: 'Product Link',
      itemsCount: (n: number) => `${n} ခု`,
      loadedFromStorageNote: 'နောက်ဆုံး ရှာဖွေမှုမှတ်တမ်းမှ ပြသထားသည် (0 cr)',
      viewingOlderNote: 'ယခင် ရှာဖွေမှုမှတ်တမ်းမှ ပြသထားသည် (0 cr)',
      backToLatestBtn: 'နောက်ဆုံးရလဒ်သို့ ပြန်မယ်',
      viewAllHistoryBtn: 'မှတ်တမ်းအားလုံးကြည့်မယ်',
      removeAria: 'ရှာဖွေမှုမှတ်တမ်းဖျက်ရန်',
    },
    searchHistoryPage: {
      title: 'ရှာဖွေမှုမှတ်တမ်းများ',
      subtitle: 'Kalodata ဖြင့် ရှာဖွေမှုတိုင်းကို ဤနေရာတွင် အလိုအလျောက် မှတ်တမ်းတင်ပေးထားပါသည်။ ယခင်ရလဒ်များကို Credit မကုန်ဘဲ (0 cr) အချိန်မရွေး ပြန်ဖွင့်ကြည့်နိုင်ပါသည်။',
      searchPlaceholder: 'Keyword၊ Category သို့မဟုတ် ပစ္စည်းနာမည်ဖြင့် မှတ်တမ်းရှာမယ်...',
      totalCount: (n: number) => `စုစုပေါင်း ရှာဖွေမှု ${n} ကြိမ် မှတ်ထားသည်`,
      clearAllBtn: 'မှတ်တမ်းအားလုံးဖျက်မယ်',
      confirmClearAll: 'သေချာဖျက်မယ်',
      cancel: 'မဖျက်တော့ပါ',
      latestTag: 'နောက်ဆုံးရလဒ်',
      modeCategory: 'Category ရှာဖွေမှု',
      modeKeyword: 'Keyword ရှာဖွေမှု',
      modeLink: 'Product Link',
      modeDefault: 'အကောင်းဆုံး စုစည်းမှု',
      openResultsBtn: 'ရလဒ်များပြန်ကြည့်မယ် (0 cr)',
      deleteBtn: 'ဖျက်မယ်',
      confirmDelete: 'သေချာဖျက်မယ်',
      emptyTitle: 'ရှာဖွေမှုမှတ်တမ်း မရှိသေးပါ',
      emptyDesc: 'Home စာမျက်နှာတွင် Kalodata ဖြင့် ပစ္စည်းရှာဖွေလိုက်သည်နှင့် ဤနေရာတွင် အလိုအလျောက် မှတ်တမ်းတင်ပေးပါမည်။',
      noFilterMatches: 'သင်ရိုက်ရှာသော စာသားနှင့် ကိုက်ညီသည့် မှတ်တမ်းမတွေ့ပါ။',
      goDiscover: 'ပစ္စည်းများ စတင်ရှာဖွေမယ်',
      creditsSpent: (c: number) => `${c} cr သုံးခဲ့သည်`,
    },
    studio: {
      backToResults: 'ရှာဖွေမှုရလဒ်သို့ ပြန်သွားမယ်',
      backToRankBoard: 'အဆင့်ဇယားသို့ ပြန်သွားမယ်',
      backToHistory: 'သိမ်းထားသော ပစ္စည်းများသို့ ပြန်သွားမယ်',
      copyFullKit: 'အားလုံးကူးယူမယ်',
      copied: 'ကူးယူပြီးပါပြီ',
      copy: 'ကူးယူမယ်',
      regenerate: 'အသစ်ပြန်ထုတ်မယ်',
      styleLabel: 'Visual ပုံစံရွေးချယ်ရန်',
      generatingTitle: 'စကားမပြောဘဲ ဆွဲဆောင်မည့် AI Video Plan ဖန်တီးနေပါသည်',
      generatingDesc: 'Visual Hook၊ Silent Script၊ AI Video Prompts နှင့် ထိုင်း TikTok SEO များကို ပြင်ဆင်နေပါသည်...',
      autoSaved: 'သိမ်းထားသော ပစ္စည်းများတွင် အလိုအလျောက် သိမ်းဆည်းပြီးပါပြီ',
      sectionConcept: '01. Silent Visual Idea နှင့် ဦးတည်ချက်',
      sectionHooks: '02. ပထမ ၃ စက္ကန့် Visual Hooks',
      sectionStoryboard: '03. စကားမပြောဘဲ ရိုက်ကူးမည့် Scene Script',
      sectionPrompts: '04. AI Video နှင့် Keyframe Image Prompts',
      sectionSeo: '05. ထိုင်း TikTok Shop SEO နှင့် Caption',
      jumpConcept: 'Concept',
      jumpHooks: 'Hooks',
      jumpScript: 'Script',
      jumpPrompts: 'AI Prompts',
      jumpSeo: 'TikTok SEO',
      jumpMaster: 'Master Prompt',
      masterPromptTitle: '04-B. တစ်ခါတည်း အစအဆုံးထွက်မည့် Master Video Prompt (All-in-One 0-15s)',
      masterPromptSub: '0 မှ 15 စက္ကန့်အထိ Silent Hook၊ Storyboard ဇာတ်ကွက်များ၊ ASMR အသံများနှင့် ထိုင်းစာတန်းများ အားလုံးကို AI Video Gen (Veo / Kling / Runway / Sora) တွင် တစ်ကြိမ်တည်းဖြင့် အစအဆုံး ထွက်လာစေရန် ပေါင်းစပ်ထားသော Master Prompt ဖြစ်ပါသည်။',
      visualDirectionLabel: 'Visual ပုံစံ',
      onScreenThaiLabel: 'Screen ပေါ်ပြမည့် ထိုင်းစာတို',
      meaningLabel: 'အဓိပ္ပာယ်',
      timeCol: 'အချိန်',
      visualCol: 'Visual နှင့် Camera လှုပ်ရှားမှု',
      soundCol: 'ASMR / အသံ (စကားမပါ)',
      screenTextCol: 'ထိုင်းစာသားနှင့် အဓိပ္ပာယ်',
      videoPromptsSub: 'AI Video Prompts (Veo / Kling / Runway / Sora)',
      imagePromptsSub: 'Keyframe Image Prompts (Start Frame)',
      thaiCaptionLabel: 'TikTok ပေါ်တင်မည့် ထိုင်း Caption',
      hashtagsLabel: 'Hashtags',
      keywordsLabel: 'TikTok Search Keywords',
      postingTipLabel: 'အရောင်းသွက်စေရန် အကြံပြုချက်',
      copyAllHashtags: 'Hashtags အားလုံးကူးမယ်',
      noSpeechNote: 'စကားလုံးဝမပါ (Zero-Speech AI Visual Format)',
      copyThaiText: 'ထိုင်းစာကူး',
      deepToggleTitle: 'ဒီပစ္စည်းအတွက် Kalodata Deep Data ထပ်ယူရန် (Optional)',
      deepToggleHint: 'တစ်ခါယူပြီးရင် Browser Storage တွင် အလိုအလျောက် သိမ်းပေးထားပါမည် (Video Plan အလိုအလျောက် မဖန်တီးပါ)',
      deepOptDetailTitle: 'Product Details',
      deepOptDetailDesc: 'ဆိုင်အမည်အတိအကျနှင့် Seller ဖော်ပြချက်',
      deepOptSpecsTitle: 'Selling Specs & Highlights',
      deepOptSpecsDesc: 'ပစ္စည်း၏ အဓိကအားသာချက်များ',
      deepOptCommentsTitle: 'Buyer Reviews & Pain Points',
      deepOptCommentsDesc: 'ထိုင်းဝယ်သူများ၏ သုံးသပ်ချက်နှင့် အသုံးပြုပုံ',
      deepFetchBtn: (cost: number) => `ရွေးထားသော Deep Data ယူမယ် (~${cost} cr)`,
      deepFetchingBtn: 'Kalodata Deep Data ယူနေသည်...',
      deepFetchedBadge: 'Storage တွင် သိမ်းပြီး',
      deepHighlightsLabel: 'အဓိကအားသာချက်များ',
      deepPainPointsLabel: 'ဝယ်သူများ၏ Pain Points',
      deepUsageLabel: 'အသုံးပြုသည့် အခြေအနေများ',
      deepDescLabel: 'Seller ဖော်ပြချက်',
      deepUpgradedToast: 'Kalodata Deep Data ကို ရယူပြီး Browser Storage တွင် သိမ်းဆည်းပြီးပါပြီ။',
      deepPartialWarning: (layers: string[]) =>
        `အချို့ Kalodata Layer များ (${layers.join(', ')}) ယူမရပါ — ရရှိသမျှ Data များကို သိမ်းဆည်းထားပြီးဖြစ်သည်။`,
      growthUnverifiedShort: 'Unit မစစ်ရသေး',
      deepSelectOneHint: 'ရယူလိုသော အချက်အနည်းဆုံး ၁ ခုကို ရွေးပါ။',
      deepSavedTag: 'သိမ်းပြီး',
      deepSavedStorageNote: 'Browser Storage တွင် အမြဲတမ်း သိမ်းဆည်းထားပြီးဖြစ်၍ ထပ်မံ Credit မကုန်တော့ပါ။',
      deepDataHeading: 'Kalodata API မှ ရယူထားသော Deep Data',
      deepCopyDataBtn: 'Data ကူးမယ်',
      deepManageFetchBtn: 'ထပ်ယူ / ရွေးမယ်',
      deepHideFetchBtn: 'ပိတ်မယ်',
      deepMetricShop: 'ဆိုင်အမည်',
      deepMetricLiveRev7d: '7 ရက် Live ဝင်ငွေ',
      deepMetricCreators: 'ရောင်းချသူ Creator',
      deepMetricRating: 'Rating / Reviews',
      deepNoDescReturned: 'API မှ စစ်ဆေးပြီး — Seller ဘက်မှ စာသားဖော်ပြချက် မထည့်ထားပါ။',
      deepNoSpecsReturned: 'API မှ စစ်ဆေးပြီး — Kalodata တွင် Selling Specs အချက်အလက် မရှိသေးပါ။',
      deepNoCommentsReturned: 'API မှ စစ်ဆေးပြီး — Kalodata တွင် Buyer Review Insight မရှိသေးပါ။',
      deepShowMore: 'အပြည့်အစုံဖတ်မယ်',
      deepShowLess: 'ပြန်ချုံ့မယ်',
      readyTitle: 'Silent AI Video Plan ဖန်တီးရန် အသင့်ဖြစ်ပါပြီ',
      readyDesc: 'အောက်တွင် Visual ပုံစံရွေးချယ်ပြီး (လိုအပ်ပါက အပေါ်မှ Kalodata Deep Data နှင့် AI သုံးသပ်ချက် စစ်ဆေးပြီးမှ) Video Plan ဖန်တီးနိုင်ပါသည်။',
      generateNowBtn: 'Video Plan ဖန်တီးမယ်',
      confirmGenTitle: 'Video Plan ဖန်တီးရန် အတည်ပြုပါ',
      confirmRegenTitle: 'Video Plan အသစ်ပြန်ထုတ်ရန် အတည်ပြုပါ',
      confirmGenDesc: 'ရွေးချယ်ထားသော Visual ပုံစံဖြင့် Silent AI Video Kit (Hooks, Script, AI Prompts, TikTok SEO) ကို စတင်ဖန်တီးပါမည်။',
      confirmStyleLabel: 'ရွေးချယ်ထားသော Visual ပုံစံ',
      confirmDeepIncluded: 'သိမ်းထားသော Kalodata Deep Data ပါဝင်မည်',
      confirmDeepNotIncluded: 'Kalodata Deep Data မပါသေးပါ (ပုံမှန်အချက်အလက်ဖြင့် ဖန်တီးမည်)',
      confirmProceedBtn: 'အတည်ပြုပြီး ဖန်တီးမယ်',
      confirmCancelBtn: 'မလုပ်တော့ပါ',
      savedStyleMark: 'သိမ်းပြီး',
      videoSectionTitle: 'Silent AI Video Ideas ဖန်တီးရန်',
      commercialStudioNotice:
        'Commercial Score သည် ဈေးကွက်အလားအလာကိုသာ တိုင်းတာပြီး Video Studio အကြံပြုချက်များနှင့် သီးခြားဖြစ်သည်။ Score မြင့်ခြင်း သို့မဟုတ် ယခင် Video ရောင်းအားရှိခြင်းသည် သင့် Video အတွက် ရောင်းအားအာမခံချက် မဟုတ်ပါ။',
      analysisTitle: 'AI ဖြင့် Video Ideas စဉ်းစားမယ် (Creative Strategist)',
      analysisSubtitle: 'သင်ခန်းစာ ၁၃ ခုအပေါ် အခြေခံ၍ ဤကုန်ပစ္စည်းနှင့် အကိုက်ညီဆုံး Video Concept ၃ မျိုး၊ 3-Layer Hook၊ 4-Part ဖွဲ့စည်းပုံနှင့် Scaling နည်းဗျူဟာများကို ဖန်တီးပေးပါမည်။',
      analysisBtn: 'Video Ideas စဉ်းစားမယ် (0 cr)',
      analysisReBtn: 'Idea အသစ်ပြန်စဉ်းစားမယ် (0 cr)',
      analysisRunningBtn: 'ကုန်ပစ္စည်းနှင့်လိုက်ဖက်မည့် Video Ideas များ စဉ်းစားနေသည်...',
      analysisCopyBtn: 'Ideas အားလုံးကူးမယ်',
      analysisSavedTag: 'Storage တွင် သိမ်းပြီး',
      analysisStaleHint: 'Kalodata Deep Data အသစ်ထပ်ယူထားသဖြင့် Idea အသစ်ပြန်စဉ်းစားပါက ပိုမိုတိကျသော Concept များ ရရှိပါမည်။',
      analysisDataSourcesLabel: 'အခြေခံမည့် Kalodata Data',
      analysisSrcSales: '7d ရောင်းအား/ဝင်ငွေ',
      analysisSrcDetails: 'Seller Details',
      analysisSrcSpecs: 'Selling Specs',
      analysisSrcReviews: 'Buyer Reviews',
      analysisAvailable: 'ရှိပြီး',
      analysisNotAvailable: 'မရှိသေးပါ',
      analysisMetricPrice: 'ဈေးနှုန်း',
      analysisMetricCommission: 'ကော်မရှင်',
      analysisMetricSales7d: '7 ရက် ရောင်းအား',
      analysisMetricRevenue7d: '7 ရက် စုစုပေါင်းဝင်ငွေ',
      analysisMetricVideoRev7d: '7 ရက် Video ဝင်ငွေ',
      analysisMetricGrowth: 'တိုးတက်မှုနှုန်း',
      analysisSecIdentity: 'ပစ္စည်းအမည်နှင့် အကြောင်းအရာ',
      analysisSecSalesPricing: 'ရောင်းအားနှင့် ဈေးနှုန်း သုံးသပ်ချက်',
      analysisSecProfitMath: 'ကော်မရှင်နှင့် အမြတ် တွက်ချက်မှု',
      analysisSecSilentAd: 'Silent Video ဖြင့် ရောင်းချနိုင်စွမ်း',
      analysisSecVisualAngles: 'အသုံးပြုသင့်သော Visual Angles',
      analysisSecSpecs: 'Kalodata Details & Specs သုံးသပ်ချက်',
      analysisSecBuyers: 'Kalodata Buyer Reviews သုံးသပ်ချက်',
      analysisSecRisks: 'သတိပြုရမည့် အချက်များ (Risks)',
      analysisSecMissing: 'လက်ရှိ Kalodata Data မရှိသေးသော အချက်များ',
      analysisDecisions: {
        strong_go: 'ရောင်းချရန် အထူးသင့်တော်',
        test_carefully: 'သတိထားစမ်းသပ်သင့်',
        need_more_data: 'Data ထပ်စစ်ရန်လိုအပ်',
      },
      videoIdeas: {
        briefTitle: 'Product Strategy Brief (Lesson 1–3 & Playbook)',
        briefToggleShow: 'Strategy အသေးစိတ်ကြည့်မယ်',
        briefToggleHide: 'ပြန်သိမ်းမယ်',
        playbookLabel: 'ကုန်ပစ္စည်း Playbook',
        playbooks: {
          problem_solving: 'Problem-Solving (Visual Proof & Contrast)',
          impulse_trendy: 'Impulse & Trendy (15–30s Wow & FOMO)',
          aesthetic_lifestyle: 'Aesthetic & Lifestyle (Identity & Vibe)',
          high_ticket_trust: 'High-Ticket & Trust (4 Pillars of Trust)',
          food_beverage: 'Food & Beverage (Sensory & Craving)',
        },
        awarenessLevels: {
          unaware: 'L1 · Unaware',
          problem_aware: 'L2 · Problem Aware',
          solution_aware: 'L3 · Solution Aware',
          product_aware: 'L4 · Product Aware',
          most_aware: 'L5 · Most Aware',
        },
        frameworks: {
          PAS: 'PAS (Problem–Agitate–Solve)',
          BAB: 'BAB (Before–After–Bridge)',
          AIDA: 'AIDA (Attention–Interest–Desire–Action)',
          '3_REASONS_WHY': '3 Reasons Why (Listicle)',
        },
        featureLabel: 'Feature (သက်သေ)',
        benefitLabel: 'Functional Benefit',
        emotionLabel: 'Emotional Benefit (ဦးစားပေး)',
        uspLabel: 'Core USP',
        visualProofLabel: 'အဓိက Visual Proof ပြကွက်',
        audienceLabel: 'ပစ်မှတ်ဝယ်သူ (Target Audience)',
        painLadderLabel: 'Pain Point အဆင့်ဆင့် & Desire',
        buyerVoiceLabel: 'ဝယ်သူအသံနှင့် သံသယ (Buyer Voice)',
        ideaTabLabel: (index: number) => `Video Idea ${index}`,
        copyIdeaBtn: 'ဒီ Idea ကူးမယ်',
        angleLabel: 'Creative Angle',
        formatLabel: 'ရိုက်ကူးပုံ (Format)',
        targetLabel: 'ရည်ရွယ်သူ',
        durationLabel: 'ကြာချိန်',
        hookSectionLabel: '၁။ 3-Layer Hook (0–3s)',
        visualHookLabel: 'Visual Hook (0–1s မြင်ကွင်း)',
        verbalHookLabel: 'Verbal Hook (အဖွင့်စကား)',
        textHookLabel: 'Text Hook (မျက်နှာပြင်စာသား)',
        bridgeSectionLabel: '၂။ Bridge / Hold (3–10s)',
        bodySectionLabel: '၃။ Body — Demo, Benefit & Objection (10–45s)',
        ctaSectionLabel: '၄။ CTA — Clear Action + Reason Why Now',
        muteTestLabel: 'Mute Test (အသံပိတ်ကြည့်ရုံဖြင့် နားလည်မှု)',
        extraHooksLabel: '1 Body, 3 Hooks — ထပ်စမ်းသင့်သော Hook အပိုများ',
        scalingTitle: 'Testing, Comment Mining & Scaling (Lesson 13)',
        commentMiningLabel: 'Comment မှ ပြန်ရိုက်သင့်သော Reply Video များ',
        iterationRoadmapLabel: 'Winning ဖြစ်လာပါက Scaling လုပ်ရန် အဆင့် ၃ ဆင့်',
        watchOutsLabel: 'ဤကုန်ပစ္စည်း Video ရိုက်ရာတွင် ရှောင်ရန်အမှားများ',
      },
      chatPrompt: {
        title: 'AI Chat တွေမှာ Paste ချဖို့ Product Prompt ကူးမယ်',
        compatibleTag: 'ChatGPT · Claude · Gemini · DeepSeek (0 cr)',
        subtitle:
          'Product Data အသေးစိတ်အားလုံး၊ AI Video ဖန်တီးမည့် Role နှင့် မြန်မာဘာသာဖြင့် ပြန်ဖြေရန် Default ပါဝင်ပြီး တစ်ချက်တည်း Copy ကူးနိုင်ပါသည်။',
        copyBtn: 'AI Chat Prompt ကူးယူမယ်',
        copiedBtn: 'Prompt ကူးယူပြီးပါပြီ',
        previewBtn: 'Prompt ကြည့်မယ်',
        hidePreviewBtn: 'ပြန်ပိတ်မယ်',
        expandAria: 'AI Chat Prompt အသေးစိတ်ဖွင့်ရန်',
        collapseAria: 'AI Chat Prompt ပိတ်ရန်',
        packedDataLabel: 'Prompt ထဲပါဝင်မည့် Data',
        includedShort: 'ပါဝင်ပြီး',
        notYetShort: 'မယူရသေး',
        benchmarkDefault: 'မြန်မာဘာသာဖြင့် ပြန်ဖြေရန် (Default)',
        benchmarkWithRef: 'မြန်မာဘာသာဖြင့် ပြန်ဖြေရန် (Default)',
        modeLabel: 'AI Chat ကို ဘာလုပ်ခိုင်းမလဲ',
        modes: {
          full: 'အားလုံးပေါင်း (Analysis + Video Plan)',
          analysis: 'Product သုံးသပ်ချက်သီးသန့်',
          video_plan: 'Silent Video Plan သီးသန့်',
        },
        outputLangLabel: 'AI ပြန်ဖြေစေချင်သော ဘာသာစကား',
        outputLangs: {
          bilingual: 'မြန်မာ + English',
          my: 'မြန်မာသီးသန့်',
          en: 'English သီးသန့်',
        },
        competitorSectionTitle: 'ပြိုင်ဘက် Creator Video Reference (Optional — မထည့်လည်း Default ပါဝင်ပြီး)',
        competitorDefaultNote:
          'Reference မထည့်ခဲ့လျှင်လည်း ထိုင်း TikTok Shop တွင် ရောင်းအားအကောင်းဆုံး Silent Video Framework များ (0–2s Hook, Tactile Proof, 12–15s Pacing, ตะกร้าเหลือง CTA) ကို Default အနေဖြင့် အလိုအလျောက် ထည့်ပေးထားပါသည်။',
        addRefBtn: 'ပြိုင်ဘက် Reference ထည့်မယ်',
        hideRefBtn: 'Reference ပိတ်မယ်',
        competitorUrlLabel: 'ပြိုင်ဘက် Video Link သို့မဟုတ် Creator အမည် (Optional)',
        competitorUrlPlaceholder: 'ဥပမာ - https://www.tiktok.com/@creator/video/... သို့မဟုတ် @creator',
        competitorNotesLabel: 'ပြိုင်ဘက် Video ရဲ့ အားသာချက် / Hook ပုံစံ (Optional)',
        competitorNotesPlaceholder: 'ဥပမာ - ပထမ 2 စက္ကန့်မှာ ရေစိုခံစမ်းပြတာ၊ ASMR အဖုံးဖွင့်သံနဲ့ စတာ...',
        stepSyncHint: 'အပေါ်မှ Kalodata Deep Data အသစ်ထပ်ယူတိုင်း Prompt ထဲ အလိုအလျောက် Update ဖြစ်ပါမည်',
      },
    },
    styles: {
      cinematic: 'Cinematic Macro',
      asmr: 'ASMR Texture',
      before_after: 'Before & After',
      problem_fix: 'Problem → Fix',
    },
    history: {
      title: 'သိမ်းထားသော ပစ္စည်းများ',
      subtitle: 'သိမ်းဆည်းထားသော ပစ္စည်းများနှင့် ဖန်တီးထားသည့် Video Kit များကို သင့်စက်ထဲတွင် သိမ်းထားပါသည်။ အချိန်မရွေး Backup ထုတ်ခြင်းနှင့် ပြန်သွင်းခြင်း ပြုလုပ်နိုင်ပါသည်။',
      searchPlaceholder: 'သိမ်းထားသော ပစ္စည်းနာမည်ဖြင့် ရှာမယ်...',
      backupBtn: 'Backup ထုတ်မယ်',
      restoreBtn: 'Restore ပြန်သွင်းမယ်',
      emptyTitle: 'သိမ်းထားသော ပစ္စည်း မရှိသေးပါ',
      emptyDesc: 'ရှာဖွေမှုရလဒ် သို့မဟုတ် Product Studio မှ Save icon ကိုနှိပ်၍ ပစ္စည်းများကို သိမ်းဆည်းနိုင်ပါသည်။',
      goDiscover: 'ပစ္စည်းများ စတင်ရှာဖွေမယ်',
      openPlan: 'Studio ဖွင့်မယ်',
      deleteBtn: 'ဖျက်မယ်',
      confirmDelete: 'သေချာဖျက်မယ်',
      cancel: 'မဖျက်တော့ပါ',
      backupSuccess: 'Backup ဖိုင်ကို အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ။',
      restoreSuccessCount: (added, total) =>
        `Restore အောင်မြင်ပါသည် — အသစ် ${added} ခု ထပ်ပေါင်းပြီး စုစုပေါင်း ${total} ခု ရှိပါပြီ။`,
      restoreSuccessWithSearches: (added, total, searchesAdded) =>
        `Restore အောင်မြင်ပါသည် — ပစ္စည်းအသစ် ${added} ခု (စုစုပေါင်း ${total} ခု) နှင့် ရှာဖွေမှုမှတ်တမ်းအသစ် ${searchesAdded} ခု ပေါင်းထည့်ပြီးပါပြီ။`,
      restoreError: 'ဖိုင်ပုံစံ မမှန်ကန်ပါ။ SiamVisual Backup JSON ဖိုင်ကိုသာ ရွေးချယ်ပါ။',
      noFilterMatches: 'သင်ရိုက်ရှာသော စာသားနှင့် ကိုက်ညီသည့် သိမ်းထားသောပစ္စည်း မတွေ့ပါ။',
      clearFilterAria: 'Filter စာသား ရှင်းမယ်',
      savedCount: (n: number) => `စုစုပေါင်း ပစ္စည်း ${n} ခု သိမ်းထားသည်`,
    },
    kalodata: {
      title: 'Kalodata Open API ချိတ်ဆက်ရန်',
      subtitle: 'Kalodata Open Center မှ secret-key ကို Copy ကူးပြီး ဤနေရာတွင် Paste ထည့်ပါ။ ချိတ်ဆက်မှု အောင်မြင်သည်နှင့် Credit Balance ကို ချက်ချင်းပြပေးပါမည်။',
      openCenterLink: 'Open Center မှ Key ယူရန်',
      inputPlaceholder: 'Kalodata API Key (secret-key) ကို Paste လုပ်ပါ...',
      pasteBtn: 'Paste',
      connectBtn: 'ချိတ်ဆက်မယ်',
      connectingBtn: 'စစ်ဆေးနေသည်...',
      connectedBadge: 'ချိတ်ဆက်မှု အောင်မြင်ပါသည်',
      mainAccount: 'Main Key',
      subAccount: 'Sub Key',
      creditBalanceLabel: 'လက်ကျန် Credit Balance',
      creditsUnit: 'Credits',
      balanceUnavailable: 'Balance မရရှိသေးပါ',
      refreshBalance: 'ပြန်စစ်မယ်',
      changeKey: 'Key ပြောင်းမယ်',
      disconnect: 'ဖြုတ်မယ်',
      closeBtn: 'ပိတ်မယ်',
      cancel: 'မလုပ်တော့ပါ',
      lastSearchUsed: 'ကုန်ကျ Credit',
      connectRequiredError: 'Kalodata API ဖြင့်သာ ရှာဖွေမည်ဖြစ်၍ သင့် Kalodata API Key ကို ဦးစွာ Paste လုပ်ပြီး ချိတ်ဆက်ပါ။',
      pasteDeniedNote: 'Clipboard မှ တိုက်ရိုက်ဖတ်မရပါ — Input ထဲတွင် Ctrl+V / Paste နှိပ်ထည့်ပါ။',
      connectedToast: 'Kalodata API ချိတ်ဆက်မှု အောင်မြင်ပါပြီ။',
      disconnectedToast: 'Kalodata API Key ကို ဖြုတ်လိုက်ပါပြီ။',
      refreshedToast: 'Credit Balance ကို အသစ်ပြန်စစ်ပြီးပါပြီ။',
      categoriesSyncedToast: 'Kalodata Thailand Live Categories များကို ရယူပြီးပါပြီ။',
      limitBtn: 'Credit Limit',
      limitTitle: 'API Credit Balance Limit သတ်မှတ်ရန်',
      maxSpendLabel: 'အများဆုံး သုံးခွင့်ပြုမည့် Credit (Max Spend)',
      maxSpendPlaceholder: 'ဥပမာ - 10 (ကန့်သတ်မထားလိုပါက ဗလာထားပါ)',
      minReserveLabel: 'အနည်းဆုံး ချန်ထားမည့် Balance (Min Reserve)',
      minReservePlaceholder: 'ဥပမာ - 50 (Balance ဤအောက်မကျအောင် ရပ်ပေးမည်)',
      spentCounterLabel: 'သုံးပြီး Credit',
      resetSpentBtn: 'သုံးပြီး Credit ပြန်စမယ်',
      saveLimitBtn: 'Limit သိမ်းမယ်',
      clearLimitBtn: 'Limit ဖြုတ်မယ်',
      limitSavedToast: 'Credit Limit သတ်မှတ်ချက်ကို သိမ်းဆည်းပြီးပါပြီ။',
      limitExceededMaxSpend: (spent, est, max) =>
        `Max Spend Limit ကျော်နေပါသည် — သုံးပြီး ${spent} + ယခုခန့်မှန်း ~${est} > Limit (${max} cr)။ Limit တိုးပါ သို့မဟုတ် Spent ကို Reset လုပ်ပါ။`,
      limitExceededReserve: (balance, est, reserve) =>
        `Minimum Reserve Limit ကြောင့် ရပ်ထားပါသည် — လက်ကျန် ${balance} မှ ~${est} နှုတ်ပါက ချန်ထားလိုသည့် ${reserve} cr အောက်ကျသွားပါမည်။`,
    },
    v2: {
      engineBadge: 'Intelligence V2',
      overallTabLabel: 'Overall Commercial Ranking',
      overallTabShort: 'Overall',
      overallDescription:
        'Demand, Earning, Competition နှင့် Customer Quality ၄ ချက်လုံးပေါင်း၍ ဟန်ချက်ညီသော အမြတ်အစွန်းအလားအလာအလိုက် စီပေးထားသည် (Visual Score မပါဝင်ပါ)။',
      commercialScoreLabel: 'Commercial Score',
      commercialScoreShort: 'Commercial',
      strategyScoreLabel: 'Strategy Score',
      strategyScoreShort: 'Strategy',
      rankingTransparencyNote:
        'Commercial Opportunity (ဈေးကွက်အလားအလာ)၊ Conversion Evidence (ယခင် Video/Live ရောင်းအား)၊ Data Confidence နှင့် Video Suitability တို့ကို သီးခြားခွဲပြထားသည်။ Score မြင့်ခြင်းသည် Affiliate ရောင်းအားကို အာမမခံပါ။',
      withheldLabel: 'Withheld (Data မပြည့်)',
      withheldZeroCommLabel: '0% (Not Monetizable)',
      dimensionsHeading: 'Commercial Dimensions ၄ ချက်',
      dimensions: {
        demand: {
          label: 'Demand (ဝယ်လိုအား)',
          short: 'Demand',
          desc: '7d စုစုပေါင်းဝင်ငွေ၊ ရောင်းအားပမာဏနှင့် Verified ဖြစ်သော Growth နှုန်း',
        },
        earning: {
          label: 'Earning (အကျိုးအမြတ်)',
          short: 'Earning',
          desc: 'ကော်မရှင်ရာခိုင်နှုန်း၊ ၁ ခုရောင်းရလျှင်ရမည့် ဘတ်ငွေနှင့် Demand ပေါင်းစပ်ချက်',
        },
        competition: {
          label: 'Competition (ပြိုင်ဆိုင်မှု)',
          short: 'Competition',
          desc: 'Creator အရေအတွက် နည်း/များနှင့် Laplace-smoothed Creator ၁ ဦးစီဝင်ငွေ (Adjusted RPC)',
        },
        quality: {
          label: 'Customer Quality (အရည်အသွေး)',
          short: 'Quality',
          desc: 'Review အရေအတွက်ပေါ်မူတည်၍ Bayesian ချိန်ညှိထားသော Rating အထောက်အထား',
        },
      },
      dimensionStatus: {
        SCORED: 'Scored',
        ZERO: 'Zero',
        NOT_MONETIZABLE: 'Not Monetizable (0%)',
        INSUFFICIENT: 'Data မပြည့်သေး',
        INVALID: 'Invalid',
      },
      classifications: {
        TOP_OPPORTUNITY: 'Top Opportunity',
        STRONG_OPPORTUNITY: 'Strong Opportunity',
        MODERATE_OPPORTUNITY: 'Moderate Opportunity',
        WATCHLIST: 'Watchlist',
        INSUFFICIENT_EVIDENCE: 'Data မပြည့်စုံသေး',
        NOT_MONETIZABLE: 'Not Monetizable (0% Comm)',
      },
      commercialEligibility: {
        ELIGIBLE: 'Eligible',
        PARTIAL_EVIDENCE: 'Partial Evidence',
        RESTRICTED_WEAK_DEMAND: 'Demand အားနည်း',
        RESTRICTED_POOR_QUALITY: 'Quality အားနည်း',
        NOT_MONETIZABLE: '0% Commission',
        INSUFFICIENT_DATA: 'Insufficient Data',
      },
      strategyEligibility: {
        QUALIFIED: 'Qualified',
        PARTIAL_EVIDENCE: 'Partial Evidence',
        INSUFFICIENT_DATA: 'Insufficient Data',
        NOT_ELIGIBLE: 'Not Eligible',
        DATA_UNAVAILABLE: 'Data Unavailable',
      },
      confidenceLabel: 'Data Confidence',
      confidenceLevels: {
        HIGH: 'High',
        MEDIUM: 'Medium',
        LOW: 'Low',
        VERY_LOW: 'Very Low',
      },
      confidenceBreakdown: {
        completeness: 'Completeness',
        provenance: 'Source Provenance',
        freshness: 'Freshness',
        validity: 'Validity',
        dimensionCoverage: 'Dimension Coverage',
      },
      conversionLabel: 'Conversion Evidence',
      conversionLevels: {
        STRONG: 'Strong Video/Live Evidence',
        MODERATE: 'Moderate Evidence',
        WEAK: 'Weak Evidence',
        INSUFFICIENT: 'Insufficient Evidence',
      },
      conversionChannels: {
        VIDEO: 'Video ဦးဆောင်',
        LIVE: 'Live ဦးဆောင်',
        BALANCED: 'Video + Live မျှတ',
        UNKNOWN: 'မသိရှိသေး',
      },
      conversionDisclaimerShort: 'ယခင် Video/Live ရောင်းအားသည် အနာဂတ် Conversion ကို အာမမခံပါ',
      strategies: {
        early_market_opportunity: {
          name: 'Early Market Opportunity',
          shortName: 'Early Market',
          desc: 'ဝယ်လိုအားကောင်း + Verified Growth တက်နေပြီး Creator မများသေးသော ပစ္စည်းများ',
          minimumRule: 'Verified demand, growth (+10%+), <=60 creators, commission >0%, confidence >=60',
          exclusionRule: '0% commission, negative growth, >60 creators, unverified growth/creators တို့ကို ဖယ်ထုတ်သည်',
        },
        underserved_demand: {
          name: 'Underserved Demand',
          shortName: 'Underserved',
          desc: 'ဝယ်လိုအားမြင့်သော်လည်း Creator ပြိုင်ဆိုင်မှု နည်းသေးသော ပစ္စည်းများ',
          minimumRule: 'Absolute demand >=50, competition >=45, earning >=35, confidence >=48 (growth မပါလည်းရ)',
          exclusionRule: '0% commission, crowded creators, unverified creator count တို့ကို ဖယ်ထုတ်သည်',
        },
        creator_yield_opportunity: {
          name: 'Creator Yield Opportunity',
          shortName: 'Creator Yield',
          desc: 'Creator တစ်ဦးချင်းစီရရှိသည့် Adjusted RPC မြင့်ပြီး ဝင်ငွေအကျိုးအမြတ်ကောင်းသော ပစ္စည်းများ',
          minimumRule: 'Revenue >=฿20,000, adjusted RPC >=฿3,000, creators >=1, commission >0%, confidence >=55',
          exclusionRule: 'Revenue နည်းပြီး creator ၁ ဦးတည်းဖြစ်နေမှုနှင့် 0-creator anomaly များကို ဖယ်ထုတ်သည်',
        },
        fast_rising_products: {
          name: 'Fast Rising Products',
          shortName: 'Fast Rising',
          desc: 'အချိန်ကာလ Snapshot များအရ ဝယ်လိုအားတက်နှုန်းက Creator တိုးနှုန်းထက် မြန်နေသော ပစ္စည်းများ',
          minimumRule: 'Verified historical snapshots >=2 (12h+ interval), demand growth >=15%',
          exclusionRule: 'Historical snapshots မရှိပါက DATA_UNAVAILABLE ပြမည် (အတု Trend မတွက်ပါ)',
        },
        profit_maximizer: {
          name: 'Profit Maximizer',
          shortName: 'Profit Max',
          desc: '၁ ခုရောင်းရလျှင်ရမည့် Affiliate Payout (฿) မြင့်ပြီး ဝယ်လိုအားလည်း ခိုင်မာသော ပစ္စည်းများ',
          minimumRule: 'Payout >=฿20/sale, earning >=48, demand >=38, competition >=30, confidence >=55',
          exclusionRule: 'Demand နည်းသော်လည်း ကော်မရှင် % မြင့်ဟန်ပြသည့် ပစ္စည်းများကို ဖယ်ထုတ်သည်',
        },
        video_proven_winners: {
          name: 'Video Proven Winners',
          shortName: 'Video Proven',
          desc: 'Short Video မှ တကယ်ရောင်းအားဝင်ငွေ (฿25K+ & 25%+ share) ရှိပြီး ပြိုင်ဆိုင်မှု ထိန်းနိုင်သော ပစ္စည်းများ',
          minimumRule: 'Video revenue >=฿25,000, video share >=25%, demand >=40, confidence >=52',
          exclusionRule: 'Visual လှရုံဖြင့် Qualification မပေးပါ — verified video revenue ရှိမှသာ ရွေးသည်',
        },
        trust_based_winners: {
          name: 'Trust-Based Winners',
          shortName: 'Trust Winners',
          desc: 'Review အရေအတွက် (30+) နှင့် Bayesian Rating (4.25+) မြင့်မား၍ ဝယ်သူယုံကြည်မှုခိုင်မာသော ပစ္စည်းများ',
          minimumRule: 'Reviews >=30, Bayesian rating >=4.25, quality >=70, demand >=40, confidence >=58',
          exclusionRule: 'Review နည်းသော (1–5 reviews) 5.0 အတု Rating များနှင့် rating unverified များကို ဖယ်ထုတ်သည်',
        },
        trend_timing_opportunity: {
          name: 'Trend Timing Opportunity',
          shortName: 'Trend Timing',
          desc: 'Snapshot 3 ခု+ အတွင်း Demand Acceleration မှန်မှန်တက်နေပြီး ဝင်ရောက်ရန် အချိန်ကောင်းသော ပစ္စည်းများ',
          minimumRule: 'Verified historical snapshots >=3 (24h+ span), accelerating demand > creator growth',
          exclusionRule: 'Multi-snapshot history မရှိပါက DATA_UNAVAILABLE ပြမည် (အတု Trend မတွက်ပါ)',
        },
      },
      strategyExplorer: {
        title: 'Strategy Explorer',
        subtitle: 'Overall Commercial သို့မဟုတ် Strategy ၈ မျိုးအနက် တစ်ခုကိုရွေး၍ ကိုက်ညီသောပစ္စည်းများကို ကြည့်ပါ',
        overallCountLabel: (n: number) => `${n} products evaluated`,
        qualifiedCountLabel: (n: number) => `${n} Qualified`,
        excludedCountLabel: (n: number) => `${n} Excluded`,
        showExcludedBtn: (n: number) => `Qualified မဖြစ်သေးသော ပစ္စည်း ${n} ခု ကြည့်မယ်`,
        hideExcludedBtn: 'Excluded ပစ္စည်းများ ပိတ်မယ်',
        excludedSectionTitle: 'Qualified မဖြစ်သေး / Data မပြည့်သေးသော ပစ္စည်းများ',
        excludedSectionSub:
          'အောက်ပါပစ္စည်းများသည် ဤ Strategy ၏ Criteria သို့မဟုတ် Verified Data Gate ကို မဖြတ်ကျော်နိုင်သေးပါ။',
        noQualifiedTitle: 'ဤ Strategy နှင့် ကိုက်ညီသော Qualified ပစ္စည်း မတွေ့သေးပါ',
        noQualifiedDesc:
          'လက်ရှိပစ္စည်းများတွင် လိုအပ်သော Verified Metrics (ဥပမာ Phase 0 Unverified ဖြစ်နေသော Creator Count, Growth, Rating) မပြည့်စုံသေးခြင်း သို့မဟုတ် Gate မပြည့်မီခြင်းကြောင့် ဖြစ်နိုင်ပါသည်။',
        historyUnavailableTitle: 'Historical Snapshot Data မရှိသေးပါ (DATA_UNAVAILABLE)',
        historyUnavailableBadge: 'History Required',
        historyUnavailableDesc:
          'ဤ Strategy သည် အချိန်ကာလအလိုက် သိမ်းဆည်းထားသော Verified Historical Snapshots (အနည်းဆုံး 2–3 ကြိမ်) ရှိမှသာ Demand Velocity နှင့် Creator Saturation ကို တွက်ချက်နိုင်ပါမည်။',
        historyUnavailableNote:
          'SiamVisual သည် မရှိသော Trend များကို အတုလုပ်မတွက်ချက်ပါ — Snapshot History storage ချိတ်ဆက်ပြီးမှသာ ဤ Strategy တွင် Qualified ပစ္စည်းများ ပေါ်လာပါမည်။',
        smallPoolWarning: (n: number) =>
          `ပစ္စည်း ${n} ခုသာ ရှိသေးသော်လည်း Absolute Commercial Benchmarks ဖြင့် တည်ငြိမ်စွာ တွက်ချက်ထားပါသည်။`,
        bestMatchLabel: 'အသင့်တော်ဆုံး Strategy',
        noStrategyQualified: 'Qualified Strategy မရှိသေး',
        whyRankedBtn: 'ဘာကြောင့် ဤအမှတ်ရသလဲ',
        hideReasonsBtn: 'အကျဉ်းပိတ်မယ်',
        whyRankedTitle: 'Ranking Reasons & Insights',
        cautionsTitle: 'သတိပြုရန် / ကန့်သတ်ချက်များ',
        missingOrUnverifiedTitle: 'Missing / Unverified Data',
        failedRequirementsTitle: 'မပြည့်မီသေးသော Strategy Requirements',
        viewFullBreakdownBtn: 'အပြည့်အစုံ Breakdown ကြည့်မယ်',
        requiresHistoryBadge: 'History',
        primaryStrategyTag: 'Primary',
      },
      provenance: {
        sectionTitle: 'Metric Provenance & Phase 0 Verification Status',
        sectionSubtitle:
          'Field တစ်ခုချင်းစီသည် Verified Source၊ Derived (တွက်ချက်)၊ သို့မဟုတ် Unverified ဖြစ်ကြောင်း တိကျစွာ ခွဲခြားပြထားသည်။',
        metricCol: 'Metric',
        valueCol: 'တန်ဖိုး',
        statusCol: 'စစ်ဆေးမှု / အရင်းအမြစ်',
        derivedTag: 'တွက်ချက်ထား',
        sourceTag: 'မူရင်း Source',
        verifiedCountLabel: (verified: number, total: number) =>
          `Verified ${verified}/${total}`,
        cardUnverifiedNotice: (count: number) =>
          `Unverified metric ${count} ခုရှိ၍ Strategy စိစစ်မှုတွင် ထည့်မတွက်ထားပါ`,
        categories: {
          verified_source: 'Verified Source',
          derived: 'Derived (တွက်ချက်)',
          unverified: 'Unverified Unit/Scope',
          missing: 'မရှိသေး (Missing)',
          zero: 'Verified Zero',
          stale: 'Stale (>24h)',
          invalid: 'Invalid',
          unavailable: 'မရရှိနိုင်',
        },
        fields: {
          priceThb: 'Price (THB)',
          commissionRate: 'Commission Rate',
          commissionThb: 'Payout per Sale (THB)',
          revenueThb7d: '7d Total Revenue',
          salesVolume7d: '7d Units Sold',
          videoRevenueThb7d: '7d Video Revenue',
          liveRevenueThb7d: '7d Live Revenue',
          revenueGrowthRate: 'Revenue Growth Rate',
          creatorCount: 'Creator Count',
          rating: 'Product Rating',
          reviewCount: 'Review Count',
        },
        unverifiedCoreBanner: (count: number) =>
          `Metric ${count} ခုသည် Upstream Unit/Definition Unverified ဖြစ်နေ၍ Strategy Qualification တွင် ထည့်မတွက်ထားပါ`,
        syntheticRevenueBanner: 'Revenue ကို Price × Sales မှ Synthetic ခန့်မှန်းထားသည် (Confidence လျှော့ချထားသည်)',
      },
      dialog: {
        v2Subtitle:
          'Commercial Opportunity ကို Demand, Earning, Competition, Customer Quality ၄ ချက်ဖြင့် တွက်ချက်ထားပြီး Video Suitability ကို ဖယ်ထုတ်ထားပါသည်။',
        gateDecisionsTitle: 'Gate Decisions & Classification Logic',
        overallInsightsTitle: 'Key Strengths & Observations',
        dimensionSubmetrics: {
          revenueScore: 'Revenue Score',
          salesScore: 'Sales Vol Score',
          absDemand: 'Absolute Demand',
          growthRate: 'Verified Growth',
          payoutPerSale: 'Payout / Sale',
          commissionRate: 'Commission %',
          creators: 'Creators',
          rawRpc: 'Raw RPC',
          adjustedRpc: 'Adjusted RPC',
          bayesianRating: 'Bayesian Rating',
          rawRating: 'Raw Rating',
          reviews: 'Reviews',
        },
        usedMetricsLabel: 'Used metrics',
        excludedMetricsLabel: 'Excluded metrics',
        conversionSectionTitle: 'Conversion Evidence (Separate from Commercial Score)',
        videoShareLabel: 'Video Share',
        liveShareLabel: 'Live Share',
        strategyMatrixTitle: '8-Strategy Eligibility Matrix',
        strategyMatrixSub: 'Strategy တစ်ခုချင်းစီ၏ Qualification, Strategy Score နှင့် မပြည့်မီသေးသော အချက်များ',
        studioVisualRefTitle: 'Creative / Video Studio Reference (Commercial Score တွင် 0% ပါဝင်)',
        studioVisualRefNotice:
          'အောက်ပါ Visual cues များသည် Video ဖန်တီးမှုအတွက်သာ ဖြစ်ပြီး Commercial Opportunity Ranking တွင် လုံးဝ မပါဝင်ပါ။',
        v1SilentScoreLabel: 'Studio Visual Reference Score (V1)',
        pillarsSummaryTitle: 'အမှတ်စနစ် ၄ မျိုး ကွဲပြားချက်',
        pillarCommercial: 'Commercial Opportunity — Demand, Earning, Competition, Quality အပေါ်အခြေခံသည့် ဈေးကွက်အလားအလာ',
        pillarConversion: 'Conversion Evidence — ယခင် Video/Live ရောင်းအားအထောက်အထား (Commercial Score နှင့် သီးခြား)',
        pillarVideo: 'Video Suitability — Video Studio ဖန်တီးမှုအတွက်သာ (Commercial Ranking တွင် 0%)',
        pillarConfidence: 'Data Confidence — Verified ဖြစ်မှု၊ ပြည့်စုံမှုနှင့် Data လတ်ဆတ်မှု အဆင့်',
        nonGuaranteeDisclaimer:
          'Commercial Score မြင့်ခြင်း သို့မဟုတ် ယခင် Video ရောင်းအားရှိခြင်းသည် သင့် Affiliate Video အတွက် ရောင်းအားအာမခံချက် မဟုတ်ပါ။',
        evidenceSummary: {
          sectionTitle: 'ပစ္စည်းအလိုက် သက်သေခွဲခြမ်းစိတ်ဖြာမှု',
          whyDiscoveredLabel: 'အဘယ်ကြောင့် ဖော်ပြထားသလဲ',
          factsTitle: 'အတည်ပြုပြီး မူရင်းအချက်အလက်များ (Facts)',
          derivedTitle: 'တွက်ချက်ထားသော တန်ဖိုးများ (Derived)',
          unavailableTitle: 'မရရှိသေး / အတည်မပြုရသေးသော အချက်များ',
          heuristicsTitle: 'ဗီဒီယိုဖန်တီးမှု ခန့်မှန်းချက် (Heuristic — ရောင်းအားသက်သေမဟုတ်)',
          statusLabels: {
            QUALIFIED: 'အပြည့်အစုံ အတည်ပြုပြီး',
            PRELIMINARY: 'ကနဦးအဆင့် (Preliminary)',
            NOT_MONETIZABLE: 'ကော်မရှင် 0% (ဝင်ငွေမရ)',
            INSUFFICIENT_DATA: 'သက်သေမလုံလောက်သေး',
          },
        },
      },
      riskLabels: {
        EXTREME_COMPETITION: 'Extreme Competition',
        HIGH_COMPETITION: 'High Competition',
        ZERO_CREATORS_POSITIVE_REVENUE: '0 Creators w/ Revenue (Unexplained)',
        ZERO_COMMISSION: '0% Commission',
        NOT_MONETIZABLE: 'Not Monetizable',
        MISSING_COMMISSION: 'Missing Commission',
        MISSING_GROWTH: 'Missing Growth',
        UNVERIFIED_GROWTH_UNIT: 'Growth Unit Unverified',
        UNVERIFIED_CREATOR_DEFINITION: 'Creator Scope Unverified',
        UNVERIFIED_RATING_SEMANTICS: 'Rating Scope Unverified',
        UNVERIFIED_REVIEW_COUNT: 'Review Count Unverified',
        LOW_REVIEW_SAMPLE: 'Low Review Sample',
        POOR_CUSTOMER_QUALITY: 'Poor Customer Quality',
        MISSING_CUSTOMER_QUALITY: 'Missing Quality Data',
        MISSING_COMPETITION: 'Missing Competition Data',
        MISSING_DEMAND: 'Missing Demand Data',
        WEAK_DEMAND: 'Weak Demand',
        NEGATIVE_GROWTH: 'Negative Growth',
        STALE_DATA: 'Stale Data',
        SYNTHETIC_REVENUE: 'Synthetic Revenue',
        CONVERSION_DISCREPANCY: 'Channel Revenue Mismatch',
        LOW_DATA_CONFIDENCE: 'Low Data Confidence',
        LOW_PAYOUT: 'Low THB Payout',
      },
      formatRiskTag: (tag: string) => tag.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      metricsShort: {
        creators: 'Creators',
        adjRpc: 'Adj RPC',
        growth: 'Growth',
        payout: 'Payout',
        rating: 'Bay. Rating',
        reviews: 'Reviews',
        videoShare: 'Video Share',
        liveRev: 'Live Rev',
        unverified: 'Unverified',
        missing: 'Missing',
      },
      discoveryShortlist: {
        signalLabel: 'Discovery Signal',
        preliminaryTag: 'Preliminary',
        verifiedQualifiedTag: 'Qualified',
        snapshotHistoryLabel: (count: number) => `Snapshots: ${count}d`,
        categories: {
          STRONG_DEMAND_STRONG_VIDEO_SALES: 'Strong Demand + Strong Video Sales',
          STRONG_DEMAND_LOW_COMPETITION: 'Strong Demand + Low Competition',
          STRONG_AFFILIATE_EARNINGS: 'Strong Affiliate Earnings',
          EMERGING_OPPORTUNITY: 'Emerging Opportunity',
          HIGH_DEMAND_HIGH_COMPETITION: 'High Demand · High Competition',
          INSUFFICIENT_EVIDENCE: 'Insufficient Evidence',
        },
      },
      historicalTrend: {
        sectionTitle: 'ရက်ပေါင်းစုံ သမိုင်းလမ်းကြောင်း (Historical Trend)',
        sectionSubtitle:
          'စစ်မှန်သော local မှတ်တမ်းများမှသာ တွက်ချက်ထားသည် (Commercial Score နှင့် သီးခြား)',
        trustScopeLabel: 'Local Observed Only',
        metricCol: 'တိုင်းတာချက်',
        rangeCol: 'အစ → နောက်ဆုံး',
        deltaCol: 'ပြောင်းလဲမှု',
        statusCol: 'လမ်းကြောင်း',
        zeroBaselineTag: 'Zero Base',
        allZeroTag: 'All 0',
        observationSpanLabel: (count: number, spanDays: number | null) =>
          spanDays !== null ? `${count}d · ${spanDays} ရက်ကာလ` : `${count}d local`,
        classifications: {
          RISING: 'တက်နေသည်',
          STABLE: 'တည်ငြိမ်',
          DECLINING: 'ကျနေသည်',
          VOLATILE: 'အတက်အကျများ',
          INSUFFICIENT_HISTORY: 'မှတ်တမ်းမလုံလောက်သေး',
          INCOMPARABLE_DATA: 'နှိုင်းယှဉ်မရ',
        },
        metrics: {
          revenue: '၇ ရက် ဝင်ငွေ',
          salesVolume: '၇ ရက် ရောင်းအား',
          videoRevenue: 'ဗီဒီယို ဝင်ငွေ',
          liveRevenue: 'Live ဝင်ငွေ',
          shoppingMallRevenue: 'Mall / Showcase ဝင်ငွေ',
          unitPrice: 'ဈေးနှုန်း',
          commissionRate: 'ကော်မရှင်နှုန်း',
        },
      },
      detailTrend: {
        sectionTitle: 'နေ့စဉ် ဘတ်ဝင်ငွေလမ်းကြောင်း (/detail Verified)',
        sectionSubtitle: 'Kalodata /detail မှ နေ့စဉ် THB ဝင်ငွေအတိအကျဖြင့် တွက်ချက်ထားသည် (Commercial Score နှင့် သီးခြား)',
        last7VsPrev7: 'နောက်ဆုံး 7d vs ရှေ့ 7d',
        dailyAvg: 'တစ်ရက်ပျမ်းမျှ',
        dailyRange: 'အနည်းဆုံး – အများဆုံး',
        activeDays: 'ရောင်းအားရှိရက်',
        activeCreatorsLabel: (windowTag: string) => `Active Creators (${windowTag} Verified)`,
        revPerActiveCreatorLabel: 'ဝင်ငွေ / Active Creator',
        lifetimeReviewsLabel: 'တစ်သက်တာ PDP Reviews',
        informationalScopeNote:
          'Active Creators နှင့် Lifetime Reviews သည် အချက်အလက်ကိုးကားရန်သာဖြစ်ပြီး ရောင်းထွက်သူခွဲဝေမှုနှင့် Star Rating မပါသဖြင့် Commercial Score တွင် မထည့်တွက်ပါ။',
        detailWindowLabel: 'Detail ကာလ:',
        detailWindow7d: '7d',
        detailWindow30d: '30d (Daily Trend)',
      },
      discoveryFilter: {
        barAriaLabel: 'Affiliate စစ်ထုတ်မှုနှင့် စီစဉ်မှု',
        presets: {
          all: 'အားလုံး',
          monetizable_only: 'ကော်မရှင်ရ',
          video_proven: 'ဗီဒီယိုရောင်းအားရှိ',
          strong_earnings: 'ကော်မရှင်ကောင်း',
          rising_trend: 'တက်နေသည်',
        },
        sortLabel: 'စီစဉ်မှု',
        sortOptions: {
          search_score_desc: 'Search အမှတ် (0.2 cr)',
          intelligence: 'Intelligence အဆင့်',
          video_revenue_desc: 'ဗီဒီယိုဝင်ငွေ (အများဆုံး)',
          payout_desc: '၁ ခုကော်မရှင် (฿)',
          commission_desc: 'ကော်မရှင် % (အများဆုံး)',
          revenue_desc: '၇ ရက် ဝင်ငွေ (အများဆုံး)',
          sales_desc: '၇ ရက် ရောင်းအား (အများဆုံး)',
        },
        minCommissionLabel: 'ကော်မရှင်',
        minVideoShareLabel: 'ဗီဒီယိုအချိုး',
        priceBandLabel: 'ဈေးနှုန်း',
        anyOption: 'အားလုံး',
        priceBands: {
          all: 'အားလုံး',
          under_300: '≤ ฿300',
          '300_1000': '฿300 – ฿1,000',
          over_1000: '> ฿1,000',
        },
        resetBtn: 'ပြန်ဖျက်',
        showingCount: (shown: number, total: number) => `${shown} / ${total} ခု ပြသနေသည်`,
        zeroCreditHint: 'Local စစ်ထုတ်မှု (0 cr)',
        emptyTitle: 'ရွေးထားသော စစ်ထုတ်မှုနှင့် ကိုက်ညီသော ပစ္စည်းမရှိပါ',
        emptyDesc: 'စစ်ထုတ်မှုအချို့ကို လျှော့ကြည့်ပါ သို့မဟုတ် ပြန်ဖျက်ပြီး ပစ္စည်းအားလုံးကို ကြည့်ပါ။',
        loadMoreBtn: (nextPage: number, pageSize = 100) =>
          `နောက်ထပ် ${pageSize} ခု ရှာမယ် (Page ${nextPage} · ~0.2 cr)`,
        loadingMoreBtn: 'နောက်ထပ်ပစ္စည်းများ ခေါ်ယူနေသည်...',
        loadedMoreToast: (added: number, page: number, fromCache: boolean) =>
          fromCache
            ? `Page ${page} မှ ပစ္စည်းအသစ် ${added} ခု ထပ်ထည့်ပြီး (0 cr · Cache)`
            : `Page ${page} မှ ပစ္စည်းအသစ် ${added} ခု ထပ်ထည့်ပြီး`,
        cachedSearchToast: '၁၀ မိနစ်အတွင်း Cache မှ ချက်ချင်းပြန်ခေါ်ပေးသည် (0 cr)',
        allLoadedNote: (count: number) => `စုစုပေါင်း ပစ္စည်း ${count} ခု ခေါ်ယူပြီးပါပြီ`,
      },
      searchDrawer: {
        title: 'ရှာဖွေမှုနှင့် Filter ချိန်ညှိမယ်',
        subtitle: 'Category၊ အရေအတွက်၊ Product Link နှင့် Affiliate Filter များကို ချိန်ပြီး Live ရှာဖွေပါ',
        closeAria: 'ရှာဖွေမှု Drawer ပိတ်မယ်',
        keywordOrLinkLabel: 'Keyword သို့မဟုတ် Product Link / ID',
        keywordOrLinkPlaceholder: 'ပစ္စည်းနာမည် ရိုက်ရှာပါ သို့မဟုတ် TikTok Shop / Kalodata Link ထည့်ပါ...',
        keywordOrLinkHint: 'TikTok Shop App Short Link (vt.tiktok.com)၊ Link အပြည့်အစုံ သို့မဟုတ် ဂဏန်း Product ID ထည့်ပါက ထိုပစ္စည်း ၁ ခုတည်းကိုသာ တိုက်ရိုက်စစ်ပေးပါမည်',
        categoriesLabel: 'Categories (တစ်ခုထက်ပိုရွေးနိုင်)',
        categoriesDisabledInLinkMode: 'Product Link စစ်နေချိန်တွင် Category နှင့် အရေအတွက် ရွေးချယ်မှုကို အလိုအလျောက် ပိတ်ထားပါသည်',
        countLabel: 'ရှာမည့် ပစ္စည်းအရေအတွက်',
        countUnit: (n: number) => `${n} ခု`,
        recommendedTag: 'အကြံပြု',
        countCostNote: '20 / 50 / 100 ခုအားလုံး Credit ကုန်ကျစရိတ် 0.20 cr အတူတူပဲ (100 ခုက Kalodata အများဆုံး)',
        windowLabel: 'ရောင်းအားကာလ',
        window7d: '၇ ရက် (7d)',
        window30d: '၃၀ ရက် (30d)',
        windowNote: '7d သည် လက်ရှိခေတ်စားနေသော Trend ကိုမြင်စေပြီး 30d သည် တည်ငြိမ်သော လစဉ်ရောင်းအားကို ပြသည်',
        affiliateFiltersLabel: 'Affiliate Filter & စီစဉ်မှု (0 cr)',
        affiliateFiltersHint: 'ရှာတွေ့သောရလဒ်များကို အလိုအလျောက် စစ်ထုတ်စီစဉ်ပေးမည် (Credit ထပ်မကုန်ပါ)',
        affiliateFiltersDisabledInLinkMode: 'Product Link စစ်ချိန်တွင် ထိုပစ္စည်းကို အပြည့်အစုံမြင်ရစေရန် Filter ကို အလိုအလျောက် ဖွင့်ပေးထားပါမည်',
        presetLabel: 'အမြန်စစ်ထုတ်မှု (Shortlist)',
        resetDefaultsBtn: 'Recommended Default ပြန်ချိန်',
        cancelBtn: 'ပိတ်မယ်',
        submitRankBtn: (count: number, cost: number) => `ပစ္စည်း ${count} ခု ရှာမယ် (~${cost} cr)`,
        submitLinkBtn: (cost: number) => `Link ပစ္စည်းစစ်မယ် (~${cost} cr)`,
        summaryRank: (count: number, windowTag: string, presetLabel: string, cost: number) =>
          `${count} ခု · ${windowTag} · ${presetLabel} · ~${cost} cr`,
        summaryLink: (productId: string, cost: number) =>
          `Product ID ${productId} · ~${cost} cr`,
        summaryShortLink: (cost: number) =>
          `TikTok Short Link (အလိုအလျောက် ဖွင့်ထုတ်မည်) · ~${cost} cr`,
        activeScopeSummary: (count: number, windowTag: string, presetLabel: string) =>
          `Default: ${count} ခု · ${windowTag} · ${presetLabel}`,
        openDrawerBtn: 'Filter & ရှာမယ်',
      },
      searchScore: {
        title: 'Search အမှတ် (0.2 cr Data ဖြင့်သာ)',
        badgeShort: 'Search မှတ်',
        subtitle:
          'Kalodata Search မှ Verified Data များဖြင့်သာ တွက်ချက်ထားသော Affiliate အလားအလာအမှတ် (Credit ထပ်မကုန်ပါ)',
        rankDataOnlyNote: '0.20 cr Search Data ဖြင့်သာ တွက်ချက်ထားသည်',
        deepStudioHint:
          'ပြိုင်ဆိုင်မှု (Creator အရေအတွက်) နှင့် Review/Rating ကို စစ်ဆေးလိုပါက Studio ထဲတွင် Kalodata Deep Data ထပ်ယူ၍ AI သုံးသပ်ချက်နှင့် Video Plan ဆွဲနိုင်ပါသည်။',
        rawScoreLabel: 'မကန့်သတ်မီ အမှတ်',
        videoPoolLabel: 'Video ကော်မရှင်အိုး',
        payoutPerSaleLabel: '၁ ခုကော်မရှင်',
        videoShareLabel: 'Video ရောင်းအားအချိုး',
        dominantChannelLabel: 'အဓိကရောင်းလမ်းကြောင်း',
        capsTitle: 'ဘေးကင်းရေး ကန့်သတ်ချက်',
        compositionTitle: 'အမှတ်ပေါင်းစပ်ပုံ (100 မှတ်)',
        channelsTitle: 'ရောင်းအားလမ်းကြောင်း',
        priceSweetSpotTitle: 'ဈေးနှုန်း Sweet Spot',
        earningSnapshotTitle: 'Affiliate အမြတ်ခန့်မှန်းချက်',
        est100SalesLabel: '×100 ခု ရောင်းရလျှင်',
        dailyTrendTitle: 'နေ့စဉ်ဝင်ငွေ လမ်းကြောင်း (/detail)',
        activeCreatorsShort: 'Active Creators',
        channelShort: {
          video: 'Short Video',
          live: 'Live',
          mall: 'Showcase / Mall',
        },
        priceZones: {
          sweet: 'Sweet Spot',
          mid: 'သင့်တင့်',
          low: 'ဈေးနည်း',
          high: 'ဈေးမြင့်',
        },
        pillars: {
          demand: { label: 'ဝယ်လိုအား', short: 'ဝယ်လိုအား', weightLabel: '30%' },
          earning: { label: 'ကော်မရှင်အမြတ်', short: 'ကော်မရှင်', weightLabel: '30%' },
          videoProof: { label: 'Video ရောင်းအား', short: 'Video', weightLabel: '25%' },
          priceFit: { label: 'ဈေးနှုန်းသင့်တော်မှု', short: 'ဈေးနှုန်း', weightLabel: '15%' },
        },
        grades: {
          TOP: 'ထိပ်တန်းရွေးချယ်မှု',
          STRONG: 'အလားအလာကောင်း',
          MODERATE: 'သင့်တင့်',
          WEAK: 'အားနည်း',
          NOT_MONETIZABLE: '0% ကော်မရှင်',
          INSUFFICIENT: 'Data မစုံသေး',
        },
        channels: {
          VIDEO: 'Short Video ဦးဆောင်',
          LIVE: 'Live ဦးဆောင်',
          SHOWCASE: 'Showcase / Mall ဦးဆောင်',
          BALANCED: 'မျှတသောလမ်းကြောင်း',
          UNKNOWN: 'မသိရသေး',
        },
        caps: {
          WEAK_DEMAND_CAP: 'ဝယ်လိုအားနည်းသဖြင့် အများဆုံး 42 မှတ်တွင် ကန့်သတ်ထားသည်',
          NO_VIDEO_SALES_CAP: 'Short Video ရောင်းအား ฿0 ဖြစ်၍ အများဆုံး 58 မှတ်တွင် ကန့်သတ်ထားသည်',
          LIVE_DEPENDENT_CAP: 'Live အပေါ် အဓိကမှီခို (≥60% Live, <10% Video) ဖြစ်၍ 68 မှတ်တွင် ကန့်သတ်ထားသည်',
          MISSING_VIDEO_DATA_CAP: 'Video ဝင်ငွေအချက်အလက် မပါဝင်သဖြင့် 75 မှတ်တွင် ကန့်သတ်ထားသည်',
        },
      },
    },
    rankBoard: {
      title: 'Thailand TikTok Shop အဆင့်ဇယား',
      subtitle:
        'ထိုင်း TikTok Shop ဈေးကွက်တစ်ခုလုံး၏ ထိပ်တန်းပစ္စည်း ၁၀၀ နှင့် Category အလိုက် ရောင်းအားဝေစုကို Chart နှင့် ခွဲခြမ်းစိတ်ဖြာမှုများဖြင့် ကြည့်ရှုပါ။',
      syncBtn: (cost: number) => `Data အသစ်ဆွဲမယ် (~${cost} cr)`,
      syncingBtn: 'TikTok Shop Data ဆွဲနေသည်...',
      timeframe7d: '၇ ရက် (7d)',
      timeframe30d: '၃၀ ရက် (30d)',
      lastSyncedLabel: 'နောက်ဆုံး Sync',
      productsUnit: (n: number) => `ပစ္စည်း ${n} ခု`,
      categoriesUnit: (n: number) => `Category ${n} ခု`,
      staleNotice: 'ဤအဆင့်ဇယားသည် ၂၄ နာရီကျော်ကြာပြီဖြစ်၍ နောက်ဆုံးဈေးကွက်အတွက် Update Sync နှိပ်ပေးပါ။',
      emptyTitle: 'ထိုင်း TikTok Shop ပင်မဈေးကွက် Data ကို စတင်ဆွဲယူပါ',
      emptyDesc:
        'Update Sync ခလုတ်နှိပ်လိုက်သည်နှင့် Kalodata မှ ထိပ်တန်းပစ္စည်း ၁၀၀ နှင့် L1 Category Market Share ကို တစ်ခါတည်း ဆွဲယူပြီး Browser တွင် အလိုအလျောက် သိမ်းပေးထားပါမည် (Tab ပြောင်းရုံဖြင့် Credit လုံးဝမကုန်ပါ)။',
      emptyBullets: [
        'Video vs Live vs Shop ချန်နယ်အလိုက် ဝင်ငွေခွဲခြမ်းမှု (Donut Chart & Stacked Bar)',
        'Category အလိုက် ဈေးကွက်ဝေစု Progress Bars — နှိပ်၍ ဇယားနှင့် Matrix ကို ချက်ချင်းစစ်နိုင်သည်',
        'ဈေးနှုန်း (฿) × ကော်မရှင် (%) Opportunity Matrix — Sweet Spot (฿100–฿600 · ≥10%) ပစ္စည်းများကို တန်းမြင်နိုင်သည်',
        'ကြိုက်နှစ်သက်ရာ ပစ္စည်းကို နှိပ်၍ Video Studio သို့ တိုက်ရိုက်ဖွင့်နိုင်သည် (0 cr)',
      ],
      emptyCtaBtn: (cost: number) => `Update Sync စတင်မယ် (~${cost} cr)`,
      connectPromptNote: 'Data ဆွဲယူရန် အပေါ်ညာဘက်မှ Kalodata API Key ကို ဦးစွာချိတ်ဆက်ပေးပါ။',
      loadingNote: 'ထိုင်း TikTok Shop ထိပ်တန်းပစ္စည်း ၁၀၀ နှင့် Category Market Share ကို Kalodata မှ ဆွဲယူနေပါသည်...',
      syncedToast: (count: number, catCount: number) =>
        `TikTok Shop ပစ္စည်း ${count} ခု နှင့် Category ${catCount} ခုကို Update Sync လုပ်ပြီးပါပြီ။`,
      kpiGmvTitle: 'Top 100 စုစုပေါင်းဝင်ငွေ',
      kpiGmvSub: (windowTag: string) => `${windowTag} ထိုင်းဈေးကွက် GMV`,
      kpiUnitsTitle: 'စုစုပေါင်း ရောင်းအား',
      kpiUnitsSub: (monetizable: number, total: number) =>
        `ကော်မရှင်ရ ပစ္စည်း ${monetizable} / ${total}`,
      kpiVideoShareTitle: 'Short Video ဝေစု',
      kpiVideoShareSub: (provenCount: number) => `Video ရောင်းအားသက်သေ ${provenCount} ခု`,
      kpiAvgCommTitle: 'ပျမ်းမျှ ကော်မရှင်',
      kpiAvgCommSub: (avgPayout: string, sweetSpot: number) =>
        `ပျမ်းမျှ ${avgPayout}/ခု · Sweet Spot ${sweetSpot} ခု`,
      channelSectionTitle: 'ရောင်းအားချန်နယ် ခွဲခြမ်းမှု',
      channelSectionSub: 'Video၊ Live နှင့် Shop/Mall ဝင်ငွေအချိုး (နှိပ်၍ ဇယားစစ်နိုင်သည်)',
      channelVideo: 'Short Video',
      channelLive: 'Live Stream',
      channelShop: 'Shop / Mall',
      channelDominantLabel: 'အများဆုံးချန်နယ်',
      channelClickHint: 'ချန်နယ်တစ်ခုကို နှိပ်၍ ထိုချန်နယ်ဦးဆောင်ပစ္စည်းများ စစ်ကြည့်နိုင်သည်',
      categorySectionTitle: 'Category အလိုက် ဈေးကွက်ဝေစု',
      categorySectionSubLive: 'Kalodata ထိုင်း L1 Category ဈေးကွက်ဝင်ငွေအဆင့် (နှိပ်၍ Filter လုပ်နိုင်သည်)',
      categorySectionSubAgg: 'Top 100 ပစ္စည်းများ၏ ဝင်ငွေအပေါ် စုစည်းတွက်ချက်ထားသည် (နှိပ်၍ Filter လုပ်နိုင်သည်)',
      categorySourceLiveTag: 'TH Market L1',
      categorySourceAggTag: 'Top 100 စုစည်းမှု',
      categoryTop100Count: (n: number) => `Top 100 ထဲ ${n} ခု`,
      categoryClickHint: 'Category နှိပ်၍ အောက်ပါ Matrix နှင့် ဇယားကို ချက်ချင်း Filter လုပ်ပါ',
      matrixSectionTitle: 'ဈေးနှုန်း × ကော်မရှင် Opportunity Matrix',
      matrixSectionSub: 'အစက်အရွယ်အစား = ဝင်ငွေပမာဏ · အစက်ကို နှိပ်၍ ပစ္စည်းအသေးစိတ်ကြည့်ပြီး Video Studio ဖွင့်ပါ',
      matrixSweetSpotLabel: 'Sweet Spot (฿100–฿600 · ≥10%)',
      matrixLegendVideo: 'Video ဦးဆောင်',
      matrixLegendLive: 'Live ဦးဆောင်',
      matrixLegendOther: 'Shop / အခြား',
      matrixAxisPrice: 'ဈေးနှုန်း (THB)',
      matrixAxisComm: 'ကော်မရှင် (%)',
      matrixTapHint: 'အစက်တစ်ခုကို နှိပ်ပါ',
      matrixInspectorEmpty: 'Chart ထဲမှ ပစ္စည်းအစက်တစ်ခုကို နှိပ်လိုက်ပါက အချက်အလက်အပြည့်အစုံနှင့် Video Studio ခလုတ် ပေါ်လာပါမည်။',
      matrixOpenStudioBtn: 'Video Studio ဖွင့်မယ်',
      tableSectionTitle: 'ထိပ်တန်းပစ္စည်း အဆင့်ဇယား',
      tableSectionSub: (shown: number, total: number) =>
        `ပစ္စည်း ${shown} / ${total} ခု ပြသနေသည် · နှိပ်၍ Video Studio သို့ တိုက်ရိုက်ဖွင့်နိုင်သည် (0 cr)`,
      searchPlaceholder: 'ပစ္စည်းနာမည်၊ ဆိုင် သို့မဟုတ် Category ရှာမယ် (0 cr)...',
      filterAll: 'အားလုံး',
      filterVideoProven: 'Video သက်သေရှိ',
      filterHighComm: 'ကော်မရှင် ≥10%',
      filterSweetSpot: 'Sweet Spot',
      clearAllFilters: 'Filter အားလုံးဖြုတ်မယ်',
      activeCategoryFilter: (name: string) => `Category: ${name}`,
      activeChannelFilter: (name: string) => `ချန်နယ်: ${name}`,
      colRank: '#',
      colProduct: 'ပစ္စည်းနှင့် ဆိုင်',
      colPrice: 'ဈေးနှုန်း',
      colRevenue: 'ဝင်ငွေ (GMV)',
      colUnits: 'ရောင်းအား',
      colCommission: 'ကော်မရှင်',
      colPayout: '၁ ခုအမြတ်',
      colChannels: 'Video / Live / Shop',
      colScore: 'အမှတ်',
      openStudioAction: 'Studio',
      noMatchesTitle: 'ရွေးထားသော Filter နှင့် ကိုက်ညီသည့် ပစ္စည်းမတွေ့ပါ',
      noMatchesDesc: 'Category၊ ချန်နယ် သို့မဟုတ် ရှာဖွေမှုစာသားကို ပြန်ဖြုတ်၍ အားလုံးကြည့်နိုင်ပါသည်။',
      sortLabel: 'စီစဉ်ပုံ',
    },
  },
  en: {
    nav: {
      discover: 'Discover',
      rankBoard: 'Rank Board',
      searchHistory: 'Search History',
      history: 'Saved Products',
      toggleThemeLight: 'Switch to Light Mode',
      toggleThemeDark: 'Switch to Dark Mode',
      connectApiShort: 'Connect API',
      creditsShort: 'cr',
    },
    search: {
      placeholder: 'Search keyword or paste product link...',
      openSearchBoxBtn: 'Keyword / Product Link',
      closeSearchBoxBtn: 'Hide Search Box',
      searchButton: 'Search',
      searchingButton: 'Searching...',
      searchSingleButton: 'Find Product',
      multiCategoryHint: 'Tap categories to filter current results (0 cr) or press Search for live results',
      selectedCount: (n: number) => `${n} selected`,
      clearCategories: 'Clear',
      syncCategoriesBtn: 'Live Categories (~0.2 cr)',
      syncingCategoriesBtn: 'Syncing...',
      liveSyncedTag: 'Live TH Categories',
      linkModeNotice: (productId: string) =>
        `Product Link (ID: ${productId}) — searching this 1 product only (~0.2 cr · Product Detail)`,
      shortLinkNotice:
        'TikTok Shop app short link detected — Product ID will be resolved automatically to check this 1 product (~0.2 cr)',
      invalidLinkNotice:
        'No TikTok Shop Product ID found in that link. Please paste the full product link or numeric Product ID.',
    },
    discover: {
      resultsHeading: 'Affiliate Product Discovery',
      singleResultHeading: 'Product from Link',
      resultsSubtext:
        'Ranked by 0–100 Search Score across Demand, Affiliate Earning, Video Sales Proof, and Price Fit.',
      singleResultSubtext: 'Fetched directly from Kalodata for your pasted product link.',
      noResultsTitle: 'No matching products found',
      noResultsDesc: 'Try another keyword, category selection, or product link.',
      retry: 'Try Again',
      loadingNote: 'Searching Kalodata Thailand TikTok Shop...',
      loadingSingleNote: 'Fetching product details from Kalodata...',
      cachedNote: 'Loaded from cache (0 cr)',
      refreshLiveBtn: 'Refresh Live (~0.2 cr)',
      staleSnapshotNotice: 'Snapshot is >24h old (Stale) — run Live Refresh for current Thailand TikTok Shop data.',
      aiFallbackNotice:
        'Kalodata products loaded safely (no credits wasted) — AI summary timed out. Retry below for 0 Kalodata credits.',
      retryAiBtn: 'Retry AI Explanation (0 Kalodata cr)',
      retryingAiBtn: 'Generating AI summary...',
      filteredEmptyTitle: 'No products in current results match this category',
      filteredEmptyDesc: (total: number) =>
        `None of the ${total} currently loaded products match this selection. Run a live Kalodata search in this category or clear the filter.`,
      searchSelectedCategoryBtn: 'Search Live in Selected Category',
      clearFilterBtn: 'Show All Current Results (0 cr)',
      filteredCountNote: (shown: number, total: number) =>
        `Filtered ${shown} of ${total} results (0 cr)`,
      viewList: 'List View',
      viewGrid: 'Grid View',
      gridColsLabel: (n: number) => `${n} columns`,
      openStudioShort: 'Studio',
      zoomIn: 'Zoom in cards',
      zoomOut: 'Zoom out cards',
      pinchZoomHint: 'Pinch with two fingers to resize view',
      microViewTag: 'Image + Name',
      listCompactTag: 'Compact',
      listDetailedTag: 'Detailed',
      emptyGuideTitle: 'Discover high-potential affiliate products',
      emptyGuideDesc:
        'Pick categories, adjust filters, or paste a TikTok Shop product link. Every product is scored from 0–100 on real Kalodata sales and commission signals.',
      emptyGuidePoints: [
        'Demand (30%) & Video Proof (25%) — highlights products actively selling through TikTok videos',
        'Affiliate Earning (30%) — combines commission rate, payout per sale, and video commission pool',
        'Price Fit (15%) — scores impulse-buy price suitability and opens Product Studio for AI video plans',
      ],
      emptyGuideDisclaimer:
        'Note: Search scores reflect recent 7-day Kalodata sales signals and do not guarantee future affiliate conversions.',
    },
    card: {
      thaiOriginal: 'Thai TikTok listing',
      whatItIs: 'What it is',
      silentEdge: 'Why silent video sells it',
      price: 'Price',
      commission: 'Commission',
      sales7d: '7d Sales',
      videoRev7d: '7d Video Rev',
      revenue7d: '7d Revenue',
      unitsSuffix: '',
      perSale: 'per sale',
      createPlan: 'Open Product Studio',
      openSavedPlan: 'Open Studio',
      savedTag: 'Saved',
      saveShort: 'Save',
      saveProduct: 'Save product',
      unsaveProduct: 'Remove from saved',
      savedProductToast: 'Saved to Saved Products.',
      removedProductToast: 'Removed from Saved Products.',
      analyzedTag: 'AI Analyzed',
      deepDataTag: 'Deep Data',
      copyThai: 'Copy Thai Name',
      copyId: 'Copy ID',
      copiedShort: 'Copied',
      explainAiBtn: 'AI Explain',
      explainingAiBtn: 'Explaining...',
      explainAllBtn: 'AI Explain All (0 cr)',
      explainingAllBtn: 'Explaining all...',
      aiExplainedTag: 'AI Explained',
      openTikTokShop: 'Open Original on TikTok Shop',
      openTikTokShort: 'TikTok Shop',
    },
    score: {
      tooltipBtn: 'Inspect Search Score visual breakdown',
      dialogSubtitle: 'Visual breakdown of Demand, Affiliate Earning, Video Sales Proof, and Price Fit.',
      metricVisualLabel: 'Visual Demo Strength',
      metricVisualDesc: 'How immediately the product sells itself on screen with zero spoken words',
      metricAiLabel: 'AI Video Suitability',
      metricAiDesc: 'How cleanly it renders in macro, ASMR, studio, or before/after AI clips',
      metricDemandLabel: 'Sales & Price Momentum',
      metricDemandDesc: 'Thailand TikTok Shop demand paired with impulse-buy price sweet spot',
      metricCommissionLabel: 'Affiliate Commission',
      metricCommissionDesc: 'Affiliate percentage rate and baht payout earned per sale',
      penaltyLabel: 'Verbal Explanation Penalty',
      penaltyDesc: 'Points deducted if the product typically needs spoken claims to sell',
      ptsUnit: 'pts',
      closeBtn: 'Close',
      grades: {
        top: 'Top Pick',
        strong: 'Strong',
        fair: 'Moderate',
        low: 'Low',
      },
    },
    recent: {
      heading: 'Recent Searches',
      savedLocallyTag: 'Auto-saved in browser · 0 cr',
      clearAll: 'Clear all',
      defaultBestLabel: 'Best Matches',
      linkLabel: 'Product Link',
      itemsCount: (n: number) => `${n} items`,
      loadedFromStorageNote: 'Latest saved search (0 cr)',
      viewingOlderNote: 'Viewing saved search from history (0 cr)',
      backToLatestBtn: 'Back to Latest',
      viewAllHistoryBtn: 'All Search History',
      removeAria: 'Remove recent search',
    },
    searchHistoryPage: {
      title: 'Search History',
      subtitle: 'Every live Kalodata search is automatically saved here. Reopen any previous search result anytime at 0 credits.',
      searchPlaceholder: 'Filter history by keyword, category, or product name...',
      totalCount: (n: number) => `${n} saved ${n === 1 ? 'search' : 'searches'}`,
      clearAllBtn: 'Clear All',
      confirmClearAll: 'Confirm Clear',
      cancel: 'Cancel',
      latestTag: 'Latest',
      modeCategory: 'Category Search',
      modeKeyword: 'Keyword Search',
      modeLink: 'Product Link',
      modeDefault: 'Best Matches',
      openResultsBtn: 'View Results (0 cr)',
      deleteBtn: 'Delete',
      confirmDelete: 'Confirm',
      emptyTitle: 'No search history yet',
      emptyDesc: 'Run a live search on Discover — your results will automatically appear here.',
      noFilterMatches: 'No saved searches match your filter.',
      goDiscover: 'Explore Products',
      creditsSpent: (c: number) => `${c} cr used`,
    },
    studio: {
      backToResults: 'Back to Results',
      backToRankBoard: 'Back to Rank Board',
      backToHistory: 'Back to Saved Products',
      copyFullKit: 'Copy Full Plan',
      copied: 'Copied',
      copy: 'Copy',
      regenerate: 'Regenerate',
      styleLabel: 'Visual style',
      generatingTitle: 'Building your zero-speech AI video plan',
      generatingDesc: 'Crafting silent visual hooks, shot-by-shot storyboard, AI prompts, and Thailand TikTok SEO...',
      autoSaved: 'Saved automatically to Saved Products',
      sectionConcept: '01. Silent Visual Concept',
      sectionHooks: '02. Visual Hooks (0–3s)',
      sectionStoryboard: '03. Shot-by-Shot Silent Script',
      sectionPrompts: '04. AI Video & Keyframe Prompts',
      sectionSeo: '05. TikTok Thailand SEO',
      jumpConcept: 'Concept',
      jumpHooks: 'Hooks',
      jumpScript: 'Script',
      jumpPrompts: 'AI Prompts',
      jumpSeo: 'TikTok SEO',
      jumpMaster: 'Master Prompt',
      masterPromptTitle: '04-B. All-in-One Master Video Prompt (0-15s Complete Sequence)',
      masterPromptSub: 'Compiles the entire 0-15s silent video sequence (Hook, Storyboard scenes, ASMR audio cues, and Thai text overlays) into a single master prompt for Veo / Kling / Runway / Sora.',
      visualDirectionLabel: 'Visual Direction',
      onScreenThaiLabel: 'Thai On-Screen Text',
      meaningLabel: 'Meaning',
      timeCol: 'Time',
      visualCol: 'Visual & Camera Move',
      soundCol: 'ASMR / Sound (No Speech)',
      screenTextCol: 'Thai Overlay & Meaning',
      videoPromptsSub: 'AI Video Prompts (Veo / Kling / Runway / Sora)',
      imagePromptsSub: 'Keyframe Image Prompts (Start Frame)',
      thaiCaptionLabel: 'Thai TikTok Caption',
      hashtagsLabel: 'Hashtags',
      keywordsLabel: 'Search Keywords',
      postingTipLabel: 'Conversion Tip',
      copyAllHashtags: 'Copy All Hashtags',
      noSpeechNote: 'Zero-Speech AI Visual Format',
      copyThaiText: 'Copy Thai',
      deepToggleTitle: 'Fetch Kalodata Deep Data for This Product (Optional)',
      deepToggleHint: 'Automatically saved permanently in browser storage once fetched (does not auto-generate Video Plan)',
      deepOptDetailTitle: 'Product Details',
      deepOptDetailDesc: 'Exact shop name & full seller description',
      deepOptSpecsTitle: 'Selling Specs & Highlights',
      deepOptSpecsDesc: 'Key product selling points & attributes',
      deepOptCommentsTitle: 'Buyer Reviews & Pain Points',
      deepOptCommentsDesc: 'Real Thai buyer pain points & usage scenarios',
      deepFetchBtn: (cost: number) => `Fetch Selected Deep Data (~${cost} cr)`,
      deepFetchingBtn: 'Fetching Kalodata Deep Data...',
      deepFetchedBadge: 'Saved in Storage',
      deepHighlightsLabel: 'Selling Highlights',
      deepPainPointsLabel: 'Buyer Pain Points',
      deepUsageLabel: 'Usage Scenarios',
      deepDescLabel: 'Seller Description',
      deepUpgradedToast: 'Kalodata deep data fetched and saved to browser storage.',
      deepPartialWarning: (layers: string[]) =>
        `Some Kalodata layers failed (${layers.join(', ')}) — partial data was saved safely.`,
      growthUnverifiedShort: 'Unverified unit',
      deepSelectOneHint: 'Select at least 1 option to fetch.',
      deepSavedTag: 'Saved',
      deepSavedStorageNote: 'Saved permanently in your browser storage — no need to fetch again.',
      deepDataHeading: 'Fetched Kalodata Deep Data',
      deepCopyDataBtn: 'Copy Data',
      deepManageFetchBtn: 'Fetch Options',
      deepHideFetchBtn: 'Hide Options',
      deepMetricShop: 'Shop Name',
      deepMetricLiveRev7d: '7d Live Revenue',
      deepMetricCreators: 'Active Creators',
      deepMetricRating: 'Rating / Reviews',
      deepNoDescReturned: 'Fetched — seller has not provided a text description on TikTok Shop.',
      deepNoSpecsReturned: 'Fetched — no selling specs/highlights listed on Kalodata for this item.',
      deepNoCommentsReturned: 'Fetched — no buyer review insights available on Kalodata yet.',
      deepShowMore: 'Show full description',
      deepShowLess: 'Show less',
      readyTitle: 'Ready to generate your Silent AI Video Plan',
      readyDesc: 'Choose a visual style below (and optionally fetch Kalodata Deep Data or run AI Product Analysis above), then click Generate.',
      generateNowBtn: 'Generate Video Plan',
      confirmGenTitle: 'Confirm Video Plan Generation',
      confirmRegenTitle: 'Confirm Regenerate Video Plan',
      confirmGenDesc: 'This will generate a complete zero-speech AI Video Kit (Hooks, Storyboard, AI Prompts & Thailand TikTok SEO) using your selected style.',
      confirmStyleLabel: 'Selected Visual Style',
      confirmDeepIncluded: 'Saved Kalodata Deep Data will be included',
      confirmDeepNotIncluded: 'No Kalodata Deep Data yet (will generate from standard product details)',
      confirmProceedBtn: 'Confirm & Generate',
      confirmCancelBtn: 'Cancel',
      savedStyleMark: 'Saved',
      videoSectionTitle: 'Silent AI Video Ideas Generator',
      commercialStudioNotice:
        'Commercial Opportunity measures market signals separately from Video Studio suitability. Neither a high score nor past video sales guarantees your affiliate video results.',
      analysisTitle: 'AI Video Ideas Strategist',
      analysisSubtitle: 'Applies your 13-lesson Ad Creative curriculum to design 3 distinct product-matched video concepts with 3-Layer Hooks, 4-Part Anatomy, UGC formats, and scaling steps.',
      analysisBtn: 'Generate Video Ideas (0 cr)',
      analysisReBtn: 'Regenerate Ideas (0 cr)',
      analysisRunningBtn: 'Brainstorming product-matched video concepts...',
      analysisCopyBtn: 'Copy All Ideas',
      analysisSavedTag: 'Saved in Storage',
      analysisStaleHint: 'New Kalodata Deep Data was fetched after these ideas — click Regenerate Ideas to incorporate it.',
      analysisDataSourcesLabel: 'Kalodata data inputs',
      analysisSrcSales: '7d Sales/Revenue',
      analysisSrcDetails: 'Seller Details',
      analysisSrcSpecs: 'Selling Specs',
      analysisSrcReviews: 'Buyer Reviews',
      analysisAvailable: 'Available',
      analysisNotAvailable: 'Not available yet',
      analysisMetricPrice: 'Price',
      analysisMetricCommission: 'Commission',
      analysisMetricSales7d: '7d Units Sold',
      analysisMetricRevenue7d: '7d Total Revenue',
      analysisMetricVideoRev7d: '7d Video Revenue',
      analysisMetricGrowth: 'Growth Rate',
      analysisSecIdentity: 'Product Identity & Overview',
      analysisSecSalesPricing: 'Sales & Pricing Audit',
      analysisSecProfitMath: 'Commission & Profit Math',
      analysisSecSilentAd: 'Silent Video Ad Potential',
      analysisSecVisualAngles: 'Recommended Visual Angles',
      analysisSecSpecs: 'Kalodata Details & Specs Audit',
      analysisSecBuyers: 'Kalodata Buyer Reviews Audit',
      analysisSecRisks: 'Key Risks to Watch',
      analysisSecMissing: 'Missing Kalodata Data Not Yet Available',
      analysisDecisions: {
        strong_go: 'Strong Pick',
        test_carefully: 'Test Carefully',
        need_more_data: 'Fetch More Data First',
      },
      videoIdeas: {
        briefTitle: 'Product Strategy Brief (Lessons 1–3 & Playbook)',
        briefToggleShow: 'Show Strategy Brief',
        briefToggleHide: 'Hide Brief',
        playbookLabel: 'Category Playbook',
        playbooks: {
          problem_solving: 'Problem-Solving (Visual Proof & Contrast)',
          impulse_trendy: 'Impulse & Trendy (15–30s Wow & FOMO)',
          aesthetic_lifestyle: 'Aesthetic & Lifestyle (Identity & Vibe)',
          high_ticket_trust: 'High-Ticket & Trust (4 Pillars of Trust)',
          food_beverage: 'Food & Beverage (Sensory & Craving)',
        },
        awarenessLevels: {
          unaware: 'L1 · Unaware',
          problem_aware: 'L2 · Problem Aware',
          solution_aware: 'L3 · Solution Aware',
          product_aware: 'L4 · Product Aware',
          most_aware: 'L5 · Most Aware',
        },
        frameworks: {
          PAS: 'PAS (Problem–Agitate–Solve)',
          BAB: 'BAB (Before–After–Bridge)',
          AIDA: 'AIDA (Attention–Interest–Desire–Action)',
          '3_REASONS_WHY': '3 Reasons Why (Listicle)',
        },
        featureLabel: 'Feature (Proof)',
        benefitLabel: 'Functional Benefit',
        emotionLabel: 'Emotional Benefit (Lead)',
        uspLabel: 'Core USP',
        visualProofLabel: 'Primary Visual Proof Shot',
        audienceLabel: 'Primary Target Audience',
        painLadderLabel: 'Pain Point Ladder & Core Desire',
        buyerVoiceLabel: 'Buyer Voice & Doubts',
        ideaTabLabel: (index: number) => `Video Idea ${index}`,
        copyIdeaBtn: 'Copy This Idea',
        angleLabel: 'Creative Angle',
        formatLabel: 'UGC Format',
        targetLabel: 'Target Buyer',
        durationLabel: 'Duration',
        hookSectionLabel: '1. 3-Layer Hook (0–3s)',
        visualHookLabel: 'Visual Hook (0–1s Action)',
        verbalHookLabel: 'Verbal Hook (Opening Line)',
        textHookLabel: 'Text Hook (On-Screen)',
        bridgeSectionLabel: '2. Bridge / Hold (3–10s)',
        bodySectionLabel: '3. Body — Demo, Benefit & Objection (10–45s)',
        ctaSectionLabel: '4. CTA — Clear Action + Reason Why Now',
        muteTestLabel: 'Mute Test (Silent Comprehension)',
        extraHooksLabel: '1 Body, 3 Hooks — Extra Hook Variations to Test',
        scalingTitle: 'Testing, Comment Mining & Scaling (Lesson 13)',
        commentMiningLabel: 'Comment Reply Video Opportunities',
        iterationRoadmapLabel: '3-Step Winning Scaling Roadmap',
        watchOutsLabel: 'Category Mistakes to Avoid',
      },
      chatPrompt: {
        title: 'Copy Product Prompt for AI Chat',
        compatibleTag: 'ChatGPT · Claude · Gemini · DeepSeek (0 cr)',
        subtitle:
          'Packs full product details, your AI video creation role, and default Myanmar reply instruction into a clean one-click prompt — no settings required.',
        copyBtn: 'Copy Prompt',
        copiedBtn: 'Prompt Copied',
        previewBtn: 'Preview',
        hidePreviewBtn: 'Hide Preview',
        expandAria: 'Expand AI Chat Prompt builder',
        collapseAria: 'Collapse AI Chat Prompt builder',
        packedDataLabel: 'Data packed in prompt',
        includedShort: 'Included',
        notYetShort: 'Not fetched',
        benchmarkDefault: 'Myanmar Reply (Default)',
        benchmarkWithRef: 'Myanmar Reply (Default)',
        modeLabel: 'What should the AI chat produce?',
        modes: {
          full: 'All-in-One (Analysis + Video Plan)',
          analysis: 'Product Analysis Only',
          video_plan: 'Silent Video Plan Only',
        },
        outputLangLabel: 'AI reply language',
        outputLangs: {
          bilingual: 'Myanmar + English',
          my: 'Myanmar Only',
          en: 'English Only',
        },
        competitorSectionTitle: 'Competitor Creator Video Reference (Optional — Default Benchmark Always Active)',
        competitorDefaultNote:
          'Leave blank to use our built-in Thailand TikTok Shop top-converting silent video framework (0–2s hook, visual proof, 12–15s pacing, yellow basket CTA), or add a competitor video link/note to outperform it.',
        addRefBtn: 'Add Competitor Reference',
        hideRefBtn: 'Hide Reference',
        competitorUrlLabel: 'Competitor TikTok Video Link or Creator Handle (Optional)',
        competitorUrlPlaceholder: 'e.g. https://www.tiktok.com/@creator/video/... or @creator',
        competitorNotesLabel: 'Observed Competitor Hook / Style Notes (Optional)',
        competitorNotesPlaceholder: 'e.g. Opens with 2s waterproof splash test + crisp ASMR cap snap...',
        stepSyncHint: 'Prompt updates automatically whenever you fetch more Kalodata Deep Data above',
      },
    },
    styles: {
      cinematic: 'Cinematic Macro',
      asmr: 'ASMR Texture',
      before_after: 'Before & After',
      problem_fix: 'Problem → Fix',
    },
    history: {
      title: 'Saved Products',
      subtitle: 'All saved products and generated silent video kits are stored locally on your device. Export a backup anytime or restore on another browser.',
      searchPlaceholder: 'Filter saved products...',
      backupBtn: 'Backup JSON',
      restoreBtn: 'Restore JSON',
      emptyTitle: 'No saved products yet',
      emptyDesc: 'Tap the Save icon on any search result or inside Product Studio to save products here.',
      goDiscover: 'Explore Products',
      openPlan: 'Open Studio',
      deleteBtn: 'Delete',
      confirmDelete: 'Confirm',
      cancel: 'Cancel',
      backupSuccess: 'Backup JSON downloaded successfully.',
      restoreSuccessCount: (added, total) =>
        `Restored successfully — ${added} new ${added === 1 ? 'product' : 'products'} added (${total} total).`,
      restoreSuccessWithSearches: (added, total, searchesAdded) =>
        `Restored successfully — ${added} new ${added === 1 ? 'product' : 'products'} (${total} total) and ${searchesAdded} new ${searchesAdded === 1 ? 'search' : 'searches'} merged.`,
      restoreError: 'Invalid file format. Please choose a valid SiamVisual backup JSON file.',
      noFilterMatches: 'No saved products match your filter.',
      clearFilterAria: 'Clear filter',
      savedCount: (n: number) => `${n} saved ${n === 1 ? 'product' : 'products'}`,
    },
    kalodata: {
      title: 'Connect Kalodata Open API',
      subtitle: 'Copy your secret-key from Kalodata Open Center and paste it below. Once verified, your live Credit Balance appears immediately.',
      openCenterLink: 'Get Key at Open Center',
      inputPlaceholder: 'Paste your Kalodata API key (secret-key)...',
      pasteBtn: 'Paste',
      connectBtn: 'Connect',
      connectingBtn: 'Verifying...',
      connectedBadge: 'Connected',
      mainAccount: 'Main Key',
      subAccount: 'Sub Key',
      creditBalanceLabel: 'Credit Balance',
      creditsUnit: 'credits',
      balanceUnavailable: 'Balance unavailable',
      refreshBalance: 'Refresh',
      changeKey: 'Change Key',
      disconnect: 'Disconnect',
      closeBtn: 'Close',
      cancel: 'Cancel',
      lastSearchUsed: 'Credits used',
      connectRequiredError: 'Please paste and connect your Kalodata API key first — search uses Kalodata API exclusively.',
      pasteDeniedNote: 'Clipboard access blocked — click the field and press Ctrl+V / Paste.',
      connectedToast: 'Connected to Kalodata Open API.',
      disconnectedToast: 'Kalodata API key disconnected.',
      refreshedToast: 'Credit balance updated.',
      categoriesSyncedToast: 'Live Thailand categories synced from Kalodata.',
      limitBtn: 'Credit Limit',
      limitTitle: 'Set API Credit Balance Limit',
      maxSpendLabel: 'Max Spend Limit (Credits)',
      maxSpendPlaceholder: 'e.g. 10 (leave blank for no cap)',
      minReserveLabel: 'Minimum Balance Reserve (Credits)',
      minReservePlaceholder: 'e.g. 50 (stop before balance drops below this)',
      spentCounterLabel: 'Tracked spent',
      resetSpentBtn: 'Reset Spent',
      saveLimitBtn: 'Save Limit',
      clearLimitBtn: 'Clear Limits',
      limitSavedToast: 'Credit limits saved.',
      limitExceededMaxSpend: (spent, est, max) =>
        `Blocked by Max Spend Limit: tracked spent (${spent}) + est. (~${est}) exceeds your ${max} cr limit. Raise limit or reset spent counter.`,
      limitExceededReserve: (balance, est, reserve) =>
        `Blocked by Minimum Balance Reserve: balance (${balance}) minus est. (~${est}) would drop below your ${reserve} cr reserve.`,
    },
    v2: {
      engineBadge: 'Intelligence V2',
      overallTabLabel: 'Overall Commercial Ranking',
      overallTabShort: 'Overall',
      overallDescription:
        'Balanced commercial opportunity across Demand, Earning, Competition, and Customer Quality. Visual suitability carries 0% weight.',
      commercialScoreLabel: 'Commercial Score',
      commercialScoreShort: 'Commercial',
      strategyScoreLabel: 'Strategy Score',
      strategyScoreShort: 'Strategy',
      rankingTransparencyNote:
        'Commercial Opportunity, Conversion Evidence, Data Confidence, and Video Suitability are tracked separately. Scores and past video sales never guarantee affiliate results.',
      withheldLabel: 'Withheld (Insufficient Data)',
      withheldZeroCommLabel: '0% (Not Monetizable)',
      dimensionsHeading: '4 Commercial Dimensions',
      dimensions: {
        demand: {
          label: 'Demand',
          short: 'Demand',
          desc: '7d revenue scale, sales volume, and verified growth velocity',
        },
        earning: {
          label: 'Earning',
          short: 'Earning',
          desc: 'Affiliate commission rate, THB payout per sale, and demand realization',
        },
        competition: {
          label: 'Competition',
          short: 'Competition',
          desc: 'Creator crowding density paired with Laplace-smoothed Adjusted RPC',
        },
        quality: {
          label: 'Customer Quality',
          short: 'Quality',
          desc: 'Bayesian-adjusted rating weighted by verified review sample size',
        },
      },
      dimensionStatus: {
        SCORED: 'Scored',
        ZERO: 'Zero',
        NOT_MONETIZABLE: 'Not Monetizable (0%)',
        INSUFFICIENT: 'Insufficient Data',
        INVALID: 'Invalid',
      },
      classifications: {
        TOP_OPPORTUNITY: 'Top Opportunity',
        STRONG_OPPORTUNITY: 'Strong Opportunity',
        MODERATE_OPPORTUNITY: 'Moderate Opportunity',
        WATCHLIST: 'Watchlist',
        INSUFFICIENT_EVIDENCE: 'Insufficient Evidence',
        NOT_MONETIZABLE: 'Not Monetizable',
      },
      commercialEligibility: {
        ELIGIBLE: 'Eligible',
        PARTIAL_EVIDENCE: 'Partial Evidence',
        RESTRICTED_WEAK_DEMAND: 'Weak Demand Gate',
        RESTRICTED_POOR_QUALITY: 'Poor Quality Gate',
        NOT_MONETIZABLE: '0% Commission',
        INSUFFICIENT_DATA: 'Insufficient Data',
      },
      strategyEligibility: {
        QUALIFIED: 'Qualified',
        PARTIAL_EVIDENCE: 'Partial Evidence',
        INSUFFICIENT_DATA: 'Insufficient Data',
        NOT_ELIGIBLE: 'Not Eligible',
        DATA_UNAVAILABLE: 'Data Unavailable',
      },
      confidenceLabel: 'Data Confidence',
      confidenceLevels: {
        HIGH: 'High',
        MEDIUM: 'Medium',
        LOW: 'Low',
        VERY_LOW: 'Very Low',
      },
      confidenceBreakdown: {
        completeness: 'Completeness',
        provenance: 'Source Provenance',
        freshness: 'Freshness',
        validity: 'Validity',
        dimensionCoverage: 'Dimension Coverage',
      },
      conversionLabel: 'Conversion Evidence',
      conversionLevels: {
        STRONG: 'Strong Evidence',
        MODERATE: 'Moderate Evidence',
        WEAK: 'Weak Evidence',
        INSUFFICIENT: 'Insufficient Evidence',
      },
      conversionChannels: {
        VIDEO: 'Video-led',
        LIVE: 'Live-led',
        BALANCED: 'Balanced',
        UNKNOWN: 'Unknown',
      },
      conversionDisclaimerShort: 'Past video/live sales do not guarantee creator conversion',
      strategies: {
        early_market_opportunity: {
          name: 'Early Market Opportunity',
          shortName: 'Early Market',
          desc: 'Strong demand with verified positive growth, low creator crowding, and solid affiliate payout.',
          minimumRule: 'Verified demand, growth (+10%+), <=60 creators, commission >0%, confidence >=60',
          exclusionRule: 'Excludes 0% commission, flat/negative growth, >60 creators, or unverified growth/creators',
        },
        underserved_demand: {
          name: 'Underserved Demand',
          shortName: 'Underserved',
          desc: 'Strong demand with relatively low creator crowding and monetizable payout; works without growth data.',
          minimumRule: 'Absolute demand >=50, competition >=45, earning >=35, confidence >=48',
          exclusionRule: 'Excludes 0% commission, crowded markets, 0-creator anomalies, or unverified creators',
        },
        creator_yield_opportunity: {
          name: 'Creator Yield Opportunity',
          shortName: 'Creator Yield',
          desc: 'High Laplace-smoothed revenue per creator (Adjusted RPC) backed by meaningful market demand.',
          minimumRule: 'Revenue >=฿20,000, adjusted RPC >=฿3,000, creators >=1, commission >0%, confidence >=55',
          exclusionRule: 'Excludes tiny low-revenue 1-creator listings, 0-creator listings, and 0% commission',
        },
        fast_rising_products: {
          name: 'Fast Rising Products',
          shortName: 'Fast Rising',
          desc: 'Accelerating demand outpacing creator saturation across verified longitudinal snapshots.',
          minimumRule: 'Requires >=2 time-separated verified snapshots (12h+) showing >=15% demand growth',
          exclusionRule: 'Returns DATA_UNAVAILABLE when snapshot history is absent; never fabricates trends',
        },
        profit_maximizer: {
          name: 'Profit Maximizer',
          shortName: 'Profit Max',
          desc: 'Attractive baht payout per sale paired with verified market demand and manageable competition.',
          minimumRule: 'Payout >=฿20/sale, earning >=48, demand >=38, competition >=30, confidence >=55',
          exclusionRule: 'Excludes high-commission % dead listings with weak demand or sub-฿20 payouts',
        },
        video_proven_winners: {
          name: 'Video Proven Winners',
          shortName: 'Video Proven',
          desc: 'Substantial historical short-video revenue (฿25K+ & 25%+ share) with verified demand.',
          minimumRule: 'Video revenue >=฿25,000, video share >=25%, demand >=40, confidence >=52',
          exclusionRule: 'Never confuses visual suitability with sales proof or guarantees future conversion',
        },
        trust_based_winners: {
          name: 'Trust-Based Winners',
          shortName: 'Trust Winners',
          desc: 'High Bayesian-adjusted customer rating supported by substantial review volume and solid demand.',
          minimumRule: 'Reviews >=30, Bayesian rating >=4.25, quality >=70, demand >=40, confidence >=58',
          exclusionRule: 'Excludes tiny-sample 5.0 ratings (<30 reviews), poor ratings, and unverified ratings',
        },
        trend_timing_opportunity: {
          name: 'Trend Timing Opportunity',
          shortName: 'Trend Timing',
          desc: 'Sustained multi-snapshot demand acceleration outpacing creator entry at the right timing window.',
          minimumRule: 'Requires >=3 verified snapshots (24h+ span) with positive demand-vs-creator spread',
          exclusionRule: 'Returns DATA_UNAVAILABLE when multi-snapshot history is absent',
        },
      },
      strategyExplorer: {
        title: 'Strategy Explorer',
        subtitle: 'Switch between Overall Commercial Ranking and all 8 specialized affiliate strategies',
        overallCountLabel: (n: number) => `${n} products`,
        qualifiedCountLabel: (n: number) => `${n} qualified`,
        excludedCountLabel: (n: number) => `${n} excluded`,
        showExcludedBtn: (n: number) => `Inspect ${n} non-qualifying candidates`,
        hideExcludedBtn: 'Hide non-qualifying candidates',
        excludedSectionTitle: 'Non-Qualifying / Unverified Candidates',
        excludedSectionSub:
          'These products did not pass the active strategy thresholds or required verified metric gates.',
        noQualifiedTitle: 'No qualified products for this strategy yet',
        noQualifiedDesc:
          'None of the current products passed all thresholds and verified metric gates (note: Phase 0 unverified fields block strategies that require them).',
        historyUnavailableTitle: 'Historical Snapshot Data Unavailable (DATA_UNAVAILABLE)',
        historyUnavailableBadge: 'History Required',
        historyUnavailableDesc:
          'This strategy requires at least 2–3 verified historical snapshots separated in time to measure real demand acceleration vs creator saturation.',
        historyUnavailableNote:
          'SiamVisual never invents synthetic historical trends. Connect longitudinal snapshot storage to activate qualified rankings here.',
        smallPoolWarning: (n: number) =>
          `Small pool (${n} items): scores remain anchored to absolute Thailand market benchmarks without percentile distortion.`,
        bestMatchLabel: 'Best Strategy Match',
        noStrategyQualified: 'No Strategy Qualified',
        whyRankedBtn: 'Why it ranks here',
        hideReasonsBtn: 'Hide explanation',
        whyRankedTitle: 'Ranking Reasons & Insights',
        cautionsTitle: 'Cautions & Gate Constraints',
        missingOrUnverifiedTitle: 'Missing / Unverified Evidence',
        failedRequirementsTitle: 'Unmet Strategy Requirements',
        viewFullBreakdownBtn: 'Full Breakdown',
        requiresHistoryBadge: 'History',
        primaryStrategyTag: 'Primary',
      },
      provenance: {
        sectionTitle: 'Metric Provenance & Phase 0 Verification Status',
        sectionSubtitle:
          'Shows whether each field comes from a verified source, is derived, or remains unverified.',
        metricCol: 'Metric',
        valueCol: 'Value',
        statusCol: 'Status / Provenance',
        derivedTag: 'Derived',
        sourceTag: 'Source',
        verifiedCountLabel: (verified: number, total: number) =>
          `Verified ${verified}/${total}`,
        cardUnverifiedNotice: (count: number) =>
          `${count} unverified metric(s) excluded from strategy qualification`,
        categories: {
          verified_source: 'Verified Source',
          derived: 'Derived (Synthetic)',
          unverified: 'Unverified Unit/Scope',
          missing: 'Missing',
          zero: 'Verified Zero',
          stale: 'Stale (>24h)',
          invalid: 'Invalid',
          unavailable: 'Unavailable',
        },
        fields: {
          priceThb: 'Price (THB)',
          commissionRate: 'Commission Rate',
          commissionThb: 'Payout per Sale (THB)',
          revenueThb7d: '7d Total Revenue',
          salesVolume7d: '7d Units Sold',
          videoRevenueThb7d: '7d Video Revenue',
          liveRevenueThb7d: '7d Live Revenue',
          revenueGrowthRate: 'Revenue Growth Rate',
          creatorCount: 'Creator Count',
          rating: 'Product Rating',
          reviewCount: 'Review Count',
        },
        unverifiedCoreBanner: (count: number) =>
          `${count} metric(s) have unverified upstream units/scope and are blocked from inflating strategy qualification`,
        syntheticRevenueBanner: 'Revenue is synthetically estimated from price × sales (confidence penalized)',
      },
      dialog: {
        v2Subtitle:
          'Commercial Opportunity evaluates Demand, Earning, Competition, and Customer Quality independently. Visual suitability is excluded.',
        gateDecisionsTitle: 'Gate Decisions & Eligibility',
        overallInsightsTitle: 'Key Strengths & Observations',
        dimensionSubmetrics: {
          revenueScore: 'Revenue Score',
          salesScore: 'Sales Vol Score',
          absDemand: 'Absolute Demand',
          growthRate: 'Verified Growth',
          payoutPerSale: 'Payout / Sale',
          commissionRate: 'Commission %',
          creators: 'Creators',
          rawRpc: 'Raw RPC',
          adjustedRpc: 'Adjusted RPC',
          bayesianRating: 'Bayesian Rating',
          rawRating: 'Raw Rating',
          reviews: 'Reviews',
        },
        usedMetricsLabel: 'Used metrics',
        excludedMetricsLabel: 'Excluded metrics',
        conversionSectionTitle: 'Conversion Evidence (Independent of Commercial Score)',
        videoShareLabel: 'Video Share',
        liveShareLabel: 'Live Share',
        strategyMatrixTitle: '8-Strategy Eligibility Matrix',
        strategyMatrixSub: 'Per-strategy eligibility status, strategy score, and exact requirement checks',
        studioVisualRefTitle: 'Creative / Video Studio Reference (0% Weight in Commercial Score)',
        studioVisualRefNotice:
          'Visual cues below assist with video production only and do not contribute to Commercial Opportunity ranking.',
        v1SilentScoreLabel: 'Studio Visual Reference (V1)',
        pillarsSummaryTitle: 'How SiamVisual Separates These 4 Signals',
        pillarCommercial: 'Commercial Opportunity — market potential from Demand, Earning, Competition, and Customer Quality',
        pillarConversion: 'Conversion Evidence — historical video/live channel revenue (separate from Commercial Score)',
        pillarVideo: 'Video Suitability — creative Studio guidance only (0% weight in commercial ranking)',
        pillarConfidence: 'Data Confidence — metric completeness, source verification, and freshness',
        nonGuaranteeDisclaimer:
          'A high Commercial Score or strong past video revenue does not guarantee affiliate sales or conversion for your own videos.',
        evidenceSummary: {
          sectionTitle: 'Product Evidence Breakdown',
          whyDiscoveredLabel: 'Why Discovered & Status',
          factsTitle: 'Verified Facts (Source)',
          derivedTitle: 'Derived Calculations',
          unavailableTitle: 'Missing / Unverified Evidence',
          heuristicsTitle: 'Creative Heuristics (Not Conversion Proof)',
          statusLabels: {
            QUALIFIED: 'Fully Qualified',
            PRELIMINARY: 'Preliminary Candidate',
            NOT_MONETIZABLE: 'Not Monetizable (0% Comm)',
            INSUFFICIENT_DATA: 'Insufficient Evidence',
          },
        },
      },
      riskLabels: {
        EXTREME_COMPETITION: 'Extreme Competition',
        HIGH_COMPETITION: 'High Competition',
        ZERO_CREATORS_POSITIVE_REVENUE: '0 Creators w/ Revenue',
        ZERO_COMMISSION: '0% Commission',
        NOT_MONETIZABLE: 'Not Monetizable',
        MISSING_COMMISSION: 'Missing Commission',
        MISSING_GROWTH: 'Missing Growth',
        UNVERIFIED_GROWTH_UNIT: 'Growth Unit Unverified',
        UNVERIFIED_CREATOR_DEFINITION: 'Creator Scope Unverified',
        UNVERIFIED_RATING_SEMANTICS: 'Rating Scope Unverified',
        UNVERIFIED_REVIEW_COUNT: 'Review Count Unverified',
        LOW_REVIEW_SAMPLE: 'Low Review Sample',
        POOR_CUSTOMER_QUALITY: 'Poor Customer Quality',
        MISSING_CUSTOMER_QUALITY: 'Missing Quality Data',
        MISSING_COMPETITION: 'Missing Competition Data',
        MISSING_DEMAND: 'Missing Demand Data',
        WEAK_DEMAND: 'Weak Demand',
        NEGATIVE_GROWTH: 'Negative Growth',
        STALE_DATA: 'Stale Data',
        SYNTHETIC_REVENUE: 'Synthetic Revenue',
        CONVERSION_DISCREPANCY: 'Channel Revenue Mismatch',
        LOW_DATA_CONFIDENCE: 'Low Data Confidence',
        LOW_PAYOUT: 'Low THB Payout',
      },
      formatRiskTag: (tag: string) => tag.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      metricsShort: {
        creators: 'Creators',
        adjRpc: 'Adj RPC',
        growth: 'Growth',
        payout: 'Payout',
        rating: 'Bay. Rating',
        reviews: 'Reviews',
        videoShare: 'Video Share',
        liveRev: 'Live Rev',
        unverified: 'Unverified',
        missing: 'Missing',
      },
      discoveryShortlist: {
        signalLabel: 'Discovery Signal',
        preliminaryTag: 'Preliminary',
        verifiedQualifiedTag: 'Qualified',
        snapshotHistoryLabel: (count: number) => `Snapshots: ${count}d`,
        categories: {
          STRONG_DEMAND_STRONG_VIDEO_SALES: 'Strong Demand + Strong Video Sales',
          STRONG_DEMAND_LOW_COMPETITION: 'Strong Demand + Low Creator Competition',
          STRONG_AFFILIATE_EARNINGS: 'Strong Affiliate Earnings',
          EMERGING_OPPORTUNITY: 'Emerging Opportunity',
          HIGH_DEMAND_HIGH_COMPETITION: 'High Demand but High Competition',
          INSUFFICIENT_EVIDENCE: 'Insufficient Evidence',
        },
      },
      historicalTrend: {
        sectionTitle: 'Historical Trend Intelligence (Derived)',
        sectionSubtitle:
          'Strictly derived from comparable trusted local observations (separate from Commercial Score)',
        trustScopeLabel: 'Local Observed Only',
        metricCol: 'Metric',
        rangeCol: 'Earliest → Latest',
        deltaCol: 'Change',
        statusCol: 'Trend',
        zeroBaselineTag: 'Zero Base',
        allZeroTag: 'All 0',
        observationSpanLabel: (count: number, spanDays: number | null) =>
          spanDays !== null ? `${count} obs · ${spanDays}d span` : `${count} local obs`,
        classifications: {
          RISING: 'Rising',
          STABLE: 'Stable',
          DECLINING: 'Declining',
          VOLATILE: 'Volatile',
          INSUFFICIENT_HISTORY: 'Insufficient History',
          INCOMPARABLE_DATA: 'Incomparable Data',
        },
        metrics: {
          revenue: '7d Revenue',
          salesVolume: '7d Sales Volume',
          videoRevenue: 'Video Revenue',
          liveRevenue: 'Live Revenue',
          shoppingMallRevenue: 'Showcase / Mall Rev',
          unitPrice: 'Unit Price',
          commissionRate: 'Commission Rate',
        },
      },
      detailTrend: {
        sectionTitle: 'In-Window Daily Revenue Trend (/detail Verified)',
        sectionSubtitle:
          'Derived from verified daily THB revenue_trend array on /tiktok/product/detail (separate from Commercial Score)',
        last7VsPrev7: 'Last 7d vs Prev 7d',
        dailyAvg: 'Daily Avg',
        dailyRange: 'Daily Min – Max',
        activeDays: 'Active Days',
        activeCreatorsLabel: (windowTag: string) => `Active Creators (${windowTag} Verified)`,
        revPerActiveCreatorLabel: 'Rev / Active Creator',
        lifetimeReviewsLabel: 'Lifetime PDP Reviews',
        informationalScopeNote:
          'Informational context only — posting vs. selling creator split and star ratings remain unavailable, so Competition and Customer Quality scores stay withheld.',
        detailWindowLabel: 'Detail window:',
        detailWindow7d: '7d',
        detailWindow30d: '30d (Daily Trend)',
      },
      discoveryFilter: {
        barAriaLabel: 'Affiliate filter and sort controls',
        presets: {
          all: 'All',
          monetizable_only: 'Monetizable',
          video_proven: 'Video Proven',
          strong_earnings: 'High Earnings',
          rising_trend: 'Rising Trend',
        },
        sortLabel: 'Sort',
        sortOptions: {
          search_score_desc: 'Search Score (0.2 cr)',
          intelligence: 'Intelligence Rank',
          video_revenue_desc: '7d Video Revenue',
          payout_desc: 'Est. Payout / Sale (฿)',
          commission_desc: 'Commission %',
          revenue_desc: '7d Total Revenue',
          sales_desc: '7d Sales Volume',
        },
        minCommissionLabel: 'Commission',
        minVideoShareLabel: 'Video Share',
        priceBandLabel: 'Price',
        anyOption: 'Any',
        priceBands: {
          all: 'Any',
          under_300: '≤ ฿300',
          '300_1000': '฿300 – ฿1,000',
          over_1000: '> ฿1,000',
        },
        resetBtn: 'Reset',
        showingCount: (shown: number, total: number) => `Showing ${shown} of ${total}`,
        zeroCreditHint: 'Local filter (0 cr)',
        emptyTitle: 'No products match your current filter',
        emptyDesc: 'Relax one of your local filters or reset to view all discovered products.',
        loadMoreBtn: (nextPage: number, pageSize = 100) =>
          `Load Next ${pageSize} (Page ${nextPage} · ~0.2 cr)`,
        loadingMoreBtn: 'Loading next page...',
        loadedMoreToast: (added: number, page: number, fromCache: boolean) =>
          fromCache
            ? `Added ${added} product(s) from Page ${page} (0 cr · Cached)`
            : `Added ${added} product(s) from Page ${page}`,
        cachedSearchToast: 'Loaded instantly from 10-min server cache (0 cr)',
        allLoadedNote: (count: number) => `All ${count} loaded products shown`,
      },
      searchDrawer: {
        title: 'Search & Filter Settings',
        subtitle: 'Configure category, count, product link, and affiliate filters before searching',
        closeAria: 'Close search drawer',
        keywordOrLinkLabel: 'Keyword or Product Link / ID',
        keywordOrLinkPlaceholder: 'Search keyword or paste TikTok Shop / Kalodata link or Product ID...',
        keywordOrLinkHint: 'Pasting a TikTok Shop app short link (vt.tiktok.com), full product URL, or numeric ID switches automatically to single-product check',
        categoriesLabel: 'Categories (Multi-select)',
        categoriesDisabledInLinkMode: 'Category and batch count controls are paused while checking a single product link',
        countLabel: 'Products per Search',
        countUnit: (n: number) => `${n} items`,
        recommendedTag: 'Best Value',
        countCostNote: '20, 50, and 100 items all cost 0.20 cr flat (100 is Kalodata API max)',
        windowLabel: 'Sales Window',
        window7d: '7 Days (7d)',
        window30d: '30 Days (30d)',
        windowNote: '7d surfaces fresh momentum; 30d reflects steadier monthly volume',
        affiliateFiltersLabel: 'Affiliate Result Filters (0 cr)',
        affiliateFiltersHint: 'Applied automatically to results locally at zero extra credit cost',
        affiliateFiltersDisabledInLinkMode: 'Single-link checks always display the pasted product regardless of commission filters',
        presetLabel: 'Shortlist Preset',
        resetDefaultsBtn: 'Recommended Defaults',
        cancelBtn: 'Cancel',
        submitRankBtn: (count: number, cost: number) => `Search ${count} Products (~${cost} cr)`,
        submitLinkBtn: (cost: number) => `Check Product Link (~${cost} cr)`,
        summaryRank: (count: number, windowTag: string, presetLabel: string, cost: number) =>
          `${count} items · ${windowTag} · ${presetLabel} · ~${cost} cr`,
        summaryLink: (productId: string, cost: number) =>
          `Product ID ${productId} · ~${cost} cr`,
        summaryShortLink: (cost: number) =>
          `TikTok Short Link (Auto-resolve) · ~${cost} cr`,
        activeScopeSummary: (count: number, windowTag: string, presetLabel: string) =>
          `Default: ${count} items · ${windowTag} · ${presetLabel}`,
        openDrawerBtn: 'Search & Filter',
      },
      searchScore: {
        title: 'Search Opportunity Score (0.2 cr Data Only)',
        badgeShort: 'Search Score',
        subtitle:
          'Scored strictly from verified 0.20 cr Kalodata rank fields with zero extra credit calls',
        rankDataOnlyNote: '0.20 cr Search Data Only',
        deepStudioHint:
          'Open Product Studio to fetch Kalodata Deep Data (creators, daily trend, buyer reviews) and generate your AI analysis & video plan.',
        rawScoreLabel: 'Uncapped Raw',
        videoPoolLabel: 'Video Comm. Pool',
        payoutPerSaleLabel: 'Payout / Sale',
        videoShareLabel: 'Video Rev Share',
        dominantChannelLabel: 'Dominant Channel',
        capsTitle: 'Active Score Cap',
        compositionTitle: 'Score Breakdown (out of 100)',
        channelsTitle: 'Sales Channels',
        priceSweetSpotTitle: 'Price Sweet Spot',
        earningSnapshotTitle: 'Affiliate Earning Snapshot',
        est100SalesLabel: 'Est. ×100 Sales',
        dailyTrendTitle: 'Daily Revenue Trend (/detail)',
        activeCreatorsShort: 'Active Creators',
        channelShort: {
          video: 'Short Video',
          live: 'Live',
          mall: 'Showcase / Mall',
        },
        priceZones: {
          sweet: 'Sweet Spot',
          mid: 'Moderate',
          low: 'Low Ticket',
          high: 'High Ticket',
        },
        pillars: {
          demand: { label: 'Market Demand', short: 'Demand', weightLabel: '30%' },
          earning: { label: 'Affiliate Earning', short: 'Earning', weightLabel: '30%' },
          videoProof: { label: 'Video Sales Proof', short: 'Video', weightLabel: '25%' },
          priceFit: { label: 'Price Fit', short: 'Price', weightLabel: '15%' },
        },
        grades: {
          TOP: 'Top Pick',
          STRONG: 'Strong',
          MODERATE: 'Moderate',
          WEAK: 'Weak',
          NOT_MONETIZABLE: '0% Comm',
          INSUFFICIENT: 'Incomplete',
        },
        channels: {
          VIDEO: 'Short-Video Led',
          LIVE: 'Live Led',
          SHOWCASE: 'Showcase / Mall Led',
          BALANCED: 'Multi-Channel',
          UNKNOWN: 'Unknown',
        },
        caps: {
          WEAK_DEMAND_CAP: 'Capped at 42 due to weak verified market demand',
          NO_VIDEO_SALES_CAP: 'Capped at 58 because verified short-video revenue is ฿0',
          LIVE_DEPENDENT_CAP: 'Capped at 68 because revenue is Live-dependent (≥60% Live, <10% Video)',
          MISSING_VIDEO_DATA_CAP: 'Capped at 75 because video revenue breakdown is missing',
        },
      },
    },
    rankBoard: {
      title: 'Thailand TikTok Shop Rank Board',
      subtitle:
        'Macro market intelligence across the Top 100 Thailand TikTok Shop products and L1 Category shares with interactive charts and drilldowns.',
      syncBtn: (cost: number) => `Update Sync (~${cost} cr)`,
      syncingBtn: 'Syncing Market Data...',
      timeframe7d: '7 Days (7d)',
      timeframe30d: '30 Days (30d)',
      lastSyncedLabel: 'Last synced',
      productsUnit: (n: number) => `${n} Products`,
      categoriesUnit: (n: number) => `${n} Categories`,
      staleNotice: 'Snapshot is >24h old — click Update Sync to refresh current Thailand TikTok Shop market rankings.',
      emptyTitle: 'Sync Thailand TikTok Shop Market Data',
      emptyDesc:
        'Press Update Sync to pull the Top 100 Thailand TikTok Shop products plus Live L1 Category market shares in one batch. Saved locally so switching tabs always costs 0 cr.',
      emptyBullets: [
        'Video vs Live vs Shop channel revenue split (interactive Donut Chart & 100% stacked bar)',
        'L1 Category market share progress bars — click any category to cross-filter the matrix and leaderboard',
        'Price (THB) × Commission (%) Opportunity Matrix highlighting Sweet Spot products (฿100–฿600 · ≥10% Comm)',
        'Click any product row or scatter dot to open directly in Video Studio (0 cr)',
      ],
      emptyCtaBtn: (cost: number) => `Start Update Sync (~${cost} cr)`,
      connectPromptNote: 'Connect your Kalodata API key from the top-right bar before running Update Sync.',
      loadingNote: 'Pulling Top 100 Thailand TikTok Shop products and L1 category shares from Kalodata...',
      syncedToast: (count: number, catCount: number) =>
        `Synced ${count} ranked products and ${catCount} categories from Thailand TikTok Shop.`,
      kpiGmvTitle: 'Top 100 Total GMV',
      kpiGmvSub: (windowTag: string) => `${windowTag} Thailand market volume`,
      kpiUnitsTitle: 'Total Units Sold',
      kpiUnitsSub: (monetizable: number, total: number) =>
        `${monetizable} / ${total} monetizable items`,
      kpiVideoShareTitle: 'Short Video Share',
      kpiVideoShareSub: (provenCount: number) => `${provenCount} video-proven products`,
      kpiAvgCommTitle: 'Avg Commission',
      kpiAvgCommSub: (avgPayout: string, sweetSpot: number) =>
        `Avg ${avgPayout}/sale · ${sweetSpot} Sweet Spot`,
      channelSectionTitle: 'Channel Revenue Split',
      channelSectionSub: 'Video, Live, and Shop/Mall GMV breakdown (click to cross-filter)',
      channelVideo: 'Short Video',
      channelLive: 'Live Stream',
      channelShop: 'Shop / Mall',
      channelDominantLabel: 'Dominant',
      channelClickHint: 'Click a channel row to filter products led by that channel',
      categorySectionTitle: 'Category Market Share',
      categorySectionSubLive: 'Live Kalodata Thailand L1 category revenue rank (click to cross-filter)',
      categorySectionSubAgg: 'Aggregated from Top 100 products revenue share (click to cross-filter)',
      categorySourceLiveTag: 'TH Market L1',
      categorySourceAggTag: 'Top 100 Aggregate',
      categoryTop100Count: (n: number) => `${n} in Top 100`,
      categoryClickHint: 'Click any category bar to cross-filter the matrix & table',
      matrixSectionTitle: 'Price × Commission Opportunity Matrix',
      matrixSectionSub: 'Bubble size = GMV · Tap any dot to inspect metrics and launch Video Studio',
      matrixSweetSpotLabel: 'Sweet Spot (฿100–฿600 · ≥10%)',
      matrixLegendVideo: 'Video-Led',
      matrixLegendLive: 'Live-Led',
      matrixLegendOther: 'Shop / Other',
      matrixAxisPrice: 'Price (THB)',
      matrixAxisComm: 'Commission (%)',
      matrixTapHint: 'Tap a dot to inspect',
      matrixInspectorEmpty: 'Select any dot on the chart to inspect its revenue, channel mix, and jump directly to Video Studio.',
      matrixOpenStudioBtn: 'Open Video Studio',
      tableSectionTitle: 'Ranked Product Leaderboard',
      tableSectionSub: (shown: number, total: number) =>
        `Showing ${shown} of ${total} products · Click any row to open Video Studio (0 cr)`,
      searchPlaceholder: 'Filter by product name, shop, or category (0 cr)...',
      filterAll: 'All',
      filterVideoProven: 'Video-Proven',
      filterHighComm: 'High Comm ≥10%',
      filterSweetSpot: 'Sweet Spot',
      clearAllFilters: 'Clear filters',
      activeCategoryFilter: (name: string) => `Category: ${name}`,
      activeChannelFilter: (name: string) => `Channel: ${name}`,
      colRank: '#',
      colProduct: 'Product & Shop',
      colPrice: 'Price',
      colRevenue: 'Revenue (GMV)',
      colUnits: 'Units',
      colCommission: 'Comm %',
      colPayout: 'Payout',
      colChannels: 'Video / Live / Shop',
      colScore: 'Score',
      openStudioAction: 'Studio',
      noMatchesTitle: 'No ranked products match these filters',
      noMatchesDesc: 'Reset your category, channel, or search filters to view the full leaderboard.',
      sortLabel: 'Sort by',
    },
  },
};
