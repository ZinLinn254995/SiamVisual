import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, Clock, Link2, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { HistoryView } from './components/HistoryView';
import { KalodataBar } from './components/KalodataBar';
import { ProductCard } from './components/ProductCard';
import { ScoreDetailDialog } from './components/ScoreDetailDialog';
import { type ActiveTab, TopBar } from './components/TopBar';
import { VideoStudioView } from './components/VideoStudioView';
import { TRANSLATIONS } from './i18n';
import {
  clearAllRecentSearches,
  exportHistoryBackup,
  hydrateProductFromStorage,
  hydrateProductsFromStorage,
  loadCachedCategories,
  loadDeepInsightsCache,
  loadKalodataLimits,
  loadLanguagePreference,
  loadRecentSearches,
  loadSavedHistory,
  loadThemePreference,
  mergeRestoredHistory,
  parseBackupFile,
  persistDeepInsightsCache,
  persistRecentSearches,
  removeHistoryEntry,
  removeRecentSearch,
  saveAiExplanationsForProducts,
  saveCachedCategories,
  saveDeepInsightForProduct,
  saveKalodataLimits,
  saveLanguagePreference,
  saveThemePreference,
  upsertHistoryEntry,
  upsertRecentSearch,
} from './lib/storage';
import type {
  BilingualText,
  KalodataCategoryItem,
  KalodataCreditBalance,
  KalodataLimitSettings,
  KalodataStatus,
  Language,
  ProductDeepInsights,
  ProductEnrichOptions,
  ProductItem,
  RecentSearchEntry,
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

  // Search state: Keyword / Link + Multiple Categories (0 auto-search)
  const [query, setQuery] = useState<string>(() => initialLatestSearch?.query ?? '');
  const [selectedCateIds, setSelectedCateIds] = useState<string[]>(
    () => initialLatestSearch?.cateIds ?? []
  );

  // Search results state (auto-restores latest browser-saved search on reload at 0 cr)
  const [hasSearched, setHasSearched] = useState<boolean>(() => Boolean(initialLatestSearch));
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductItem[]>(() =>
    hydrateProductsFromStorage(initialLatestSearch?.products ?? [])
  );
  const [lastSearchMode, setLastSearchMode] = useState<'rank' | 'single_link'>(
    () => initialLatestSearch?.mode ?? 'rank'
  );
  const [lastSearchCreditsUsed, setLastSearchCreditsUsed] = useState<number | null>(
    () => initialLatestSearch?.creditsUsed ?? null
  );
  const [lastSearchFromCache, setLastSearchFromCache] = useState(false);
  const [explainingProductIds, setExplainingProductIds] = useState<string[]>([]);
  const [isExplainingAll, setIsExplainingAll] = useState(false);
  const [scoreDialogProduct, setScoreDialogProduct] = useState<ProductItem | null>(null);

  // Studio state
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<VisualStyle>('cinematic');
  const [activePlan, setActivePlan] = useState<VideoAdPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isEnrichingProduct, setIsEnrichingProduct] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [cameFromHistory, setCameFromHistory] = useState(false);

  // Local history state
  const [history, setHistory] = useState<SavedHistoryEntry[]>(() => loadSavedHistory());
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    tone: 'neutral' | 'error';
  } | null>(null);

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

  function showToast(text: string, tone: 'neutral' | 'error' = 'neutral') {
    setToastMessage({ text, tone });
    setTimeout(() => {
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

  function handleRestoreRecentSearch(entry: RecentSearchEntry) {
    const hydrated = hydrateProductsFromStorage(entry.products);
    setQuery(entry.query);
    setSelectedCateIds(entry.cateIds);
    setProducts(hydrated);
    setLastSearchMode(entry.mode);
    setLastSearchCreditsUsed(entry.creditsUsed);
    setLastSearchFromCache(false);
    setRestoredFromBrowser(true);
    setHasSearched(true);
    setSearchError(null);
    setActiveRecentId(entry.id);
  }

  function handleRemoveRecentSearch(searchId: string) {
    setRecentSearches((prev) => removeRecentSearch(prev, searchId));
    if (activeRecentId === searchId) {
      setActiveRecentId(null);
    }
  }

  function handleClearRecentSearches() {
    setRecentSearches(clearAllRecentSearches());
    setActiveRecentId(null);
    setRestoredFromBrowser(false);
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
        setCategories(data.categories);
        saveCachedCategories(data.categories);
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

  async function runProductSearch(forceRefresh = false) {
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
      const response = await fetch('/api/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          cateIds: linkInfo.isLinkOrId ? [] : selectedCateIds,
          forceRefresh,
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

      const rawFetched = Array.isArray(data.products) ? data.products : [];
      // Persist any single-link Seller description into permanent Deep Insights cache too
      for (const item of rawFetched) {
        if (item.deepInsights?.description) {
          saveDeepInsightForProduct(item.id, {
            deepInsights: item.deepInsights,
            shopName: item.shopName,
            imageUrl: item.imageUrl,
          });
        }
      }
      const hydratedProducts = hydrateProductsFromStorage(rawFetched).sort(
        (a, b) => (b.scoreBreakdown?.total ?? 0) - (a.scoreBreakdown?.total ?? 0)
      );

      const resolvedMode: 'rank' | 'single_link' =
        data.mode === 'single_link' ? 'single_link' : 'rank';
      const fromCache = data.fromCache === true;
      const used = typeof data.creditsUsed === 'number' ? data.creditsUsed : null;

      setProducts(hydratedProducts);
      setLastSearchFromCache(fromCache);
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

      if (!fromCache) {
        const spentDelta = used !== null ? used : LEAN_SEARCH_COST;
        recordSpentCredits(spentDelta);
      }
    } catch (err) {
      setProducts([]);
      setSearchError(err instanceof Error ? err.message : 'Unable to search right now.');
    } finally {
      setIsSearching(false);
    }
  }

  // Manual per-product AI explanation (0 Kalodata credits)
  async function handleExplainSingleProduct(target: ProductItem) {
    if (explainingProductIds.includes(target.id)) return;
    setExplainingProductIds((prev) => [...prev, target.id]);
    try {
      const response = await fetch('/api/products/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: [target] }),
      });
      const data = await parseApiJson<{ products?: ProductItem[]; error?: string }>(
        response,
        language
      );
      if (!response.ok || !Array.isArray(data.products) || data.products.length === 0) {
        throw new Error(data.error || 'Could not generate AI explanation.');
      }
      const explained = hydrateProductFromStorage(data.products[0]);
      saveAiExplanationsForProducts([explained]);

      setProducts((prev) => {
        const nextList = prev.map((item) => (item.id === explained.id ? explained : item));
        syncUpdatedProductsToActiveRecent(nextList);
        return nextList;
      });
      setSelectedProduct((prev) => (prev && prev.id === explained.id ? explained : prev));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI explanation failed.', 'error');
    } finally {
      setExplainingProductIds((prev) => prev.filter((id) => id !== target.id));
    }
  }

  // Manual batch AI explanation for all un-explained products in current results (0 Kalodata credits)
  async function handleExplainAllProducts() {
    const pending = products.filter((p) => !p.aiEnriched);
    if (pending.length === 0 || isExplainingAll) return;
    setIsExplainingAll(true);
    try {
      const response = await fetch('/api/products/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: pending }),
      });
      const data = await parseApiJson<{ products?: ProductItem[]; error?: string }>(
        response,
        language
      );
      if (!response.ok || !Array.isArray(data.products)) {
        throw new Error(data.error || 'Could not generate AI explanations.');
      }
      const explainedHydrated = hydrateProductsFromStorage(data.products);
      saveAiExplanationsForProducts(explainedHydrated);
      const map = new Map(explainedHydrated.map((p) => [p.id, p]));

      setProducts((prev) => {
        const nextList = prev
          .map((item) => map.get(item.id) ?? item)
          .sort((a, b) => (b.scoreBreakdown?.total ?? 0) - (a.scoreBreakdown?.total ?? 0));
        syncUpdatedProductsToActiveRecent(nextList);
        return nextList;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI explanation failed.', 'error');
    } finally {
      setIsExplainingAll(false);
    }
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    runProductSearch(false);
  }

  async function requestVideoPlan(
    product: ProductItem,
    style: VisualStyle,
    forceFresh = false
  ) {
    if (!forceFresh) {
      const cached = history.find(
        (entry) => entry.product.id === product.id && entry.plan.style === style
      );
      if (cached) {
        setActivePlan(cached.plan);
        setPlanError(null);
        setIsGeneratingPlan(false);
        return;
      }
    }

    setIsGeneratingPlan(true);
    setPlanError(null);
    setActivePlan(null);

    try {
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, style }),
      });

      const data = await parseApiJson<{ plan?: VideoAdPlan; error?: string }>(
        response,
        language
      );
      if (!response.ok || !data.plan) {
        throw new Error(data.error || 'Unable to generate video plan right now.');
      }

      const generatedPlan = data.plan;
      setActivePlan(generatedPlan);

      const newEntry: SavedHistoryEntry = {
        id: generatedPlan.id,
        savedAt: generatedPlan.createdAt,
        product,
        plan: generatedPlan,
      };
      setHistory((prev) => upsertHistoryEntry(prev, newEntry));
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Unable to generate video plan right now.');
    } finally {
      setIsGeneratingPlan(false);
    }
  }

  async function handleFetchProductDeepInsights(options: ProductEnrichOptions) {
    if (!selectedProduct) return;
    setIsEnrichingProduct(true);
    setEnrichError(null);
    try {
      const response = await fetch('/api/products/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          options,
          minBalanceReserve: kalodataLimits.minBalanceReserve,
          maxSpendRemaining,
        }),
      });
      const data = await parseApiJson<{
        deepInsights?: ProductDeepInsights;
        shopName?: string;
        imageUrl?: string;
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

      // Permanently save fetched Kalodata Deep Data into browser localStorage (never auto-generates Video Ideas!)
      const savedRecord = saveDeepInsightForProduct(selectedProduct.id, {
        deepInsights: data.deepInsights,
        shopName: data.shopName,
        imageUrl: data.imageUrl,
      });

      const upgradedProduct: ProductItem = {
        ...selectedProduct,
        shopName: savedRecord.shopName || selectedProduct.shopName,
        imageUrl: savedRecord.imageUrl || selectedProduct.imageUrl,
        deepInsights: savedRecord.deepInsights,
      };

      setSelectedProduct(upgradedProduct);
      setProducts((prev) => {
        const nextList = prev.map((item) =>
          item.id === upgradedProduct.id ? upgradedProduct : item
        );
        syncUpdatedProductsToActiveRecent(nextList);
        return nextList;
      });

      showToast(t.studio.deepUpgradedToast, 'neutral');
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : 'Unable to enrich product.');
    } finally {
      setIsEnrichingProduct(false);
    }
  }

  function findSavedPlanFor(productId: string, style: VisualStyle): VideoAdPlan | null {
    const found = history.find(
      (entry) => entry.product.id === productId && entry.plan.style === style
    );
    return found ? found.plan : null;
  }

  // Opens Video Studio cleanly — NEVER auto-generates Video Ideas!
  function handleSelectProduct(product: ProductItem) {
    const hydrated = hydrateProductFromStorage(product);
    const defaultStyle: VisualStyle = 'cinematic';
    const existingSavedPlan = findSavedPlanFor(hydrated.id, defaultStyle);

    setSelectedProduct(hydrated);
    setSelectedStyle(defaultStyle);
    setActivePlan(existingSavedPlan);
    setPlanError(null);
    setEnrichError(null);
    setIsGeneratingPlan(false);
    setCameFromHistory(false);
    setActiveTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleOpenHistoryEntry(entry: SavedHistoryEntry) {
    const hydrated = hydrateProductFromStorage(entry.product);
    setSelectedProduct(hydrated);
    setSelectedStyle(entry.plan.style);
    setActivePlan(entry.plan);
    setPlanError(null);
    setEnrichError(null);
    setIsGeneratingPlan(false);
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
      if (parsed.deepInsightsCache) {
        const mergedDeepCache = {
          ...loadDeepInsightsCache(),
          ...parsed.deepInsightsCache,
        };
        persistDeepInsightsCache(mergedDeepCache);
      }
      if (parsed.recentSearches && parsed.recentSearches.length > 0) {
        setRecentSearches(parsed.recentSearches);
        persistRecentSearches(parsed.recentSearches);
      }
      showToast(t.history.restoreSuccessCount(addedCount, merged.length), 'neutral');
    } catch {
      showToast(t.history.restoreError, 'error');
    }
  }

  const hasLiveSyncedCategories = categories.some((c) => c.source === 'kalodata_live');
  const isSingleLinkValid = linkInfo.isLinkOrId && Boolean(linkInfo.productId);
  const isLinkBroken = linkInfo.isLinkOrId && !linkInfo.productId;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B1117] text-[#0F172A] dark:text-[#F1F5F9] transition-colors duration-200">
      <TopBar
        activeTab={activeTab}
        onNavigate={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        language={language}
        onToggleLanguage={() => setLanguage((prev) => (prev === 'my' ? 'en' : 'my'))}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        savedCount={history.length}
        kalodataStatus={kalodataStatus}
        kalodataLimits={kalodataLimits}
        isKalodataPanelOpen={isKalodataPanelOpen}
        onToggleKalodataPanel={() => setIsKalodataPanelOpen((prev) => !prev)}
        t={t}
      />

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
              <section className="max-w-3xl mx-auto">
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

                {/* Minimal Classic Search Box (Default Best Matches / Keyword / Multi-Category / Product Link) */}
                <form
                  onSubmit={handleSearchSubmit}
                  className="bg-white dark:bg-[#131B24] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <div className="relative flex-1 flex items-center">
                      {linkInfo.isLinkOrId ? (
                        <Link2 className="w-4 h-4 text-teal-600 dark:text-teal-400 absolute left-3.5 pointer-events-none" />
                      ) : (
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                      )}
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t.search.placeholder}
                        className="w-full h-11 pl-10 pr-9 rounded-xl bg-transparent text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                      />
                      {query && (
                        <button
                          type="button"
                          onClick={() => setQuery('')}
                          aria-label="Clear search"
                          className="absolute right-2 h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSearching || Boolean(searchLimitWarning) || isLinkBroken}
                      className="h-11 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-sm font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 disabled:opacity-55 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      {isSearching
                        ? t.search.searchingButton
                        : `${
                            isSingleLinkValid ? t.search.searchSingleButton : t.search.searchButton
                          } (~${LEAN_SEARCH_COST} cr)`}
                    </button>
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
                      {linkInfo.isShortLink ? t.search.shortLinkNotice : t.search.invalidLinkNotice}
                    </div>
                  )}
                </form>

                {/* Multi-Select Official Thailand TikTok Shop Categories (0 Credits until Search) */}
                <div
                  className={`mt-4 transition-opacity duration-150 ${
                    linkInfo.isLinkOrId ? 'opacity-45 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {categories.map((cat) => {
                      const isAll = !cat.id;
                      const isSelected = isAll
                        ? selectedCateIds.length === 0
                        : selectedCateIds.includes(cat.id);

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
                        </button>
                      );
                    })}
                  </div>

                  {/* Subtle Footer Row: Multi-Category Selection Info + Optional Live Sync */}
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

                {searchLimitWarning && (
                  <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400">
                    {searchLimitWarning}
                  </p>
                )}

                {/* Minimalist Auto-Saved Recent Searches Strip (0 cr instant recall from Browser Storage) */}
                {recentSearches.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800/80">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0">
                          {t.recent.heading}
                        </span>
                        <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
                          ·
                        </span>
                        <span className="hidden sm:inline truncate text-[11px]">
                          {t.recent.savedLocallyTag}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearRecentSearches}
                        className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {t.recent.clearAll}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {recentSearches.map((entry) => {
                        const isActive = activeRecentId === entry.id && hasSearched;
                        const labelText =
                          entry.mode === 'single_link'
                            ? `${t.recent.linkLabel}: ${entry.products[0]?.clearTitle[language] || entry.query}`
                            : entry.query
                              ? entry.cateLabels.length > 0
                                ? `${entry.query} · ${entry.cateLabels.map((l) => l[language]).join(', ')}`
                                : entry.query
                              : entry.cateLabels.length > 0
                                ? entry.cateLabels.map((l) => l[language]).join(', ')
                                : t.recent.defaultBestLabel;

                        return (
                          <div
                            key={entry.id}
                            className={`inline-flex items-center rounded-lg border transition-colors max-w-full ${
                              isActive
                                ? 'bg-teal-50/80 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800 text-teal-900 dark:text-teal-200'
                                : 'bg-white dark:bg-[#131B24] border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleRestoreRecentSearch(entry)}
                              className="h-8 pl-2.5 pr-1.5 text-xs inline-flex items-center gap-1.5 min-w-0 max-w-[240px] sm:max-w-[280px] cursor-pointer"
                              title={labelText}
                            >
                              <span className="truncate font-medium">{labelText}</span>
                              <span className="font-mono-num text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                                ({t.recent.itemsCount(entry.products.length)})
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRecentSearch(entry.id)}
                              aria-label={t.recent.removeAria}
                              className="h-8 w-7 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* Results / Loading / Error Area */}
              <section className="mt-8 sm:mt-10">
                {isSearching ? (
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">
                      {isSingleLinkValid ? t.discover.loadingSingleNote : t.discover.loadingNote}
                    </p>
                    <div
                      className={`grid gap-6 ${
                        isSingleLinkValid
                          ? 'grid-cols-1 max-w-md mx-auto'
                          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                      }`}
                    >
                      {(isSingleLinkValid ? [1] : [1, 2, 3, 4, 5, 6]).map((slot) => (
                        <div
                          key={slot}
                          className="rounded-xl bg-white dark:bg-[#131B24] border border-slate-200/80 dark:border-slate-800 overflow-hidden"
                        >
                          <div className="aspect-[4/3] bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
                          <div className="p-5 space-y-3">
                            <div className="h-3 w-28 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
                            <div className="h-5 w-4/5 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
                            <div className="h-3 w-2/3 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
                            <div className="h-12 w-full rounded bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
                            <div className="h-10 w-full rounded-lg bg-slate-200/70 dark:bg-slate-800/70 animate-pulse mt-4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : searchError ? (
                  <div className="max-w-lg mx-auto p-6 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-center">
                    <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
                      {searchError}
                    </p>
                    {kalodataStatus.connected && !searchLimitWarning && !isLinkBroken && (
                      <button
                        type="button"
                        onClick={() => runProductSearch(false)}
                        className="mt-4 h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium cursor-pointer"
                      >
                        {t.discover.retry}
                      </button>
                    )}
                  </div>
                ) : hasSearched ? (
                  products.length > 0 ? (
                    <div>
                      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                        <div>
                          <h2 className="font-display text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
                            {lastSearchMode === 'single_link'
                              ? t.discover.singleResultHeading
                              : `${t.discover.resultsHeading} (${products.length})`}
                          </h2>
                          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            {lastSearchMode === 'single_link'
                              ? t.discover.singleResultSubtext
                              : t.discover.resultsSubtext}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono-num text-slate-500 dark:text-slate-400 shrink-0">
                          {products.some((p) => !p.aiEnriched) && (
                            <button
                              type="button"
                              disabled={isExplainingAll}
                              onClick={handleExplainAllProducts}
                              className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B24] hover:border-teal-400 dark:hover:border-teal-600 text-slate-700 dark:text-slate-200 font-sans text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-55"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                              <span>
                                {isExplainingAll ? t.card.explainingAllBtn : t.card.explainAllBtn}
                              </span>
                            </button>
                          )}

                          {restoredFromBrowser ? (
                            <>
                              <span className="text-teal-700 dark:text-teal-400 font-medium">
                                {t.recent.loadedFromStorageNote}
                              </span>
                              {kalodataStatus.connected && (
                                <button
                                  type="button"
                                  disabled={Boolean(searchLimitWarning)}
                                  onClick={() => runProductSearch(true)}
                                  className="font-sans font-medium text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 underline cursor-pointer disabled:opacity-50"
                                >
                                  {t.discover.refreshLiveBtn}
                                </button>
                              )}
                            </>
                          ) : lastSearchFromCache ? (
                            <>
                              <span className="text-teal-700 dark:text-teal-400 font-medium">
                                {t.discover.cachedNote}
                              </span>
                              <button
                                type="button"
                                disabled={Boolean(searchLimitWarning)}
                                onClick={() => runProductSearch(true)}
                                className="font-sans font-medium text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 underline cursor-pointer disabled:opacity-50"
                              >
                                {t.discover.refreshLiveBtn}
                              </button>
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

                      <div
                        className={`grid gap-6 ${
                          products.length === 1
                            ? 'grid-cols-1 max-w-md mx-auto'
                            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        }`}
                      >
                        {products.map((product, index) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            index={index}
                            language={language}
                            isSaved={savedProductIds.has(product.id)}
                            isExplaining={explainingProductIds.includes(product.id)}
                            t={t}
                            onSelect={handleSelectProduct}
                            onOpenScoreDetails={setScoreDialogProduct}
                            onExplainSingle={handleExplainSingleProduct}
                          />
                        ))}
                      </div>
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
                ) : null}
              </section>
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
                plan={activePlan}
                style={selectedStyle}
                savedStyles={history
                  .filter((e) => e.product.id === selectedProduct.id)
                  .map((e) => e.plan.style)}
                isGenerating={isGeneratingPlan}
                isEnrichingProduct={isEnrichingProduct}
                isExplainingProduct={explainingProductIds.includes(selectedProduct.id)}
                enrichError={enrichError}
                error={planError}
                cameFromHistory={cameFromHistory}
                language={language}
                kalodataStatus={kalodataStatus}
                kalodataLimits={kalodataLimits}
                t={t}
                onBack={() => setActiveTab(cameFromHistory ? 'history' : 'discover')}
                onSelectStyle={handleStyleChange}
                onConfirmGenerate={handleConfirmGeneratePlan}
                onFetchDeepInsights={handleFetchProductDeepInsights}
                onExplainProduct={() => handleExplainSingleProduct(selectedProduct)}
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
                language={language}
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
        t={t}
        onClose={() => setScoreDialogProduct(null)}
      />

      {/* Minimalist Non-Intrusive Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            role="status"
            className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl text-sm font-medium border shadow-sm ${
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
