import type { ProductItem } from '../src/types.ts';

function safeFinite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sanitizes client-supplied ProductItem payloads sent to AI endpoints.
 * Preserves verified zero values (e.g., 0% commission / 0 THB payout) instead of
 * fabricating non-zero minimums like 0.1% or ฿1.
 */
export function sanitizeProductPayloadForAi(
  product: ProductItem,
  options?: { forVideoPlan?: boolean }
): ProductItem {
  const forVideoPlan = options?.forVideoPlan === true;
  const rawDeep = product.deepInsights;
  const safeDeepInsights =
    rawDeep && typeof rawDeep === 'object'
      ? {
          description:
            typeof rawDeep.description === 'string'
              ? rawDeep.description.slice(0, 700)
              : undefined,
          highlights: Array.isArray(rawDeep.highlights)
            ? rawDeep.highlights
                .map((h) => String(h).slice(0, forVideoPlan ? 100 : 120))
                .slice(0, 8)
            : undefined,
          painPoints: Array.isArray(rawDeep.painPoints)
            ? rawDeep.painPoints
                .map((p) => String(p).slice(0, forVideoPlan ? 180 : 200))
                .slice(0, 6)
            : undefined,
          usageScenarios: Array.isArray(rawDeep.usageScenarios)
            ? rawDeep.usageScenarios
                .map((u) => String(u).slice(0, forVideoPlan ? 180 : 200))
                .slice(0, 6)
            : undefined,
          fetchedAt: String(rawDeep.fetchedAt || new Date().toISOString()),
        }
      : undefined;

  const rawM = product.kalodataMetrics;
  const safeTrend = Array.isArray(rawM?.revenueTrendThb)
    ? rawM.revenueTrendThb
        .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0)
        .slice(0, 31)
    : undefined;
  const safeMetrics =
    rawM && typeof rawM === 'object'
      ? {
          salesVolume7d: safeFinite(rawM.salesVolume7d),
          revenueThb7d: safeFinite(rawM.revenueThb7d),
          videoRevenueThb7d: safeFinite(rawM.videoRevenueThb7d),
          liveRevenueThb7d: safeFinite(rawM.liveRevenueThb7d),
          shoppingMallRevenueThb7d: safeFinite(rawM.shoppingMallRevenueThb7d),
          revenueGrowthRate: safeFinite(rawM.revenueGrowthRate),
          creatorCount: safeFinite(rawM.creatorCount),
          rating: safeFinite(rawM.rating),
          reviewCount: safeFinite(rawM.reviewCount),
          ...(safeTrend && safeTrend.length > 0 ? { revenueTrendThb: safeTrend } : {}),
          videoCount: safeFinite(rawM.videoCount),
          liveCount: safeFinite(rawM.liveCount),
          launchDate: typeof rawM.launchDate === 'string' ? rawM.launchDate.slice(0, 32) : undefined,
          deliveryType: typeof rawM.deliveryType === 'string' ? rawM.deliveryType.slice(0, 48) : undefined,
          dateRange:
            typeof rawM.dateRange === 'string' ? rawM.dateRange.slice(0, 32) : 'last7Day',
          fetchedAt: typeof rawM.fetchedAt === 'string' ? rawM.fetchedAt.slice(0, 48) : undefined,
        }
      : undefined;

  const titleMax = forVideoPlan ? 260 : 280;
  const clearMax = forVideoPlan ? 200 : 220;

  return {
    ...product,
    id: String(product.id || 'product').slice(0, 80),
    thaiTitle: product.thaiTitle.trim().slice(0, titleMax),
    clearTitle: {
      my: String(product.clearTitle?.my || product.clearTitle?.en || product.thaiTitle).slice(
        0,
        clearMax
      ),
      en: String(product.clearTitle?.en || product.thaiTitle).slice(0, clearMax),
    },
    whatItIs: {
      my: String(product.whatItIs?.my || '').slice(0, 600),
      en: String(product.whatItIs?.en || '').slice(0, 600),
    },
    whySilentWorks: {
      my: String(product.whySilentWorks?.my || '').slice(0, 400),
      en: String(product.whySilentWorks?.en || '').slice(0, 400),
    },
    categoryLabel: {
      my: String(product.categoryLabel?.my || '').slice(0, 80),
      en: String(product.categoryLabel?.en || product.category || 'General').slice(0, 80),
    },
    shopName: String(product.shopName || 'TikTok Shop TH').slice(0, 120),
    priceThb:
      typeof product.priceThb === 'number' && Number.isFinite(product.priceThb)
        ? Math.max(0, Math.min(1000000, Math.round(product.priceThb)))
        : null,
    commissionRate:
      typeof product.commissionRate === 'number' && Number.isFinite(product.commissionRate)
        ? roundToTwoDecimals(Math.max(0, Math.min(100, product.commissionRate)))
        : null,
    commissionThb:
      typeof product.commissionThb === 'number' && Number.isFinite(product.commissionThb)
        ? roundToTwoDecimals(Math.max(0, Math.min(200000, product.commissionThb)))
        : null,
    ...(safeMetrics ? { kalodataMetrics: safeMetrics } : {}),
    deepInsights: safeDeepInsights,
  };
}
