import type { ProductValidatedMetrics } from './types/metrics';
import type { CommercialScoreV2Result } from './types/scoringV2';
import type { ProductStrategyReportV2 } from './types/strategyV2';

export * from './types/metrics';
export * from './types/scoringV2';
export * from './types/strategyV2';

export type Language = 'my' | 'en';
export type Theme = 'light' | 'dark';
export type VisualStyle = 'cinematic' | 'asmr' | 'before_after' | 'problem_fix';
export type SearchDateRange = 'last7Day' | 'last30Day';
export type SearchSortBy = 'revenue' | 'growth';
export type ResultViewMode = 'grid' | 'list';
export type ResultGridCols = 1 | 2 | 3 | 4 | 5;
export type ResultListZoom = 0 | 1 | 2;
export type CardDensity = 'spacious' | 'standard' | 'compact' | 'micro';

export type CategoryKey =
  | 'all'
  | 'beauty'
  | 'home'
  | 'gadget'
  | 'fashion'
  | 'wellness'
  | 'pet';

export interface BilingualText {
  my: string;
  en: string;
}

export interface KalodataCategoryItem {
  id: string; // '' for All, or official TikTok Shop Thailand L1 Category ID (e.g. '601450')
  label: BilingualText;
  visualGroup: Exclude<CategoryKey, 'all'>;
  source: 'official' | 'kalodata_live';
}

export interface ProductDeepInsights {
  description?: string;
  highlights?: string[];
  painPoints?: string[];
  usageScenarios?: string[];
  fetchedDetails?: boolean;
  fetchedSpecs?: boolean;
  fetchedComments?: boolean;
  fetchedAt: string;
}

export interface ProductKalodataMetrics {
  salesVolume7d?: number | null;
  revenueThb7d?: number | null;
  videoRevenueThb7d?: number | null;
  liveRevenueThb7d?: number | null;
  shoppingMallRevenueThb7d?: number | null;
  revenueGrowthRate?: number | null;
  creatorCount?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  /** Verified daily THB revenue values (chronological oldest -> newest) from POST /tiktok/product/detail. */
  revenueTrendThb?: number[] | null;
  videoCount?: number | null;
  liveCount?: number | null;
  launchDate?: string | null;
  deliveryType?: string | null;
  dateRange?: string;
  fetchedAt?: string;
  /** Per-metric observation timestamps preserved when combining /rank and /detail responses (null = unknown). */
  metricTimestamps?: Partial<Record<string, string | null>>;
}

export type ProductAnalysisDecision = 'strong_go' | 'test_carefully' | 'need_more_data';

export type VideoIdeasPlaybookCategory =
  | 'problem_solving'
  | 'impulse_trendy'
  | 'aesthetic_lifestyle'
  | 'high_ticket_trust'
  | 'food_beverage';

export type VideoIdeasAwarenessLevel =
  | 'unaware'
  | 'problem_aware'
  | 'solution_aware'
  | 'product_aware'
  | 'most_aware';

export type VideoIdeasFramework = 'PAS' | 'BAB' | 'AIDA' | '3_REASONS_WHY';

export interface VideoIdeaHook3Layer {
  hookType: BilingualText;
  visualHook: BilingualText;
  verbalHook: BilingualText;
  textHook: BilingualText;
}

export interface VideoIdeaConcept {
  title: BilingualText;
  targetSegment: BilingualText;
  awarenessLevel: VideoIdeasAwarenessLevel;
  framework: VideoIdeasFramework;
  creativeAngle: BilingualText;
  ugcFormat: BilingualText;
  recommendedDuration: string;
  hook3Layer: VideoIdeaHook3Layer;
  bridgeHold: BilingualText;
  bodyPlan: BilingualText;
  ctaAction: BilingualText;
  muteTestVisual: BilingualText;
  extraHookVariations: {
    my: string[];
    en: string[];
  };
}

export interface VideoIdeasStrategyPack {
  playbookCategory: VideoIdeasPlaybookCategory;
  playbookReason: BilingualText;
  productAnalysis: {
    coreFeature: BilingualText;
    functionalBenefit: BilingualText;
    emotionalBenefit: BilingualText;
    coreUsp: BilingualText;
    visualProofIdea: BilingualText;
  };
  targetAudience: {
    primaryBuyer: BilingualText;
    painPointLadder: BilingualText;
    buyerVoiceInsight: BilingualText;
  };
  concepts: VideoIdeaConcept[];
  scalingPlan: {
    commentMiningIdeas: {
      my: string[];
      en: string[];
    };
    iterationRoadmap: BilingualText;
    watchOuts: {
      my: string[];
      en: string[];
    };
  };
}

export interface ProductAiAnalysis {
  analyzedAt: string;
  dataSnapshot: {
    hasSalesMetrics: boolean;
    hasDetails: boolean;
    hasSpecs: boolean;
    hasComments: boolean;
  };
  cleanName: BilingualText;
  /** New 13-lesson trained Video Ideas Strategy Pack (replaces legacy product audit UI). */
  videoIdeasPack?: VideoIdeasStrategyPack;
  /** Legacy fields kept optional/populated for backup & prompt backward compatibility. */
  productOverview: BilingualText;
  salesAndPricingAudit: BilingualText;
  profitCalculation: BilingualText;
  silentVideoVerdict: BilingualText;
  visualAngles: {
    my: string[];
    en: string[];
  };
  deepDataSpecsAudit: BilingualText;
  deepDataBuyerAudit: BilingualText;
  risks: {
    my: string[];
    en: string[];
  };
  missingDataNotes: {
    my: string[];
    en: string[];
  };
  decision: ProductAnalysisDecision;
  bottomLine: BilingualText;
}

export type ScoreGrade = 'top' | 'strong' | 'fair' | 'low';

export interface ProductScoreBreakdown {
  total: number;          // 0-100 rounded silent-visual composite score
  grade: ScoreGrade;      // top (>=85), strong (70-84), fair (55-69), low (<55)
  visualDemo: number;     // 0-100 (42% weight)
  aiSuitability: number;  // 0-100 (26% weight)
  salesDemand: number;    // 0-100 (18% weight)
  commissionValue: number;// 0-100 (14% weight)
  speechPenalty: number;  // 0-20 deducted points for verbal-explanation reliance
}

export interface ProductItem {
  id: string;
  thaiTitle: string;
  clearTitle: BilingualText;
  whatItIs: BilingualText;
  whySilentWorks: BilingualText;
  category: Exclude<CategoryKey, 'all'>;
  categoryLabel: BilingualText;
  kalodataCategoryId?: string;
  shopName: string;
  priceThb: number | null;
  commissionRate: number | null;
  commissionThb: number | null;
  imageUrl?: string;
  productUrl?: string;
  visualTags: string[];
  aiEnriched?: boolean;
  scoreBreakdown?: ProductScoreBreakdown;
  kalodataMetrics?: ProductKalodataMetrics;
  validatedMetrics?: ProductValidatedMetrics;
  commercialScoreV2?: CommercialScoreV2Result;
  strategyIntelligenceV2?: ProductStrategyReportV2;
  deepInsights?: ProductDeepInsights;
  aiAnalysis?: ProductAiAnalysis;
}

export interface VisualHook {
  title: BilingualText;
  visualAction: BilingualText;
  onScreenTextTh: string;
  onScreenTextMeaning: BilingualText;
}

export interface StoryboardShot {
  timeRange: string;
  sceneVisual: BilingualText;
  cameraMove: BilingualText;
  soundDesign: BilingualText;
  onScreenTextTh: string;
  onScreenTextMeaning: BilingualText;
}

export interface AiPromptItem {
  label: BilingualText;
  prompt: string;
}

export interface TikTokSeoPack {
  captionTh: string;
  captionMeaning: BilingualText;
  hashtags: string[];
  keywords: string[];
  postingTip: BilingualText;
}

export interface VideoAdPlan {
  id: string;
  productId: string;
  style: VisualStyle;
  createdAt: string;
  conceptTitle: BilingualText;
  conceptSummary: BilingualText;
  visualDirection: BilingualText;
  hooks: VisualHook[];
  storyboard: StoryboardShot[];
  aiVideoPrompts: AiPromptItem[];
  aiImagePrompts: AiPromptItem[];
  seo: TikTokSeoPack;
  masterVideoPrompt?: BilingualText;
  usedDeepInsights?: boolean;
}

export interface SavedHistoryEntry {
  id: string;
  savedAt: string;
  product: ProductItem;
  plan?: VideoAdPlan;
}

export interface KalodataCreditBalance {
  available: number | null;
  mainRemain?: number | null;
  subRemain?: number | null;
  accountType?: 'main' | 'sub';
  unit: string;
  checkedAt: string;
}

export interface KalodataStatus {
  connected: boolean;
  keySource: 'env' | 'ui' | 'none';
  maskedKey: string | null;
  balance: KalodataCreditBalance | null;
}

export interface ProductEnrichOptions {
  includeDetails: boolean;
  includeSpecs: boolean;
  includeComments: boolean;
  dateRange?: SearchDateRange;
}

export interface KalodataLimitSettings {
  maxSpendCredits: number | null;
  minBalanceReserve: number | null;
  trackedSpentCredits: number;
}

export interface RecentSearchEntry {
  id: string;
  searchedAt: string;
  query: string;
  cateIds: string[];
  cateLabels: BilingualText[];
  mode: 'rank' | 'single_link';
  products: ProductItem[];
  creditsUsed: number | null;
}

export interface SavedDeepInsightRecord {
  deepInsights: ProductDeepInsights;
  kalodataMetrics?: ProductKalodataMetrics;
  validatedMetrics?: ProductValidatedMetrics;
  shopName?: string;
  imageUrl?: string;
  savedAt: string;
}

export interface RankBoardCategoryMarketItem {
  id: string;
  label: BilingualText;
  visualGroup: Exclude<CategoryKey, 'all'>;
  revenueThb: number | null;
  salesVolume: number | null;
  productCountInTop100: number;
  marketSharePct: number;
  source: 'kalodata_category_rank' | 'top100_aggregate';
}

export interface RankBoardMarketSummary {
  totalRevenueThb: number;
  totalSalesVolume: number;
  videoRevenueThb: number;
  liveRevenueThb: number;
  shopRevenueThb: number;
  videoSharePct: number;
  liveSharePct: number;
  shopSharePct: number;
  avgCommissionRate: number | null;
  avgPayoutThb: number | null;
  monetizableCount: number;
  videoProvenCount: number;
  sweetSpotCount: number;
}

export interface RankBoardSnapshot {
  syncedAt: string;
  dateRange: SearchDateRange;
  products: ProductItem[];
  categoryMarket: RankBoardCategoryMarketItem[];
  marketSummary: RankBoardMarketSummary;
  creditsUsed: number | null;
  categorySource: 'kalodata_category_rank' | 'top100_aggregate';
}

export interface BackupPayload {
  app: 'SiamVisual';
  version: 1 | 2 | 3 | 4 | 5;
  exportedAt: string;
  entries: SavedHistoryEntry[];
  limits?: KalodataLimitSettings;
  recentSearches?: RecentSearchEntry[];
  deepInsightsCache?: Record<string, SavedDeepInsightRecord>;
  productAnalysisCache?: Record<string, ProductAiAnalysis>;
  productSnapshots?: Record<string, import('./types/metrics').ProductObservationSnapshot[]>;
  rankBoardSnapshot?: RankBoardSnapshot | null;
}


