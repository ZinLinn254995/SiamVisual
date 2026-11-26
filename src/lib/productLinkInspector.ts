export interface InspectedQueryLink {
  isLinkOrId: boolean;
  productId: string | null;
  isShortLink: boolean;
}

/**
 * Inspects a user search input to distinguish normal keyword queries from
 * single TikTok Shop / Kalodata product URLs or numeric product IDs.
 */
export function inspectQueryLink(rawInput: string): InspectedQueryLink {
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
