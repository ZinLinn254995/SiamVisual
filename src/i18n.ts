import type { Language, VisualStyle } from './types';

export interface Translations {
  nav: {
    discover: string;
    history: string;
    toggleThemeLight: string;
    toggleThemeDark: string;
    connectApiShort: string;
    creditsShort: string;
  };
  search: {
    placeholder: string;
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
  };
  card: {
    thaiOriginal: string;
    whatItIs: string;
    silentEdge: string;
    price: string;
    commission: string;
    perSale: string;
    createPlan: string;
    openSavedPlan: string;
    savedTag: string;
    copyThai: string;
    copyId: string;
    copiedShort: string;
    explainAiBtn: string;
    explainingAiBtn: string;
    explainAllBtn: string;
    explainingAllBtn: string;
    aiExplainedTag: string;
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
    removeAria: string;
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
      history: 'သိမ်းထားသည်များ',
      toggleThemeLight: 'Light Mode ပြောင်းမယ်',
      toggleThemeDark: 'Dark Mode ပြောင်းမယ်',
      connectApiShort: 'Kalodata ချိတ်ဆက်',
      creditsShort: 'cr',
    },
    search: {
      placeholder: 'Keyword သို့မဟုတ် Product Link ထည့်ရှာပါ...',
      searchButton: 'ရှာဖွေမယ်',
      searchingButton: 'ရှာဖွေနေသည်...',
      searchSingleButton: 'Link ပစ္စည်းရှာမယ်',
      multiCategoryHint: 'Category တစ်ခုထက်ပို၍ ရွေးနိုင်သည် (ရွေးရုံဖြင့် Credit မဖြတ်ပါ)',
      selectedCount: (n: number) => `${n} ခု ရွေးထားသည်`,
      clearCategories: 'ပြန်ဖြုတ်မယ်',
      syncCategoriesBtn: 'Live Categories (~0.2 cr)',
      syncingCategoriesBtn: 'စစ်ယူနေသည်...',
      liveSyncedTag: 'Live TH Categories',
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
      resultsSubtext: 'စကားမပြောဘဲ Visual သက်သက်ဖြင့် ရောင်းအားကောင်းနိုင်ဆုံး ပစ္စည်းများကို စစ်ထုတ်ပေးထားပါသည်။',
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
    },
    card: {
      thaiOriginal: 'ထိုင်း TikTok နာမည်',
      whatItIs: 'ဒါဘာပစ္စည်းလဲ',
      silentEdge: 'Visual ဆွဲဆောင်ချက်',
      price: 'ဈေးနှုန်း',
      commission: 'ကော်မရှင်',
      perSale: '၁ ခုရောင်းရလျှင်',
      createPlan: 'Video Idea ဖန်တီးမယ်',
      openSavedPlan: 'သိမ်းထားသော Plan ဖွင့်မယ်',
      savedTag: 'သိမ်းပြီး',
      copyThai: 'ထိုင်းနာမည်ကူး',
      copyId: 'ID ကူး',
      copiedShort: 'ကူးပြီး',
      explainAiBtn: 'AI ရှင်းပြချက်ထုတ်မယ်',
      explainingAiBtn: 'AI ရှင်းပြနေသည်...',
      explainAllBtn: 'အားလုံး AI ရှင်းပြမယ် (0 cr)',
      explainingAllBtn: 'အားလုံး AI ရှင်းပြနေသည်...',
      aiExplainedTag: 'AI ရှင်းပြပြီး',
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
      loadedFromStorageNote: 'Browser History မှ ပြသထားသည် (0 cr)',
      removeAria: 'ရှာဖွေမှုမှတ်တမ်းဖျက်ရန်',
    },
    studio: {
      backToResults: 'ရှာဖွေမှုရလဒ်သို့ ပြန်သွားမယ်',
      backToHistory: 'သိမ်းထားသည်များသို့ ပြန်သွားမယ်',
      copyFullKit: 'အားလုံးကူးယူမယ်',
      copied: 'ကူးယူပြီးပါပြီ',
      copy: 'ကူးယူမယ်',
      regenerate: 'အသစ်ပြန်ထုတ်မယ်',
      styleLabel: 'Visual ပုံစံရွေးချယ်ရန်',
      generatingTitle: 'စကားမပြောဘဲ ဆွဲဆောင်မည့် AI Video Plan ဖန်တီးနေပါသည်',
      generatingDesc: 'Visual Hook၊ Silent Script၊ AI Video Prompts နှင့် ထိုင်း TikTok SEO များကို ပြင်ဆင်နေပါသည်...',
      autoSaved: 'Local History တွင် အလိုအလျောက် သိမ်းဆည်းပြီးပါပြီ',
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
      readyTitle: 'Silent AI Video Plan ဖန်တီးရန် အသင့်ဖြစ်ပါပြီ',
      readyDesc: 'အပေါ်တွင် Visual ပုံစံရွေးချယ်ပြီး (လိုအပ်ပါက Kalodata Deep Data ထပ်ယူပြီးမှ) အောက်ပါခလုတ်ကို နှိပ်၍ ဖန်တီးနိုင်ပါသည်။',
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
    },
    styles: {
      cinematic: 'Cinematic Macro',
      asmr: 'ASMR Texture',
      before_after: 'Before & After',
      problem_fix: 'Problem → Fix',
    },
    history: {
      title: 'သိမ်းဆည်းထားသော Video Plans များ',
      subtitle: 'ဖန်တီးထားသမျှ Product နှင့် Video Kit များကို သင့်စက်ထဲတွင် သိမ်းဆည်းထားပါသည်။ အချိန်မရွေး Backup ထုတ်ခြင်းနှင့် ပြန်သွင်းခြင်း ပြုလုပ်နိုင်ပါသည်။',
      searchPlaceholder: 'သိမ်းထားသော ပစ္စည်းနာမည်ဖြင့် ရှာမယ်...',
      backupBtn: 'Backup ထုတ်မယ်',
      restoreBtn: 'Restore ပြန်သွင်းမယ်',
      emptyTitle: 'သိမ်းဆည်းထားသော Video Plan မရှိသေးပါ',
      emptyDesc: 'ပစ္စည်းတစ်ခုရှာပြီး Video Idea ဖန်တီးလိုက်သည်နှင့် ဤနေရာတွင် အလိုအလျောက် သိမ်းဆည်းပေးပါမည်။',
      goDiscover: 'ပစ္စည်းများ စတင်ရှာဖွေမယ်',
      openPlan: 'ပြန်ကြည့်မယ်',
      deleteBtn: 'ဖျက်မယ်',
      confirmDelete: 'သေချာဖျက်မယ်',
      cancel: 'မဖျက်တော့ပါ',
      backupSuccess: 'Backup ဖိုင်ကို အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ။',
      restoreSuccessCount: (added, total) =>
        `Restore အောင်မြင်ပါသည် — အသစ် ${added} ခု ထပ်ပေါင်းပြီး စုစုပေါင်း ${total} ခု ရှိပါပြီ။`,
      restoreError: 'ဖိုင်ပုံစံ မမှန်ကန်ပါ။ SiamVisual Backup JSON ဖိုင်ကိုသာ ရွေးချယ်ပါ။',
      savedCount: (n: number) => `စုစုပေါင်း ${n} ခု သိမ်းထားသည်`,
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
      history: 'Saved Plans',
      toggleThemeLight: 'Switch to Light Mode',
      toggleThemeDark: 'Switch to Dark Mode',
      connectApiShort: 'Connect API',
      creditsShort: 'cr',
    },
    search: {
      placeholder: 'Search keyword or paste product link...',
      searchButton: 'Search',
      searchingButton: 'Searching...',
      searchSingleButton: 'Find Product',
      multiCategoryHint: 'Select one or multiple categories (0 cr until Search)',
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
      resultsSubtext: 'Filtered and ranked behind the scenes for silent visual appeal, demand, and margin.',
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
    },
    card: {
      thaiOriginal: 'Thai TikTok listing',
      whatItIs: 'What it is',
      silentEdge: 'Why silent video sells it',
      price: 'Price',
      commission: 'Commission',
      perSale: 'per sale',
      createPlan: 'Generate Video Plan',
      openSavedPlan: 'Open Saved Plan',
      savedTag: 'Saved',
      copyThai: 'Copy Thai Name',
      copyId: 'Copy ID',
      copiedShort: 'Copied',
      explainAiBtn: 'AI Explain',
      explainingAiBtn: 'Explaining...',
      explainAllBtn: 'AI Explain All (0 cr)',
      explainingAllBtn: 'Explaining all...',
      aiExplainedTag: 'AI Explained',
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
      loadedFromStorageNote: 'Restored from browser history (0 cr)',
      removeAria: 'Remove recent search',
    },
    studio: {
      backToResults: 'Back to Results',
      backToHistory: 'Back to Saved Plans',
      copyFullKit: 'Copy Full Plan',
      copied: 'Copied',
      copy: 'Copy',
      regenerate: 'Regenerate',
      styleLabel: 'Visual style',
      generatingTitle: 'Building your zero-speech AI video plan',
      generatingDesc: 'Crafting silent visual hooks, shot-by-shot storyboard, AI prompts, and Thailand TikTok SEO...',
      autoSaved: 'Saved automatically to Local History',
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
      readyTitle: 'Ready to generate your Silent AI Video Plan',
      readyDesc: 'Choose a visual style above (and optionally fetch Kalodata Deep Data), then click below when you are ready to generate.',
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
    },
    styles: {
      cinematic: 'Cinematic Macro',
      asmr: 'ASMR Texture',
      before_after: 'Before & After',
      problem_fix: 'Problem → Fix',
    },
    history: {
      title: 'Saved Video Plans',
      subtitle: 'All generated products and silent video kits are stored locally on your device. Export a backup anytime or restore on another browser.',
      searchPlaceholder: 'Filter saved products...',
      backupBtn: 'Backup JSON',
      restoreBtn: 'Restore JSON',
      emptyTitle: 'No saved video plans yet',
      emptyDesc: 'Search for a Thailand TikTok product and generate a video plan — it will appear here automatically.',
      goDiscover: 'Explore Products',
      openPlan: 'Open Plan',
      deleteBtn: 'Delete',
      confirmDelete: 'Confirm',
      cancel: 'Cancel',
      backupSuccess: 'Backup JSON downloaded successfully.',
      restoreSuccessCount: (added, total) =>
        `Restored successfully — ${added} new ${added === 1 ? 'plan' : 'plans'} added (${total} total).`,
      restoreError: 'Invalid file format. Please choose a valid SiamVisual backup JSON file.',
      savedCount: (n: number) => `${n} saved ${n === 1 ? 'plan' : 'plans'}`,
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
