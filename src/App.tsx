import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  LayoutGrid,
  Link2,
  List,
  RefreshCw,
  Search,
  SlidersHorizontal,
  WifiOff,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { BottomSheet } from './components/BottomSheet';
import { CompactFilterBar } from './components/CompactFilterBar';
import { DiscoveryFilterBar } from './components/DiscoveryFilterBar';
import { HistoryView } from './components/HistoryView';
import { KalodataBar } from './components/KalodataBar';
import { PaginationBar } from './components/PaginationBar';
import { ProductCard } from './components/ProductCard';
import { ProductRankBoardView, RANK_BOARD_SYNC_COST } from './components/ProductRankBoardView';
import { ScoreDetailDialog } from './components/ScoreDetailDialog';
import { SearchConfigDrawer } from './components/SearchConfigDrawer';
import { SearchHistoryView } from './components/SearchHistoryView';
import { type ActiveTab, TopBar } from './components/TopBar';
import { VideoStudioView } from './components/VideoStudioView';
import { TRANSLATIONS } from './i18n';
import {
  doesProductMatchCategory,
  doesProductMatchSelectedCategories,
  localizeCategories,
} from './lib/categoryTranslations';
import {
  applyDiscoveryFiltersAndSort,
  DEFAULT_DISCOVERY_FILTER_STATE,
  DEFAULT_SEARCH_DATE_RANGE,
  DEFAULT_SEARCH_PAGE_SIZE,
  type DiscoveryFilterState,
  RECOMMENDED_DISCOVERY_FILTER_STATE,
  resolveAppliedDiscoveryFilterAfterSearch,
  type SearchConfigDraft,
  type SearchDateRangeOption,
  type SearchPageSizeOption,
} from './lib/discoveryFilterEngine';
import { inspectQueryLink } from './lib/productLinkInspector';
import { useBackHistoryLayer } from './lib/backHistory';
import {
  buildProductIntelligenceView,
  sortProductsByV2Overall,
} from './lib/productIntelligenceView';
import { evaluateProductCommercialV2 } from './lib/scoringEngineV2';
import {
  buildStrategySnapshotsMap,
  loadProductSnapshotsFromStorage,
  mergeRestoredProductSnapshots,
  recordProductSnapshotsInStorage,
} from './lib/snapshotStore';
import { evaluateProductStrategiesV2 } from './lib/strategyEngineV2';
import {
  clearAllRecentSearches,
  exportHistoryBackup,
  getIdeaPlansForProduct,
  hydrateProductFromStorage,
  hydrateProductsFromStorage,
  loadCachedCategories,
  loadDeepInsightsCache,
  loadIdeaPlansCache,
  loadKalodataLimits,
  loadLanguagePreference,
  loadPinchHintSeen,
  loadProductAnalysisCache,
  loadRankBoardSnapshot,
  loadRecentSearches,
  loadResultGridCols,
  loadResultListZoom,
  loadResultViewMode,
  loadSavedHistory,
  loadThemePreference,
  mergeKalodataMetrics,
  mergeRestoredHistory,
  mergeRestoredRecentSearches,
  mergeValidatedMetricsSnapshots,
  parseBackupFile,
  persistDeepInsightsCache,
  persistIdeaPlansCache,
  persistProductAnalysisCache,
  persistRecentSearches,
  removeHistoryEntry,
  removeRecentSearch,
  saveCachedCategories,
  saveDeepInsightForProduct,
  saveIdeaPlanForProduct,
  saveKalodataLimits,
  saveLanguagePreference,
  savePinchHintSeen,
  saveProductAnalysisForProduct,
  saveRankBoardSnapshot,
  saveResultGridCols,
  saveResultListZoom,
  saveResultViewMode,
  saveThemePreference,
  syncProductInSavedHistory,
  toggleSavedProduct,
  upsertHistoryEntry,
  upsertRecentSearch,
} from './lib/storage';
import type {
  BilingualText,
  CardDensity,
  KalodataCategoryItem,
  KalodataCreditBalance,
  KalodataLimitSettings,
  KalodataStatus,
  Language,
  ProductAiAnalysis,
  ProductDeepInsights,
  ProductEnrichOptions,
  ProductItem,
  ProductKalodataMetrics,
  ProductObservationSnapshot,
  ProductValidatedMetrics,
  RankBoardSnapshot,
  RecentSearchEntry,
  ResultGridCols,
  ResultListZoom,
  ResultViewMode,
  SavedHistoryEntry,
  SearchDateRange,
  Theme,
  VideoAdPlan,
  VideoIdeaIndex,
} from './types';

const LEAN_SEARCH_COST = 0.2;

async function parseApiJson<T>(
  response: Response,
  language: Language
): Promise<T> {
  const rawText = await response.text();
  if (!rawText.trim()) {
    throw new Error(
      language === 'my'
        ? 'Server မှ အချက်အလက် မရရှိပါ — ခဏစောင့်ပြီး ထပ်မံကြိုးစားပါ။'
        : 'Empty response from server. Please try again in a moment.'
    );
  }
  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(
      language === 'my'
        ? 'Server ခဏပြန်စနေသည် သို့မဟုတ် ချိတ်ဆက်မှု ကြာသွားပါသည် — ခဏစောင့်ပြီး ထပ်မံကြိုးစားပါ။'
        : 'Server is restarting or took too long to respond. Please try again in a moment.'
    );
  }
}

async function parseApiStreamOrJson<T>(
  response: Response,
  language: Language
): Promise<T> {
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.includes('application/x-ndjson')) {
    const parsed = await parseApiJson<T & { error?: string }>(response, language);
    if (!response.ok) {
      throw new Error(parsed.error || 'Unable to complete AI request right now.');
    }
    return parsed;
  }

  let finalData: T | null = null;
  let streamError: string | null = null;

  const processLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line) return;
    let frame: { type?: string; data?: T; error?: string; code?: string };
    try {
      frame = JSON.parse(line) as { type?: string; data?: T; error?: string; code?: string };
    } catch {
      return;
    }
    if (frame.type === 'result' && frame.data !== undefined) {
      finalData = frame.data;
    } else if (frame.type === 'error') {
      if (frame.code === 'API_KEY_REQUIRED') {
        streamError =
          language === 'my'
            ? 'Gemini API Key မချိတ်ဆက်ရသေးပါ — AI Studio ၏ Settings > Secrets ထဲတွင် GEMINI_API_KEY ထည့်သွင်း (သို့မဟုတ် ရွေးချယ်) ပေးပါ။'
            : 'Gemini API key is not configured yet — please check or select GEMINI_API_KEY in Settings > Secrets.';
      } else if (frame.code === 'AI_BUSY') {
        streamError =
          language === 'my'
            ? 'AI Server ခဏအလုပ်များနေပါသည် — စက္ကန့်အနည်းငယ်စောင့်ပြီး ထပ်မံနှိပ်ပေးပါ။'
            : 'AI server is temporarily busy due to high demand. Please try again in a few seconds.';
      } else {
        streamError = frame.error || 'Unable to complete AI request right now.';
      }
    }
  };

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        processLine(line);
      }
    }
    if (buffer.trim()) {
      processLine(buffer);
    }
  } else {
    const text = await response.text();
    for (const line of text.split('\n')) {
      processLine(line);
    }
  }

  if (streamError) {
    throw new Error(streamError);
  }
  if (finalData === null) {
    throw new Error(
      language === 'my'
        ? 'AI ဖန်တီးမှု ပြတ်တောက်သွားပါသည် — ထပ်မံကြိုးစားပေးပါ။'
        : 'AI generation was interrupted. Please try again.'
    );
  }
  return finalData;
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => loadLanguagePreference());
  const [theme, setTheme] = useState<Theme>(() => loadThemePreference());
  const [activeTab, setActiveTab] = useState<ActiveTab>('discover');
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Kalodata API connection, live credit balance, drawer toggle & limits
  const [kalodataStatus, setKalodataStatus] = useState<KalodataStatus>({
    connected: false,
    keySource: 'none',
    maskedKey: null,
    balance: null,
  });
  const [isKalodataPanelOpen, setIsKalodataPanelOpen] = useState(false);
  const [kalodataLimits, setKalodataLimits] = useState<KalodataLimitSettings>(() =>
    loadKalodataLimits()
  );
  const [isConnectingKalodata, setIsConnectingKalodata] = useState(false);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [kalodataConnectError, setKalodataConnectError] = useState<string | null>(null);

  // Official + optionally synced live Thailand TikTok Shop categories
  const [categories, setCategories] = useState<KalodataCategoryItem[]>(() =>
    loadCachedCategories()
  );
  const [isSyncingCategories, setIsSyncingCategories] = useState(false);

  // Recent searches auto-saved in browser localStorage (parsed once on mount)
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>(() =>
    loadRecentSearches()
  );
  const initialLatestSearch = recentSearches[0] ?? null;

  const [activeRecentId, setActiveRecentId] = useState<string | null>(
    () => initialLatestSearch?.id ?? null
  );
  const [restoredFromBrowser, setRestoredFromBrowser] = useState<boolean>(
    () => Boolean(initialLatestSearch)
  );

  // Search controls start clean with recommended defaults (100 items · 7d · Monetizable)
  const [query, setQuery] = useState<string>('');
  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState<boolean>(false);
  const [searchPageSize, setSearchPageSize] = useState<SearchPageSizeOption>(
    DEFAULT_SEARCH_PAGE_SIZE
  );
  const [searchDateRange, setSearchDateRange] = useState<SearchDateRangeOption>(
    DEFAULT_SEARCH_DATE_RANGE
  );
  const headerRef = useRef<HTMLElement | null>(null);
  const searchSectionRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(60);
  const [headerSafeTop, setHeaderSafeTop] = useState<number>(0);
  const [showCompactBar, setShowCompactBar] = useState<boolean>(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState<boolean>(false);
  const [isBottomNavHidden, setIsBottomNavHidden] = useState<boolean>(false);
  const compactActiveRef = useRef<boolean>(false);
  const headerHiddenRef = useRef<boolean>(false);
  const bottomNavHiddenRef = useRef<boolean>(false);
  const [selectedCateIds, setSelectedCateIds] = useState<string[]>([]);
  const [resultViewMode, setResultViewMode] = useState<ResultViewMode>(() => loadResultViewMode());
  const [storedGridCols, setStoredGridCols] = useState<ResultGridCols | null>(() =>
    loadResultGridCols()
  );
  const [listZoomLevel, setListZoomLevel] = useState<ResultListZoom>(() => loadResultListZoom());
  const [viewportTier, setViewportTier] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    if (window.innerWidth < 640) return 'mobile';
    if (window.innerWidth < 1024) return 'tablet';
    return 'desktop';
  });
  const resultsGridRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollAnchorRef = useRef<{ productId: string; prevTop: number } | null>(null);
  const zoomHudTimerRef = useRef<number | null>(null);
  const lastPinchEndedAtRef = useRef<number>(0);
  const [zoomHudText, setZoomHudText] = useState<string | null>(null);
  const [zoomDirection, setZoomDirection] = useState<1 | -1 | 0>(0);
  const [showPinchHint, setShowPinchHint] = useState<boolean>(() => !loadPinchHintSeen());

  const [evaluationNowMs, setEvaluationNowMs] = useState<number>(() => Date.now());

  // Append-only daily observation snapshots stored locally for longitudinal strategies (0 extra API calls)
  const [productSnapshots, setProductSnapshots] = useState<
    Record<string, ProductObservationSnapshot[]>
  >(() => loadProductSnapshotsFromStorage());

  const historicalSnapshotsByProductId = useMemo(
    () => buildStrategySnapshotsMap(productSnapshots, { nowMs: evaluationNowMs }),
    [productSnapshots, evaluationNowMs]
  );

  // Home Search Results always initialize with the latest Recent History (0 cr)
  const [hasSearched, setHasSearched] = useState<boolean>(() => Boolean(initialLatestSearch));
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductItem[]>(() =>
    sortProductsByV2Overall(
      hydrateProductsFromStorage(initialLatestSearch?.products ?? [], { nowMs: evaluationNowMs }),
      { nowMs: evaluationNowMs }
    )
  );
  const [discoveryFilter, setDiscoveryFilter] = useState<DiscoveryFilterState>(() =>
    initialLatestSearch?.mode === 'single_link'
      ? { ...DEFAULT_DISCOVERY_FILTER_STATE, sortMode: 'search_score_desc' }
      : RECOMMENDED_DISCOVERY_FILTER_STATE
  );
  const [currentSearchPage, setCurrentSearchPage] = useState<number>(1);
  const [discoverPage, setDiscoverPage] = useState<number>(1);
  const [hasMorePages, setHasMorePages] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [lastSearchMode, setLastSearchMode] = useState<'rank' | 'single_link'>(
    () => initialLatestSearch?.mode ?? 'rank'
  );
  const [scoreDialogProduct, setScoreDialogProduct] = useState<ProductItem | null>(null);

  // Studio state
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const selectedProductIdRef = useRef<string | null>(null);
  const [activeIdeaPlans, setActiveIdeaPlans] = useState<Partial<Record<VideoIdeaIndex, VideoAdPlan>>>(
    {}
  );
  const [generatingIdeaIndex, setGeneratingIdeaIndex] = useState<VideoIdeaIndex | null>(null);
  const [planErrorByIdea, setPlanErrorByIdea] = useState<
    Partial<Record<VideoIdeaIndex, string | null>>
  >({});
  const [isEnrichingProduct, setIsEnrichingProduct] = useState(false);
  const [isAnalyzingProduct, setIsAnalyzingProduct] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [cameFromHistory, setCameFromHistory] = useState(false);
  const [studioReturnTab, setStudioReturnTab] = useState<'discover' | 'rank_board' | 'history'>(
    'discover'
  );

  // Per-tab scroll position memory (Phase 3 Item 15) + credit-safe Pull-to-Refresh state (Item 20)
  type ScrollableTab = 'discover' | 'rank_board' | 'search_history' | 'history';
  const tabScrollPositionsRef = useRef<Record<ScrollableTab, number>>({
    discover: 0,
    rank_board: 0,
    search_history: 0,
    history: 0,
  });
  const pendingTabScrollRestoreRef = useRef<ScrollableTab | null>(null);
  const [ptrPullDistance, setPtrPullDistance] = useState<number>(0);
  const [ptrConfirmScope, setPtrConfirmScope] = useState<'discover' | 'rank_board' | null>(null);

  function saveTabScrollPosition(tab: ActiveTab) {
    if (tab === 'studio' || typeof window === 'undefined') return;
    tabScrollPositionsRef.current[tab] = Math.max(0, window.scrollY);
  }

  function restoreScrollForTab(tab: ScrollableTab) {
    if (pendingTabScrollRestoreRef.current !== tab || typeof window === 'undefined') return;
    pendingTabScrollRestoreRef.current = null;
    const targetY = tabScrollPositionsRef.current[tab] ?? 0;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'instant' as ScrollBehavior });
    });
  }

  // Executive Thailand TikTok Shop Product Rank Board state (restored locally at 0 cr, synced manually)
  const [rankBoardSnapshot, setRankBoardSnapshot] = useState<RankBoardSnapshot | null>(() => {
    const stored = loadRankBoardSnapshot();
    if (!stored) return null;
    return {
      ...stored,
      products: hydrateProductsFromStorage(stored.products, { nowMs: evaluationNowMs }),
    };
  });
  const [rankBoardDateRange, setRankBoardDateRange] = useState<SearchDateRange>(
    () => rankBoardSnapshot?.dateRange ?? 'last7Day'
  );
  const [isSyncingRankBoard, setIsSyncingRankBoard] = useState(false);
  const [rankBoardError, setRankBoardError] = useState<string | null>(null);

  // Local history state
  const [history, setHistory] = useState<SavedHistoryEntry[]>(() => loadSavedHistory());
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    tone: 'neutral' | 'error';
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const studioReturnTabRef = useRef(studioReturnTab);
  studioReturnTabRef.current = studioReturnTab;

  useBackHistoryLayer(
    activeTab === 'studio' && Boolean(selectedProduct),
    () => {
      pendingTabScrollRestoreRef.current = studioReturnTabRef.current;
      setActiveTab(studioReturnTabRef.current);
      headerHiddenRef.current = false;
      bottomNavHiddenRef.current = false;
      setIsHeaderHidden(false);
      setIsBottomNavHidden(false);
    },
    'studio_view'
  );

  useEffect(() => {
    if (activeTab !== 'studio') {
      restoreScrollForTab(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    selectedProductIdRef.current = selectedProduct?.id ?? null;
  }, [selectedProduct?.id]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const t = TRANSLATIONS[language];

  const linkInfo = useMemo(() => inspectQueryLink(query), [query]);

  const savedProductIds = useMemo(
    () => new Set(history.map((entry) => entry.product.id)),
    [history]
  );

  const maxSpendRemaining = useMemo(() => {
    if (kalodataLimits.maxSpendCredits === null) return null;
    return Math.max(
      0,
      Math.round((kalodataLimits.maxSpendCredits - kalodataLimits.trackedSpentCredits) * 100) / 100
    );
  }, [kalodataLimits]);

  const searchLimitWarning = useMemo(() => {
    if (!kalodataStatus.connected) return null;
    const avail = kalodataStatus.balance?.available;
    if (avail !== null && avail !== undefined && avail + 0.0001 < LEAN_SEARCH_COST) {
      return t.kalodata.insufficientBalanceWarning(avail, LEAN_SEARCH_COST);
    }
    if (
      kalodataLimits.maxSpendCredits !== null &&
      kalodataLimits.trackedSpentCredits + LEAN_SEARCH_COST >
        kalodataLimits.maxSpendCredits + 0.0001
    ) {
      return t.kalodata.limitExceededMaxSpend(
        kalodataLimits.trackedSpentCredits,
        LEAN_SEARCH_COST,
        kalodataLimits.maxSpendCredits
      );
    }
    if (
      kalodataLimits.minBalanceReserve !== null &&
      avail !== null &&
      avail !== undefined &&
      avail - LEAN_SEARCH_COST < kalodataLimits.minBalanceReserve - 0.0001
    ) {
      return t.kalodata.limitExceededReserve(
        avail,
        LEAN_SEARCH_COST,
        kalodataLimits.minBalanceReserve
      );
    }
    return null;
  }, [kalodataStatus, kalodataLimits, t]);

  const rankBoardLimitWarning = useMemo(() => {
    if (!kalodataStatus.connected) return null;
    const avail = kalodataStatus.balance?.available;
    if (avail !== null && avail !== undefined && avail + 0.0001 < RANK_BOARD_SYNC_COST) {
      return t.kalodata.insufficientBalanceWarning(avail, RANK_BOARD_SYNC_COST);
    }
    if (
      kalodataLimits.maxSpendCredits !== null &&
      kalodataLimits.trackedSpentCredits + RANK_BOARD_SYNC_COST >
        kalodataLimits.maxSpendCredits + 0.0001
    ) {
      return t.kalodata.limitExceededMaxSpend(
        kalodataLimits.trackedSpentCredits,
        RANK_BOARD_SYNC_COST,
        kalodataLimits.maxSpendCredits
      );
    }
    if (
      kalodataLimits.minBalanceReserve !== null &&
      avail !== null &&
      avail !== undefined &&
      avail - RANK_BOARD_SYNC_COST < kalodataLimits.minBalanceReserve - 0.0001
    ) {
      return t.kalodata.limitExceededReserve(
        avail,
        RANK_BOARD_SYNC_COST,
        kalodataLimits.minBalanceReserve
      );
    }
    return null;
  }, [kalodataStatus, kalodataLimits, t]);

  useEffect(() => {
    let active = true;
    fetch('/api/kalodata/status')
      .then(async (res) => {
        if (!res.ok) return null;
        const text = await res.text();
        try {
          return JSON.parse(text) as KalodataStatus;
        } catch {
          return null;
        }
      })
      .then((data: KalodataStatus | null) => {
        if (!active || !data || typeof data.connected !== 'boolean') return;
        setKalodataStatus({
          connected: data.connected,
          keySource: data.keySource,
          maskedKey: data.maskedKey,
          balance: data.balance,
        });
      })
      .catch(() => {
        // Ignore initial network error gracefully
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    let dynamicThemeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-dynamic="true"]');
    if (!dynamicThemeMeta) {
      dynamicThemeMeta = document.createElement('meta');
      dynamicThemeMeta.name = 'theme-color';
      dynamicThemeMeta.setAttribute('data-dynamic', 'true');
      document.head.appendChild(dynamicThemeMeta);
    }
    dynamicThemeMeta.content = theme === 'dark' ? '#0B1117' : '#F8FAFC';
    saveThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-lang', language);
    document.documentElement.lang = language === 'my' ? 'my' : 'en';
    saveLanguagePreference(language);
  }, [language]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Suppress native browser long-press menus, text-selection popups, and image/link drag previews
  // across the entire app while preserving typing, paste, and explicit .select-text opt-in blocks.
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest('input, textarea, [contenteditable="true"], .select-text, [data-selectable="true"]')
      );
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    const handleSelectStart = (e: Event) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    const handleDragStart = (e: DragEvent) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  // Measure live TopBar height + safe-area top padding so CompactFilterBar docks edge-to-edge on every viewport
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const updateMetrics = () => {
      const nextHeight = Math.round(el.getBoundingClientRect().height);
      const nextSafeTop = Math.round(parseFloat(window.getComputedStyle(el).paddingTop) || 0);
      if (nextHeight > 0) setHeaderHeight(nextHeight);
      setHeaderSafeTop(nextSafeTop);
    };
    updateMetrics();
    const vv = window.visualViewport;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateMetrics);
      observer.observe(el);
    }
    window.addEventListener('resize', updateMetrics, { passive: true });
    window.addEventListener('orientationchange', updateMetrics, { passive: true });
    vv?.addEventListener('resize', updateMetrics, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateMetrics);
      window.removeEventListener('orientationchange', updateMetrics);
      vv?.removeEventListener('resize', updateMetrics);
    };
  }, []);

  useEffect(() => {
    const updateTier = () => {
      const width = window.innerWidth;
      const next: 'mobile' | 'tablet' | 'desktop' =
        width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
      setViewportTier((prev) => (prev === next ? prev : next));
    };
    updateTier();
    window.addEventListener('resize', updateTier, { passive: true });
    return () => window.removeEventListener('resize', updateTier);
  }, []);

  useEffect(() => {
    const syncClock = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const now = Date.now();
      setEvaluationNowMs((prev) => (now - prev >= 60_000 ? now : prev));
    };
    window.addEventListener('focus', syncClock);
    document.addEventListener('visibilitychange', syncClock);
    return () => {
      window.removeEventListener('focus', syncClock);
      document.removeEventListener('visibilitychange', syncClock);
    };
  }, []);

  // Scroll-driven handoff on Discover results + mobile/tablet bottom nav scroll-hide across tabs:
  // - Discover results: scrolling down hides TopBar -> CompactFilterBar & hides Bottom Nav (<1024px).
  // - Other tabs (<1024px): scrolling down hides Bottom Nav for cleaner viewport, scroll up reveals it.
  useEffect(() => {
    const canShowCompact =
      activeTab === 'discover' && hasSearched && products.length > 0 && !isKalodataPanelOpen;
    const isSmallViewport = viewportTier !== 'desktop';
    const hasOpenModal =
      isKalodataPanelOpen ||
      isSearchDrawerOpen ||
      Boolean(scoreDialogProduct) ||
      Boolean(ptrConfirmScope);

    if (!canShowCompact) {
      compactActiveRef.current = false;
      headerHiddenRef.current = false;
      setShowCompactBar(false);
      setIsHeaderHidden(false);
    }

    if (hasOpenModal || !isSmallViewport) {
      bottomNavHiddenRef.current = false;
      setIsBottomNavHidden(false);
    }

    if (!canShowCompact && (!isSmallViewport || hasOpenModal)) {
      return;
    }

    let lastY = Math.max(0, window.scrollY);
    let downAccum = 0;
    let upAccum = 0;
    let rafId = 0;

    const evaluate = (isScrollEvent: boolean) => {
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const currentY = Math.min(Math.max(0, window.scrollY), maxScroll);
      const diff = isScrollEvent ? currentY - lastY : 0;
      lastY = currentY;

      if (canShowCompact) {
        const sectionEl = searchSectionRef.current;
        const rectBottom = sectionEl ? sectionEl.getBoundingClientRect().bottom : 999;

        if (!compactActiveRef.current && rectBottom <= 10 && currentY > 24) {
          compactActiveRef.current = true;
          setShowCompactBar(true);
          if (diff >= 0) {
            headerHiddenRef.current = true;
            setIsHeaderHidden(true);
            if (isSmallViewport && !hasOpenModal) {
              bottomNavHiddenRef.current = true;
              setIsBottomNavHidden(true);
            }
            downAccum = 0;
            upAccum = 0;
          }
          return;
        }

        if (compactActiveRef.current && (rectBottom >= 36 || currentY <= 12)) {
          compactActiveRef.current = false;
          headerHiddenRef.current = false;
          bottomNavHiddenRef.current = false;
          downAccum = 0;
          upAccum = 0;
          setShowCompactBar(false);
          setIsHeaderHidden(false);
          setIsBottomNavHidden(false);
          return;
        }

        if (!compactActiveRef.current || !isScrollEvent || Math.abs(diff) < 1) return;

        if (diff > 0) {
          downAccum += diff;
          upAccum = 0;
          if (!headerHiddenRef.current && downAccum >= 10) {
            headerHiddenRef.current = true;
            downAccum = 0;
            setIsHeaderHidden(true);
            if (isSmallViewport && !hasOpenModal) {
              bottomNavHiddenRef.current = true;
              setIsBottomNavHidden(true);
            }
          }
        } else {
          upAccum += Math.abs(diff);
          downAccum = 0;
          if (headerHiddenRef.current && upAccum >= 14) {
            headerHiddenRef.current = false;
            bottomNavHiddenRef.current = false;
            upAccum = 0;
            setIsHeaderHidden(false);
            setIsBottomNavHidden(false);
          }
        }
        return;
      }

      // Non-discover / pre-search mobile & tablet bottom nav scroll-hide
      if (!isSmallViewport || hasOpenModal) return;

      if (currentY <= 24) {
        if (bottomNavHiddenRef.current) {
          bottomNavHiddenRef.current = false;
          setIsBottomNavHidden(false);
        }
        downAccum = 0;
        upAccum = 0;
        return;
      }

      if (!isScrollEvent || Math.abs(diff) < 1) return;

      if (diff > 0) {
        downAccum += diff;
        upAccum = 0;
        if (!bottomNavHiddenRef.current && currentY > 72 && downAccum >= 16) {
          bottomNavHiddenRef.current = true;
          downAccum = 0;
          setIsBottomNavHidden(true);
        }
      } else {
        upAccum += Math.abs(diff);
        downAccum = 0;
        if (bottomNavHiddenRef.current && upAccum >= 14) {
          bottomNavHiddenRef.current = false;
          upAccum = 0;
          setIsBottomNavHidden(false);
        }
      }
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        evaluate(true);
      });
    };

    const onResize = () => evaluate(false);

    evaluate(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [
    activeTab,
    hasSearched,
    products.length,
    isKalodataPanelOpen,
    isSearchDrawerOpen,
    scoreDialogProduct,
    ptrConfirmScope,
    viewportTier,
  ]);

  // If category filtering shrinks the result grid enough that the inline filters come back into view, exit compact mode cleanly
  useEffect(() => {
    if (!compactActiveRef.current) return;
    const raf = window.requestAnimationFrame(() => {
      const rectBottom = searchSectionRef.current?.getBoundingClientRect().bottom ?? 999;
      if (rectBottom >= 36 || window.scrollY <= 12) {
        compactActiveRef.current = false;
        headerHiddenRef.current = false;
        bottomNavHiddenRef.current = false;
        setShowCompactBar(false);
        setIsHeaderHidden(false);
        setIsBottomNavHidden(false);
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [selectedCateIds]);

  function showToast(text: string, tone: 'neutral' | 'error' = 'neutral') {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage({ text, tone });
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null;
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3400);
  }

  function recordSpentCredits(spentDelta: number) {
    if (spentDelta <= 0) return;
    setKalodataLimits((prev) => {
      const updated: KalodataLimitSettings = {
        ...prev,
        trackedSpentCredits:
          Math.round((prev.trackedSpentCredits + spentDelta) * 100) / 100,
      };
      saveKalodataLimits(updated);
      return updated;
    });
  }

  function handleSaveLimits(next: KalodataLimitSettings) {
    setKalodataLimits(next);
    saveKalodataLimits(next);
    showToast(t.kalodata.limitSavedToast, 'neutral');
  }

  function handleToggleCategory(cateId: string) {
    setDiscoverPage(1);
    if (!cateId) {
      // "All" clears individual multi-category selections
      setSelectedCateIds([]);
      return;
    }
    setSelectedCateIds((prev) =>
      prev.includes(cateId) ? prev.filter((id) => id !== cateId) : [...prev, cateId]
    );
  }

  function resolveCategoryLabels(cateIds: string[]): BilingualText[] {
    return cateIds
      .map((id) => categories.find((c) => c.id === id)?.label)
      .filter((lbl): lbl is BilingualText => Boolean(lbl));
  }

  function saveSearchToBrowserHistory(params: {
    searchQuery: string;
    cateIds: string[];
    mode: 'rank' | 'single_link';
    foundProducts: ProductItem[];
    creditsUsed: number | null;
  }) {
    if (params.foundProducts.length === 0) return;
    const entry: RecentSearchEntry = {
      id: `srch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      searchedAt: new Date().toISOString(),
      query: params.searchQuery,
      cateIds: params.cateIds,
      cateLabels: resolveCategoryLabels(params.cateIds),
      mode: params.mode,
      products: params.foundProducts,
      creditsUsed: params.creditsUsed,
    };
    setRecentSearches((prev) => upsertRecentSearch(prev, entry));
    setActiveRecentId(entry.id);
    setRestoredFromBrowser(false);
  }

  function loadRecentEntryIntoHome(entry: RecentSearchEntry) {
    const nowMs = Date.now();
    setEvaluationNowMs(nowMs);
    const hydrated = sortProductsByV2Overall(
      hydrateProductsFromStorage(entry.products, { nowMs }),
      { nowMs }
    );
    setProducts(hydrated);
    setSelectedCateIds([]);
    setDiscoverPage(1);
    setDiscoveryFilter(
      resolveAppliedDiscoveryFilterAfterSearch(entry.mode, RECOMMENDED_DISCOVERY_FILTER_STATE)
    );
    setLastSearchMode(entry.mode);
    setRestoredFromBrowser(true);
    setHasSearched(true);
    setSearchError(null);
    setActiveRecentId(entry.id);
  }

  function handleOpenSearchHistoryEntry(entry: RecentSearchEntry) {
    saveTabScrollPosition('search_history');
    tabScrollPositionsRef.current.discover = 0;
    pendingTabScrollRestoreRef.current = 'discover';
    loadRecentEntryIntoHome(entry);
    setActiveTab('discover');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleRemoveRecentSearch(searchId: string) {
    const nowMs = Date.now();
    setEvaluationNowMs(nowMs);
    setRecentSearches((prev) => {
      const next = removeRecentSearch(prev, searchId);
      if (activeRecentId === searchId) {
        const nextLatest = next[0] ?? null;
        if (nextLatest) {
          setProducts(
            sortProductsByV2Overall(
              hydrateProductsFromStorage(nextLatest.products, { nowMs }),
              { nowMs }
            )
          );
          setDiscoverPage(1);
          setLastSearchMode(nextLatest.mode);
          setRestoredFromBrowser(true);
          setHasSearched(true);
          setActiveRecentId(nextLatest.id);
        } else {
          setProducts([]);
          setDiscoverPage(1);
          setHasSearched(false);
          setRestoredFromBrowser(false);
          setActiveRecentId(null);
        }
      }
      return next;
    });
  }

  function handleClearRecentSearches() {
    setRecentSearches(clearAllRecentSearches());
    setActiveRecentId(null);
    setRestoredFromBrowser(false);
    setProducts([]);
    setSelectedCateIds([]);
    setDiscoverPage(1);
    setSearchError(null);
    setHasSearched(false);
  }

  function syncUpdatedProductsToActiveRecent(updatedProducts: ProductItem[]) {
    if (!activeRecentId) return;
    setRecentSearches((prev) => {
      const next = prev.map((entry) =>
        entry.id === activeRecentId ? { ...entry, products: updatedProducts } : entry
      );
      persistRecentSearches(next);
      return next;
    });
  }

  async function handleConnectKalodata(apiKey: string): Promise<boolean> {
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setKalodataConnectError(t.kalodata.offlineNotice);
      showToast(t.kalodata.offlineNotice, 'error');
      return false;
    }
    setIsConnectingKalodata(true);
    setKalodataConnectError(null);
    setSearchError(null);
    try {
      const response = await fetch('/api/kalodata/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = await parseApiJson<KalodataStatus & { error?: string }>(response, language);
      if (!response.ok) {
        setKalodataConnectError(data.error || 'Could not verify Kalodata API key.');
        return false;
      }
      setKalodataStatus(data);
      setIsKalodataPanelOpen(false);
      showToast(t.kalodata.connectedToast, 'neutral');
      return true;
    } catch (err) {
      setKalodataConnectError(
        err instanceof Error ? err.message : 'Unable to reach server. Please try again.'
      );
      return false;
    } finally {
      setIsConnectingKalodata(false);
    }
  }

  async function handleDisconnectKalodata(): Promise<void> {
    try {
      const response = await fetch('/api/kalodata/connect', { method: 'DELETE' });
      const data = await parseApiJson<KalodataStatus>(response, language);
      setKalodataStatus(data);
      showToast(t.kalodata.disconnectedToast, 'neutral');
    } catch {
      // Ignore error
    }
  }

  async function handleRefreshBalance(): Promise<void> {
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      showToast(t.kalodata.offlineNotice, 'error');
      return;
    }
    setIsRefreshingBalance(true);
    try {
      const response = await fetch('/api/kalodata/balance');
      const data = await parseApiJson<{
        balance?: KalodataCreditBalance;
        error?: string;
      }>(response, language);
      if (!response.ok) {
        showToast(data.error || 'Could not refresh balance.', 'error');
        return;
      }
      if (data.balance) {
        setKalodataStatus((prev) => ({
          ...prev,
          balance: data.balance ?? prev.balance,
        }));
        showToast(t.kalodata.refreshedToast, 'neutral');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not refresh balance.', 'error');
    } finally {
      setIsRefreshingBalance(false);
    }
  }

  async function handleSyncLiveCategories(): Promise<void> {
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      showToast(t.kalodata.offlineNotice, 'error');
      return;
    }
    if (!kalodataStatus.connected) {
      setIsKalodataPanelOpen(true);
      showToast(t.kalodata.connectRequiredError, 'error');
      return;
    }
    if (searchLimitWarning) {
      showToast(searchLimitWarning, 'error');
      return;
    }

    setIsSyncingCategories(true);
    try {
      const response = await fetch('/api/kalodata/categories/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minBalanceReserve: kalodataLimits.minBalanceReserve,
          maxSpendRemaining,
        }),
      });
      const data = await parseApiJson<{
        categories?: KalodataCategoryItem[];
        creditsUsed?: number | null;
        balance?: KalodataCreditBalance | null;
        error?: string;
      }>(response, language);
      if (!response.ok) {
        throw new Error(data.error || 'Could not sync live categories.');
      }
      if (Array.isArray(data.categories) && data.categories.length > 1) {
        const localized = localizeCategories(data.categories);
        setCategories(localized);
        saveCachedCategories(localized);
      }
      if (data.balance) {
        setKalodataStatus((prev) => ({ ...prev, balance: data.balance ?? prev.balance }));
      }
      const spent = typeof data.creditsUsed === 'number' ? data.creditsUsed : LEAN_SEARCH_COST;
      recordSpentCredits(spent);
      showToast(t.kalodata.categoriesSyncedToast, 'neutral');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not sync categories.', 'error');
    } finally {
      setIsSyncingCategories(false);
    }
  }

  // Manual Update Sync (~0.4 cr) for the Thailand TikTok Shop Executive Product Rank Board
  async function handleSyncRankBoard(targetDateRange?: SearchDateRange): Promise<void> {
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setRankBoardError(t.kalodata.offlineNotice);
      showToast(t.kalodata.offlineNotice, 'error');
      return;
    }
    const effectiveRange: SearchDateRange =
      targetDateRange ?? rankBoardDateRange ?? 'last7Day';

    if (!kalodataStatus.connected) {
      setIsKalodataPanelOpen(true);
      setRankBoardError(t.kalodata.connectRequiredError);
      showToast(t.kalodata.connectRequiredError, 'error');
      return;
    }

    if (rankBoardLimitWarning) {
      setRankBoardError(rankBoardLimitWarning);
      showToast(rankBoardLimitWarning, 'error');
      return;
    }

    setIsSyncingRankBoard(true);
    setRankBoardError(null);
    try {
      const response = await fetch('/api/rank-board/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRange: effectiveRange,
          minBalanceReserve: kalodataLimits.minBalanceReserve,
          maxSpendRemaining,
        }),
      });
      const data = await parseApiJson<{
        snapshot?: RankBoardSnapshot;
        creditsUsed?: number | null;
        balance?: KalodataCreditBalance | null;
        code?: string;
        error?: string;
      }>(response, language);

      if (!response.ok || !data.snapshot) {
        if (data.code === 'KALODATA_NOT_CONNECTED') {
          setKalodataStatus((prev) => ({ ...prev, connected: false, balance: null }));
          setIsKalodataPanelOpen(true);
          throw new Error(t.kalodata.connectRequiredError);
        }
        throw new Error(data.error || 'Could not sync Thailand TikTok Shop Rank Board.');
      }

      const nowMs = Date.now();
      setEvaluationNowMs(nowMs);
      const hydratedProducts = hydrateProductsFromStorage(data.snapshot.products, { nowMs });

      if (hydratedProducts.length > 0) {
        const snapshotUpdate = recordProductSnapshotsInStorage(hydratedProducts, { nowMs });
        if (snapshotUpdate.addedCount > 0 || snapshotUpdate.updatedCount > 0) {
          setProductSnapshots(snapshotUpdate.snapshotsByProductId);
        }
      }

      const nextSnapshot: RankBoardSnapshot = {
        ...data.snapshot,
        products: hydratedProducts,
      };
      setRankBoardSnapshot(nextSnapshot);
      setRankBoardDateRange(nextSnapshot.dateRange);
      saveRankBoardSnapshot(nextSnapshot);

      if (data.balance) {
        setKalodataStatus((prev) => ({ ...prev, balance: data.balance ?? prev.balance }));
      }
      const spent =
        typeof data.creditsUsed === 'number' ? data.creditsUsed : RANK_BOARD_SYNC_COST;
      recordSpentCredits(spent);

      showToast(
        t.rankBoard.syncedToast(
          nextSnapshot.products.length,
          nextSnapshot.categoryMarket.length
        ),
        'neutral'
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not sync Thailand TikTok Shop Rank Board.';
      setRankBoardError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSyncingRankBoard(false);
    }
  }

  // Kalodata API Search (reuses 10-min server cache unless forceRefresh=true; supports pageSize & dateRange)
  async function runProductSearch(options?: {
    pageNumber?: number;
    append?: boolean;
    forceRefresh?: boolean;
    queryOverride?: string;
    cateIdsOverride?: string[];
    pageSizeOverride?: SearchPageSizeOption;
    dateRangeOverride?: SearchDateRangeOption;
    filterStateOverride?: DiscoveryFilterState;
  }) {
    const targetPage = Math.max(1, Math.min(10, Math.floor(options?.pageNumber ?? 1)));
    const isAppend = options?.append === true && targetPage > 1;
    const effectiveQuery = (options?.queryOverride ?? query).trim();
    const effectiveLinkInfo = inspectQueryLink(effectiveQuery);
    const effectiveCateIds = effectiveLinkInfo.isLinkOrId
      ? []
      : options?.cateIdsOverride ?? selectedCateIds;
    const effectivePageSize = options?.pageSizeOverride ?? searchPageSize;
    const effectiveDateRange = options?.dateRangeOverride ?? searchDateRange;
    const effectiveFilterState = options?.filterStateOverride ?? discoveryFilter;

    if (options?.queryOverride !== undefined) setQuery(effectiveQuery);
    if (options?.cateIdsOverride !== undefined) setSelectedCateIds(effectiveCateIds);
    if (options?.pageSizeOverride !== undefined) setSearchPageSize(effectivePageSize);
    if (options?.dateRangeOverride !== undefined) setSearchDateRange(effectiveDateRange);

    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      if (!isAppend) {
        setHasSearched(true);
        setSearchError(t.kalodata.offlineNotice);
      }
      showToast(t.kalodata.offlineNotice, 'error');
      return;
    }

    if (!kalodataStatus.connected) {
      setIsKalodataPanelOpen(true);
      if (!isAppend) {
        setHasSearched(true);
        setProducts([]);
        setSearchError(t.kalodata.connectRequiredError);
      } else {
        showToast(t.kalodata.connectRequiredError, 'error');
      }
      return;
    }

    if (
      effectiveLinkInfo.isLinkOrId &&
      !effectiveLinkInfo.productId &&
      !effectiveLinkInfo.isShortLink
    ) {
      setHasSearched(true);
      setProducts([]);
      setSearchError(t.search.invalidLinkNotice);
      return;
    }

    if (searchLimitWarning) {
      if (!isAppend) {
        setHasSearched(true);
        setSearchError(searchLimitWarning);
      } else {
        showToast(searchLimitWarning, 'error');
      }
      return;
    }

    if (isAppend) {
      setIsLoadingMore(true);
    } else {
      tabScrollPositionsRef.current.discover = 0;
      setIsSearching(true);
      setHasSearched(true);
      setSearchError(null);
    }

    try {
      const singleSelectedCat =
        !effectiveLinkInfo.isLinkOrId && effectiveCateIds.length === 1
          ? categories.find((c) => c.id === effectiveCateIds[0])
          : undefined;
      const response = await fetch('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: effectiveQuery,
          cateIds: effectiveLinkInfo.isLinkOrId ? [] : effectiveCateIds,
          selectedCategoryMeta: singleSelectedCat
            ? {
                id: singleSelectedCat.id,
                my: singleSelectedCat.label.my,
                en: singleSelectedCat.label.en,
              }
            : null,
          pageNumber: targetPage,
          pageSize: effectivePageSize,
          dateRange: effectiveDateRange,
          forceRefresh: options?.forceRefresh === true,
          minBalanceReserve: kalodataLimits.minBalanceReserve,
          maxSpendRemaining,
        }),
      });

      const data = await parseApiJson<{
        products?: ProductItem[];
        balance?: KalodataCreditBalance | null;
        creditsUsed?: number | null;
        fromCache?: boolean;
        mode?: 'rank' | 'single_link';
        pageNumber?: number;
        pageSize?: number;
        hasMore?: boolean;
        code?: string;
        error?: string;
      }>(response, language);

      if (!response.ok) {
        if (data.code === 'KALODATA_NOT_CONNECTED') {
          setKalodataStatus((prev) => ({ ...prev, connected: false, balance: null }));
          setIsKalodataPanelOpen(true);
          throw new Error(t.kalodata.connectRequiredError);
        }
        throw new Error(data.error || 'Kalodata API search failed');
      }

      const nowMs = Date.now();
      setEvaluationNowMs(nowMs);
      const rawFetched = Array.isArray(data.products) ? data.products : [];
      // Persist any single-link /detail layer (even if description is empty) into permanent Deep Insights cache
      for (const item of rawFetched) {
        if (item.deepInsights?.fetchedDetails || item.deepInsights?.description) {
          saveDeepInsightForProduct(item.id, {
            deepInsights: item.deepInsights,
            kalodataMetrics: item.kalodataMetrics,
            validatedMetrics: item.validatedMetrics,
            shopName: item.shopName,
            imageUrl: item.imageUrl,
          });
        }
      }
      const hydratedIncoming = hydrateProductsFromStorage(rawFetched, { nowMs });

      // Append genuine Kalodata source observations into local daily snapshot history (0 extra API calls)
      if (hydratedIncoming.length > 0) {
        const snapshotUpdate = recordProductSnapshotsInStorage(hydratedIncoming, { nowMs });
        if (snapshotUpdate.addedCount > 0 || snapshotUpdate.updatedCount > 0) {
          setProductSnapshots(snapshotUpdate.snapshotsByProductId);
        }
      }

      const resolvedMode: 'rank' | 'single_link' =
        data.mode === 'single_link' ? 'single_link' : 'rank';
      const used = typeof data.creditsUsed === 'number' ? data.creditsUsed : null;
      const fromCache = data.fromCache === true;
      const resolvedPage = typeof data.pageNumber === 'number' ? data.pageNumber : targetPage;
      const resolvedPageSize =
        typeof data.pageSize === 'number' && data.pageSize > 0
          ? data.pageSize
          : effectivePageSize;
      const nextHasMore =
        resolvedMode === 'rank' &&
        (typeof data.hasMore === 'boolean'
          ? data.hasMore
          : rawFetched.length >= resolvedPageSize && resolvedPage < 10);

      let finalProducts: ProductItem[];
      let newlyAddedCount = hydratedIncoming.length;

      if (isAppend) {
        const existingById = new Map(products.map((p) => [p.id, p]));
        let added = 0;
        for (const item of hydratedIncoming) {
          if (!existingById.has(item.id)) {
            added += 1;
          }
          existingById.set(item.id, item);
        }
        newlyAddedCount = added;
        finalProducts = sortProductsByV2Overall(Array.from(existingById.values()), {
          nowMs,
          historicalSnapshotsByProductId,
        });
      } else {
        finalProducts = sortProductsByV2Overall(hydratedIncoming, {
          nowMs,
          historicalSnapshotsByProductId,
        });
        setDiscoveryFilter(
          resolveAppliedDiscoveryFilterAfterSearch(resolvedMode, effectiveFilterState)
        );
      }

      setProducts(finalProducts);
      if (!isAppend) {
        setDiscoverPage(1);
      }
      setCurrentSearchPage(resolvedPage);
      setHasMorePages(nextHasMore);
      setLastSearchMode(resolvedMode);
      setRestoredFromBrowser(false);

      if (finalProducts.length > 0) {
        saveSearchToBrowserHistory({
          searchQuery: effectiveQuery,
          cateIds: effectiveLinkInfo.isLinkOrId ? [] : effectiveCateIds,
          mode: resolvedMode,
          foundProducts: finalProducts,
          creditsUsed: fromCache ? 0 : used,
        });
      }

      if (data.balance) {
        setKalodataStatus((prev) => ({
          ...prev,
          balance: data.balance ?? prev.balance,
        }));
      }

      if (!fromCache) {
        const spentDelta = used !== null ? used : LEAN_SEARCH_COST;
        recordSpentCredits(spentDelta);
      } else if (!isAppend) {
        showToast(t.v2.discoveryFilter.cachedSearchToast, 'neutral');
      }

      if (isAppend) {
        showToast(
          t.v2.discoveryFilter.loadedMoreToast(newlyAddedCount, resolvedPage, fromCache),
          'neutral'
        );
      }
    } catch (err) {
      if (isAppend) {
        showToast(err instanceof Error ? err.message : 'Unable to load next page right now.', 'error');
      } else {
        setProducts([]);
        setHasMorePages(false);
        setSearchError(err instanceof Error ? err.message : 'Unable to search right now.');
      }
    } finally {
      if (isAppend) {
        setIsLoadingMore(false);
      } else {
        setIsSearching(false);
      }
    }
  }

  function handleDrawerSearchSubmit(config: SearchConfigDraft) {
    setIsSearchDrawerOpen(false);
    runProductSearch({
      pageNumber: 1,
      append: false,
      forceRefresh: false,
      queryOverride: config.query,
      cateIdsOverride: config.cateIds,
      pageSizeOverride: config.pageSize,
      dateRangeOverride: config.dateRange,
      filterStateOverride: config.filterState,
    });
  }

  async function requestIdeaVideoPlan(
    product: ProductItem,
    ideaIndex: VideoIdeaIndex,
    forceFresh = false
  ) {
    const targetProductId = product.id;
    const concept = product.aiAnalysis?.videoIdeasPack?.concepts?.[ideaIndex];
    if (!concept) {
      const missingErr =
        language === 'my'
          ? `Video Idea ${ideaIndex + 1} အချက်အလက် မတွေ့သေးပါ — ဦးစွာ Video Ideas ဖန်တီးပေးပါ။`
          : `Video Idea ${ideaIndex + 1} is not ready yet. Please generate Video Ideas first.`;
      setPlanErrorByIdea((prev) => ({ ...prev, [ideaIndex]: missingErr }));
      return;
    }

    if (!forceFresh) {
      const cachedPlan =
        activeIdeaPlans[ideaIndex] ??
        getIdeaPlansForProduct(targetProductId)[ideaIndex] ??
        history.find((entry) => entry.product.id === targetProductId && entry.ideaPlans?.[ideaIndex])
          ?.ideaPlans?.[ideaIndex];
      if (cachedPlan) {
        if (selectedProductIdRef.current === targetProductId) {
          setActiveIdeaPlans((prev) => ({ ...prev, [ideaIndex]: cachedPlan }));
          setPlanErrorByIdea((prev) => ({ ...prev, [ideaIndex]: null }));
          setGeneratingIdeaIndex((prev) => (prev === ideaIndex ? null : prev));
        }
        return;
      }
    }

    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setPlanErrorByIdea((prev) => ({ ...prev, [ideaIndex]: t.kalodata.offlineNotice }));
      showToast(t.kalodata.offlineNotice, 'error');
      return;
    }

    setGeneratingIdeaIndex(ideaIndex);
    setPlanErrorByIdea((prev) => ({ ...prev, [ideaIndex]: null }));

    const controller = new AbortController();
    const clientTimer = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product,
          ideaIndex,
          concept,
          videoIdeasPack: product.aiAnalysis?.videoIdeasPack,
        }),
        signal: controller.signal,
      });

      const data = await parseApiStreamOrJson<{ plan?: VideoAdPlan }>(response, language);
      if (!data.plan) {
        throw new Error('Unable to generate video plan right now.');
      }

      const generatedPlan: VideoAdPlan = {
        ...data.plan,
        ideaIndex,
      };
      const nextForProduct = saveIdeaPlanForProduct(targetProductId, ideaIndex, generatedPlan);

      const newEntry: SavedHistoryEntry = {
        id: `prod_${targetProductId}`,
        savedAt: generatedPlan.createdAt,
        product,
        ideaPlans: nextForProduct,
      };
      setHistory((prev) => upsertHistoryEntry(prev, newEntry));

      if (selectedProductIdRef.current === targetProductId) {
        setActiveIdeaPlans(nextForProduct);
      }
    } catch (err) {
      if (selectedProductIdRef.current === targetProductId) {
        if (err instanceof Error && err.name === 'AbortError') {
          setPlanErrorByIdea((prev) => ({
            ...prev,
            [ideaIndex]:
              language === 'my'
                ? 'AI Video Plan ဖန်တီးချိန် ကြာသွားပါသည် — ထပ်မံကြိုးစားပေးပါ။'
                : 'AI video generation timed out. Please try again.',
          }));
        } else {
          setPlanErrorByIdea((prev) => ({
            ...prev,
            [ideaIndex]:
              err instanceof Error ? err.message : 'Unable to generate video plan right now.',
          }));
        }
      }
    } finally {
      window.clearTimeout(clientTimer);
      if (selectedProductIdRef.current === targetProductId) {
        setGeneratingIdeaIndex((prev) => (prev === ideaIndex ? null : prev));
      }
    }
  }

  async function handleFetchProductDeepInsights(options: ProductEnrichOptions) {
    if (!selectedProduct) return;
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setEnrichError(t.kalodata.offlineNotice);
      showToast(t.kalodata.offlineNotice, 'error');
      return;
    }
    const targetProduct = selectedProduct;
    const targetProductId = targetProduct.id;
    setIsEnrichingProduct(true);
    setEnrichError(null);
    try {
      const response = await fetch('/api/products/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: targetProductId,
          options,
          minBalanceReserve: kalodataLimits.minBalanceReserve,
          maxSpendRemaining,
        }),
      });
      const data = await parseApiJson<{
        deepInsights?: ProductDeepInsights;
        kalodataMetrics?: ProductKalodataMetrics;
        validatedMetrics?: ProductValidatedMetrics;
        shopName?: string;
        imageUrl?: string;
        failedLayers?: Array<'details' | 'specs' | 'comments'>;
        creditsUsed?: number | null;
        balance?: KalodataCreditBalance | null;
        error?: string;
      }>(response, language);
      if (!response.ok || !data.deepInsights) {
        throw new Error(data.error || 'Could not fetch Kalodata deep data.');
      }

      if (data.balance) {
        setKalodataStatus((prev) => ({
          ...prev,
          balance: data.balance ?? prev.balance,
        }));
      }

      const est =
        (options.includeDetails ? 0.2 : 0) +
        (options.includeSpecs ? 0.5 : 0) +
        (options.includeComments ? 1.0 : 0);
      const spent = typeof data.creditsUsed === 'number' ? data.creditsUsed : est;
      recordSpentCredits(spent);

      const nowMs = Date.now();
      setEvaluationNowMs(nowMs);

      const mergedIncomingKalodata = mergeKalodataMetrics(
        data.kalodataMetrics,
        targetProduct.kalodataMetrics
      );
      const mergedIncomingValidated = mergeValidatedMetricsSnapshots(
        data.validatedMetrics,
        targetProduct.validatedMetrics
      );

      // Permanently save fetched Kalodata Deep Data & Metrics into browser localStorage (never auto-generates Video Ideas!)
      const savedRecord = saveDeepInsightForProduct(targetProductId, {
        deepInsights: data.deepInsights,
        kalodataMetrics: mergedIncomingKalodata,
        validatedMetrics: mergedIncomingValidated,
        shopName: data.shopName,
        imageUrl: data.imageUrl,
      });

      const nextValidated = savedRecord.validatedMetrics ?? targetProduct.validatedMetrics;
      const nextCommercialV2 = nextValidated
        ? evaluateProductCommercialV2(nextValidated, { nowMs })
        : targetProduct.commercialScoreV2;
      const upgradedProduct: ProductItem = {
        ...targetProduct,
        shopName: savedRecord.shopName || targetProduct.shopName,
        imageUrl: savedRecord.imageUrl || targetProduct.imageUrl,
        kalodataMetrics: savedRecord.kalodataMetrics ?? targetProduct.kalodataMetrics,
        validatedMetrics: nextValidated,
        commercialScoreV2: nextCommercialV2,
        strategyIntelligenceV2: nextValidated
          ? evaluateProductStrategiesV2(nextValidated, nextCommercialV2, {
              scoringConfig: { nowMs },
            })
          : targetProduct.strategyIntelligenceV2,
        deepInsights: savedRecord.deepInsights,
      };

      const snapshotUpdate = recordProductSnapshotsInStorage([upgradedProduct], { nowMs });
      if (snapshotUpdate.addedCount > 0 || snapshotUpdate.updatedCount > 0) {
        setProductSnapshots(snapshotUpdate.snapshotsByProductId);
      }

      setHistory((prev) => syncProductInSavedHistory(prev, upgradedProduct));
      setProducts((prev) => {
        const nextList = prev.map((item) =>
          item.id === upgradedProduct.id ? upgradedProduct : item
        );
        syncUpdatedProductsToActiveRecent(nextList);
        return nextList;
      });

      if (selectedProductIdRef.current === targetProductId) {
        setSelectedProduct(upgradedProduct);
      }

      if (Array.isArray(data.failedLayers) && data.failedLayers.length > 0) {
        const partialMsg = t.studio.deepPartialWarning(data.failedLayers);
        if (selectedProductIdRef.current === targetProductId) {
          setEnrichError(partialMsg);
        }
        showToast(partialMsg, 'error');
      } else {
        showToast(t.studio.deepUpgradedToast, 'neutral');
      }
    } catch (err) {
      if (selectedProductIdRef.current === targetProductId) {
        setEnrichError(err instanceof Error ? err.message : 'Unable to enrich product.');
      }
    } finally {
      if (selectedProductIdRef.current === targetProductId) {
        setIsEnrichingProduct(false);
      }
    }
  }

  // Manual AI Deep Product Analysis strictly grounded in available Kalodata data (0 Kalodata credits)
  async function handleAnalyzeProduct() {
    if (!selectedProduct || isAnalyzingProduct) return;
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setAnalysisError(t.kalodata.offlineNotice);
      showToast(t.kalodata.offlineNotice, 'error');
      return;
    }
    const targetProduct = selectedProduct;
    const targetProductId = targetProduct.id;
    setIsAnalyzingProduct(true);
    setAnalysisError(null);
    const controller = new AbortController();
    const clientTimer = window.setTimeout(() => controller.abort(), 105000);
    try {
      const response = await fetch('/api/products/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: targetProduct }),
        signal: controller.signal,
      });
      const data = await parseApiStreamOrJson<{ analysis?: ProductAiAnalysis }>(
        response,
        language
      );
      if (!data.analysis) {
        throw new Error('Unable to generate video ideas right now.');
      }

      saveProductAnalysisForProduct(targetProductId, data.analysis);

      const analyzedProduct: ProductItem = {
        ...targetProduct,
        aiAnalysis: data.analysis,
      };
      setHistory((prev) => syncProductInSavedHistory(prev, analyzedProduct));
      setProducts((prev) => {
        const nextList = prev.map((item) =>
          item.id === analyzedProduct.id ? analyzedProduct : item
        );
        syncUpdatedProductsToActiveRecent(nextList);
        return nextList;
      });

      if (selectedProductIdRef.current === targetProductId) {
        setSelectedProduct(analyzedProduct);
      }
    } catch (err) {
      if (selectedProductIdRef.current === targetProductId) {
        if (err instanceof Error && err.name === 'AbortError') {
          setAnalysisError(
            language === 'my'
              ? 'AI Video Ideas စဉ်းစားချိန် ကြာသွားပါသည် — ထပ်မံကြိုးစားပေးပါ။'
              : 'AI Video Ideas generation timed out. Please try again.'
          );
        } else {
          setAnalysisError(
            err instanceof Error ? err.message : 'Unable to generate video ideas right now.'
          );
        }
      }
    } finally {
      window.clearTimeout(clientTimer);
      if (selectedProductIdRef.current === targetProductId) {
        setIsAnalyzingProduct(false);
      }
    }
  }

  function loadMergedIdeaPlansForEntry(
    productId: string,
    entry?: SavedHistoryEntry
  ): Partial<Record<VideoIdeaIndex, VideoAdPlan>> {
    const cached = getIdeaPlansForProduct(productId);
    const matchingHistory = history.filter((item) => item.product.id === productId);
    const fromHistory = matchingHistory.reduce<Partial<Record<VideoIdeaIndex, VideoAdPlan>>>(
      (acc, item) => ({ ...acc, ...(item.ideaPlans ?? {}) }),
      {}
    );
    const merged: Partial<Record<VideoIdeaIndex, VideoAdPlan>> = {
      ...cached,
      ...fromHistory,
      ...(entry?.ideaPlans ?? {}),
    };
    const legacyPlan = entry?.plan ?? matchingHistory.find((item) => item.plan)?.plan;
    if (
      legacyPlan &&
      (legacyPlan.ideaIndex === 0 || legacyPlan.ideaIndex === 1 || legacyPlan.ideaIndex === 2) &&
      !merged[legacyPlan.ideaIndex]
    ) {
      merged[legacyPlan.ideaIndex] = legacyPlan;
    }
    return merged;
  }

  function handleToggleSaveProduct(product: ProductItem) {
    const hydrated = hydrateProductFromStorage(product, { nowMs: evaluationNowMs });
    const { next, saved } = toggleSavedProduct(history, hydrated);
    setHistory(next);
    showToast(saved ? t.card.savedProductToast : t.card.removedProductToast, 'neutral');
  }

  // Opens Video Studio cleanly — NEVER auto-generates Video Ideas!
  function handleSelectProduct(
    product: ProductItem,
    sourceTab: 'discover' | 'rank_board' = 'discover'
  ) {
    // Ignore stray click synthesized right after lifting two fingers from a pinch gesture
    if (sourceTab === 'discover' && Date.now() - lastPinchEndedAtRef.current < 280) return;
    const hydrated = hydrateProductFromStorage(product, { nowMs: evaluationNowMs });
    const savedIdeaPlans = loadMergedIdeaPlansForEntry(hydrated.id);

    saveTabScrollPosition(sourceTab);
    selectedProductIdRef.current = hydrated.id;
    setSelectedProduct(hydrated);
    setActiveIdeaPlans(savedIdeaPlans);
    setGeneratingIdeaIndex(null);
    setPlanErrorByIdea({});
    setEnrichError(null);
    setAnalysisError(null);
    setIsEnrichingProduct(false);
    setIsAnalyzingProduct(false);
    setCameFromHistory(false);
    setStudioReturnTab(sourceTab);
    setActiveTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleOpenHistoryEntry(entry: SavedHistoryEntry) {
    const hydrated = hydrateProductFromStorage(entry.product, { nowMs: evaluationNowMs });
    const savedIdeaPlans = loadMergedIdeaPlansForEntry(hydrated.id, entry);

    saveTabScrollPosition('history');
    selectedProductIdRef.current = hydrated.id;
    setSelectedProduct(hydrated);
    setActiveIdeaPlans(savedIdeaPlans);
    setGeneratingIdeaIndex(null);
    setPlanErrorByIdea({});
    setEnrichError(null);
    setAnalysisError(null);
    setIsEnrichingProduct(false);
    setIsAnalyzingProduct(false);
    setCameFromHistory(true);
    setStudioReturnTab('history');
    setActiveTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleExportBackup() {
    exportHistoryBackup(history, kalodataLimits, recentSearches);
    showToast(t.history.backupSuccess, 'neutral');
  }

  async function handleImportBackup(file: File) {
    try {
      const text = await file.text();
      const parsed = parseBackupFile(text);
      if (!parsed) {
        showToast(t.history.restoreError, 'error');
        return;
      }
      const { merged, addedCount } = mergeRestoredHistory(history, parsed.entries);
      setHistory(merged);
      if (parsed.limits) {
        setKalodataLimits(parsed.limits);
        saveKalodataLimits(parsed.limits);
      }
      let cachesRestored = false;
      if (parsed.deepInsightsCache) {
        const mergedDeepCache = {
          ...loadDeepInsightsCache(),
          ...parsed.deepInsightsCache,
        };
        persistDeepInsightsCache(mergedDeepCache);
        cachesRestored = true;
      }
      if (parsed.productAnalysisCache) {
        const mergedAnalysisCache = {
          ...loadProductAnalysisCache(),
          ...parsed.productAnalysisCache,
        };
        persistProductAnalysisCache(mergedAnalysisCache);
        cachesRestored = true;
      }
      if (parsed.ideaPlansCache) {
        const currentIdeaCache = loadIdeaPlansCache();
        const mergedIdeaCache = { ...currentIdeaCache };
        for (const [productId, plans] of Object.entries(parsed.ideaPlansCache)) {
          mergedIdeaCache[productId] = {
            ...(currentIdeaCache[productId] ?? {}),
            ...plans,
          };
        }
        persistIdeaPlansCache(mergedIdeaCache);
        if (selectedProductIdRef.current) {
          setActiveIdeaPlans((prev) => ({
            ...prev,
            ...(mergedIdeaCache[selectedProductIdRef.current!] ?? {}),
          }));
        }
        cachesRestored = true;
      }
      if (parsed.productSnapshots) {
        const { merged: mergedSnapshots } = mergeRestoredProductSnapshots(
          productSnapshots,
          parsed.productSnapshots
        );
        setProductSnapshots(mergedSnapshots);
        cachesRestored = true;
      }
      let searchesAdded = 0;
      if (parsed.recentSearches && parsed.recentSearches.length > 0) {
        const { merged: mergedSearches, addedCount: addedSearches } =
          mergeRestoredRecentSearches(recentSearches, parsed.recentSearches);
        searchesAdded = addedSearches;
        setRecentSearches(mergedSearches);
        if (!hasSearched && mergedSearches[0]) {
          loadRecentEntryIntoHome(mergedSearches[0]);
        }
      }
      if (cachesRestored) {
        const nowMs = Date.now();
        setEvaluationNowMs(nowMs);
        setProducts((prev) =>
          prev.length > 0
            ? sortProductsByV2Overall(hydrateProductsFromStorage(prev, { nowMs }), { nowMs })
            : prev
        );
        setSelectedProduct((prev) =>
          prev ? hydrateProductFromStorage(prev, { nowMs }) : prev
        );
      }
      showToast(
        searchesAdded > 0
          ? t.history.restoreSuccessWithSearches(addedCount, merged.length, searchesAdded)
          : t.history.restoreSuccessCount(addedCount, merged.length),
        'neutral'
      );
    } catch {
      showToast(t.history.restoreError, 'error');
    }
  }

  const hasLiveSyncedCategories = categories.some((c) => c.source === 'kalodata_live');
  const isSingleLinkValid =
    linkInfo.isLinkOrId && (Boolean(linkInfo.productId) || linkInfo.isShortLink);
  const isLinkBroken = linkInfo.isLinkOrId && !linkInfo.productId && !linkInfo.isShortLink;
  const activeRecentEntry = useMemo(
    () => recentSearches.find((entry) => entry.id === activeRecentId) ?? null,
    [recentSearches, activeRecentId]
  );
  const isViewingOlderHistory = Boolean(
    activeRecentEntry && recentSearches[0] && activeRecentEntry.id !== recentSearches[0].id
  );

  // Dual-purpose Category Chips:
  // 1) Selecting categories immediately filters currently displayed results (0 cr),
  //    UNLESS selected categories already match the exact live category search that produced these results.
  // 2) Clicking the primary Search button uses the exact same selectedCateIds for a fresh live Kalodata search (~0.2 cr).
  const isSameAsActiveSearchScope = useMemo(() => {
    if (selectedCateIds.length === 0 || !activeRecentEntry || activeRecentEntry.cateIds.length === 0) {
      return false;
    }
    if (selectedCateIds.length !== activeRecentEntry.cateIds.length) {
      return false;
    }
    const activeSet = new Set(activeRecentEntry.cateIds);
    return selectedCateIds.every((id) => activeSet.has(id));
  }, [selectedCateIds, activeRecentEntry]);

  const isCategoryFilterActive = Boolean(
    products.length > 0 &&
      lastSearchMode !== 'single_link' &&
      !linkInfo.isLinkOrId &&
      selectedCateIds.length > 0 &&
      !isSameAsActiveSearchScope
  );

  const filteredProducts = useMemo(() => {
    if (!isCategoryFilterActive) return products;
    return products.filter((product) =>
      doesProductMatchSelectedCategories(product, selectedCateIds, categories)
    );
  }, [products, isCategoryFilterActive, selectedCateIds, categories]);

  const intelligenceView = useMemo(
    () =>
      buildProductIntelligenceView(filteredProducts, 'overall', {
        nowMs: evaluationNowMs,
        historicalSnapshotsByProductId,
        observationSnapshotsByProductId: productSnapshots,
      }),
    [
      filteredProducts,
      evaluationNowMs,
      historicalSnapshotsByProductId,
      productSnapshots,
    ]
  );

  const discoveryFilterResult = useMemo(
    () => applyDiscoveryFiltersAndSort(intelligenceView.rankedEntries, discoveryFilter),
    [intelligenceView.rankedEntries, discoveryFilter]
  );

  const displayedRankedEntries = discoveryFilterResult.entries;

  const DISCOVER_PAGE_SIZE = 12;
  const totalDiscoverPages = Math.max(
    1,
    Math.ceil(displayedRankedEntries.length / DISCOVER_PAGE_SIZE)
  );
  const safeDiscoverPage = Math.min(discoverPage, totalDiscoverPages);
  const paginatedDiscoverEntries = useMemo(() => {
    const start = (safeDiscoverPage - 1) * DISCOVER_PAGE_SIZE;
    return displayedRankedEntries.slice(start, start + DISCOVER_PAGE_SIZE);
  }, [displayedRankedEntries, safeDiscoverPage]);

  function handleDiscoverPageChange(nextPage: number) {
    setDiscoverPage(nextPage);
    headerHiddenRef.current = false;
    bottomNavHiddenRef.current = false;
    setIsHeaderHidden(false);
    setIsBottomNavHidden(false);
    tabScrollPositionsRef.current.discover = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const isRestoredDataStale = useMemo(() => {
    if (!restoredFromBrowser || !activeRecentEntry) return false;
    const searchedMs = Date.parse(activeRecentEntry.searchedAt);
    const isSearchOlderThan24h =
      Number.isFinite(searchedMs) && evaluationNowMs - searchedMs > 24 * 3_600_000;
    const hasStaleRiskTag = intelligenceView.rankedEntries.some((entry) =>
      entry.riskTags.includes('STALE_DATA')
    );
    return isSearchOlderThan24h || hasStaleRiskTag;
  }, [restoredFromBrowser, activeRecentEntry, evaluationNowMs, intelligenceView.rankedEntries]);

  const categoryMatchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (products.length === 0 || lastSearchMode === 'single_link') {
      return counts;
    }
    counts.set('', products.length);
    const activeScopeSet =
      activeRecentEntry && activeRecentEntry.cateIds.length === 1
        ? new Set(activeRecentEntry.cateIds)
        : null;

    for (const cat of categories) {
      if (!cat.id) continue;
      if (activeScopeSet?.has(cat.id)) {
        counts.set(cat.id, products.length);
        continue;
      }
      let matchCount = 0;
      for (const product of products) {
        if (doesProductMatchCategory(product, cat)) {
          matchCount += 1;
        }
      }
      counts.set(cat.id, matchCount);
    }
    return counts;
  }, [products, lastSearchMode, categories, activeRecentEntry]);

  // Discover page Category Chips: show ONLY categories that actually have data in the loaded results
  const populatedDiscoverCategories = useMemo(() => {
    if (products.length === 0 || lastSearchMode === 'single_link') {
      return [];
    }
    const matchingNonAll = categories.filter(
      (cat) =>
        Boolean(cat.id) &&
        ((categoryMatchCounts.get(cat.id) ?? 0) > 0 || selectedCateIds.includes(cat.id))
    );
    if (matchingNonAll.length === 0) {
      return [];
    }
    const allCat = categories.find((cat) => !cat.id);
    return allCat ? [allCat, ...matchingNonAll] : matchingNonAll;
  }, [categories, categoryMatchCounts, products.length, lastSearchMode, selectedCateIds]);

  // Gallery zoom sequence ordered from smallest card (most cols = Image + Name only) to largest card (fewest cols)
  const zoomColsSequence: ResultGridCols[] = useMemo(
    () =>
      viewportTier === 'mobile'
        ? [3, 2, 1]
        : viewportTier === 'tablet'
          ? [4, 3, 2, 1]
          : [5, 4, 3, 2],
    [viewportTier]
  );

  const defaultGridCols: ResultGridCols =
    viewportTier === 'mobile' ? 2 : viewportTier === 'tablet' ? 2 : 3;

  const effectiveGridCols: ResultGridCols = (() => {
    if (storedGridCols === null) return defaultGridCols;
    const maxCols = zoomColsSequence[0];
    const minCols = zoomColsSequence[zoomColsSequence.length - 1];
    if (storedGridCols < minCols) return minCols;
    if (storedGridCols > maxCols) return maxCols;
    return storedGridCols;
  })();

  const zoomIndex = Math.max(0, zoomColsSequence.indexOf(effectiveGridCols));

  const gridCardDensity: CardDensity = (() => {
    if (zoomIndex === 0) return 'micro';
    if (
      (viewportTier === 'desktop' && effectiveGridCols === 4) ||
      (viewportTier === 'tablet' && effectiveGridCols === 3) ||
      (viewportTier === 'mobile' && effectiveGridCols === 2)
    ) {
      return 'compact';
    }
    if (
      (viewportTier === 'desktop' && effectiveGridCols === 2) ||
      (viewportTier === 'tablet' && effectiveGridCols === 1) ||
      (viewportTier === 'mobile' && effectiveGridCols === 1)
    ) {
      return 'spacious';
    }
    return 'standard';
  })();

  const cardDensity: CardDensity =
    resultViewMode === 'list'
      ? listZoomLevel === 0
        ? 'micro'
        : listZoomLevel === 1
          ? 'compact'
          : 'spacious'
      : gridCardDensity;

  const activeGridLayoutClass = (() => {
    if (effectiveGridCols === 1) return 'grid grid-cols-1 gap-5';
    if (effectiveGridCols === 2) {
      return `grid grid-cols-2 ${gridCardDensity === 'compact' ? 'gap-3' : 'gap-6'}`;
    }
    if (effectiveGridCols === 3) {
      return `grid grid-cols-3 ${
        gridCardDensity === 'micro'
          ? 'gap-2'
          : gridCardDensity === 'compact'
            ? 'gap-4'
            : 'gap-6'
      }`;
    }
    if (effectiveGridCols === 4) {
      return `grid grid-cols-4 ${gridCardDensity === 'micro' ? 'gap-2.5' : 'gap-4'}`;
    }
    return 'grid grid-cols-5 gap-2.5';
  })();

  const activeListGapClass =
    listZoomLevel === 0 ? 'gap-1.5' : listZoomLevel === 1 ? 'gap-2' : 'gap-3';

  const layoutTransitionKey =
    resultViewMode === 'list' ? `list-${listZoomLevel}` : `grid-${effectiveGridCols}`;

  // Keep latest zoom state in refs so Android Gallery two-finger pinch never tears down mid-gesture
  const zoomGestureStateRef = useRef({
    viewMode: resultViewMode,
    zoomIndex,
    listZoomLevel,
    sequence: zoomColsSequence,
    microLabel: t.discover.microViewTag,
    listCompactLabel: t.discover.listCompactTag,
    listDetailedLabel: t.discover.listDetailedTag,
  });
  zoomGestureStateRef.current = {
    viewMode: resultViewMode,
    zoomIndex,
    listZoomLevel,
    sequence: zoomColsSequence,
    microLabel: t.discover.microViewTag,
    listCompactLabel: t.discover.listCompactTag,
    listDetailedLabel: t.discover.listDetailedTag,
  };

  const canPinchResults =
    activeTab === 'discover' &&
    !isSearching &&
    !isSearchDrawerOpen &&
    !scoreDialogProduct &&
    !ptrConfirmScope &&
    (resultViewMode === 'list'
      ? paginatedDiscoverEntries.length > 0
      : paginatedDiscoverEntries.length > 1);

  const dismissPinchHint = () => {
    setShowPinchHint(false);
    savePinchHintSeen();
  };

  const captureResultsScrollAnchor = () => {
    const containerEl = resultsGridRef.current;
    if (!containerEl || window.scrollY <= 120) {
      pendingScrollAnchorRef.current = null;
      return;
    }
    const minVisibleTop = compactActiveRef.current ? 64 : headerHeight;
    const cards = containerEl.querySelectorAll<HTMLElement>('[data-product-id]');
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.bottom > minVisibleTop && rect.top < window.innerHeight) {
        const productId = card.dataset.productId;
        if (productId) {
          pendingScrollAnchorRef.current = { productId, prevTop: rect.top };
        }
        return;
      }
    }
  };

  const scrollAnchorActionRef = useRef(captureResultsScrollAnchor);
  scrollAnchorActionRef.current = captureResultsScrollAnchor;
  const dismissPinchHintRef = useRef(dismissPinchHint);
  dismissPinchHintRef.current = dismissPinchHint;

  // Compensate scroll offset synchronously when grid/list density changes so visible product stays anchored
  useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current;
    if (!anchor) return;
    pendingScrollAnchorRef.current = null;
    const containerEl = resultsGridRef.current;
    if (!containerEl) return;
    const cards = containerEl.querySelectorAll<HTMLElement>('[data-product-id]');
    for (const card of cards) {
      if (card.dataset.productId === anchor.productId) {
        const nextTop = card.getBoundingClientRect().top;
        const delta = nextTop - anchor.prevTop;
        if (Math.abs(delta) > 1) {
          window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
        }
        break;
      }
    }
  }, [effectiveGridCols, listZoomLevel, resultViewMode]);

  // Show one-time pinch gesture hint on mobile/tablet and persist dismissal in localStorage
  useEffect(() => {
    if (!showPinchHint || !canPinchResults || viewportTier === 'desktop') return;
    const timer = window.setTimeout(() => {
      dismissPinchHintRef.current();
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [showPinchHint, canPinchResults, viewportTier]);

  // Android Gallery-style two-finger pinch-to-zoom + iOS Safari gesture + desktop trackpad pinch (Ctrl+Wheel)
  // Attached at window level with touch-action: pan-y lock so Android Chrome / tablets never hijack
  // two-finger pinches into native browser page zoom or drop listeners across conditional mounts.
  useEffect(() => {
    if (!canPinchResults) return;

    const rootEl = document.documentElement;
    const bodyEl = document.body;
    rootEl.classList.add('pinch-zoom-surface');
    bodyEl.classList.add('pinch-zoom-surface');

    let pinchActive = false;
    let anchorDistance = 0;
    let lastStepAt = 0;
    let wheelAccum = 0;
    let safariAnchorScale = 1;

    const getTouchDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const isTargetInsideHeaderOrOverlay = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest('header, [role="dialog"], input, textarea'));
    };

    const isPinchOverResultsArea = (e: TouchEvent): boolean => {
      const containerEl = resultsGridRef.current;
      if (!containerEl) return false;
      if (isTargetInsideHeaderOrOverlay(e.target)) return false;
      if (containerEl.contains(e.target as Node)) return true;

      // Also capture pinches where fingers rest in tablet/desktop side gutters next to the grid
      const rect = containerEl.getBoundingClientRect();
      if (rect.height <= 0) return false;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      if (!t0 || !t1) return false;
      const midY = (t0.clientY + t1.clientY) / 2;
      return midY >= Math.max(0, rect.top - 120) && midY <= rect.bottom + 120;
    };

    const triggerHapticAndHud = (label: string) => {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(10);
        } catch {
          // ignore unsupported vibrate
        }
      }
      setZoomHudText(label);
      if (zoomHudTimerRef.current !== null) {
        window.clearTimeout(zoomHudTimerRef.current);
      }
      zoomHudTimerRef.current = window.setTimeout(() => {
        setZoomHudText(null);
        zoomHudTimerRef.current = null;
      }, 900);
    };

    const pulseContainerFeedback = (direction: 1 | -1) => {
      const containerEl = resultsGridRef.current;
      if (!containerEl) return;
      containerEl.style.transition = 'none';
      containerEl.style.transform = direction === 1 ? 'scale(0.965)' : 'scale(1.035)';
      requestAnimationFrame(() => {
        if (!resultsGridRef.current) return;
        resultsGridRef.current.style.transition =
          'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)';
        resultsGridRef.current.style.transform = 'scale(1)';
      });
    };

    const stepZoomFromGesture = (direction: 1 | -1) => {
      const now = Date.now();
      if (now - lastStepAt < 130) return false;

      const state = zoomGestureStateRef.current;

      if (state.viewMode === 'list') {
        const nextLevel = Math.max(
          0,
          Math.min(2, state.listZoomLevel + direction)
        ) as ResultListZoom;
        if (nextLevel === state.listZoomLevel) return false;
        lastStepAt = now;
        scrollAnchorActionRef.current();
        dismissPinchHintRef.current();
        state.listZoomLevel = nextLevel;
        setZoomDirection(direction);
        setListZoomLevel(nextLevel);
        saveResultListZoom(nextLevel);
        const label =
          nextLevel === 0
            ? `List · ${state.microLabel}`
            : nextLevel === 1
              ? `List · ${state.listCompactLabel}`
              : `List · ${state.listDetailedLabel}`;
        triggerHapticAndHud(label);
        pulseContainerFeedback(direction);
        return true;
      }

      const nextIdx = Math.max(
        0,
        Math.min(state.sequence.length - 1, state.zoomIndex + direction)
      );
      if (nextIdx === state.zoomIndex) return false;
      lastStepAt = now;
      scrollAnchorActionRef.current();
      dismissPinchHintRef.current();
      const nextCols = state.sequence[nextIdx];
      state.zoomIndex = nextIdx;
      setZoomDirection(direction);
      setStoredGridCols(nextCols);
      saveResultGridCols(nextCols);
      const label = nextIdx === 0 ? `${nextCols}× · ${state.microLabel}` : `${nextCols}×`;
      triggerHapticAndHud(label);
      pulseContainerFeedback(direction);
      return true;
    };

    const resetContainerTransform = () => {
      const containerEl = resultsGridRef.current;
      if (!containerEl) return;
      containerEl.style.transition = 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)';
      containerEl.style.transform = '';
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinchOverResultsArea(e)) {
        pinchActive = true;
        anchorDistance = Math.max(getTouchDistance(e.touches), 20);
        if (e.cancelable) e.preventDefault();
        const containerEl = resultsGridRef.current;
        if (containerEl) {
          containerEl.style.transition = 'none';
        }
      } else if (e.touches.length !== 2 && pinchActive) {
        pinchActive = false;
        lastPinchEndedAtRef.current = Date.now();
        resetContainerTransform();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;

      // Auto-initialize pinch if the 2nd finger landed mid-scroll or after touchstart
      if (!pinchActive) {
        if (!isPinchOverResultsArea(e)) return;
        pinchActive = true;
        anchorDistance = Math.max(getTouchDistance(e.touches), 20);
      }

      if (e.cancelable) e.preventDefault();

      const dist = getTouchDistance(e.touches);
      const delta = dist - anchorDistance;
      const ratio = dist / Math.max(anchorDistance, 20);

      // Subtle tactile elastic scale feedback during pinch
      const containerEl = resultsGridRef.current;
      if (containerEl) {
        const previewScale = Math.max(0.94, Math.min(1.06, 1 + (ratio - 1) * 0.18));
        containerEl.style.transition = 'none';
        containerEl.style.transform = `scale(${previewScale.toFixed(3)})`;
      }

      if (ratio >= 1.14 || delta >= 34) {
        if (stepZoomFromGesture(1)) {
          anchorDistance = Math.max(dist, 20);
        }
      } else if (ratio <= 0.88 || delta <= -34) {
        if (stepZoomFromGesture(-1)) {
          anchorDistance = Math.max(dist, 20);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (pinchActive && e.touches.length < 2) {
        pinchActive = false;
        lastPinchEndedAtRef.current = Date.now();
        resetContainerTransform();
      }
    };

    // Safari / iPadOS gesture events fallback
    const onGestureStart = (e: Event) => {
      if (isTargetInsideHeaderOrOverlay(e.target)) return;
      e.preventDefault();
      const ge = e as Event & { scale?: number };
      safariAnchorScale = typeof ge.scale === 'number' && ge.scale > 0 ? ge.scale : 1;
    };

    const onGestureChange = (e: Event) => {
      if (isTargetInsideHeaderOrOverlay(e.target)) return;
      e.preventDefault();
      const ge = e as Event & { scale?: number };
      const scale = typeof ge.scale === 'number' && ge.scale > 0 ? ge.scale : 1;
      const rel = scale / safariAnchorScale;
      if (rel >= 1.14) {
        if (stepZoomFromGesture(1)) {
          safariAnchorScale = scale;
        }
      } else if (rel <= 0.88) {
        if (stepZoomFromGesture(-1)) {
          safariAnchorScale = scale;
        }
      }
    };

    const onGestureEnd = () => {
      safariAnchorScale = 1;
      lastPinchEndedAtRef.current = Date.now();
      resetContainerTransform();
    };

    // Desktop trackpad pinch (Ctrl/Cmd + Wheel)
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (isTargetInsideHeaderOrOverlay(e.target)) return;
      e.preventDefault();
      wheelAccum += e.deltaY;
      if (wheelAccum <= -30) {
        stepZoomFromGesture(1);
        wheelAccum = 0;
      } else if (wheelAccum >= 30) {
        stepZoomFromGesture(-1);
        wheelAccum = 0;
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('gesturestart', onGestureStart, { passive: false });
    window.addEventListener('gesturechange', onGestureChange, { passive: false });
    window.addEventListener('gestureend', onGestureEnd, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      rootEl.classList.remove('pinch-zoom-surface');
      bodyEl.classList.remove('pinch-zoom-surface');
      resetContainerTransform();
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('gesturestart', onGestureStart);
      window.removeEventListener('gesturechange', onGestureChange);
      window.removeEventListener('gestureend', onGestureEnd);
      window.removeEventListener('wheel', onWheel);
    };
  }, [canPinchResults]);

  // Credit-safe custom Pull-to-Refresh listener for mobile/tablet when overscroll-behavior-y: contain disables native PTR.
  // Never auto-spends Kalodata credits on pull release: opens a confirmation BottomSheet instead.
  useEffect(() => {
    const canTrackPtr =
      viewportTier !== 'desktop' &&
      (activeTab === 'discover' || activeTab === 'rank_board') &&
      !isSearchDrawerOpen &&
      !isKalodataPanelOpen &&
      !scoreDialogProduct &&
      !ptrConfirmScope &&
      !isSearching &&
      !isSyncingRankBoard;

    if (!canTrackPtr) {
      setPtrPullDistance(0);
      return;
    }

    let tracking = false;
    let startX = 0;
    let startY = 0;
    let lastPull = 0;

    const isExcludedTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          'header, [role="dialog"], input, textarea, select, [data-sheet-scroll], .overflow-x-auto, .touch-none'
        )
      );
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || window.scrollY > 1 || isExcludedTarget(e.target)) {
        tracking = false;
        return;
      }
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastPull = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      if (e.touches.length !== 1 || window.scrollY > 1) {
        tracking = false;
        lastPull = 0;
        setPtrPullDistance(0);
        return;
      }
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        if (lastPull > 0) {
          lastPull = 0;
          setPtrPullDistance(0);
        }
        return;
      }
      if (dy < 16 && Math.abs(dx) > Math.abs(dy)) {
        tracking = false;
        lastPull = 0;
        setPtrPullDistance(0);
        return;
      }
      if (dy > 8) {
        const damped = Math.min(96, Math.round(dy * 0.48));
        lastPull = damped;
        setPtrPullDistance(damped);
      }
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      const committedPull = lastPull;
      lastPull = 0;
      setPtrPullDistance(0);
      if (committedPull >= 64) {
        setPtrConfirmScope(activeTab === 'rank_board' ? 'rank_board' : 'discover');
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [
    viewportTier,
    activeTab,
    isSearchDrawerOpen,
    isKalodataPanelOpen,
    scoreDialogProduct,
    ptrConfirmScope,
    isSearching,
    isSyncingRankBoard,
  ]);

  useEffect(() => {
    return () => {
      if (zoomHudTimerRef.current !== null) {
        window.clearTimeout(zoomHudTimerRef.current);
      }
    };
  }, []);

  function handleSelectViewMode(next: ResultViewMode) {
    if (next === resultViewMode) return;
    captureResultsScrollAnchor();
    setZoomDirection(0);
    setResultViewMode(next);
    saveResultViewMode(next);
  }

  function handleCycleResultDensity() {
    captureResultsScrollAnchor();
    if (showPinchHint) {
      dismissPinchHint();
    }
    const triggerQuickHud = (label: string) => {
      setZoomHudText(label);
      if (zoomHudTimerRef.current !== null) {
        window.clearTimeout(zoomHudTimerRef.current);
      }
      zoomHudTimerRef.current = window.setTimeout(() => {
        setZoomHudText(null);
        zoomHudTimerRef.current = null;
      }, 900);
    };

    if (resultViewMode === 'list') {
      const nextLevel = ((listZoomLevel + 1) % 3) as ResultListZoom;
      setZoomDirection(1);
      setListZoomLevel(nextLevel);
      saveResultListZoom(nextLevel);
      const label =
        nextLevel === 0
          ? `List · ${t.discover.microViewTag}`
          : nextLevel === 1
            ? `List · ${t.discover.listCompactTag}`
            : `List · ${t.discover.listDetailedTag}`;
      triggerQuickHud(label);
      return;
    }

    const nextIdx = (zoomIndex + 1) % zoomColsSequence.length;
    const nextCols = zoomColsSequence[nextIdx];
    setZoomDirection(nextIdx > zoomIndex ? 1 : -1);
    setStoredGridCols(nextCols);
    saveResultGridCols(nextCols);
    const label = nextIdx === 0 ? `${nextCols}× · ${t.discover.microViewTag}` : `${nextCols}×`;
    triggerQuickHud(label);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B1117] text-[#0F172A] dark:text-[#F1F5F9] transition-colors duration-200">
      <TopBar
        activeTab={activeTab}
        onNavigate={(tab) => {
          if (tab === activeTab) {
            headerHiddenRef.current = false;
            bottomNavHiddenRef.current = false;
            setIsHeaderHidden(false);
            setIsBottomNavHidden(false);
            tabScrollPositionsRef.current[tab] = 0;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }

          saveTabScrollPosition(activeTab);

          if (tab === 'discover' && recentSearches[0] && !isSearching) {
            // Home always defaults to showing the latest recent search
            if (activeRecentId !== recentSearches[0].id) {
              loadRecentEntryIntoHome(recentSearches[0]);
              tabScrollPositionsRef.current.discover = 0;
            }
          }

          pendingTabScrollRestoreRef.current = tab;
          setActiveTab(tab);
          headerHiddenRef.current = false;
          bottomNavHiddenRef.current = false;
          setIsHeaderHidden(false);
          setIsBottomNavHidden(false);
        }}
        language={language}
        onToggleLanguage={() => setLanguage((prev) => (prev === 'my' ? 'en' : 'my'))}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        searchHistoryCount={recentSearches.length}
        savedCount={history.length}
        kalodataStatus={kalodataStatus}
        kalodataLimits={kalodataLimits}
        isKalodataPanelOpen={isKalodataPanelOpen}
        onToggleKalodataPanel={() => {
          setIsKalodataPanelOpen((prev) => {
            const next = !prev;
            if (next && window.scrollY > 120) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return next;
          });
        }}
        headerRef={headerRef}
        isHidden={isHeaderHidden}
        isBottomNavHidden={isBottomNavHidden}
        onRevealHeader={() => {
          headerHiddenRef.current = false;
          bottomNavHiddenRef.current = false;
          setIsHeaderHidden(false);
          setIsBottomNavHidden(false);
        }}
        studioReturnTab={studioReturnTab}
        t={t}
      />

      {/* Scroll-Driven Compact Category Filters & Bottom Search Drawer Trigger */}
      {activeTab === 'discover' && (
        <CompactFilterBar
          isVisible={showCompactBar && !isKalodataPanelOpen && !isSearchDrawerOpen}
          isHeaderHidden={isHeaderHidden}
          headerHeight={headerHeight}
          headerSafeTop={headerSafeTop}
          categories={populatedDiscoverCategories}
          selectedCateIds={selectedCateIds}
          categoryMatchCounts={categoryMatchCounts}
          language={language}
          query={query}
          searchPageSize={searchPageSize}
          isSearching={isSearching}
          isSingleLinkValid={isSingleLinkValid}
          isLinkOrId={linkInfo.isLinkOrId}
          leanSearchCost={LEAN_SEARCH_COST}
          isOffline={!isOnline}
          t={t}
          onToggleCategory={handleToggleCategory}
          onOpenSearchDrawer={() => setIsSearchDrawerOpen(true)}
        />
      )}

      {!isOnline && (
        <div
          role="status"
          className="border-b border-amber-200/80 dark:border-amber-900/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>{t.kalodata.offlineNotice}</span>
        </div>
      )}

      {/* Collapsible Kalodata Connection, Live Credit Balance & Credit Limit Drawer */}
      <AnimatePresence>
        {isKalodataPanelOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0E151D]"
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
              <KalodataBar
                status={kalodataStatus}
                limits={kalodataLimits}
                isConnecting={isConnectingKalodata}
                isRefreshingBalance={isRefreshingBalance}
                connectError={kalodataConnectError}
                t={t}
                onConnect={handleConnectKalodata}
                onDisconnect={handleDisconnectKalodata}
                onRefreshBalance={handleRefreshBalance}
                onSaveLimits={handleSaveLimits}
                onClose={() => setIsKalodataPanelOpen(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credit-Safe Pull-to-Refresh Visual Indicator (Mobile/Tablet) */}
      <AnimatePresence>
        {ptrPullDistance > 12 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            role="status"
            aria-live="polite"
            className="lg:hidden fixed top-[calc(4rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3.5 py-2 rounded-full bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-950 shadow-lg border border-slate-700/60 dark:border-slate-300/60 backdrop-blur-md text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap"
          >
            <ArrowDown
              className={`w-3.5 h-3.5 text-teal-400 dark:text-teal-600 transition-transform duration-150 ${
                ptrPullDistance >= 64 ? 'rotate-180' : ''
              }`}
            />
            <span>
              {ptrPullDistance >= 64 ? t.discover.pullToRefreshRelease : t.discover.pullToRefreshHint}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Viewport */}
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0 mobile-landscape-main">
        <AnimatePresence mode="wait">
          {activeTab === 'discover' && (
            <motion.div
              key="discover"
              ref={(el) => {
                if (el) restoreScrollForTab('discover');
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-5"
            >
              <h1 className="sr-only">{t.discover.resultsHeading}</h1>
              {/* Ultra-Clean Focused Search Area */}
              <section ref={searchSectionRef} className="max-w-3xl mx-auto">
                {/* Inline Connect Prompt ONLY when disconnected & drawer closed */}
                {!kalodataStatus.connected && !isKalodataPanelOpen && (
                  <div className="mb-3">
                    <KalodataBar
                      status={kalodataStatus}
                      limits={kalodataLimits}
                      isConnecting={isConnectingKalodata}
                      isRefreshingBalance={isRefreshingBalance}
                      connectError={kalodataConnectError}
                      t={t}
                      onConnect={handleConnectKalodata}
                      onDisconnect={handleDisconnectKalodata}
                      onRefreshBalance={handleRefreshBalance}
                      onSaveLimits={handleSaveLimits}
                    />
                  </div>
                )}

                {/* Focused Search Action Bar */}
                <div className={`flex flex-wrap items-center gap-2.5 ${query.trim() ? 'justify-between' : 'justify-end'}`}>
                  {query.trim() && (
                    <div className="h-9 px-3 rounded-lg bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 inline-flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-400 min-w-0">
                      {linkInfo.isLinkOrId && <Link2 className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate max-w-[180px] sm:max-w-[260px] font-medium">
                        “{query.trim()}”
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label={t.history.clearFilterAria}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isSearching}
                    onClick={() => setIsSearchDrawerOpen(true)}
                    className={`${
                      query.trim() ? '' : 'w-full sm:w-auto'
                    } h-10 sm:h-9 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] duration-150 whitespace-nowrap shrink-0 disabled:opacity-55 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500`}
                  >
                    {isSingleLinkValid ? (
                      <Link2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <Search className="w-4 h-4 shrink-0" />
                    )}
                    <span>
                      {isSearching
                        ? t.search.searchingButton
                        : `${
                            isSingleLinkValid
                              ? t.search.searchSingleButton
                              : t.search.searchButton
                          } (~${LEAN_SEARCH_COST} cr)`}
                    </span>
                  </button>
                </div>

                {searchLimitWarning && (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                    {searchLimitWarning}
                  </p>
                )}
              </section>

              {/* Results / Loading / Error Area */}
              <section className="mt-4 sm:mt-5">
                {isSearching ? (
                  <div>
                    {resultViewMode === 'list' && !isSingleLinkValid ? (
                      <div className="flex flex-col gap-3">
                        {[1, 2, 3, 4].map((slot) => (
                          <div
                            key={slot}
                            className="flex flex-row rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/80 dark:border-slate-800 overflow-hidden"
                          >
                            <div className="w-24 sm:w-36 md:w-44 aspect-square sm:aspect-[4/3] bg-slate-200/70 dark:bg-slate-800/70 animate-pulse shrink-0" />
                            <div className="flex-1 p-4 space-y-2.5">
                              <div className="h-3 w-32 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
                              <div className="h-5 w-3/4 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
                              <div className="h-3 w-1/2 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
                              <div className="h-8 w-full rounded bg-slate-200/60 dark:bg-slate-800/60 animate-pulse mt-2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className={
                          isSingleLinkValid
                            ? 'grid grid-cols-1 max-w-md mx-auto gap-6'
                            : activeGridLayoutClass
                        }
                      >
                        {(isSingleLinkValid ? [1] : [1, 2, 3, 4, 5, 6]).map((slot) => (
                          <div
                            key={slot}
                            className="rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/80 dark:border-slate-800 overflow-hidden"
                          >
                            <div
                              className={`${
                                cardDensity === 'compact' ? 'aspect-square sm:aspect-[4/3]' : 'aspect-[4/3]'
                              } bg-slate-200/70 dark:bg-slate-800/70 animate-pulse`}
                            />
                            <div className={cardDensity === 'compact' ? 'p-3 space-y-2' : 'p-5 space-y-3'}>
                              <div className="h-3 w-24 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
                              <div className="h-4 w-4/5 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
                              <div className="h-3 w-2/3 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
                              <div className="h-10 w-full rounded bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
                              <div className="h-9 w-full rounded-lg bg-slate-200/70 dark:bg-slate-800/70 animate-pulse mt-3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : searchError ? (
                  <div className="max-w-lg mx-auto p-6 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-center">
                    <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
                      {searchError}
                    </p>
                    {kalodataStatus.connected && !searchLimitWarning && !isLinkBroken && (
                      <button
                        type="button"
                        onClick={() => runProductSearch()}
                        className="mt-4 h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        {t.discover.retry}
                      </button>
                    )}
                  </div>
                ) : hasSearched ? (
                  products.length > 0 ? (
                    <div>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-xs font-mono-num font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                            {isCategoryFilterActive
                              ? `${filteredProducts.length} / ${products.length}`
                              : displayedRankedEntries.length}
                          </span>

                          {totalDiscoverPages > 1 && (
                            <div className="inline-flex items-center gap-0.5 h-7 px-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24]">
                              <button
                                type="button"
                                disabled={safeDiscoverPage <= 1}
                                onClick={() => handleDiscoverPageChange(safeDiscoverPage - 1)}
                                aria-label={t.pagination.prev}
                                className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-1.5 font-mono-num tabular-nums text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                {t.pagination.pageOf(safeDiscoverPage, totalDiscoverPages)}
                              </span>
                              <button
                                type="button"
                                disabled={safeDiscoverPage >= totalDiscoverPages}
                                onClick={() => handleDiscoverPageChange(safeDiscoverPage + 1)}
                                aria-label={t.pagination.next}
                                className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {isCategoryFilterActive && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCateIds([]);
                                setDiscoverPage(1);
                              }}
                              className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-teal-500 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            >
                              {t.search.clearCategories}
                            </button>
                          )}

                          {restoredFromBrowser && isRestoredDataStale && kalodataStatus.connected && (
                            <button
                              type="button"
                              disabled={isSearching || Boolean(searchLimitWarning)}
                              onClick={() =>
                                runProductSearch({ pageNumber: 1, append: false, forceRefresh: true })
                              }
                              className="h-7 px-2.5 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 text-xs font-semibold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            >
                              <RefreshCw className="w-3 h-3 shrink-0" />
                              <span>{t.discover.refreshLiveBtn}</span>
                            </button>
                          )}

                          {restoredFromBrowser && isViewingOlderHistory && recentSearches[0] && (
                            <button
                              type="button"
                              onClick={() => loadRecentEntryIntoHome(recentSearches[0])}
                              className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-teal-500 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            >
                              {t.recent.backToLatestBtn}
                            </button>
                          )}
                        </div>

                        {/* View Mode (List / Grid) & Mobile/Tablet Tactile Density Cycle Control */}
                        {filteredProducts.length > 0 && (
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <button
                              type="button"
                              onClick={handleCycleResultDensity}
                              aria-label={
                                resultViewMode === 'grid'
                                  ? t.discover.gridColsLabel(effectiveGridCols)
                                  : listZoomLevel === 0
                                    ? `List · ${t.discover.microViewTag}`
                                    : listZoomLevel === 1
                                      ? `List · ${t.discover.listCompactTag}`
                                      : `List · ${t.discover.listDetailedTag}`
                              }
                              title={
                                resultViewMode === 'grid'
                                  ? t.discover.gridColsLabel(effectiveGridCols)
                                  : t.discover.pinchZoomHint
                              }
                              className="lg:hidden h-9 px-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-[#131B24] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-medium inline-flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            >
                              <Columns3 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                              <span className="font-mono-num font-semibold">
                                {resultViewMode === 'grid'
                                  ? `${effectiveGridCols}×`
                                  : listZoomLevel === 0
                                    ? t.discover.microViewTag
                                    : listZoomLevel === 1
                                      ? t.discover.listCompactTag
                                      : t.discover.listDetailedTag}
                              </span>
                            </button>

                            <div
                              role="group"
                              aria-label="Result layout view"
                              className="inline-flex items-center p-0.5 rounded-lg bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/75 dark:border-slate-700/70"
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectViewMode('grid')}
                                aria-pressed={resultViewMode === 'grid'}
                                aria-label={t.discover.viewGrid}
                                title={t.discover.viewGrid}
                                className={`h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                                  resultViewMode === 'grid'
                                    ? 'bg-white dark:bg-[#131B24] text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                              >
                                <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                                <span className="hidden sm:inline">Grid</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectViewMode('list')}
                                aria-pressed={resultViewMode === 'list'}
                                aria-label={t.discover.viewList}
                                title={t.discover.viewList}
                                className={`h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                                  resultViewMode === 'list'
                                    ? 'bg-white dark:bg-[#131B24] text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                              >
                                <List className="w-3.5 h-3.5 shrink-0" />
                                <span className="hidden sm:inline">List</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {filteredProducts.length > 0 ? (
                        <div>
                          {intelligenceView.rankedEntries.length > 0 && (
                            <DiscoveryFilterBar
                              state={discoveryFilter}
                              counts={discoveryFilterResult.counts}
                              t={t}
                              onChange={(next) => {
                                setDiscoveryFilter(next);
                                setDiscoverPage(1);
                              }}
                            />
                          )}

                          {/* Data-Only Category Chips Positioned Directly Above Result Products (0 cr local filter) */}
                          {populatedDiscoverCategories.length > 0 && (
                            <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain flex-nowrap sm:flex-wrap pl-0.5 pr-4 sm:pr-0">
                              {populatedDiscoverCategories.map((cat) => {
                                const isAll = !cat.id;
                                const isSelected = isAll
                                  ? selectedCateIds.length === 0
                                  : selectedCateIds.includes(cat.id);
                                const matchCount = categoryMatchCounts.get(cat.id) ?? 0;

                                return (
                                  <button
                                    key={cat.id || 'all'}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => handleToggleCategory(cat.id)}
                                    className={`h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all active:scale-[0.97] duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                                      isSelected
                                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-semibold'
                                        : 'bg-white dark:bg-[#131B24] text-slate-700 dark:text-slate-300 border border-slate-200/85 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                  >
                                    {!isAll && isSelected && <Check className="w-3 h-3 shrink-0" />}
                                    <span>{cat.label[language]}</span>
                                    {matchCount > 0 && (
                                      <span
                                        className={`font-mono-num tabular-nums text-[11px] ${
                                          isSelected
                                            ? 'text-white/75 dark:text-slate-950/70'
                                            : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                      >
                                        {matchCount}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                              {selectedCateIds.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCateIds([]);
                                    setDiscoverPage(1);
                                  }}
                                  className="h-8 px-2 text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                                >
                                  {t.search.clearCategories}
                                </button>
                              )}
                            </div>
                          )}

                          {displayedRankedEntries.length > 0 ? (
                            <div
                              ref={resultsGridRef}
                              style={
                                canPinchResults
                                  ? { touchAction: 'pan-y', transformOrigin: 'center top' }
                                  : undefined
                              }
                            >
                              <div
                                className={
                                  resultViewMode === 'list'
                                    ? `flex flex-col ${activeListGapClass} ${
                                        paginatedDiscoverEntries.length === 1
                                          ? 'max-w-3xl mx-auto'
                                          : ''
                                      }`
                                    : paginatedDiscoverEntries.length === 1
                                      ? 'grid grid-cols-1 max-w-md mx-auto gap-6'
                                      : activeGridLayoutClass
                                }
                              >
                                {paginatedDiscoverEntries.map((entry, index) => (
                                  <ProductCard
                                    key={entry.product.id}
                                    product={entry.product}
                                    intelligenceItem={entry}
                                    index={index}
                                    language={language}
                                    isSaved={savedProductIds.has(entry.product.id)}
                                    viewMode={resultViewMode}
                                    density={cardDensity}
                                    nowMs={evaluationNowMs}
                                    t={t}
                                    onSelect={handleSelectProduct}
                                    onToggleSave={handleToggleSaveProduct}
                                    onOpenScoreDetails={setScoreDialogProduct}
                                  />
                                ))}
                              </div>

                              <PaginationBar
                                currentPage={safeDiscoverPage}
                                totalPages={totalDiscoverPages}
                                t={t}
                                onPageChange={handleDiscoverPageChange}
                                className="mt-6"
                              />

                              {/* Multi-Page Kalodata Rank Exploration Control */}
                              {lastSearchMode === 'rank' && hasMorePages && (
                                <div className="mt-7 flex justify-center">
                                  <button
                                    type="button"
                                    disabled={isLoadingMore || isSearching || Boolean(searchLimitWarning)}
                                    onClick={() =>
                                      runProductSearch({
                                        pageNumber: currentSearchPage + 1,
                                        append: true,
                                        forceRefresh: false,
                                      })
                                    }
                                    className="h-10 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] hover:border-teal-400 dark:hover:border-teal-500 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                  >
                                    <RefreshCw
                                      className={`w-3.5 h-3.5 shrink-0 ${
                                        isLoadingMore ? 'animate-spin' : ''
                                      }`}
                                    />
                                    <span>
                                      {isLoadingMore
                                        ? t.v2.discoveryFilter.loadingMoreBtn
                                        : t.v2.discoveryFilter.loadMoreBtn(
                                            currentSearchPage + 1,
                                            searchPageSize
                                          )}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-10 flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setDiscoveryFilter({
                                    ...DEFAULT_DISCOVERY_FILTER_STATE,
                                    sortMode: 'search_score_desc',
                                  });
                                  setDiscoverPage(1);
                                }}
                                className="h-10 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                              >
                                {t.v2.discoveryFilter.resetBtn}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-10 flex flex-wrap items-center justify-center gap-2.5">
                          <button
                            type="button"
                            disabled={isSearching}
                            onClick={() => setIsSearchDrawerOpen(true)}
                            className="h-10 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            <Search className="w-4 h-4 shrink-0" />
                            <span>
                              {t.discover.searchSelectedCategoryBtn} (~{LEAN_SEARCH_COST} cr)
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCateIds([]);
                              setDiscoverPage(1);
                            }}
                            className="h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          >
                            {t.discover.clearFilterBtn}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-14 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setIsSearchDrawerOpen(true)}
                        className="h-10 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        <Search className="w-4 h-4 shrink-0" />
                        <span>{t.search.searchButton}</span>
                      </button>
                    </div>
                  )
                ) : (
                  <div className="py-14 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setIsSearchDrawerOpen(true)}
                      className="h-11 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      <Search className="w-4 h-4 shrink-0" />
                      <span>{t.search.searchButton}</span>
                    </button>
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {activeTab === 'rank_board' && (
            <motion.div
              key="rank_board"
              ref={(el) => {
                if (el) restoreScrollForTab('rank_board');
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <ProductRankBoardView
                snapshot={rankBoardSnapshot}
                dateRange={rankBoardDateRange}
                isSyncing={isSyncingRankBoard}
                syncError={rankBoardError}
                limitWarning={rankBoardLimitWarning}
                kalodataStatus={kalodataStatus}
                savedProductIds={savedProductIds}
                language={language}
                nowMs={evaluationNowMs}
                t={t}
                onChangeDateRange={setRankBoardDateRange}
                onSync={handleSyncRankBoard}
                onOpenConnectPanel={() => setIsKalodataPanelOpen(true)}
                onSelectProduct={(p) => handleSelectProduct(p, 'rank_board')}
                onToggleSaveProduct={handleToggleSaveProduct}
              />
            </motion.div>
          )}

          {activeTab === 'search_history' && (
            <motion.div
              key="search_history"
              ref={(el) => {
                if (el) restoreScrollForTab('search_history');
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <SearchHistoryView
                entries={recentSearches}
                activeRecentId={activeRecentId}
                language={language}
                t={t}
                onOpenEntry={handleOpenSearchHistoryEntry}
                onDeleteEntry={handleRemoveRecentSearch}
                onClearAll={handleClearRecentSearches}
                onGoDiscover={() => {
                  saveTabScrollPosition('search_history');
                  pendingTabScrollRestoreRef.current = 'discover';
                  setActiveTab('discover');
                }}
              />
            </motion.div>
          )}

          {activeTab === 'studio' && selectedProduct && (
            <motion.div
              key="studio"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <VideoStudioView
                product={selectedProduct}
                isSaved={savedProductIds.has(selectedProduct.id)}
                ideaPlans={activeIdeaPlans}
                generatingIdeaIndex={generatingIdeaIndex}
                planErrorByIdea={planErrorByIdea}
                isEnrichingProduct={isEnrichingProduct}
                isAnalyzingProduct={isAnalyzingProduct}
                enrichError={enrichError}
                analysisError={analysisError}
                cameFromHistory={cameFromHistory}
                returnTab={studioReturnTab}
                language={language}
                nowMs={evaluationNowMs}
                kalodataStatus={kalodataStatus}
                kalodataLimits={kalodataLimits}
                isOffline={!isOnline}
                isBottomNavHidden={isBottomNavHidden}
                t={t}
                onBack={() => {
                  pendingTabScrollRestoreRef.current = studioReturnTab;
                  setActiveTab(studioReturnTab);
                  headerHiddenRef.current = false;
                  bottomNavHiddenRef.current = false;
                  setIsHeaderHidden(false);
                  setIsBottomNavHidden(false);
                }}
                onToggleSave={handleToggleSaveProduct}
                onGenerateIdeaPlan={(ideaIndex, forceFresh) => {
                  if (selectedProduct) {
                    void requestIdeaVideoPlan(selectedProduct, ideaIndex, forceFresh);
                  }
                }}
                onFetchDeepInsights={handleFetchProductDeepInsights}
                onAnalyzeProduct={handleAnalyzeProduct}
                onOpenScoreDetails={setScoreDialogProduct}
                onNotifyToast={showToast}
              />
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              ref={(el) => {
                if (el) restoreScrollForTab('history');
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <HistoryView
                entries={history}
                recentSearchesCount={recentSearches.length}
                language={language}
                nowMs={evaluationNowMs}
                t={t}
                onOpenEntry={handleOpenHistoryEntry}
                onDeleteEntry={(entryId) => setHistory((prev) => removeHistoryEntry(prev, entryId))}
                onExportBackup={handleExportBackup}
                onImportBackupFile={handleImportBackup}
                onGoDiscover={() => {
                  saveTabScrollPosition('history');
                  pendingTabScrollRestoreRef.current = 'discover';
                  setActiveTab('discover');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Search & Filter Configuration Drawer */}
      <SearchConfigDrawer
        isOpen={isSearchDrawerOpen}
        initialConfig={{
          query,
          cateIds: selectedCateIds,
          pageSize: searchPageSize,
          dateRange: searchDateRange,
          filterState: discoveryFilter,
        }}
        categories={categories}
        categoryMatchCounts={categoryMatchCounts}
        language={language}
        isConnected={kalodataStatus.connected}
        isSearching={isSearching}
        isSyncingCategories={isSyncingCategories}
        hasLiveSyncedCategories={hasLiveSyncedCategories}
        searchLimitWarning={searchLimitWarning}
        isOffline={!isOnline}
        leanSearchCost={LEAN_SEARCH_COST}
        t={t}
        onClose={() => setIsSearchDrawerOpen(false)}
        onSyncCategories={handleSyncLiveCategories}
        onSubmit={handleDrawerSearchSubmit}
      />

      {/* Minimalist Score Details Dialog */}
      <ScoreDetailDialog
        product={scoreDialogProduct}
        snapshots={scoreDialogProduct ? productSnapshots[scoreDialogProduct.id] : undefined}
        language={language}
        nowMs={evaluationNowMs}
        t={t}
        onClose={() => setScoreDialogProduct(null)}
      />

      {/* Mobile/Tablet Floating Filter & Sort Pill while scrolling Discover results */}
      <AnimatePresence>
        {activeTab === 'discover' &&
          hasSearched &&
          products.length > 0 &&
          showCompactBar &&
          !isSearching &&
          !isSearchDrawerOpen &&
          !isKalodataPanelOpen &&
          !scoreDialogProduct &&
          !ptrConfirmScope && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setIsSearchDrawerOpen(true)}
              aria-label={t.discover.floatingFilterBtn}
              className={`lg:hidden fixed right-4 ${
                isBottomNavHidden
                  ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
                  : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'
              } z-30 h-11 px-4 rounded-full bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-950 border border-slate-700/50 dark:border-slate-300/60 shadow-lg backdrop-blur-md text-xs font-semibold inline-flex items-center gap-2 transition-[bottom,transform,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>{t.discover.floatingFilterBtn}</span>
              {(discoveryFilterResult.counts.activeFilterCount > 0 ||
                selectedCateIds.length > 0) && (
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-teal-500 text-slate-950 text-[11px] font-mono-num font-bold inline-flex items-center justify-center">
                  {discoveryFilterResult.counts.activeFilterCount +
                    (selectedCateIds.length > 0 ? 1 : 0)}
                </span>
              )}
            </motion.button>
          )}
      </AnimatePresence>

      {/* Ephemeral Gallery Zoom HUD (shown briefly only while pinching / zooming grid) */}
      <AnimatePresence>
        {zoomHudText && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            aria-live="polite"
            className={`fixed ${
              isBottomNavHidden
                ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
                : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'
            } lg:bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none px-3.5 py-1.5 rounded-xl bg-slate-900/90 dark:bg-slate-100/95 text-white dark:text-slate-950 text-xs font-mono-num font-semibold shadow-sm backdrop-blur-sm whitespace-nowrap transition-[bottom] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]`}
          >
            {zoomHudText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credit-Safe Pull-to-Refresh Confirmation BottomSheet (never auto-spends Kalodata credits) */}
      <BottomSheet
        isOpen={Boolean(ptrConfirmScope)}
        onClose={() => setPtrConfirmScope(null)}
        historyKey="ptr_confirm"
        variant="dialog"
        maxWidthClass="max-w-md"
        showMobileHandle={false}
        labelledBy="ptr-confirm-title"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="ptr-confirm-title"
                className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                {t.discover.pullConfirmTitle}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {ptrConfirmScope === 'rank_board'
                  ? t.discover.pullConfirmRankDesc(RANK_BOARD_SYNC_COST)
                  : t.discover.pullConfirmDiscoverDesc(LEAN_SEARCH_COST)}
              </p>
            </div>
          </div>

          {(!isOnline ||
            !kalodataStatus.connected ||
            (ptrConfirmScope === 'rank_board' ? rankBoardLimitWarning : searchLimitWarning)) && (
            <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/35 px-3.5 py-2.5 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {!isOnline
                  ? t.kalodata.offlineNotice
                  : !kalodataStatus.connected
                    ? t.kalodata.connectRequiredError
                    : ptrConfirmScope === 'rank_board'
                      ? rankBoardLimitWarning
                      : searchLimitWarning}
              </span>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setPtrConfirmScope(null)}
              className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {t.discover.pullCancelAction}
            </button>
            <button
              type="button"
              disabled={
                !isOnline ||
                !kalodataStatus.connected ||
                Boolean(
                  ptrConfirmScope === 'rank_board' ? rankBoardLimitWarning : searchLimitWarning
                )
              }
              onClick={() => {
                const targetScope = ptrConfirmScope;
                setPtrConfirmScope(null);
                if (targetScope === 'rank_board') {
                  void handleSyncRankBoard(rankBoardDateRange);
                } else {
                  void runProductSearch({ pageNumber: 1, append: false, forceRefresh: true });
                }
              }}
              className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span>{t.discover.pullConfirmAction}</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Minimalist Non-Intrusive Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            role="status"
            className={`fixed ${
              isBottomNavHidden
                ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
                : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'
            } inset-x-3 sm:inset-x-auto sm:right-5 lg:bottom-5 sm:max-w-sm z-50 px-4 py-3 rounded-xl text-sm font-medium border shadow-sm transition-[bottom] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              toastMessage.tone === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 border-slate-800 dark:border-slate-200'
            }`}
          >
            {toastMessage.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
