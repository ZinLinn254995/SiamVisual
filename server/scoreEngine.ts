import type { CategoryKey, ProductItem, ProductScoreBreakdown, ScoreGrade } from '../src/types.ts';

export interface ScoredCandidate {
  product: ProductItem;
  signals: {
    visualDemoStrength: number; // 0-100: how instantly understandable without talking
    aiVideoSuitability: number; // 0-100: texture, motion, before/after, macro potential
    salesMomentum: number;      // 0-100: Thailand TikTok demand & impulse buy appeal
    needsExplanationPenalty: number; // 0-40: penalty if product requires verbal explanation
  };
}

export interface RawKalodataMetrics {
  thaiTitle: string;
  category: Exclude<CategoryKey, 'all'>;
  priceThb: number | null;
  commissionRate: number | null;
  commissionThb: number | null;
  salesVolume7d: number;
  revenueThb7d: number;
  videoRevenueThb7d: number;
  revenueGrowthRate: number;
  hasImage: boolean;
}

export function resolveScoreGrade(total: number): ScoreGrade {
  if (total >= 85) return 'top';
  if (total >= 70) return 'strong';
  if (total >= 55) return 'fair';
  return 'low';
}

const VISUAL_BOOST_PATTERNS = [
  /กันน้ำ|waterproof|360|รีดน้ำ|อัตโนมัติ|หมุนได้|พับได้|foldable|แม่เหล็ก|magnetic/i,
  /led|ไฟ|เรืองแสง|glow|สว่าง|โคม|neon|rgb|มินิ|mini|พกพา|portable/i,
  /ทำความสะอาด|ขัด|แปรง|brush|ซิลิโคน|silicone|เจล|gel|โฟม|foam|สเปรย์|spray/i,
  /นวด|massag|ยืด|stretch|สติ๊กเกอร์|กันลื่น|organizer|จัดระเบียบ|กล่อง|ชั้นวาง/i,
  /ลิป|lip|บลัช|blush|มาสก์|mask|เซรั่ม|serum|กันแดด|sunscreen|ครีม|cream|หวี|ผม|hair/i,
];

const SPEECH_PENALTY_PATTERNS = [
  /อาหารเสริม|วิตามิน|vitamin|supplement|แคปซูล|capsule|คอลลาเจน|collagen|โปรตีน|protein/i,
  /ยา|รักษา|บำรุงเลือด|สมุนไพร|detox|ดีท็อกซ์|ลดน้ำหนัก|ประกัน|คอร์ส|course|ebook|บัตร/i,
];

const CATEGORY_VISUAL_BASE: Record<Exclude<CategoryKey, 'all'>, { visual: number; ai: number }> = {
  beauty: { visual: 80, ai: 82 },
  home: { visual: 82, ai: 80 },
  gadget: { visual: 78, ai: 81 },
  fashion: { visual: 74, ai: 77 },
  pet: { visual: 79, ai: 76 },
  wellness: { visual: 66, ai: 68 },
};

/**
 * Computes an instant, deterministic Silent-Visual Score Breakdown directly from
 * real Kalodata Thailand TikTok Shop metrics (0 AI calls, <1ms for 20 products).
 */
export function computeDirectKalodataScore(metrics: RawKalodataMetrics): ProductScoreBreakdown {
  const catBase = CATEGORY_VISUAL_BASE[metrics.category] ?? { visual: 74, ai: 74 };

  // Video revenue share proves visually-driven TikTok Shop conversion
  const videoShare =
    metrics.revenueThb7d > 0
      ? clamp(metrics.videoRevenueThb7d / metrics.revenueThb7d, 0, 1)
      : 0.35;

  let visualKeywordBoost = 0;
  for (const rx of VISUAL_BOOST_PATTERNS) {
    if (rx.test(metrics.thaiTitle)) visualKeywordBoost += 4;
  }
  visualKeywordBoost = Math.min(12, visualKeywordBoost);

  const visualDemo = clamp(
    catBase.visual + videoShare * 12 + visualKeywordBoost + (metrics.hasImage ? 2 : -6),
    35,
    98
  );

  const aiSuitability = clamp(
    catBase.ai + visualKeywordBoost * 0.8 + (metrics.hasImage ? 4 : -6) + (videoShare > 0.5 ? 4 : 0),
    35,
    96
  );

  // Sales momentum from Kalodata 7-day volume, revenue & growth + impulse price sweet spot
  const salesSignal =
    metrics.salesVolume7d > 0
      ? clamp(45 + Math.log10(metrics.salesVolume7d + 1) * 14, 40, 96)
      : metrics.revenueThb7d > 0
        ? clamp(42 + Math.log10(metrics.revenueThb7d + 1) * 9, 40, 94)
        : 65;

  const growthBoost =
    metrics.revenueGrowthRate >= 20
      ? 6
      : metrics.revenueGrowthRate > 0
        ? 3
        : 0;

  const priceSweetSpot =
    metrics.priceThb !== null ? computeThaiImpulsePriceScore(metrics.priceThb) : 70;

  const salesDemand = clamp(
    clamp(salesSignal + growthBoost, 30, 100) * 0.65 + priceSweetSpot * 0.35,
    30,
    99
  );

  const commissionValue =
    metrics.commissionRate !== null
      ? computeCommissionScore(metrics.commissionRate, metrics.commissionThb ?? 0)
      : 58;

  let rawPenalty = 0;
  for (const rx of SPEECH_PENALTY_PATTERNS) {
    if (rx.test(metrics.thaiTitle)) rawPenalty += 12;
  }
  if (metrics.category === 'wellness' && rawPenalty === 0) {
    rawPenalty = 6;
  }
  rawPenalty = clamp(rawPenalty, 0, 32);
  const speechPenalty = Math.round(rawPenalty * 0.5);

  const compositeRaw =
    visualDemo * 0.42 +
    aiSuitability * 0.26 +
    salesDemand * 0.18 +
    commissionValue * 0.14 -
    speechPenalty;

  const total = Math.round(clamp(compositeRaw, 0, 100));

  return {
    total,
    grade: resolveScoreGrade(total),
    visualDemo: Math.round(visualDemo),
    aiSuitability: Math.round(aiSuitability),
    salesDemand: Math.round(salesDemand),
    commissionValue: Math.round(commissionValue),
    speechPenalty,
  };
}

/**
 * AI-refined Silent-Visual Ad Score Engine.
 * Used when the user manually triggers AI Explanation on one or more products.
 */
export function rankSilentVisualProducts(
  candidates: ScoredCandidate[],
  maxResults = 20
): ProductItem[] {
  const scored = candidates.map((entry) => {
    const { product, signals } = entry;

    // 1. Visual demonstration power (zero-speech clarity) — 42% weight
    const visualScore = clamp(signals.visualDemoStrength, 0, 100);

    // 2. AI visual production suitability (macro, ASMR, transformation) — 26% weight
    const aiProductionScore = clamp(signals.aiVideoSuitability, 0, 100);

    // 3. Thailand TikTok impulse-buy pricing + demand momentum — 18% weight
    const priceSweetSpot =
      product.priceThb !== null ? computeThaiImpulsePriceScore(product.priceThb) : 72;
    const demandScore = clamp(signals.salesMomentum * 0.65 + priceSweetSpot * 0.35, 0, 100);

    // 4. Affiliate commission attractiveness — 14% weight
    const commissionScore =
      product.commissionRate !== null
        ? computeCommissionScore(product.commissionRate, product.commissionThb ?? 0)
        : 60;

    // Penalty if product relies on complex verbal claims (up to -20 pts)
    const rawPenalty = clamp(signals.needsExplanationPenalty, 0, 40);
    const speechPenalty = Math.round(rawPenalty * 0.5);

    const compositeRaw =
      visualScore * 0.42 +
      aiProductionScore * 0.26 +
      demandScore * 0.18 +
      commissionScore * 0.14 -
      rawPenalty * 0.5;

    const total = Math.round(clamp(compositeRaw, 0, 100));

    return {
      product: {
        ...product,
        scoreBreakdown: {
          total,
          grade: resolveScoreGrade(total),
          visualDemo: Math.round(visualScore),
          aiSuitability: Math.round(aiProductionScore),
          salesDemand: Math.round(demandScore),
          commissionValue: Math.round(commissionScore),
          speechPenalty,
        },
      },
      composite: compositeRaw,
    };
  });

  // Sort ALL candidates strictly from highest silent-visual score to lowest
  return scored
    .sort((a, b) => b.composite - a.composite)
    .slice(0, maxResults)
    .map((item) => item.product);
}

function computeThaiImpulsePriceScore(priceThb: number): number {
  // TikTok Shop Thailand impulse-buy sweet spot: ฿99 - ฿590 converts fastest on silent visual clips
  if (priceThb >= 99 && priceThb <= 590) return 96;
  if (priceThb > 590 && priceThb <= 990) return 82;
  if (priceThb >= 59 && priceThb < 99) return 78;
  if (priceThb > 990 && priceThb <= 1800) return 65;
  return 50;
}

function computeCommissionScore(ratePercent: number, commissionThb: number): number {
  const rateScore = clamp((ratePercent / 20) * 100, 20, 100);
  const bahtScore = commissionThb > 0 ? clamp((commissionThb / 60) * 100, 20, 100) : rateScore;
  return rateScore * 0.6 + bahtScore * 0.4;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
