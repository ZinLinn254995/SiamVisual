import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  LayoutGrid,
  Link2,
  List,
  RefreshCw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { CompactFilterBar } from './components/CompactFilterBar';
import { HistoryView } from './components/HistoryView';
import { KalodataBar } from './components/KalodataBar';
import { ProductCard } from './components/ProductCard';
import { ScoreDetailDialog } from './components/ScoreDetailDialog';
import { SearchHistoryView } from './components/SearchHistoryView';
import { StrategyExplorerBar } from './components/StrategyExplorerBar';
import { type ActiveTab, TopBar } from './components/TopBar';
import { VideoStudioView } from './components/VideoStudioView';
import { TRANSLATIONS } from './i18n';
import {
  doesProductMatchCategory,
  doesProductMatchSelectedCategories,
  localizeCategories,
  translateCategoryNameToMyanmar,
} from './lib/categoryTranslations';
import {
  type ActiveStrategyView,
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
  hydrateProductFromStorage,
  hydrateProductsFromStorage,
  loadCachedCategories,
  loadDeepInsightsCache,
  loadKalodataLimits,
  loadLanguagePreference,
  loadProductAnalysisCache,
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
  persistProductAnalysisCache,
  persistRecentSearches,
  removeHistoryEntry,
  removeRecentSearch,
  saveCachedCategories,
  saveDeepInsightForProduct,
  saveKalodataLimits,
  saveLanguagePreference,
  saveProductAnalysisForProduct,
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
  RecentSearchEntry,
  ResultGridCols,
  ResultListZoom,
  ResultViewMode,
  SavedHistoryEntry,
  Theme,
  VideoAdPlan,
  VisualStyle,
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

function inspectQueryLink(rawInput: string): {
  isLinkOrId: boolean;
  productId: string | null;
  isShortLink: boolean;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { isLinkOrId: false, productId: null, isShortLink: false };
  }

  if (/^\d{12,24}$/.test(trimmed)) {
    return { isLinkOrId: true, productId: trimmed, isShortLink: false };
  }

  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) ||
    /(?:tiktok\.com|kalodata\.com)/i.test(trimmed);

  if (!looksLikeUrl) {
    return { isLinkOrId: false, productId: null, isShortLink: false };
  }

  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();

    for (const key of ['id', 'product_id', 'productId', 'item_id']) {
      const val = url.searchParams.get(key)?.trim();
      if (val && /^\d{12,24}$/.test(val)) {
        return { isLinkOrId: true, productId: val, isShortLink: false };
      }
    }

    const pathMatch = url.pathname.match(/(\d{12,24})/);
    if (pathMatch?.[1]) {
      return { isLinkOrId: true, productId: pathMatch[1], isShortLink: false };
    }

    if (host.startsWith('vt.tiktok.com') || host.startsWith('vm.tiktok.com')) {
      return { isLinkOrId: true, productId: null, isShortLink: true };
    }
  } catch {
    // Fallback regex scan below
  }

  const anyId = trimmed.match(/\b(\d{12,24})\b/);
  if (anyId?.[1]) {
    return { isLinkOrId: true, productId: anyId[1], isShortLink: false };
  }

  return {
    isLinkOrId: true,
    productId: null,
    isShortLink: /v[tm]\.tiktok\.com/i.test(trimmed),
  };
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => loadLanguagePreference());
  const [theme, setTheme] = useState<Theme>(() => loadThemePreference());
  const [activeTab, setActiveTab] = useState<ActiveTab>('discover');

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

  // Search controls start clean so Categories are always immediately clickable (0 auto-search)
  const [query, setQuery] = useState<string>('');
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const searchSectionRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(60);
  const [showCompactBar, setShowCompactBar] = useState<boolean>(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState<boolean>(false);
  const [isCompactSearchOpen, setIsCompactSearchOpen] = useState<boolean>(false);
  const compactActiveRef = useRef<boolean>(false);
  const headerHiddenRef = useRef<boolean>(false);
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
  const zoomHudTimerRef = useRef<number | null>(null);
  const [zoomHudText, setZoomHudText] = useState<string | null>(null);
  const [zoomDirection, setZoomDirection] = useState<1 | -1 | 0>(0);

  const [evaluationNowMs, setEvaluationNowMs] = useState<number>(() => Date.now());

  // Append-only daily observation snapshots stored locally for longitudinal strategies (0 extra API calls)
  const [productSnapshots, setProductSnapshots] = useState<
    Record<string, ProductObservationSnapshot[]>
  >(() => loadProductSnapshotsFromStorage());

  const historicalSnapshotsByProductId = useMemo(
    () => buildStrategySnapshotsMap(productSnapshots),
    [productSnapshots]
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
  const [activeStrategyView, setActiveStrategyView] =
    useState<ActiveStrategyView>('overall');
  const [showExcludedCandidates, setShowExcludedCandidates] = useState<boolean>(false);
  const [lastSearchMode, setLastSearchMode] = useState<'rank' | 'single_link'>(
    () => initialLatestSearch?.mode ?? 'rank'
  );
  const [lastSearchCreditsUsed, setLastSearchCreditsUsed] = useState<number | null>(
    () => initialLatestSearch?.creditsUsed ?? null
  );
  const [scoreDialogProduct, setScoreDialogProduct] = useState<ProductItem | null>(null);

  // Studio state
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const selectedProductIdRef = useRef<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<VisualStyle>('cinematic');
  const [activePlan, setActivePlan] = useState<VideoAdPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isEnrichingProduct, setIsEnrichingProduct] = useState(false);
  const [isAnalyzingProduct, setIsAnalyzingProduct] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [cameFromHistory, setCameFromHistory] = useState(false);

  // Local history state
  const [history, setHistory] = useState<SavedHistoryEntry[]>(() => loadSavedHistory());
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    tone: 'neutral' | 'error';
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

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
    const avail = kalodataStatus.balance?.available;
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
    saveThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-lang', language);
    document.documentElement.lang = language === 'my' ? 'my' : 'en';
    saveLanguagePreference(language);
  }, [language]);

  useEffect(() => {
    if (!isSearchBoxOpen) return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isSearchBoxOpen]);

  // Measure live TopBar height so CompactFilterBar docks edge-to-edge on every viewport
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const updateHeight = () => {
      const next = Math.round(el.getBoundingClientRect().height);
      if (next > 0) setHeaderHeight(next);
    };
    updateHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateHeight, { passive: true });
    return () => window.removeEventListener('resize', updateHeight);
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

  useEffect(() => {
    if (!showCompactBar) {
      setIsCompactSearchOpen(false);
    }
  }, [showCompactBar]);

  // Scroll-driven handoff on Discover results:
  // - Scrolling down past the inline Category/Search block pushes Header out & replaces it with CompactFilterBar.
  // - Scrolling slightly back up reveals Header again with CompactFilterBar docked cleanly underneath.
  useEffect(() => {
    const canShowCompact =
      activeTab === 'discover' && hasSearched && products.length > 0 && !isKalodataPanelOpen;

    if (!canShowCompact) {
      compactActiveRef.current = false;
      headerHiddenRef.current = false;
      setShowCompactBar(false);
      setIsHeaderHidden(false);
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

      const sectionEl = searchSectionRef.current;
      const rectBottom = sectionEl ? sectionEl.getBoundingClientRect().bottom : 999;

      if (!compactActiveRef.current && rectBottom <= 10 && currentY > 24) {
        compactActiveRef.current = true;
        setShowCompactBar(true);
        if (diff >= 0) {
          headerHiddenRef.current = true;
          setIsHeaderHidden(true);
          downAccum = 0;
          upAccum = 0;
        }
        return;
      }

      if (compactActiveRef.current && (rectBottom >= 36 || currentY <= 12)) {
        compactActiveRef.current = false;
        headerHiddenRef.current = false;
        downAccum = 0;
        upAccum = 0;
        setShowCompactBar(false);
        setIsHeaderHidden(false);
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
        }
      } else {
        upAccum += Math.abs(diff);
        downAccum = 0;
        if (headerHiddenRef.current && upAccum >= 14) {
          headerHiddenRef.current = false;
          upAccum = 0;
          setIsHeaderHidden(false);
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
  }, [activeTab, hasSearched, products.length, isKalodataPanelOpen]);

  // If category filtering shrinks the result grid enough that the inline filters come back into view, exit compact mode cleanly
  useEffect(() => {
    if (!compactActiveRef.current) return;
    const raf = window.requestAnimationFrame(() => {
      const rectBottom = searchSectionRef.current?.getBoundingClientRect().bottom ?? 999;
      if (rectBottom >= 36 || window.scrollY <= 12) {
        compactActiveRef.current = false;
        headerHiddenRef.current = false;
        setShowCompactBar(false);
        setIsHeaderHidden(false);
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
    setActiveStrategyView('overall');
    setShowExcludedCandidates(false);
    setLastSearchMode(entry.mode);
    setLastSearchCreditsUsed(entry.creditsUsed);
    setRestoredFromBrowser(true);
    setHasSearched(true);
    setSearchError(null);
    setActiveRecentId(entry.id);
  }

  function handleOpenSearchHistoryEntry(entry: RecentSearchEntry) {
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
          setActiveStrategyView('overall');
          setShowExcludedCandidates(false);
          setLastSearchMode(nextLatest.mode);
          setLastSearchCreditsUsed(nextLatest.creditsUsed);
          setRestoredFromBrowser(true);
          setHasSearched(true);
          setActiveRecentId(nextLatest.id);
        } else {
          setProducts([]);
          setActiveStrategyView('overall');
          setShowExcludedCandidates(false);
          setHasSearched(false);
          setRestoredFromBrowser(false);
          setActiveRecentId(null);
          setLastSearchCreditsUsed(null);
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
    setActiveStrategyView('overall');
    setShowExcludedCandidates(false);
    setSearchError(null);
    setHasSearched(false);
    setLastSearchCreditsUsed(null);
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
      setLastSearchCreditsUsed(null);
      showToast(t.kalodata.disconnectedToast, 'neutral');
    } catch {
      // Ignore error
    }
  }

  async function handleRefreshBalance(): Promise<void> {
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

  // Live Kalodata API Search ONLY (always uses credits, never reads local history or server cache)
  async function runProductSearch() {
    if (!kalodataStatus.connected) {
      setIsKalodataPanelOpen(true);
      setHasSearched(true);
      setProducts([]);
      setSearchError(t.kalodata.connectRequiredError);
      return;
    }

    if (linkInfo.isLinkOrId && !linkInfo.productId) {
      setHasSearched(true);
      setProducts([]);
      setSearchError(
        linkInfo.isShortLink ? t.search.shortLinkNotice : t.search.invalidLinkNotice
      );
      return;
    }

    if (searchLimitWarning) {
      setHasSearched(true);
      setSearchError(searchLimitWarning);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);

    try {
      const singleSelectedCat =
        !linkInfo.isLinkOrId && selectedCateIds.length === 1
          ? categories.find((c) => c.id === selectedCateIds[0])
          : undefined;
      const response = await fetch('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          cateIds: linkInfo.isLinkOrId ? [] : selectedCateIds,
          selectedCategoryMeta: singleSelectedCat
            ? {
                id: singleSelectedCat.id,
                my: singleSelectedCat.label.my,
                en: singleSelectedCat.label.en,
              }
            : null,
          forceRefresh: true,
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
      const hydratedProducts = sortProductsByV2Overall(
        hydrateProductsFromStorage(rawFetched, { nowMs }),
        { nowMs, historicalSnapshotsByProductId }
      );

      // Append genuine Kalodata source observations into local daily snapshot history (0 extra API calls)
      if (hydratedProducts.length > 0) {
        const snapshotUpdate = recordProductSnapshotsInStorage(hydratedProducts, { nowMs });
        if (snapshotUpdate.addedCount > 0 || snapshotUpdate.updatedCount > 0) {
          setProductSnapshots(snapshotUpdate.snapshotsByProductId);
        }
      }

      const resolvedMode: 'rank' | 'single_link' =
        data.mode === 'single_link' ? 'single_link' : 'rank';
      const used = typeof data.creditsUsed === 'number' ? data.creditsUsed : null;

      setProducts(hydratedProducts);
      setActiveStrategyView('overall');
      setShowExcludedCandidates(false);
      setLastSearchMode(resolvedMode);
      setLastSearchCreditsUsed(used);
      setRestoredFromBrowser(false);

      if (hydratedProducts.length > 0) {
        saveSearchToBrowserHistory({
          searchQuery: query.trim(),
          cateIds: linkInfo.isLinkOrId ? [] : selectedCateIds,
          mode: resolvedMode,
          foundProducts: hydratedProducts,
          creditsUsed: used,
        });
      }

      if (data.balance) {
        setKalodataStatus((prev) => ({
          ...prev,
          balance: data.balance ?? prev.balance,
        }));
      }

      const spentDelta = used !== null ? used : LEAN_SEARCH_COST;
      recordSpentCredits(spentDelta);
    } catch (err) {
      setProducts([]);
      setSearchError(err instanceof Error ? err.message : 'Unable to search right now.');
    } finally {
      setIsSearching(false);
    }
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    runProductSearch();
  }

  async function requestVideoPlan(
    product: ProductItem,
    style: VisualStyle,
    forceFresh = false
  ) {
    const targetProductId = product.id;
    if (!forceFresh) {
      const cached = history.find(
        (entry) => entry.product.id === targetProductId && entry.plan?.style === style
      );
      if (cached?.plan) {
        if (selectedProductIdRef.current === targetProductId) {
          setActivePlan(cached.plan);
          setPlanError(null);
          setIsGeneratingPlan(false);
        }
        return;
      }
    }

    setIsGeneratingPlan(true);
    setPlanError(null);
    setActivePlan(null);

    const controller = new AbortController();
    const clientTimer = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, style }),
        signal: controller.signal,
      });

      const data = await parseApiStreamOrJson<{ plan?: VideoAdPlan }>(response, language);
      if (!data.plan) {
        throw new Error('Unable to generate video plan right now.');
      }

      const generatedPlan = data.plan;
      const newEntry: SavedHistoryEntry = {
        id: generatedPlan.id,
        savedAt: generatedPlan.createdAt,
        product,
        plan: generatedPlan,
      };
      setHistory((prev) => upsertHistoryEntry(prev, newEntry));

      if (selectedProductIdRef.current === targetProductId) {
        setActivePlan(generatedPlan);
      }
    } catch (err) {
      if (selectedProductIdRef.current === targetProductId) {
        if (err instanceof Error && err.name === 'AbortError') {
          setPlanError(
            language === 'my'
              ? 'AI Video Plan ဖန်တီးချိန် ကြာသွားပါသည် — ထပ်မံကြိုးစားပေးပါ။'
              : 'AI video generation timed out. Please try again.'
          );
        } else {
          setPlanError(
            err instanceof Error ? err.message : 'Unable to generate video plan right now.'
          );
        }
      }
    } finally {
      window.clearTimeout(clientTimer);
      if (selectedProductIdRef.current === targetProductId) {
        setIsGeneratingPlan(false);
      }
    }
  }

  async function handleFetchProductDeepInsights(options: ProductEnrichOptions) {
    if (!selectedProduct) return;
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
    const targetProduct = selectedProduct;
    const targetProductId = targetProduct.id;
    setIsAnalyzingProduct(true);
    setAnalysisError(null);
    const controller = new AbortController();
    const clientTimer = window.setTimeout(() => controller.abort(), 90000);
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
        throw new Error('Unable to analyze product right now.');
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
              ? 'AI သုံးသပ်ချက် ဖန်တီးချိန် ကြာသွားပါသည် — ထပ်မံကြိုးစားပေးပါ။'
              : 'AI product analysis timed out. Please try again.'
          );
        } else {
          setAnalysisError(
            err instanceof Error ? err.message : 'Unable to analyze product right now.'
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

  function findSavedPlanFor(productId: string, style: VisualStyle): VideoAdPlan | null {
    const found = history.find(
      (entry) => entry.product.id === productId && entry.plan?.style === style
    );
    return found?.plan ?? null;
  }

  function handleToggleSaveProduct(product: ProductItem) {
    const hydrated = hydrateProductFromStorage(product, { nowMs: evaluationNowMs });
    const { next, saved } = toggleSavedProduct(history, hydrated);
    setHistory(next);
    showToast(saved ? t.card.savedProductToast : t.card.removedProductToast, 'neutral');
  }

  // Opens Video Studio cleanly — NEVER auto-generates Video Ideas!
  function handleSelectProduct(product: ProductItem) {
    const hydrated = hydrateProductFromStorage(product, { nowMs: evaluationNowMs });
    const defaultStyle: VisualStyle = 'cinematic';
    const existingSavedPlan = findSavedPlanFor(hydrated.id, defaultStyle);

    selectedProductIdRef.current = hydrated.id;
    setSelectedProduct(hydrated);
    setSelectedStyle(defaultStyle);
    setActivePlan(existingSavedPlan);
    setPlanError(null);
    setEnrichError(null);
    setAnalysisError(null);
    setIsGeneratingPlan(false);
    setIsEnrichingProduct(false);
    setIsAnalyzingProduct(false);
    setCameFromHistory(false);
    setActiveTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleOpenHistoryEntry(entry: SavedHistoryEntry) {
    const hydrated = hydrateProductFromStorage(entry.product, { nowMs: evaluationNowMs });
    const nextStyle: VisualStyle = entry.plan?.style ?? 'cinematic';
    const nextPlan: VideoAdPlan | null = entry.plan ?? findSavedPlanFor(hydrated.id, nextStyle);

    selectedProductIdRef.current = hydrated.id;
    setSelectedProduct(hydrated);
    setSelectedStyle(nextStyle);
    setActivePlan(nextPlan);
    setPlanError(null);
    setEnrichError(null);
    setAnalysisError(null);
    setIsGeneratingPlan(false);
    setIsEnrichingProduct(false);
    setIsAnalyzingProduct(false);
    setCameFromHistory(true);
    setActiveTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Switching Visual Style ONLY updates selection & shows saved plan if present — NEVER auto-generates!
  function handleStyleChange(nextStyle: VisualStyle) {
    if (!selectedProduct || nextStyle === selectedStyle) return;
    setSelectedStyle(nextStyle);
    setPlanError(null);
    const existingSavedPlan = findSavedPlanFor(selectedProduct.id, nextStyle);
    setActivePlan(existingSavedPlan);
  }

  // Called ONLY after the user explicitly confirms inside the Studio Confirmation Dialog
  function handleConfirmGeneratePlan(forceFresh: boolean) {
    if (!selectedProduct) return;
    requestVideoPlan(selectedProduct, selectedStyle, forceFresh);
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
  const isSingleLinkValid = linkInfo.isLinkOrId && Boolean(linkInfo.productId);
  const isLinkBroken = linkInfo.isLinkOrId && !linkInfo.productId;
  const activeRecentEntry = useMemo(
    () => recentSearches.find((entry) => entry.id === activeRecentId) ?? null,
    [recentSearches, activeRecentId]
  );
  const isViewingOlderHistory = Boolean(
    activeRecentEntry && recentSearches[0] && activeRecentEntry.id !== recentSearches[0].id
  );
  const activeResultScopeLabel = useMemo(() => {
    if (!activeRecentEntry) return null;
    const localizedCates = activeRecentEntry.cateLabels.map((lbl) =>
      language === 'my'
        ? lbl.my && /[\u1000-\u109F]/.test(lbl.my)
          ? lbl.my
          : translateCategoryNameToMyanmar(lbl.en || lbl.my)
        : lbl.en || lbl.my
    );
    if (activeRecentEntry.mode === 'single_link') {
      return activeRecentEntry.products[0]?.clearTitle[language] || activeRecentEntry.query;
    }
    if (activeRecentEntry.query.trim()) {
      return localizedCates.length > 0
        ? `${activeRecentEntry.query.trim()} · ${localizedCates.join(', ')}`
        : activeRecentEntry.query.trim();
    }
    if (localizedCates.length > 0) {
      return localizedCates.join(', ');
    }
    return t.recent.defaultBestLabel;
  }, [activeRecentEntry, language, t]);

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
      buildProductIntelligenceView(filteredProducts, activeStrategyView, {
        nowMs: evaluationNowMs,
        historicalSnapshotsByProductId,
      }),
    [filteredProducts, activeStrategyView, evaluationNowMs, historicalSnapshotsByProductId]
  );

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

  function handleSelectStrategyView(next: ActiveStrategyView) {
    setActiveStrategyView(next);
    setShowExcludedCandidates(false);
  }

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

  // Gallery zoom sequence ordered from smallest card (most cols = Image + Name only) to largest card (fewest cols)
  const zoomColsSequence: ResultGridCols[] = useMemo(
    () =>
      viewportTier === 'mobile'
        ? [3, 2, 1]
        : viewportTier === 'tablet'
          ? [4, 3, 2]
          : [5, 4, 3, 2],
    [viewportTier]
  );

  const defaultGridCols: ResultGridCols =
    viewportTier === 'mobile' ? 1 : viewportTier === 'tablet' ? 2 : 3;

  const effectiveGridCols: ResultGridCols = (() => {
    if (storedGridCols === null) return defaultGridCols;
    const maxCols = zoomColsSequence[0];
    const minCols = zoomColsSequence[zoomColsSequence.length - 1];
    if (storedGridCols < minCols) return minCols;
    if (storedGridCols > maxCols) return maxCols;
    return storedGridCols;
  })();

  const zoomIndex = Math.max(0, zoomColsSequence.indexOf(effectiveGridCols));
  const maxZoomIndex = zoomColsSequence.length - 1;

  const activeZoomIndex = resultViewMode === 'list' ? listZoomLevel : zoomIndex;
  const activeMaxZoomIndex = resultViewMode === 'list' ? 2 : maxZoomIndex;

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

  const flashZoomHud = (label: string) => {
    setZoomHudText(label);
    if (zoomHudTimerRef.current !== null) {
      window.clearTimeout(zoomHudTimerRef.current);
    }
    zoomHudTimerRef.current = window.setTimeout(() => {
      setZoomHudText(null);
      zoomHudTimerRef.current = null;
    }, 900);
  };

  const getListZoomHudLabel = (level: ResultListZoom) => {
    if (level === 0) return `List · ${t.discover.microViewTag}`;
    if (level === 1) return `List · ${t.discover.listCompactTag}`;
    return `List · ${t.discover.listDetailedTag}`;
  };

  const applyActiveZoomIndex = (nextIndex: number, announceHud = true) => {
    if (resultViewMode === 'list') {
      const clamped = Math.max(0, Math.min(2, nextIndex)) as ResultListZoom;
      if (clamped === listZoomLevel) return false;
      setZoomDirection(clamped > listZoomLevel ? 1 : -1);
      setListZoomLevel(clamped);
      saveResultListZoom(clamped);
      if (announceHud) {
        flashZoomHud(getListZoomHudLabel(clamped));
      }
      return true;
    }

    const clamped = Math.max(0, Math.min(zoomColsSequence.length - 1, nextIndex));
    const nextCols = zoomColsSequence[clamped];
    if (nextCols === effectiveGridCols) return false;
    setZoomDirection(clamped > zoomIndex ? 1 : -1);
    setStoredGridCols(nextCols);
    saveResultGridCols(nextCols);
    if (announceHud) {
      flashZoomHud(clamped === 0 ? `${nextCols}× · ${t.discover.microViewTag}` : `${nextCols}×`);
    }
    return true;
  };

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
    (resultViewMode === 'list'
      ? intelligenceView.rankedEntries.length > 0
      : intelligenceView.rankedEntries.length > 1);

  // Android Gallery-style two-finger pinch-to-zoom + desktop trackpad pinch (Ctrl+Wheel) for BOTH Grid & List
  useEffect(() => {
    const containerEl = resultsGridRef.current;
    if (!canPinchResults || !containerEl) return;

    let pinchActive = false;
    let anchorDistance = 0;
    let wheelAccum = 0;

    const getTouchDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
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

    const stepZoomFromGesture = (direction: 1 | -1) => {
      const state = zoomGestureStateRef.current;

      if (state.viewMode === 'list') {
        const nextLevel = Math.max(0, Math.min(2, state.listZoomLevel + direction)) as ResultListZoom;
        if (nextLevel === state.listZoomLevel) return false;
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
        return true;
      }

      const nextIdx = Math.max(0, Math.min(state.sequence.length - 1, state.zoomIndex + direction));
      if (nextIdx === state.zoomIndex) return false;
      const nextCols = state.sequence[nextIdx];
      state.zoomIndex = nextIdx;
      setZoomDirection(direction);
      setStoredGridCols(nextCols);
      saveResultGridCols(nextCols);
      const label = nextIdx === 0 ? `${nextCols}× · ${state.microLabel}` : `${nextCols}×`;
      triggerHapticAndHud(label);
      return true;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchActive = true;
        anchorDistance = Math.max(getTouchDistance(e.touches), 24);
        containerEl.style.transition = 'none';
      } else {
        pinchActive = false;
        containerEl.style.transform = '';
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pinchActive || e.touches.length !== 2) return;
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      const ratio = dist / anchorDistance;

      // Subtle tactile elastic scale feedback during pinch
      const previewScale = Math.max(0.95, Math.min(1.05, 1 + (ratio - 1) * 0.16));
      containerEl.style.transform = `scale(${previewScale.toFixed(3)})`;

      if (ratio >= 1.22) {
        if (stepZoomFromGesture(1)) {
          anchorDistance = Math.max(dist, 24);
          containerEl.style.transition = 'none';
          containerEl.style.transform = 'scale(1)';
        }
      } else if (ratio <= 0.8) {
        if (stepZoomFromGesture(-1)) {
          anchorDistance = Math.max(dist, 24);
          containerEl.style.transition = 'none';
          containerEl.style.transform = 'scale(1)';
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchActive = false;
        containerEl.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)';
        containerEl.style.transform = '';
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      wheelAccum += e.deltaY;
      if (wheelAccum <= -36) {
        stepZoomFromGesture(1);
        wheelAccum = 0;
      } else if (wheelAccum >= 36) {
        stepZoomFromGesture(-1);
        wheelAccum = 0;
      }
    };

    containerEl.addEventListener('touchstart', onTouchStart, { passive: true });
    containerEl.addEventListener('touchmove', onTouchMove, { passive: false });
    containerEl.addEventListener('touchend', onTouchEnd, { passive: true });
    containerEl.addEventListener('touchcancel', onTouchEnd, { passive: true });
    containerEl.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      containerEl.style.transform = '';
      containerEl.style.transition = '';
      containerEl.removeEventListener('touchstart', onTouchStart);
      containerEl.removeEventListener('touchmove', onTouchMove);
      containerEl.removeEventListener('touchend', onTouchEnd);
      containerEl.removeEventListener('touchcancel', onTouchEnd);
      containerEl.removeEventListener('wheel', onWheel);
    };
  }, [canPinchResults]);

  useEffect(() => {
    return () => {
      if (zoomHudTimerRef.current !== null) {
        window.clearTimeout(zoomHudTimerRef.current);
      }
    };
  }, []);

  function handleSelectViewMode(next: ResultViewMode) {
    if (next === resultViewMode) return;
    setZoomDirection(0);
    setResultViewMode(next);
    saveResultViewMode(next);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B1117] text-[#0F172A] dark:text-[#F1F5F9] transition-colors duration-200">
      <TopBar
        activeTab={activeTab}
        onNavigate={(tab) => {
          if (tab === 'discover' && recentSearches[0] && !isSearching) {
            // Home always defaults to showing the latest recent search
            if (activeRecentId !== recentSearches[0].id) {
              loadRecentEntryIntoHome(recentSearches[0]);
            }
          }
          setActiveTab(tab);
          setIsHeaderHidden(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
        onRevealHeader={() => {
          headerHiddenRef.current = false;
          setIsHeaderHidden(false);
        }}
        t={t}
      />

      {/* Scroll-Driven Compact Category Filters & Search Bar (replaces Header on scroll down, docks beneath on scroll up) */}
      {activeTab === 'discover' && (
        <CompactFilterBar
          isVisible={showCompactBar && !isKalodataPanelOpen}
          isHeaderHidden={isHeaderHidden}
          headerHeight={headerHeight}
          categories={categories}
          selectedCateIds={selectedCateIds}
          categoryMatchCounts={categoryMatchCounts}
          language={language}
          query={query}
          isCompactSearchOpen={isCompactSearchOpen}
          isSearching={isSearching}
          isSingleLinkValid={isSingleLinkValid}
          isLinkOrId={linkInfo.isLinkOrId}
          isLinkBroken={isLinkBroken}
          isShortLink={linkInfo.isShortLink}
          linkProductId={linkInfo.productId}
          searchLimitWarning={searchLimitWarning}
          leanSearchCost={LEAN_SEARCH_COST}
          t={t}
          onToggleCategory={handleToggleCategory}
          onQueryChange={setQuery}
          onToggleCompactSearch={() => setIsCompactSearchOpen((prev) => !prev)}
          onCloseCompactSearch={() => setIsCompactSearchOpen(false)}
          onSubmitSearch={runProductSearch}
        />
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

      {/* Main Content Viewport */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10"
            >
              {/* Ultra-Clean Focused Search Area (No Hero Fluff, No 7d/30d Clutter) */}
              <section ref={searchSectionRef} className="max-w-3xl mx-auto">
                {/* Inline Connect Prompt ONLY when disconnected & drawer closed */}
                {!kalodataStatus.connected && !isKalodataPanelOpen && (
                  <div className="mb-5">
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

                {/* Focused Search Workflow: Categories First -> Optional Motion Search Box -> Primary Search Button Below */}
                <form onSubmit={handleSearchSubmit}>
                  {/* Multi-Select Official & Live Synced Thailand TikTok Shop Categories (0 Credits until Search) */}
                  <div
                    className={`transition-opacity duration-150 ${
                      linkInfo.isLinkOrId ? 'opacity-45 pointer-events-none' : 'opacity-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {categories.map((cat) => {
                        const isAll = !cat.id;
                        const isSelected = isAll
                          ? selectedCateIds.length === 0
                          : selectedCateIds.includes(cat.id);
                        const matchCount = categoryMatchCounts.get(cat.id) ?? 0;

                        return (
                          <button
                            key={cat.id || 'all'}
                            type="button"
                            onClick={() => handleToggleCategory(cat.id)}
                            className={`h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                              isSelected
                                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                                : 'bg-white dark:bg-[#131B24] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            {!isAll && isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                            <span>{cat.label[language]}</span>
                            {matchCount > 0 && (
                              <span
                                className={`font-mono-num text-[11px] ${
                                  isSelected
                                    ? 'text-white/75 dark:text-slate-950/70'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {matchCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Subtle Category Meta Row: Multi-Category Selection Info + Optional Live Sync */}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedCateIds.length > 0 ? (
                          <>
                            <span className="font-medium text-teal-700 dark:text-teal-400">
                              {t.search.selectedCount(selectedCateIds.length)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedCateIds([])}
                              className="underline hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                            >
                              {t.search.clearCategories}
                            </button>
                          </>
                        ) : (
                          <span>
                            {hasLiveSyncedCategories && (
                              <span className="text-teal-700 dark:text-teal-400 font-medium mr-1.5">
                                {t.search.liveSyncedTag} ·
                              </span>
                            )}
                            {t.search.multiCategoryHint}
                          </span>
                        )}
                      </div>

                      {kalodataStatus.connected && (
                        <button
                          type="button"
                          disabled={isSyncingCategories || Boolean(searchLimitWarning)}
                          onClick={handleSyncLiveCategories}
                          className="font-medium text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${isSyncingCategories ? 'animate-spin' : ''}`}
                          />
                          <span>
                            {isSyncingCategories
                              ? t.search.syncingCategoriesBtn
                              : t.search.syncCategoriesBtn}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* On-Demand Collapsible Search Box (Opens Smoothly with Motion Only When Needed) */}
                  <AnimatePresence initial={false}>
                    {isSearchBoxOpen && (
                      <motion.div
                        key="discover-search-box"
                        initial={{ opacity: 0, height: 0, y: -6 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -6 }}
                        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <motion.div
                          initial={{ scale: 0.985 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0.985 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          className="mt-4 bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2 shadow-xs focus-within:border-teal-500/70 dark:focus-within:border-teal-500/60 transition-colors"
                        >
                          <div className="relative flex items-center">
                            {linkInfo.isLinkOrId ? (
                              <Link2 className="w-4 h-4 text-teal-600 dark:text-teal-400 absolute left-3.5 pointer-events-none" />
                            ) : (
                              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                            )}
                            <input
                              ref={searchInputRef}
                              type="text"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape' && !query.trim()) {
                                  setIsSearchBoxOpen(false);
                                }
                              }}
                              placeholder={t.search.placeholder}
                              className="w-full h-11 pl-10 pr-9 rounded-xl bg-transparent text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                            />
                            {query && (
                              <button
                                type="button"
                                onClick={() => {
                                  setQuery('');
                                  searchInputRef.current?.focus();
                                }}
                                aria-label="Clear search"
                                className="absolute right-2 h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Single-Product Link Mode Cost Notice */}
                          {isSingleLinkValid && linkInfo.productId && (
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 px-2 flex items-center gap-2 text-xs text-teal-700 dark:text-teal-400 font-medium">
                              <Link2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{t.search.linkModeNotice(linkInfo.productId)}</span>
                            </div>
                          )}

                          {isLinkBroken && (
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 px-2 text-xs text-amber-700 dark:text-amber-400">
                              {linkInfo.isShortLink
                                ? t.search.shortLinkNotice
                                : t.search.invalidLinkNotice}
                            </div>
                          )}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action Row Placed Directly Below Categories: Search Box Toggle + Primary Search CTA */}
                  <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setIsSearchBoxOpen((prev) => !prev)}
                        aria-expanded={isSearchBoxOpen}
                        className={`h-11 px-4 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer border ${
                          isSearchBoxOpen || query.trim()
                            ? 'bg-teal-50/70 dark:bg-teal-950/35 border-teal-300/90 dark:border-teal-800 text-teal-800 dark:text-teal-300'
                            : 'bg-white dark:bg-[#131B24] border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {linkInfo.isLinkOrId ? (
                          <Link2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <Search className="w-4 h-4 shrink-0" />
                        )}
                        <span>
                          {isSearchBoxOpen
                            ? t.search.closeSearchBoxBtn
                            : t.search.openSearchBoxBtn}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                            isSearchBoxOpen ? 'rotate-180' : 'rotate-0'
                          }`}
                        />
                      </button>

                      {!isSearchBoxOpen && query.trim() && (
                        <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 min-w-0">
                          <span className="truncate max-w-[160px] sm:max-w-[220px] font-medium">
                            “{query.trim()}”
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuery('')}
                            aria-label="Clear search"
                            className="h-6 w-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSearching || Boolean(searchLimitWarning) || isLinkBroken}
                      className="h-11 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors duration-150 whitespace-nowrap shrink-0 disabled:opacity-55 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
                </form>

                {searchLimitWarning && (
                  <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400">
                    {searchLimitWarning}
                  </p>
                )}
              </section>

              {/* Results / Loading / Error Area (Always displays latest Recent History or live search results) */}
              <section className="mt-8 sm:mt-10">
                {isSearching ? (
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">
                      {isSingleLinkValid ? t.discover.loadingSingleNote : t.discover.loadingNote}
                    </p>
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
                        className="mt-4 h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium cursor-pointer"
                      >
                        {t.discover.retry}
                      </button>
                    )}
                  </div>
                ) : hasSearched ? (
                  products.length > 0 ? (
                    <div>
                      <div className="mb-6 flex flex-col gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                              <h2 className="font-display text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
                                {lastSearchMode === 'single_link'
                                  ? t.discover.singleResultHeading
                                  : isCategoryFilterActive
                                    ? `${t.discover.resultsHeading} (${filteredProducts.length} / ${products.length})`
                                    : `${t.discover.resultsHeading} (${products.length})`}
                              </h2>
                              {activeResultScopeLabel && (
                                <span className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-400">
                                  · {activeResultScopeLabel}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                              {lastSearchMode === 'single_link'
                                ? t.discover.singleResultSubtext
                                : t.discover.resultsSubtext}
                            </p>
                          </div>

                          {/* View Mode (List / Grid) & Adjustable Grid Column Controls */}
                          {filteredProducts.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 self-start sm:self-end shrink-0">
                              <div
                                role="group"
                                aria-label="Result layout view"
                                className="inline-flex items-center p-0.5 rounded-lg bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/75 dark:border-slate-700/70"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleSelectViewMode('grid')}
                                  aria-pressed={resultViewMode === 'grid'}
                                  title={t.discover.viewGrid}
                                  className={`h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                    resultViewMode === 'grid'
                                      ? 'bg-white dark:bg-[#131B24] text-slate-900 dark:text-white shadow-xs'
                                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                  }`}
                                >
                                  <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                                  <span className="hidden sm:inline">Grid</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSelectViewMode('list')}
                                  aria-pressed={resultViewMode === 'list'}
                                  title={t.discover.viewList}
                                  className={`h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                    resultViewMode === 'list'
                                      ? 'bg-white dark:bg-[#131B24] text-slate-900 dark:text-white shadow-xs'
                                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                  }`}
                                >
                                  <List className="w-3.5 h-3.5 shrink-0" />
                                  <span className="hidden sm:inline">List</span>
                                </button>
                              </div>

                              {(resultViewMode === 'list' || filteredProducts.length > 1) && (
                                <div
                                  role="group"
                                  aria-label={t.discover.pinchZoomHint}
                                  title={t.discover.pinchZoomHint}
                                  className="inline-flex items-center gap-1 h-9 px-1 rounded-lg bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/75 dark:border-slate-700/70"
                                >
                                  <button
                                    type="button"
                                    disabled={activeZoomIndex <= 0}
                                    onClick={() => applyActiveZoomIndex(activeZoomIndex - 1)}
                                    aria-label={t.discover.zoomOut}
                                    title={t.discover.zoomOut}
                                    className="h-8 w-8 rounded-md inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#131B24] hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-35 cursor-pointer disabled:cursor-default"
                                  >
                                    <ZoomOut className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="range"
                                    min={0}
                                    max={activeMaxZoomIndex}
                                    step={1}
                                    value={activeZoomIndex}
                                    onChange={(e) => applyActiveZoomIndex(Number(e.target.value))}
                                    aria-label={t.discover.pinchZoomHint}
                                    className="w-14 sm:w-20 h-1.5 accent-teal-600 dark:accent-teal-400 cursor-pointer"
                                  />
                                  <button
                                    type="button"
                                    disabled={activeZoomIndex >= activeMaxZoomIndex}
                                    onClick={() => applyActiveZoomIndex(activeZoomIndex + 1)}
                                    aria-label={t.discover.zoomIn}
                                    title={t.discover.zoomIn}
                                    className="h-8 w-8 rounded-md inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#131B24] hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-35 cursor-pointer disabled:cursor-default"
                                  >
                                    <ZoomIn className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono-num text-slate-500 dark:text-slate-400">
                          {isCategoryFilterActive && (
                            <span className="inline-flex items-center gap-2 font-sans">
                              <span className="text-teal-700 dark:text-teal-400 font-medium">
                                {t.discover.filteredCountNote(
                                  filteredProducts.length,
                                  products.length
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedCateIds([])}
                                className="font-medium text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 underline cursor-pointer"
                              >
                                {t.search.clearCategories}
                              </button>
                            </span>
                          )}

                          {restoredFromBrowser ? (
                            <>
                              <span
                                className={`font-medium ${
                                  isRestoredDataStale
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-teal-700 dark:text-teal-400'
                                }`}
                              >
                                {isRestoredDataStale
                                  ? t.discover.staleSnapshotNotice
                                  : isViewingOlderHistory
                                    ? t.recent.viewingOlderNote
                                    : t.recent.loadedFromStorageNote}
                              </span>
                              {isRestoredDataStale && kalodataStatus.connected && (
                                <button
                                  type="button"
                                  disabled={isSearching || Boolean(searchLimitWarning)}
                                  onClick={() => runProductSearch()}
                                  className="font-sans font-semibold text-amber-800 dark:text-amber-300 hover:underline whitespace-nowrap cursor-pointer disabled:opacity-50"
                                >
                                  {t.discover.refreshLiveBtn}
                                </button>
                              )}
                              {isViewingOlderHistory && recentSearches[0] ? (
                                <button
                                  type="button"
                                  onClick={() => loadRecentEntryIntoHome(recentSearches[0])}
                                  className="font-sans font-medium text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 underline cursor-pointer"
                                >
                                  {t.recent.backToLatestBtn}
                                </button>
                              ) : (
                                recentSearches.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveTab('search_history')}
                                    className="font-sans font-medium text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 underline cursor-pointer"
                                  >
                                    {t.recent.viewAllHistoryBtn} ({recentSearches.length})
                                  </button>
                                )
                              )}
                            </>
                          ) : (
                            lastSearchCreditsUsed !== null && (
                              <span>
                                {t.kalodata.lastSearchUsed}: {lastSearchCreditsUsed}{' '}
                                {t.kalodata.creditsUnit}
                              </span>
                            )
                          )}
                        </div>
                      </div>

                      {filteredProducts.length > 0 ? (
                        <div>
                          <StrategyExplorerBar
                            viewModel={intelligenceView}
                            activeView={activeStrategyView}
                            showExcluded={showExcludedCandidates}
                            t={t}
                            onSelectView={handleSelectStrategyView}
                            onToggleShowExcluded={() =>
                              setShowExcludedCandidates((prev) => !prev)
                            }
                          />

                          {intelligenceView.rankedEntries.length > 0 ? (
                            <div
                              ref={resultsGridRef}
                              style={
                                canPinchResults
                                  ? { touchAction: 'pan-y', transformOrigin: 'center top' }
                                  : undefined
                              }
                            >
                              <motion.div
                                key={`${layoutTransitionKey}-${activeStrategyView}`}
                                initial={{
                                  opacity: 0.35,
                                  scale:
                                    zoomDirection === 1
                                      ? 0.94
                                      : zoomDirection === -1
                                        ? 1.06
                                        : 0.985,
                                }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                                style={{
                                  transformOrigin: 'center top',
                                  willChange: 'transform, opacity',
                                }}
                                className={
                                  resultViewMode === 'list'
                                    ? `flex flex-col ${activeListGapClass} ${
                                        intelligenceView.rankedEntries.length === 1
                                          ? 'max-w-3xl mx-auto'
                                          : ''
                                      }`
                                    : intelligenceView.rankedEntries.length === 1
                                      ? 'grid grid-cols-1 max-w-md mx-auto gap-6'
                                      : activeGridLayoutClass
                                }
                              >
                                {intelligenceView.rankedEntries.map((entry, index) => (
                                  <ProductCard
                                    key={entry.product.id}
                                    product={entry.product}
                                    intelligenceItem={entry}
                                    activeStrategyView={activeStrategyView}
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
                              </motion.div>
                            </div>
                          ) : (
                            <div className="py-10 px-6 max-w-2xl mx-auto text-center rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#131B24]">
                              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                                {intelligenceView.isHistoricalDataUnavailable
                                  ? t.v2.strategyExplorer.historyUnavailableTitle
                                  : t.v2.strategyExplorer.noQualifiedTitle}
                              </h3>
                              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                {intelligenceView.isHistoricalDataUnavailable
                                  ? t.v2.strategyExplorer.historyUnavailableDesc
                                  : t.v2.strategyExplorer.noQualifiedDesc}
                              </p>
                              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                                {intelligenceView.excludedEntries.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowExcludedCandidates((prev) => !prev)
                                    }
                                    className="h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
                                  >
                                    {showExcludedCandidates
                                      ? t.v2.strategyExplorer.hideExcludedBtn
                                      : t.v2.strategyExplorer.showExcludedBtn(
                                          intelligenceView.excludedEntries.length
                                        )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleSelectStrategyView('overall')}
                                  className="h-10 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  {t.v2.overallTabLabel} ({intelligenceView.overallCount})
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Non-Qualifying Candidates Drawer / Section for Active Strategy */}
                          {activeStrategyView !== 'overall' &&
                            showExcludedCandidates &&
                            intelligenceView.excludedEntries.length > 0 && (
                              <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800">
                                <div className="mb-4">
                                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                                    {t.v2.strategyExplorer.excludedSectionTitle} (
                                    {intelligenceView.excludedEntries.length})
                                  </h3>
                                  <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                    {t.v2.strategyExplorer.excludedSectionSub}
                                  </p>
                                </div>

                                <div
                                  className={
                                    resultViewMode === 'list'
                                      ? `flex flex-col ${activeListGapClass}`
                                      : activeGridLayoutClass
                                  }
                                >
                                  {intelligenceView.excludedEntries.map(
                                    (excluded, idx) => (
                                      <ProductCard
                                        key={`excluded-${excluded.product.id}`}
                                        product={excluded.product}
                                        intelligenceItem={excluded}
                                        activeStrategyView={activeStrategyView}
                                        index={idx}
                                        language={language}
                                        isSaved={savedProductIds.has(excluded.product.id)}
                                        viewMode={resultViewMode}
                                        density={cardDensity}
                                        nowMs={evaluationNowMs}
                                        t={t}
                                        onSelect={handleSelectProduct}
                                        onToggleSave={handleToggleSaveProduct}
                                        onOpenScoreDetails={setScoreDialogProduct}
                                      />
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      ) : (
                        <div className="py-12 px-6 max-w-lg mx-auto text-center rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#131B24]">
                          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                            {t.discover.filteredEmptyTitle}
                          </h3>
                          <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            {t.discover.filteredEmptyDesc(products.length)}
                          </p>
                          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                            <button
                              type="button"
                              disabled={isSearching || Boolean(searchLimitWarning)}
                              onClick={() => runProductSearch()}
                              className="h-10 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-55"
                            >
                              <Search className="w-4 h-4 shrink-0" />
                              <span>
                                {t.discover.searchSelectedCategoryBtn} (~{LEAN_SEARCH_COST} cr)
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedCateIds([])}
                              className="h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
                            >
                              {t.discover.clearFilterBtn}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-14 text-center max-w-md mx-auto">
                      <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {t.discover.noResultsTitle}
                      </h2>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {t.discover.noResultsDesc}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="max-w-2xl mx-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131B24] p-5 sm:p-6">
                    <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                      {t.discover.emptyGuideTitle}
                    </h2>
                    <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t.discover.emptyGuideDesc}
                    </p>
                    <ul className="mt-3.5 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {t.discover.emptyGuidePoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2 leading-relaxed">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t.discover.emptyGuideDisclaimer}
                    </p>
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {activeTab === 'search_history' && (
            <motion.div
              key="search_history"
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
                onGoDiscover={() => setActiveTab('discover')}
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
                plan={activePlan}
                style={selectedStyle}
                savedStyles={history
                  .filter((e) => e.product.id === selectedProduct.id && Boolean(e.plan))
                  .map((e) => e.plan!.style)}
                isGenerating={isGeneratingPlan}
                isEnrichingProduct={isEnrichingProduct}
                isAnalyzingProduct={isAnalyzingProduct}
                enrichError={enrichError}
                analysisError={analysisError}
                error={planError}
                cameFromHistory={cameFromHistory}
                language={language}
                nowMs={evaluationNowMs}
                kalodataStatus={kalodataStatus}
                kalodataLimits={kalodataLimits}
                t={t}
                onBack={() => setActiveTab(cameFromHistory ? 'history' : 'discover')}
                onToggleSave={handleToggleSaveProduct}
                onSelectStyle={handleStyleChange}
                onConfirmGenerate={handleConfirmGeneratePlan}
                onFetchDeepInsights={handleFetchProductDeepInsights}
                onAnalyzeProduct={handleAnalyzeProduct}
                onOpenScoreDetails={setScoreDialogProduct}
              />
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
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
                onGoDiscover={() => setActiveTab('discover')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Minimalist Score Details Dialog */}
      <ScoreDetailDialog
        product={scoreDialogProduct}
        language={language}
        nowMs={evaluationNowMs}
        t={t}
        onClose={() => setScoreDialogProduct(null)}
      />

      {/* Ephemeral Gallery Zoom HUD (shown briefly only while pinching / zooming grid) */}
      <AnimatePresence>
        {zoomHudText && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            aria-live="polite"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none px-3.5 py-1.5 rounded-xl bg-slate-900/90 dark:bg-slate-100/95 text-white dark:text-slate-950 text-xs font-mono-num font-semibold shadow-sm backdrop-blur-sm whitespace-nowrap"
          >
            {zoomHudText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimalist Non-Intrusive Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            role="status"
            className={`fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:max-w-sm z-50 px-4 py-3 rounded-xl text-sm font-medium border shadow-sm ${
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
