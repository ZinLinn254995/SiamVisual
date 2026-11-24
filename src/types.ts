export type Language = 'my' | 'en';
export type Theme = 'light' | 'dark';
export type VisualStyle = 'cinematic' | 'asmr' | 'before_after' | 'problem_fix';
export type SearchDateRange = 'last7Day' | 'last30Day';
export type SearchSortBy = 'revenue' | 'growth';

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
  fetchedAt: string;
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
  shopName: string;
  priceThb: number | null;
  commissionRate: number | null;
  commissionThb: number | null;
  imageUrl?: string;
  productUrl?: string;
  visualTags: string[];
  aiEnriched?: boolean;
  scoreBreakdown?: ProductScoreBreakdown;
  deepInsights?: ProductDeepInsights;
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
  usedDeepInsights?: boolean;
}

export interface SavedHistoryEntry {
  id: string;
  savedAt: string;
  product: ProductItem;
  plan: VideoAdPlan;
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
  shopName?: string;
  imageUrl?: string;
  savedAt: string;
}

export interface BackupPayload {
  app: 'SiamVisual';
  version: 1 | 2 | 3;
  exportedAt: string;
  entries: SavedHistoryEntry[];
  limits?: KalodataLimitSettings;
  recentSearches?: RecentSearchEntry[];
  deepInsightsCache?: Record<string, SavedDeepInsightRecord>;
}
