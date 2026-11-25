import { ThinkingLevel, Type } from '@google/genai';
import type {
  CategoryKey,
  KalodataCreditBalance,
  ProductAiAnalysis,
  ProductAnalysisDecision,
  ProductItem,
  VideoAdPlan,
  VisualStyle,
} from '../src/types.ts';
import {
  inferSpecificProductCategory,
  translateCategoryNameToMyanmar,
} from '../src/lib/categoryTranslations.ts';
import { adaptProductItemToValidatedMetrics } from '../src/lib/metricFoundation.ts';
import { sortProductsByV2Overall } from '../src/lib/productIntelligenceView.ts';
import { evaluateProductCommercialV2 } from '../src/lib/scoringEngineV2.ts';
import { evaluateProductStrategiesV2 } from '../src/lib/strategyEngineV2.ts';
import {
  generateStructuredJsonStream,
  sanitizeExternalUrl,
} from './gemini.ts';
import {
  type CreditGuardrails,
  fetchKalodataThailandProducts,
  fetchSingleKalodataProductById,
  KalodataApiError,
  type KalodataRawProduct,
  OFFICIAL_TH_CATEGORIES,
  parseProductLinkInput,
} from './kalodata.ts';
import {
  computeDirectKalodataScore,
  rankSilentVisualProducts,
  type ScoredCandidate,
} from './scoreEngine.ts';

const VALID_CATEGORIES = ['beauty', 'home', 'gadget', 'fashion', 'wellness', 'pet'] as const;

const CATEGORY_LABELS: Record<Exclude<CategoryKey, 'all'>, { my: string; en: string }> = {
  beauty: { my: 'အလှကုန်နှင့် အသားအရေ', en: 'Beauty & Personal Care' },
  home: { my: 'အိမ်သုံးနှင့် မီးဖိုချောင်', en: 'Home & Kitchen' },
  gadget: { my: 'ဖုန်းနှင့် စမတ်ပစ္စည်း', en: 'Phones & Gadgets' },
  fashion: { my: 'ဖက်ရှင်နှင့် အသုံးအဆောင်', en: 'Fashion & Apparel' },
  wellness: { my: 'ကျန်းမာရေးနှင့် နေထိုင်မှု', en: 'Health & Wellness' },
  pet: { my: 'အိမ်မွေးတိရစ္ဆာန်သုံး', en: 'Pet Supplies' },
};

const KNOWN_CATE_ID_GROUP: Record<string, Exclude<CategoryKey, 'all'>> = {
  '601450': 'beauty',
  '600001': 'home',
  '600024': 'home',
  '601739': 'gadget',
  '601152': 'fashion',
  '700645': 'wellness',
  '602118': 'pet',
  '605196': 'gadget',
  '824328': 'fashion',
  '601226': 'fashion',
  '601352': 'fashion',
  '601303': 'fashion',
  '700437': 'wellness',
  '603014': 'wellness',
  '602284': 'wellness',
  '600942': 'gadget',
};

function normalizeCategory(
  raw: string,
  fallback: Exclude<CategoryKey, 'all'>,
  thaiTitle = '',
  rawCategoryId?: string
): Exclude<CategoryKey, 'all'> {
  if (rawCategoryId && KNOWN_CATE_ID_GROUP[rawCategoryId]) {
    return KNOWN_CATE_ID_GROUP[rawCategoryId];
  }
  const combined = `${raw} ${thaiTitle}`.toLowerCase();
  if (
    /beaut|skin|cosmet|hair|personal care|serum|cream|lip|sunscreen|shampoo|makeup|perfume|เซรั่ม|ครีม|ลิป|กันแดด|แชมพู|สบู่|มาส์ก|สกินแคร์|บำรุงผิว|ผิวหน้า|เครื่องสำอาง|น้ำหอม|ยาสระผม/.test(
      combined
    )
  ) {
    return 'beauty';
  }
  if (/pet|cat|dog|แมว|หมา|สุนัข|สัตว์เลี้ยง|ทรายแมว|อาหารแมว|อาหารสุนัข/.test(combined)) {
    return 'pet';
  }
  if (
    /fash|bag|cloth|wear|shoe|jewel|dress|shirt|pant|bra|underwear|เสื้อ|กางเกง|เดรส|กระโปรง|ชุดชั้นใน|บรา|รองเท้า|กระเป๋า|แฟชั่น|หมวก|แว่นตา|นาฬิกา/.test(
      combined
    )
  ) {
    return 'fashion';
  }
  if (
    /gadget|tech|elec|phone|auto|moto|appliance|charger|earbud|bluetooth|powerbank|camera|fan|vacuum|โทรศัพท์|มือถือ|เคส|สายชาร์จ|หูฟัง|พาวเวอร์แบงค์|ลำโพง|พัดลม|กล้อง|รถยนต์|มอเตอร์ไซค์|เครื่องดูดฝุ่น|ไดร์เป่าผม/.test(
      combined
    )
  ) {
    return 'gadget';
  }
  if (
    /well|health|massag|vitamin|collagen|supplement|food|beverage|snack|coffee|tea|baby|maternity|sport|fitness|วิตามิน|คอลลาเจน|อาหารเสริม|สุขภาพ|กาแฟ|ชา|ขนม|โปรตีน|นวด|เด็ก|ทารก|ผ้าอ้อม|กีฬา|ออกกำลังกาย/.test(
      combined
    )
  ) {
    return 'wellness';
  }
  if (
    /home|kitchen|clean|decor|furniture|bedding|pillow|towel|tool|hardware|ครัว|กระทะ|หม้อ|แก้ว|ขวดน้ำ|ทำความสะอาด|ชั้นวาง|ผ้าปู|หมอน|ผ้าห่ม|เฟอร์นิเจอร์|โต๊ะ|เก้าอี้|สว่าน|หลอดไฟ/.test(
      combined
    )
  ) {
    return 'home';
  }
  if ((VALID_CATEGORIES as readonly string[]).includes(fallback)) {
    return fallback;
  }
  return 'home';
}

function resolveVisualGroupFromCateIds(cateIds: string[]): Exclude<CategoryKey, 'all'> {
  if (cateIds.length === 1) {
    const found = OFFICIAL_TH_CATEGORIES.find((c) => c.id && c.id === cateIds[0]);
    if (found) return found.visualGroup;
  }
  return 'home';
}

interface RawAiEnrichment {
  id: string;
  clearTitleMy: string;
  clearTitleEn: string;
  whatItIsMy: string;
  whatItIsEn: string;
  whySilentWorksMy: string;
  whySilentWorksEn: string;
  category: string;
  visualTags: string[];
  visualDemoStrength: number;
  aiVideoSuitability: number;
  salesMomentum: number;
  needsExplanationPenalty: number;
}

const enrichmentListSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: 'Exact product id from the Kalodata input list.' },
      clearTitleMy: { type: Type.STRING, description: 'Short, natural, crystal-clear product name in Myanmar language.' },
      clearTitleEn: { type: Type.STRING, description: 'Short, clear product name in English.' },
      whatItIsMy: {
        type: Type.STRING,
        description: 'Plain-language 2-sentence Myanmar explanation of what this Thai product actually is and how it is used.',
      },
      whatItIsEn: {
        type: Type.STRING,
        description: 'Plain-language 2-sentence English explanation of what this Thai product actually is and how it is used.',
      },
      whySilentWorksMy: {
        type: Type.STRING,
        description: '1 concise sentence in Myanmar explaining the visual hook that sells it without any talking.',
      },
      whySilentWorksEn: {
        type: Type.STRING,
        description: '1 concise sentence in English explaining the visual hook that sells it without any talking.',
      },
      category: {
        type: Type.STRING,
        description: 'One of: beauty, home, gadget, fashion, wellness, pet',
      },
      visualTags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '2-3 short English visual traits like Macro Texture, Instant Before-After, ASMR Sound.',
      },
      visualDemoStrength: { type: Type.NUMBER, description: '0-100 score for selling with zero spoken words.' },
      aiVideoSuitability: { type: Type.NUMBER, description: '0-100 score for clean AI visual video generation.' },
      salesMomentum: { type: Type.NUMBER, description: '0-100 Thailand TikTok Shop sales momentum based on Kalodata metrics.' },
      needsExplanationPenalty: { type: Type.NUMBER, description: '0-40 penalty if product needs verbal explanation.' },
    },
    required: [
      'id',
      'clearTitleMy',
      'clearTitleEn',
      'whatItIsMy',
      'whatItIsEn',
      'whySilentWorksMy',
      'whySilentWorksEn',
      'category',
      'visualTags',
      'visualDemoStrength',
      'aiVideoSuitability',
      'salesMomentum',
      'needsExplanationPenalty',
    ],
  },
};

export interface KalodataProductSearchOutput {
  products: ProductItem[];
  creditsUsed: number | null;
  fromCache: boolean;
  mode: 'rank' | 'single_link';
  aiEnrichmentFailed: boolean;
  balance: KalodataCreditBalance | null;
}

function buildScoredKalodataItem(
  raw: KalodataRawProduct,
  _fallbackGroup: Exclude<CategoryKey, 'all'>,
  searchedCateMeta?: { id: string; my?: string; en?: string }
): ProductItem {
  const effectiveCateId = raw.rawCategoryId || searchedCateMeta?.id || undefined;
  const inferred = inferSpecificProductCategory({
    categoryId: effectiveCateId,
    categoryHint: raw.categoryHint,
    thaiTitle: raw.thaiTitle,
    shopName: raw.shopName,
  });

  // If the user explicitly searched a single live-synced category and Kalodata omitted category_name on the row,
  // use the exact searched category's localized label so every item reflects that real category.
  const categoryLabel =
    raw.categoryHint
      ? inferred.label
      : searchedCateMeta?.en
        ? {
            my:
              searchedCateMeta.my && /[\u1000-\u109F]/.test(searchedCateMeta.my)
                ? searchedCateMeta.my
                : translateCategoryNameToMyanmar(searchedCateMeta.en, searchedCateMeta.id),
            en: searchedCateMeta.en,
          }
        : inferred.label;

  const normalizedCat = inferred.visualGroup;

  const priceThb = raw.priceThb;
  const commissionRate = raw.commissionRate;
  const commissionThb =
    priceThb !== null && commissionRate !== null
      ? commissionRate === 0
        ? 0
        : Math.round(priceThb * commissionRate) / 100
      : null;

  const imageUrl = sanitizeExternalUrl(raw.imageUrl);
  const scoreBreakdown = computeDirectKalodataScore({
    thaiTitle: raw.thaiTitle,
    category: normalizedCat,
    priceThb,
    commissionRate,
    commissionThb,
    salesVolume7d: raw.salesVolume7d,
    revenueThb7d: raw.revenueThb7d,
    videoRevenueThb7d: raw.videoRevenueThb7d,
    revenueGrowthRate: raw.revenueGrowthRate,
    hasImage: Boolean(imageUrl),
  });

  const commercialV2 = evaluateProductCommercialV2(raw.validatedMetrics);

  return {
    id: raw.id,
    thaiTitle: raw.thaiTitle,
    clearTitle: {
      my: raw.thaiTitle,
      en: raw.thaiTitle,
    },
    whatItIs: {
      my: '',
      en: '',
    },
    whySilentWorks: {
      my: '',
      en: '',
    },
    category: normalizedCat,
    categoryLabel,
    ...(effectiveCateId ? { kalodataCategoryId: effectiveCateId } : {}),
    shopName: raw.shopName,
    priceThb,
    commissionRate,
    commissionThb,
    imageUrl,
    productUrl: sanitizeExternalUrl(raw.productUrl),
    visualTags: [],
    aiEnriched: false,
    scoreBreakdown,
    kalodataMetrics: raw.kalodataMetrics,
    validatedMetrics: raw.validatedMetrics,
    commercialScoreV2: commercialV2,
    strategyIntelligenceV2: evaluateProductStrategiesV2(raw.validatedMetrics, commercialV2),
    ...(raw.description || raw.validatedMetrics.sourceEndpoint === 'detail'
      ? {
          deepInsights: {
            ...(raw.description ? { description: raw.description } : {}),
            ...(raw.validatedMetrics.sourceEndpoint === 'detail' ? { fetchedDetails: true } : {}),
            fetchedAt: raw.validatedMetrics.fetchedAt ?? new Date().toISOString(),
          },
        }
      : {}),
  };
}



async function enrichChunkWithGemini(
  chunk: KalodataRawProduct[]
): Promise<RawAiEnrichment[]> {
  const enrichPrompt = `You are a Thailand TikTok Shop affiliate specialist and silent-video creative director helping a Myanmar & English creator understand real Kalodata Thailand TikTok Shop products.

Real Kalodata Thailand TikTok Shop Products (JSON):
${JSON.stringify(
  chunk.map((p) => ({
    id: p.id,
    thaiTitle: p.thaiTitle,
    shopName: p.shopName,
    priceThb: p.priceThb,
    commissionRate: p.commissionRate,
    salesVolume7d: p.salesVolume7d,
    revenueThb7d: p.revenueThb7d,
    videoRevenueThb7d: p.videoRevenueThb7d,
    revenueGrowthRate: p.revenueGrowthRate,
    categoryHint: p.categoryHint,
    ...(p.description ? { description: p.description } : {}),
  }))
)}

Task:
For EVERY product in the JSON list above (keep the exact same "id"), return a JSON array with:
1. Natural, crystal-clear, concise Myanmar (clearTitleMy, whatItIsMy, whySilentWorksMy) and English (clearTitleEn, whatItIsEn, whySilentWorksEn) explanations so the creator immediately understands what the Thai product actually is in 3 seconds. Keep each explanation crisp (1-2 short sentences).
2. Honest silent-visual scoring signals for ZERO-SPEECH (no talking, no voiceover) AI visual videos:
   - visualDemoStrength (0-100): high (80-98) if the product sells purely by seeing it work (texture, glow, cleaning, before/after, clever mechanism).
   - aiVideoSuitability (0-100): high if clean studio/macro/cinematic visuals showcase it easily.
   - salesMomentum (0-100): based on the Kalodata sales, video revenue & growth figures.
   - needsExplanationPenalty (0-40): higher if the product requires spoken explanation.
Do NOT invent new products. Only evaluate the exact Kalodata product IDs provided.`;

  const parsed = await generateStructuredJsonStream<RawAiEnrichment[]>({
    contents: enrichPrompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: enrichmentListSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
    timeoutMs: 35000,
    label: 'AI_ENRICH',
  });

  return Array.isArray(parsed) ? parsed : [];
}

async function runGeminiEnrichmentAndRank(
  batchForAi: KalodataRawProduct[],
  fallbackGroup: Exclude<CategoryKey, 'all'>,
  maxResults = 20
): Promise<{ products: ProductItem[]; partialFailure: boolean }> {
  // Split into parallel chunks of up to 10 products so all 20 finish fast & reliably
  const chunkSize = 10;
  const chunks: KalodataRawProduct[][] = [];
  for (let i = 0; i < batchForAi.length; i += chunkSize) {
    chunks.push(batchForAi.slice(i, i + chunkSize));
  }

  const settled = await Promise.allSettled(chunks.map((chunk) => enrichChunkWithGemini(chunk)));

  const enriched: RawAiEnrichment[] = [];
  let failedChunks = 0;
  let firstError: unknown = null;

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      enriched.push(...result.value);
    } else {
      failedChunks += 1;
      if (!firstError) firstError = result.reason;
    }
  }

  if (enriched.length === 0) {
    throw firstError ?? new Error('AI_ENRICHMENT_EMPTY');
  }

  const enrichedMap = new Map<string, RawAiEnrichment>(
    enriched.filter((e) => e && typeof e.id === 'string').map((e) => [e.id, e])
  );

  const candidates: ScoredCandidate[] = batchForAi.map((raw) => {
    const info = enrichedMap.get(raw.id);
    const normalizedCat = normalizeCategory(info?.category || raw.categoryHint || '', fallbackGroup);
    const priceThb = raw.priceThb;
    const commissionRate = raw.commissionRate;
    const commissionThb =
      priceThb !== null && commissionRate !== null
        ? commissionRate === 0
          ? 0
          : Math.round(priceThb * commissionRate) / 100
        : null;

    const product: ProductItem = {
      id: raw.id,
      thaiTitle: raw.thaiTitle,
      clearTitle: {
        my: info?.clearTitleMy?.trim() || raw.thaiTitle,
        en: info?.clearTitleEn?.trim() || raw.thaiTitle,
      },
      whatItIs: {
        my: info?.whatItIsMy?.trim() || raw.thaiTitle,
        en: info?.whatItIsEn?.trim() || raw.thaiTitle,
      },
      whySilentWorks: {
        my: info?.whySilentWorksMy?.trim() || '',
        en: info?.whySilentWorksEn?.trim() || '',
      },
      category: normalizedCat,
      categoryLabel: CATEGORY_LABELS[normalizedCat],
      shopName: raw.shopName,
      priceThb,
      commissionRate,
      commissionThb,
      imageUrl: sanitizeExternalUrl(raw.imageUrl),
      productUrl: sanitizeExternalUrl(raw.productUrl),
      visualTags: Array.isArray(info?.visualTags) ? info.visualTags.slice(0, 3) : [],
      aiEnriched: Boolean(info),
      kalodataMetrics: raw.kalodataMetrics,
      validatedMetrics: raw.validatedMetrics,
      commercialScoreV2: evaluateProductCommercialV2(raw.validatedMetrics),
      strategyIntelligenceV2: evaluateProductStrategiesV2(
        raw.validatedMetrics,
        evaluateProductCommercialV2(raw.validatedMetrics)
      ),
      ...(raw.description
        ? {
            deepInsights: {
              description: raw.description,
              fetchedAt: new Date().toISOString(),
            },
          }
        : {}),
    };

    return {
      product,
      signals: {
        visualDemoStrength: Number(info?.visualDemoStrength) || 74,
        aiVideoSuitability: Number(info?.aiVideoSuitability) || 74,
        salesMomentum: Number(info?.salesMomentum) || 70,
        needsExplanationPenalty: Number(info?.needsExplanationPenalty) || 0,
      },
    };
  });

  return {
    products: rankSilentVisualProducts(candidates, maxResults),
    partialFailure: failedChunks > 0,
  };
}

/**
 * Searches Thailand TikTok Shop EXCLUSIVELY via Kalodata Open API:
 *  - If user pasted a Product Link / Product ID -> calls /tiktok/product/detail (~0.2 cr) for that 1 product only.
 *  - Otherwise -> calls /tiktok/product/rank (~0.2 cr) with optional keyword and/or multiple cate_ids, or default best matches when empty.
 */
export async function searchSilentVisualProducts(params: {
  query: string;
  cateIds: string[];
  selectedCategoryMeta?: { id: string; my?: string; en?: string } | null;
  forceRefresh?: boolean;
  guardrails?: CreditGuardrails;
}): Promise<KalodataProductSearchOutput> {
  const linkCheck = parseProductLinkInput(params.query);

  if (linkCheck.isLinkOrId) {
    if (!linkCheck.productId) {
      throw new KalodataApiError(
        'KALODATA_INVALID_LINK',
        linkCheck.isShortLink
          ? 'Short TikTok links (vt.tiktok.com) hide the Product ID. Please open the link in a browser and paste the full Product URL or numeric Product ID.'
          : 'Could not find a TikTok Shop Product ID in that link. Please paste a full TikTok Shop / Kalodata product link or numeric Product ID.',
        400
      );
    }

    const singleResult = await fetchSingleKalodataProductById({
      productId: linkCheck.productId,
      forceRefresh: params.forceRefresh,
      guardrails: params.guardrails,
    });

    if (singleResult.products.length === 0) {
      return {
        products: [],
        creditsUsed: singleResult.creditsUsed,
        fromCache: singleResult.fromCache,
        mode: 'single_link',
        aiEnrichmentFailed: false,
        balance: singleResult.balance,
      };
    }

    const scoredSingle = singleResult.products.map((raw) =>
      buildScoredKalodataItem(raw, 'home')
    );

    return {
      products: scoredSingle,
      creditsUsed: singleResult.creditsUsed,
      fromCache: singleResult.fromCache,
      mode: 'single_link',
      aiEnrichmentFailed: false,
      balance: singleResult.balance,
    };
  }

  // Standard Ranking Search (Default best matches, Keyword, Multiple Categories, or combined)
  const kalodataResult = await fetchKalodataThailandProducts({
    query: params.query,
    cateIds: params.cateIds,
    forceRefresh: params.forceRefresh,
    guardrails: params.guardrails,
  });
  const kalodataProducts = kalodataResult.products;

  if (kalodataProducts.length === 0) {
    return {
      products: [],
      creditsUsed: kalodataResult.creditsUsed,
      fromCache: kalodataResult.fromCache,
      mode: 'rank',
      aiEnrichmentFailed: false,
      balance: kalodataResult.balance,
    };
  }

  const fallbackGroup = resolveVisualGroupFromCateIds(params.cateIds);
  const singleSearchedCateMeta =
    params.cateIds.length === 1
      ? params.selectedCategoryMeta && params.selectedCategoryMeta.id === params.cateIds[0]
        ? params.selectedCategoryMeta
        : { id: params.cateIds[0] }
      : undefined;

  // Instant Score Engine on all 20 Kalodata products (NO auto-AI call — user runs Studio AI Analysis manually!)
  const scoredProducts = sortProductsByV2Overall(
    kalodataProducts
      .slice(0, 20)
      .map((raw) => buildScoredKalodataItem(raw, fallbackGroup, singleSearchedCateMeta))
  );

  return {
    products: scoredProducts,
    creditsUsed: kalodataResult.creditsUsed,
    fromCache: kalodataResult.fromCache,
    mode: 'rank',
    aiEnrichmentFailed: false,
    balance: kalodataResult.balance,
  };
}

export async function explainExistingProducts(
  products: ProductItem[]
): Promise<ProductItem[]> {
  const existingMap = new Map(products.map((p) => [p.id, p]));
  const rawBatch: KalodataRawProduct[] = products.slice(0, 20).map((p) => ({
    id: p.id,
    thaiTitle: p.thaiTitle,
    shopName: p.shopName,
    priceThb: p.priceThb,
    commissionRate: p.commissionRate,
    salesVolume7d: p.kalodataMetrics?.salesVolume7d ?? 0,
    revenueThb7d: p.kalodataMetrics?.revenueThb7d ?? 0,
    videoRevenueThb7d: p.kalodataMetrics?.videoRevenueThb7d ?? 0,
    revenueGrowthRate: p.kalodataMetrics?.revenueGrowthRate ?? 0,
    kalodataMetrics: p.kalodataMetrics ?? {},
    validatedMetrics: p.validatedMetrics ?? adaptProductItemToValidatedMetrics(p),
    categoryHint: p.category,
    imageUrl: p.imageUrl,
    productUrl: p.productUrl,
    description: p.deepInsights?.description,
  }));

  if (rawBatch.length === 0) return [];
  const result = await runGeminiEnrichmentAndRank(
    rawBatch,
    products[0]?.category || 'home',
    rawBatch.length
  );

  // Preserve any existing full deepInsights, kalodataMetrics, validatedMetrics, and aiAnalysis
  return result.products.map((item) => {
    const prev = existingMap.get(item.id);
    if (!prev) return item;
    return {
      ...item,
      kalodataCategoryId: prev.kalodataCategoryId ?? item.kalodataCategoryId,
      kalodataMetrics: prev.kalodataMetrics ?? item.kalodataMetrics,
      validatedMetrics: prev.validatedMetrics ?? item.validatedMetrics,
      commercialScoreV2:
        prev.commercialScoreV2 ??
        item.commercialScoreV2 ??
        evaluateProductCommercialV2(prev.validatedMetrics ?? item.validatedMetrics ?? prev),
      strategyIntelligenceV2:
        prev.strategyIntelligenceV2 ??
        item.strategyIntelligenceV2 ??
        evaluateProductStrategiesV2(
          prev.validatedMetrics ?? item.validatedMetrics ?? prev,
          prev.commercialScoreV2 ?? item.commercialScoreV2
        ),
      deepInsights: prev.deepInsights ?? item.deepInsights,
      aiAnalysis: prev.aiAnalysis,
    };
  });
}

const bilingualSchema = {
  type: Type.OBJECT,
  properties: {
    my: { type: Type.STRING },
    en: { type: Type.STRING },
  },
  required: ['my', 'en'],
};

const videoPlanSchema = {
  type: Type.OBJECT,
  properties: {
    conceptTitle: bilingualSchema,
    conceptSummary: bilingualSchema,
    visualDirection: bilingualSchema,
    hooks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: bilingualSchema,
          visualAction: bilingualSchema,
          onScreenTextTh: { type: Type.STRING },
          onScreenTextMeaning: bilingualSchema,
        },
        required: ['title', 'visualAction', 'onScreenTextTh', 'onScreenTextMeaning'],
      },
    },
    storyboard: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timeRange: { type: Type.STRING },
          sceneVisual: bilingualSchema,
          cameraMove: bilingualSchema,
          soundDesign: bilingualSchema,
          onScreenTextTh: { type: Type.STRING },
          onScreenTextMeaning: bilingualSchema,
        },
        required: [
          'timeRange',
          'sceneVisual',
          'cameraMove',
          'soundDesign',
          'onScreenTextTh',
          'onScreenTextMeaning',
        ],
      },
    },
    aiVideoPrompts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: bilingualSchema,
          prompt: { type: Type.STRING },
        },
        required: ['label', 'prompt'],
      },
    },
    aiImagePrompts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: bilingualSchema,
          prompt: { type: Type.STRING },
        },
        required: ['label', 'prompt'],
      },
    },
    seo: {
      type: Type.OBJECT,
      properties: {
        captionTh: { type: Type.STRING },
        captionMeaning: bilingualSchema,
        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        postingTip: bilingualSchema,
      },
      required: ['captionTh', 'captionMeaning', 'hashtags', 'keywords', 'postingTip'],
    },
    masterVideoPrompt: bilingualSchema,
  },
  required: [
    'conceptTitle',
    'conceptSummary',
    'visualDirection',
    'hooks',
    'storyboard',
    'aiVideoPrompts',
    'aiImagePrompts',
    'seo',
    'masterVideoPrompt',
  ],
};

const STYLE_DIRECTIONS: Record<VisualStyle, string> = {
  cinematic: 'Cinematic Macro & Luxury Studio Visuals — smooth slow-motion reveals, crisp rim lighting, glossy commercial aesthetics, zero talking.',
  asmr: 'Satisfying ASMR & Tactile Texture Focus — close-up textures, clicks, snaps, pours, crisp sound effects, pure sensory satisfaction, zero talking.',
  before_after: 'Instant Visual Before & After Transformation — dramatic split-second contrast showing immediate visible results on camera, zero talking.',
  problem_fix: 'Everyday Frustration to Effortless Instant Fix — 2-second visual problem followed by smooth one-motion product rescue, zero talking.',
};

export async function generateSilentVideoPlan(
  product: ProductItem,
  style: VisualStyle,
  onProgress?: () => void
): Promise<VideoAdPlan> {
  const priceLine =
    product.priceThb !== null ? `฿${product.priceThb} THB` : 'Not specified';
  const commissionLine =
    product.commissionRate !== null
      ? `${product.commissionRate}%${product.commissionThb ? ` (฿${product.commissionThb}/sale)` : ''}`
      : 'Not specified';

  const deepBlocks: string[] = [];
  if (product.deepInsights?.description) {
    deepBlocks.push(`Seller Description (Kalodata): ${product.deepInsights.description.slice(0, 450)}`);
  }
  if (product.deepInsights?.highlights?.length) {
    deepBlocks.push(`Key Selling Highlights (Kalodata): ${product.deepInsights.highlights.slice(0, 6).join(', ')}`);
  }
  if (product.deepInsights?.painPoints?.length) {
    deepBlocks.push(`Real Thai Buyer Pain Points (Kalodata Reviews): ${product.deepInsights.painPoints.slice(0, 4).join('; ')}`);
  }
  if (product.deepInsights?.usageScenarios?.length) {
    deepBlocks.push(`Real Usage Scenarios (Kalodata Reviews): ${product.deepInsights.usageScenarios.slice(0, 4).join('; ')}`);
  }

  const hasDeepInsights = deepBlocks.length > 0;
  const displayEn =
    product.aiAnalysis?.cleanName?.en?.trim() || product.clearTitle.en || product.thaiTitle;
  const displayMy =
    product.aiAnalysis?.cleanName?.my?.trim() || product.clearTitle.my || product.thaiTitle;

  const prompt = `Create a crisp, high-converting, 100% SILENT (ZERO SPOKEN DIALOGUE, ZERO VOICEOVER) AI visual TikTok Shop Thailand video kit:

Product (EN): ${displayEn}
Product (MY): ${displayMy}
Thai Listing: ${product.thaiTitle}
Price: ${priceLine} | Commission: ${commissionLine}
Visual Style: ${STYLE_DIRECTIONS[style]}
${hasDeepInsights ? `\nKALODATA DEEP INSIGHTS:\n${deepBlocks.join('\n')}` : ''}

STRICT RULES (ULTRA-CONCISE FOR FAST RESPONSE):
1. ZERO TALKING / VOICEOVER. Sell purely via AI visuals, camera motion, ASMR beats, and ultra-short Thai text overlays.
2. Fill every bilingual field in natural Myanmar ("my") and clear English ("en") — max 1 short punchy sentence (10–18 words) per field.
3. Natural Thailand TikTok Shop Thai for onScreenTextTh and captionTh (include soft CTA to ตะกร้าเหลือง).
4. hooks: 3 distinct 0–3s visual hooks (short title + 1-line visual action + 3–5 word Thai overlay).
5. storyboard: 4 tight scenes ("0-3s", "3-7s", "7-11s", "11-15s"), ultra-short 1-line visual, camera, ASMR sound, and Thai text.
6. aiVideoPrompts: 3 ready-to-paste English prompts (25–40 words each, vertical 9:16, ending with "silent visual commercial, no dialogue, photorealistic 4K").
7. aiImagePrompts: 2 ready-to-paste English start-frame prompts (20–30 words each, vertical 9:16, studio photo, no text).
8. seo: 2-line Thai caption, 6 Thailand TikTok Shop hashtags (#...), 4 search keywords, 1 short posting tip.
9. masterVideoPrompt: 1 comprehensive, all-in-one English master video prompt (80-120 words) that compiles the entire 0-15s silent video sequence (Hook + Scene 1 + Scene 2 + Scene 3 + Scene 4 + ASMR audio cues + Thai text overlays) into a single master prompt for Veo/Kling/Runway/Sora, plus its Myanmar translation.`;

  const data = await generateStructuredJsonStream<
    Omit<VideoAdPlan, 'id' | 'productId' | 'style' | 'createdAt'>
  >({
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: videoPlanSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
    timeoutMs: 45000,
    retries: 1,
    label: 'VIDEO_PLAN',
    onProgress,
  });

  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    productId: product.id,
    style,
    createdAt: new Date().toISOString(),
    conceptTitle: data.conceptTitle || { my: displayMy, en: displayEn },
    conceptSummary: data.conceptSummary || { my: '', en: '' },
    visualDirection: data.visualDirection || { my: '', en: '' },
    hooks: Array.isArray(data.hooks) ? data.hooks.slice(0, 3) : [],
    storyboard: Array.isArray(data.storyboard) ? data.storyboard.slice(0, 5) : [],
    aiVideoPrompts: Array.isArray(data.aiVideoPrompts) ? data.aiVideoPrompts.slice(0, 4) : [],
    aiImagePrompts: Array.isArray(data.aiImagePrompts) ? data.aiImagePrompts.slice(0, 3) : [],
    seo: {
      captionTh: data.seo?.captionTh || '',
      captionMeaning: data.seo?.captionMeaning || { my: '', en: '' },
      hashtags: Array.isArray(data.seo?.hashtags)
        ? data.seo.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`))
        : [],
      keywords: Array.isArray(data.seo?.keywords) ? data.seo.keywords : [],
      postingTip: data.seo?.postingTip || { my: '', en: '' },
    },
    masterVideoPrompt: data.masterVideoPrompt || {
      en: `Vertical 9:16 zero-speech TikTok commercial for ${displayEn}. 0-3s hook with instant visual shock, followed by 3-15s smooth macro ASMR texture and before/after transformation. Photorealistic 4K, studio lighting, no dialogue.`,
      my: `${displayMy} အတွက် 0 မှ 15 စက္ကန့်အထိ အစအဆုံး တစ်ခါတည်းထွက်မည့် 100% စကားမပြောဘဲ ချက်ချင်းဆွဲဆောင်မည့် 9:16 Vertical AI Video Master Prompt ဖြစ်ပါသည်။`,
    },
    usedDeepInsights: hasDeepInsights,
  };
}

const bilingualListSchema = {
  type: Type.OBJECT,
  properties: {
    my: { type: Type.ARRAY, items: { type: Type.STRING } },
    en: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['my', 'en'],
};

const productAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    cleanName: bilingualSchema,
    productOverview: bilingualSchema,
    salesAndPricingAudit: bilingualSchema,
    profitCalculation: bilingualSchema,
    silentVideoVerdict: bilingualSchema,
    visualAngles: bilingualListSchema,
    deepDataSpecsAudit: bilingualSchema,
    deepDataBuyerAudit: bilingualSchema,
    risks: bilingualListSchema,
    missingDataNotes: bilingualListSchema,
    decision: {
      type: Type.STRING,
      description: 'One of: strong_go, test_carefully, need_more_data',
    },
    bottomLine: bilingualSchema,
  },
  required: [
    'cleanName',
    'productOverview',
    'salesAndPricingAudit',
    'profitCalculation',
    'silentVideoVerdict',
    'visualAngles',
    'deepDataSpecsAudit',
    'deepDataBuyerAudit',
    'risks',
    'missingDataNotes',
    'decision',
    'bottomLine',
  ],
};

function normalizeDecision(raw: unknown): ProductAnalysisDecision {
  if (raw === 'strong_go' || raw === 'test_carefully' || raw === 'need_more_data') {
    return raw;
  }
  return 'test_carefully';
}

export async function analyzeProductWithAi(
  product: ProductItem,
  onProgress?: () => void
): Promise<ProductAiAnalysis> {
  const m = product.kalodataMetrics;
  const d = product.deepInsights;

  const hasSalesVolume = typeof m?.salesVolume7d === 'number' && Number.isFinite(m.salesVolume7d);
  const hasRevenue = typeof m?.revenueThb7d === 'number' && Number.isFinite(m.revenueThb7d);
  const hasVideoRevenue =
    typeof m?.videoRevenueThb7d === 'number' && Number.isFinite(m.videoRevenueThb7d);
  const hasLiveRevenue =
    typeof m?.liveRevenueThb7d === 'number' && Number.isFinite(m.liveRevenueThb7d);
  const hasGrowth =
    typeof m?.revenueGrowthRate === 'number' && Number.isFinite(m.revenueGrowthRate);
  const hasCreatorCount = typeof m?.creatorCount === 'number' && Number.isFinite(m.creatorCount);
  const hasRating = typeof m?.rating === 'number' && Number.isFinite(m.rating);
  const hasReviewCount = typeof m?.reviewCount === 'number' && Number.isFinite(m.reviewCount);

  const hasSalesMetrics = Boolean(hasSalesVolume || hasRevenue || hasVideoRevenue);
  const hasDetails = Boolean(d?.description && d.description.trim());
  const hasSpecs = Boolean(d?.highlights && d.highlights.length > 0);
  const hasComments = Boolean(
    (d?.painPoints && d.painPoints.length > 0) ||
      (d?.usageScenarios && d.usageScenarios.length > 0)
  );

  // Build explicit factual inventory of available vs missing Kalodata data
  const missingFields: string[] = [];
  if (product.priceThb === null) missingFields.push('Price (THB)');
  if (product.commissionRate === null) missingFields.push('Affiliate Commission Rate (%)');
  if (!hasSalesVolume) missingFields.push('7-Day Sales Volume');
  if (!hasRevenue) missingFields.push('7-Day Total Revenue');
  if (!hasVideoRevenue) missingFields.push('7-Day Video Revenue');
  if (!hasGrowth) missingFields.push('Revenue Growth Rate');
  if (!hasDetails) missingFields.push('Kalodata Deep Data: Product Details / Seller Description');
  if (!hasSpecs) missingFields.push('Kalodata Deep Data: Selling Specs & Highlights');
  if (!hasComments) missingFields.push('Kalodata Deep Data: Buyer Reviews & Pain Points');

  // Pre-compute deterministic math on real numbers so AI calculations are 100% accurate
  const computedMath: Record<string, string | number | null> = {
    priceThb: product.priceThb,
    commissionRatePct: product.commissionRate,
    commissionPerSaleThb: product.commissionThb,
    salesNeededFor1000Thb:
      product.commissionThb && product.commissionThb > 0
        ? Math.ceil(1000 / product.commissionThb)
        : null,
    salesNeededFor10000Thb:
      product.commissionThb && product.commissionThb > 0
        ? Math.ceil(10000 / product.commissionThb)
        : null,
    videoRevenueSharePct:
      hasRevenue && hasVideoRevenue && (m?.revenueThb7d ?? 0) > 0
        ? Math.round(((m!.videoRevenueThb7d! / m!.revenueThb7d!) * 100) * 10) / 10
        : null,
    avgDailySales7d:
      hasSalesVolume ? Math.round((m!.salesVolume7d! / 7) * 10) / 10 : null,
    avgDailyRevenueThb7d:
      hasRevenue ? Math.round(m!.revenueThb7d! / 7) : null,
  };

  const payloadForAi = {
    productId: product.id,
    thaiTitle: product.thaiTitle,
    shopName: product.shopName,
    category: product.categoryLabel.en,
    priceThb: product.priceThb,
    commissionRatePct: product.commissionRate,
    commissionPerSaleThb: product.commissionThb,
    kalodataMetrics7d: {
      salesVolume7d: hasSalesVolume ? m?.salesVolume7d : 'NOT_AVAILABLE',
      revenueThb7d: hasRevenue ? m?.revenueThb7d : 'NOT_AVAILABLE',
      videoRevenueThb7d: hasVideoRevenue ? m?.videoRevenueThb7d : 'NOT_AVAILABLE',
      liveRevenueThb7d: hasLiveRevenue ? m?.liveRevenueThb7d : 'NOT_AVAILABLE',
      revenueGrowthRate: hasGrowth ? m?.revenueGrowthRate : 'NOT_AVAILABLE',
      creatorCount: hasCreatorCount ? m?.creatorCount : 'NOT_AVAILABLE',
      rating: hasRating ? m?.rating : 'NOT_AVAILABLE',
      reviewCount: hasReviewCount ? m?.reviewCount : 'NOT_AVAILABLE',
    },
    precomputedMath: computedMath,
    silentVisualScore: product.scoreBreakdown ?? 'NOT_AVAILABLE',
    kalodataDeepData: {
      sellerDescription: hasDetails ? d?.description?.slice(0, 450) : 'NOT_FETCHED_YET',
      sellingSpecsHighlights: hasSpecs ? d?.highlights?.slice(0, 6) : 'NOT_FETCHED_YET',
      buyerPainPoints: d?.painPoints?.length ? d.painPoints.slice(0, 4) : 'NOT_FETCHED_YET',
      buyerUsageScenarios: d?.usageScenarios?.length ? d.usageScenarios.slice(0, 4) : 'NOT_FETCHED_YET',
    },
    missingKalodataFields: missingFields,
  };

  const prompt = `You are a strict Thailand TikTok Shop affiliate analyst evaluating a product ONLY from the Kalodata JSON below.

KALODATA DATA (JSON):
${JSON.stringify(payloadForAi)}

STRICT RULES (ZERO HALLUCINATION + ULTRA-FAST CONCISE OUTPUT):
1. Use ONLY real figures from JSON above. Never invent missing sales, revenue, specs, or reviews.
2. For any "NOT_AVAILABLE" or "NOT_FETCHED_YET" field, state briefly in 1 short sentence in Myanmar (for 'my') and English (for 'en').
3. Keep EVERY field crisp and compact (1–2 short sentences max; no fluff).
4. CRITICAL LANGUAGE REQUIREMENT: Write all analysis and explanation sentences inside 'my' in fluent, natural Myanmar (Burmese) language (သုံးသပ်ချက်စာသားများကို မြန်မာဘာသာဖြင့်သာ ရေးပါ), and 'en' in English.
5. DO NOT TRANSLATE THE PRODUCT NAME: Never translate the product name (thaiTitle) or brand/shop name into Myanmar. Keep the product name in its original form ("${product.thaiTitle}").

FIELDS:
- cleanName: Keep the original product name as-is (do not translate into Myanmar).
- productOverview: 1–2 short sentences explaining what the product is and how it works (in Myanmar for 'my', English for 'en', without translating the product's proper name).
- salesAndPricingAudit: 1–2 short sentences on 7d sales, revenue, video share, growth & price.
- profitCalculation: 1–2 short sentences using exact precomputedMath (THB/sale, units for ฿1,000 & ฿10,000).
- silentVideoVerdict: 1–2 short sentences on zero-speech AI visual ad fit.
- visualAngles: 2–3 short visual hooks.
- deepDataSpecsAudit: 1 short sentence on description/highlights.
- deepDataBuyerAudit: 1 short sentence on buyer pain points/usage.
- risks: 2–3 brief real risks visible in data.
- missingDataNotes: Short items from missingKalodataFields (empty array if none).
- decision: "strong_go" | "test_carefully" | "need_more_data".
- bottomLine: 1 punchy sentence with next action.`;

  const parsed = await generateStructuredJsonStream<
    Omit<ProductAiAnalysis, 'analyzedAt' | 'dataSnapshot'>
  >({
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: productAnalysisSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
    timeoutMs: 45000,
    retries: 1,
    label: 'PRODUCT_ANALYSIS',
    onProgress,
  });

  return {
    analyzedAt: new Date().toISOString(),
    dataSnapshot: {
      hasSalesMetrics,
      hasDetails,
      hasSpecs,
      hasComments,
    },
    cleanName: {
      my: product.thaiTitle,
      en: product.thaiTitle,
    },
    productOverview: {
      my: parsed.productOverview?.my?.trim() || '',
      en: parsed.productOverview?.en?.trim() || '',
    },
    salesAndPricingAudit: {
      my: parsed.salesAndPricingAudit?.my?.trim() || '',
      en: parsed.salesAndPricingAudit?.en?.trim() || '',
    },
    profitCalculation: {
      my: parsed.profitCalculation?.my?.trim() || '',
      en: parsed.profitCalculation?.en?.trim() || '',
    },
    silentVideoVerdict: {
      my: parsed.silentVideoVerdict?.my?.trim() || '',
      en: parsed.silentVideoVerdict?.en?.trim() || '',
    },
    visualAngles: {
      my: Array.isArray(parsed.visualAngles?.my) ? parsed.visualAngles.my.slice(0, 4) : [],
      en: Array.isArray(parsed.visualAngles?.en) ? parsed.visualAngles.en.slice(0, 4) : [],
    },
    deepDataSpecsAudit: {
      my: parsed.deepDataSpecsAudit?.my?.trim() || '',
      en: parsed.deepDataSpecsAudit?.en?.trim() || '',
    },
    deepDataBuyerAudit: {
      my: parsed.deepDataBuyerAudit?.my?.trim() || '',
      en: parsed.deepDataBuyerAudit?.en?.trim() || '',
    },
    risks: {
      my: Array.isArray(parsed.risks?.my) ? parsed.risks.my.slice(0, 5) : [],
      en: Array.isArray(parsed.risks?.en) ? parsed.risks.en.slice(0, 5) : [],
    },
    missingDataNotes: {
      my: Array.isArray(parsed.missingDataNotes?.my)
        ? parsed.missingDataNotes.my.slice(0, 8)
        : [],
      en: Array.isArray(parsed.missingDataNotes?.en)
        ? parsed.missingDataNotes.en.slice(0, 8)
        : [],
    },
    decision: normalizeDecision(parsed.decision),
    bottomLine: {
      my: parsed.bottomLine?.my?.trim() || '',
      en: parsed.bottomLine?.en?.trim() || '',
    },
  };
}
