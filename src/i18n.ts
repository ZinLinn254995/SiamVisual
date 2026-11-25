import type { Language, VisualStyle } from './types';

export interface Translations {
  nav: {
    discover: string;
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
    restoreError: string;
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
}

export const TRANSLATIONS: Record<Language, Translations> = {
  my: {
    nav: {
      discover: 'ရှာဖွေမယ်',
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
        'Short link (vt.tiktok.com) ထဲမှာ Product ID မပါသဖြင့် Browser တွင်ဖွင့်ပြီး Product ID ပါသော Link အပြည့်အစုံ (သို့) Product ID ကို ထည့်ပေးပါ။',
      invalidLinkNotice:
        'ဒီ Link ထဲမှာ TikTok Shop Product ID မတွေ့ပါ — Product ID ပါသော Link အပြည့်အစုံ (သို့) ဂဏန်း ID ထည့်ပေးပါ။',
    },
    discover: {
      resultsHeading: 'အကောင်းဆုံး ရွေးချယ်ထားသော ပစ္စည်းများ',
      singleResultHeading: 'Link မှ ရှာတွေ့သော ပစ္စည်း',
      resultsSubtext: 'Kalodata ရောင်းအား၊ ကော်မရှင်နှင့် Silent Visual အမှတ်အလိုက် စီပေးထားပါသည်။',
      singleResultSubtext: 'သင်ထည့်ထားသော Product Link မှ တိုက်ရိုက်ရယူထားသော အချက်အလက်ဖြစ်ပါသည်။',
      noResultsTitle: 'ကိုက်ညီသော ပစ္စည်းမတွေ့သေးပါ',
      noResultsDesc: 'အခြား Keyword၊ Category သို့မဟုတ် Product Link ဖြင့် ထပ်မံရှာဖွေကြည့်ပါ။',
      retry: 'ပြန်လည်ကြိုးစားမယ်',
      loadingNote: 'Kalodata Thailand TikTok Shop မှ အကောင်းဆုံး ပစ္စည်းများကို ရှာဖွေနေပါသည်...',
      loadingSingleNote: 'သင်ထည့်ထားသော Link မှ Product အချက်အလက်ကို ရှာဖွေနေပါသည်...',
      cachedNote: 'Cache မှ ပြသထားသည် (0 cr)',
      refreshLiveBtn: 'Live ပြန်ဆွဲမယ် (~0.2 cr)',
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
      tooltipBtn: 'Score အသေးစိတ်ကြည့်ရန်',
      dialogSubtitle: 'စကားမပြောဘဲ AI Visual ဖြင့် ရောင်းအားတက်နိုင်မှုကို အချက် ၄ ချက်ဖြင့် တွက်ချက်ထားပါသည်။',
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
      analysisTitle: 'AI ဖြင့် Product အသေးစိတ် သုံးသပ်ချက်',
      analysisSubtitle: 'လက်ရှိရရှိထားသော Kalodata အချက်အလက်များ (နာမည်၊ ဈေးနှုန်း၊ ရောင်းအား၊ ကော်မရှင်၊ Deep Data) ပေါ်မူတည်၍ တွက်ချက်သုံးသပ်ပေးပါမည်။ Data မရှိသေးသောအချက်များကို အတိအကျ ဖော်ပြပေးပါမည်။',
      analysisBtn: 'AI ဖြင့် Product သုံးသပ်မယ် (0 cr)',
      analysisReBtn: 'ပြန်လည်သုံးသပ်မယ် (0 cr)',
      analysisRunningBtn: 'Kalodata Data များကို AI သုံးသပ်တွက်ချက်နေသည်...',
      analysisCopyBtn: 'သုံးသပ်ချက်ကူးမယ်',
      analysisSavedTag: 'Storage တွင် သိမ်းပြီး',
      analysisStaleHint: 'Kalodata Deep Data အသစ်ထပ်ယူထားသဖြင့် ပြန်လည်သုံးသပ်ပါက ပိုမိုပြည့်စုံသော ရလဒ်ရရှိပါမည်။',
      analysisDataSourcesLabel: 'လက်ရှိ Kalodata Data အခြေအနေ',
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
      restoreError: 'ဖိုင်ပုံစံ မမှန်ကန်ပါ။ SiamVisual Backup JSON ဖိုင်ကိုသာ ရွေးချယ်ပါ။',
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
  },
  en: {
    nav: {
      discover: 'Discover',
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
        'Short links (vt.tiktok.com) hide the Product ID. Open the link once and paste the full Product URL or numeric Product ID.',
      invalidLinkNotice:
        'No TikTok Shop Product ID found in that link. Please paste the full product link or numeric Product ID.',
    },
    discover: {
      resultsHeading: 'Best Matches',
      singleResultHeading: 'Product from Link',
      resultsSubtext: 'Ranked by Kalodata sales velocity, affiliate commission, and silent-visual score.',
      singleResultSubtext: 'Fetched directly from Kalodata for your pasted product link.',
      noResultsTitle: 'No matching products found',
      noResultsDesc: 'Try another keyword, category selection, or product link.',
      retry: 'Try Again',
      loadingNote: 'Searching Kalodata Thailand TikTok Shop...',
      loadingSingleNote: 'Fetching product details from Kalodata...',
      cachedNote: 'Loaded from cache (0 cr)',
      refreshLiveBtn: 'Refresh Live (~0.2 cr)',
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
      tooltipBtn: 'View score breakdown',
      dialogSubtitle: 'Silent-visual ad potential calculated across 4 core conversion factors.',
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
      analysisTitle: 'AI Product Deep Analysis',
      analysisSubtitle: 'Analyzes product identity, pricing, sales velocity, commission math, and deep data strictly from available Kalodata records. Clearly flags any missing data.',
      analysisBtn: 'Analyze Product with AI (0 cr)',
      analysisReBtn: 'Re-analyze (0 cr)',
      analysisRunningBtn: 'Calculating & analyzing Kalodata product data...',
      analysisCopyBtn: 'Copy Analysis',
      analysisSavedTag: 'Saved in Storage',
      analysisStaleHint: 'New Kalodata Deep Data was fetched after this analysis — click Re-analyze to include it.',
      analysisDataSourcesLabel: 'Available Kalodata data',
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
      restoreError: 'Invalid file format. Please choose a valid SiamVisual backup JSON file.',
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
  },
};
