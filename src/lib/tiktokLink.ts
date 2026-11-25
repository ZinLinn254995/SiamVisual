import type { ProductItem } from '../types';

/**
 * Resolves the direct Thailand TikTok Shop product URL for a Kalodata product.
 * Uses the native www.tiktok.com/view/product/{id}?region=TH&local=th format so
 * Thailand-region TikTok apps route directly to the PDP instead of dropping to the feed.
 */
export function getTikTokShopProductUrl(
  product: Pick<ProductItem, 'id' | 'productUrl'>
): string | null {
  const rawUrl = product.productUrl?.trim();
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (
        (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
        /(?:^|\.)tiktok\.com$/i.test(parsed.hostname)
      ) {
        return parsed.toString();
      }
    } catch {
      // Ignore malformed URL and fall back to Product ID
    }
  }

  const cleanId = String(product.id || '').trim();
  if (/^\d{10,24}$/.test(cleanId)) {
    return `https://www.tiktok.com/view/product/${cleanId}?region=TH&local=th`;
  }

  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.toString();
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Direct Kalodata product detail URL — opens cleanly in browser even if the user's
 * TikTok app account is outside Thailand (where TikTok's mobile app blocks cross-region PDP links).
 */
export function getKalodataProductUrl(productId: string): string | null {
  const cleanId = String(productId || '').trim();
  if (/^\d{10,24}$/.test(cleanId)) {
    return `https://www.kalodata.com/product/detail?id=${cleanId}`;
  }
  return null;
}
