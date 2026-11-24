import { ThinkingLevel, Type } from '@google/genai';
import type {
  CategoryKey,
  KalodataCreditBalance,
  ProductItem,
  VideoAdPlan,
  VisualStyle,
} from '../src/types.ts';
import { GEMINI_MODEL, getGeminiClient, sanitizeExternalUrl, withRetry } from './gemini.ts';
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

function normalizeCategory(raw: string, fallback: Exclude<CategoryKey, 'all'>): Exclude<CategoryKey, 'all'> {
  const lower = raw.toLowerCase();
  if (lower.includes('beaut') || lower.includes('skin') || lower.includes('cosmet') || lower.includes('hair') || lower.includes('personal')) {
    return 'beauty';
  }
  if (lower.includes('home') || lower.includes('kitchen') || lower.includes('clean') || lower.includes('decor')) {
    return 'home';
  }
  if (lower.includes('gadget') || lower.includes('tech') || lower.includes('elec') || lower.includes('phone') || lower.includes('auto')) {
    return 'gadget';
  }
  if (lower.includes('fash') || lower.includes('bag') || lower.includes('cloth') || lower.includes('wear') || lower.includes('shoe') || lower.includes('jewel')) {
    return 'fashion';
  }
  if (lower.includes('pet') || lower.includes('cat') || lower.includes('dog')) {
    return 'pet';
  }
  if (lower.includes('well') || lower.includes('health') || lower.includes('massag') || lower.includes('tumbl')) {
    return 'wellness';
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
  fallbackGroup: Exclude<CategoryKey, 'all'>
): ProductItem {
  const normalizedCat = normalizeCategory(raw.categoryHint || '', fallbackGroup);
  const priceThb = raw.priceThb;
  const commissionRate = raw.commissionRate;
  const commissionThb =
    priceThb !== null && commissionRate !== null
      ? Math.max(1, Math.round((priceThb * commissionRate) / 100))
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
    categoryLabel: CATEGORY_LABELS[normalizedCat],
    shopName: raw.shopName,
    priceThb,
    commissionRate,
    commissionThb,
    imageUrl,
    productUrl: sanitizeExternalUrl(raw.productUrl),
    visualTags: [],
    aiEnriched: false,
    scoreBreakdown,
    ...(raw.description
      ? {
          deepInsights: {
            description: raw.description,
            fetchedAt: new Date().toISOString(),
          },
        }
      : {}),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function selectTopCandidatesForAi(
  rows: KalodataRawProduct[],
  limit = 8
): KalodataRawProduct[] {
  if (rows.length <= limit) return rows;
  return [...rows]
    .sort((a, b) => {
      const scoreA =
        a.videoRevenueThb7d * 1.6 +
        a.revenueThb7d +
        (a.commissionRate ?? 0) * 600 +
        (a.imageUrl ? 500 : 0);
      const scoreB =
        b.videoRevenueThb7d * 1.6 +
        b.revenueThb7d +
        (b.commissionRate ?? 0) * 600 +
        (b.imageUrl ? 500 : 0);
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

async function enrichChunkWithGemini(
  chunk: KalodataRawProduct[]
): Promise<RawAiEnrichment[]> {
  const ai = getGeminiClient();

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

  const structuredResponse = await withTimeout(
    withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: enrichPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: enrichmentListSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    ),
    35000,
    'AI_ENRICH'
  );

  const rawText = (structuredResponse.text ?? '[]').trim();
  const parsed = JSON.parse(rawText);
  return Array.isArray(parsed) ? (parsed as RawAiEnrichment[]) : [];
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
        ? Math.max(1, Math.round((priceThb * commissionRate) / 100))
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

  // Instant Score Engine on all 20 Kalodata products (NO auto-AI call — user runs AI Explain manually!)
  const scoredProducts = kalodataProducts
    .slice(0, 20)
    .map((raw) => buildScoredKalodataItem(raw, fallbackGroup))
    .sort((a, b) => (b.scoreBreakdown?.total ?? 0) - (a.scoreBreakdown?.total ?? 0));

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
    salesVolume7d: 0,
    revenueThb7d: 0,
    videoRevenueThb7d: 0,
    revenueGrowthRate: 0,
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

  // Preserve any existing full deepInsights (highlights, painPoints, usageScenarios)
  return result.products.map((item) => {
    const prev = existingMap.get(item.id);
    if (prev?.deepInsights) {
      return {
        ...item,
        deepInsights: prev.deepInsights,
      };
    }
    return item;
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
  style: VisualStyle
): Promise<VideoAdPlan> {
  const ai = getGeminiClient();

  const priceLine =
    product.priceThb !== null ? `฿${product.priceThb} THB` : 'Not specified';
  const commissionLine =
    product.commissionRate !== null
      ? `${product.commissionRate}%${product.commissionThb ? ` (฿${product.commissionThb}/sale)` : ''}`
      : 'Not specified';

  const deepBlocks: string[] = [];
  if (product.deepInsights?.description) {
    deepBlocks.push(`Seller Description (Kalodata): ${product.deepInsights.description}`);
  }
  if (product.deepInsights?.highlights?.length) {
    deepBlocks.push(`Key Selling Highlights (Kalodata): ${product.deepInsights.highlights.join(', ')}`);
  }
  if (product.deepInsights?.painPoints?.length) {
    deepBlocks.push(`Real Thai Buyer Pain Points (Kalodata Reviews): ${product.deepInsights.painPoints.join('; ')}`);
  }
  if (product.deepInsights?.usageScenarios?.length) {
    deepBlocks.push(`Real Usage Scenarios (Kalodata Reviews): ${product.deepInsights.usageScenarios.join('; ')}`);
  }

  const hasDeepInsights = deepBlocks.length > 0;

  const prompt = `Create a complete, high-converting, 100% SILENT (ZERO SPOKEN DIALOGUE, ZERO VOICEOVER) AI visual TikTok Shop Thailand video production kit for this Kalodata Thailand TikTok Shop product:

Product (English): ${product.clearTitle.en}
Product (Myanmar): ${product.clearTitle.my}
Original Thai Listing: ${product.thaiTitle}
What it is: ${product.whatItIs.en}
Why silent visuals sell it: ${product.whySilentWorks.en || 'Visual product demonstration'}
Price: ${priceLine} | Affiliate Commission: ${commissionLine}
Requested Visual Style: ${STYLE_DIRECTIONS[style]}
${hasDeepInsights ? `\nVERIFIED KALODATA DEEP INSIGHTS (weave these real selling points & buyer pain points visually into the hooks, scenes, and Thai copy!):\n${deepBlocks.join('\n')}` : ''}

CRITICAL RULES:
1. STRICTLY NO TALKING, NO VOICEOVER, NO SPOKEN SCRIPT, NO LIP-SYNC. The entire 15-second TikTok ad sells purely through clean, mesmerizing AI visuals, crisp camera motion, subtle ASMR/music beats, and ultra-short Thai on-screen text overlays.
2. Provide ALL creator explanations, titles, hooks, storyboard actions, and tips in BOTH natural idiomatic Myanmar (my) and clear English (en).
3. Provide all buyer-facing TikTok text (onScreenTextTh, captionTh) in natural, high-converting Thai (ภาษาไทย) tailored for Thailand TikTok Shop shoppers (including a soft CTA to the yellow basket ตะกร้าเหลือง), along with exact Myanmar & English meanings so the creator understands every Thai line.
4. hooks: Exactly 3 distinct 0–3 second silent visual hooks.
5. storyboard: Exactly 4 to 5 tight scenes covering 0–15 seconds (e.g. "0–3s", "3–6s", "6–10s", "10–13s", "13–15s").
6. aiVideoPrompts: Exactly 3 ready-to-paste English prompts tailored for AI video tools (Veo / Kling / Runway / Sora) — each must specify vertical 9:16 aspect ratio, lighting, camera movement, tactile product details, and explicitly end with "silent visual commercial, no dialogue, no talking, photorealistic 4K".
7. aiImagePrompts: Exactly 2 ready-to-paste English start-frame keyframe image prompts (vertical 9:16, studio commercial photography, no text).
8. seo: High-converting Thai caption, 8–10 real Thailand TikTok Shop hashtags (starting with #), 5–6 TikTok TH search keywords, and 1 practical posting tip.`;

  const response = await withTimeout(
    withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: videoPlanSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    ),
    40000,
    'VIDEO_PLAN'
  );

  const rawText = (response.text ?? '{}').trim();
  let data: Omit<VideoAdPlan, 'id' | 'productId' | 'style' | 'createdAt'>;
  try {
    data = JSON.parse(rawText) as Omit<VideoAdPlan, 'id' | 'productId' | 'style' | 'createdAt'>;
  } catch {
    throw new Error('INVALID_PLAN_RESPONSE');
  }

  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    productId: product.id,
    style,
    createdAt: new Date().toISOString(),
    conceptTitle: data.conceptTitle,
    conceptSummary: data.conceptSummary,
    visualDirection: data.visualDirection,
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
    usedDeepInsights: hasDeepInsights,
  };
}
