export interface InspectedQueryLink {
  isLinkOrId: boolean;
  productId: string | null;
  isShortLink: boolean;
}

function extractUrlCandidate(trimmed: string): string | null {
  const explicitMatch = trimmed.match(/https?:\/\/[^\s<>"'`]+/i);
  if (explicitMatch?.[0]) {
    return explicitMatch[0].replace(/[.,!?;:)\]}]+$/, '');
  }
  const bareMatch = trimmed.match(
    /(?:^|[\s(])((?:[a-z0-9-]+\.)?(?:tiktok\.com|tiktokv\.com|kalodata\.com)\/[^\s<>"'`]+)/i
  );
  if (bareMatch?.[1]) {
    return `https://${bareMatch[1].replace(/[.,!?;:)\]}]+$/, '')}`;
  }
  return null;
}

function isTikTokShortUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === 'vt.tiktok.com' || host === 'vm.tiktok.com') {
    return true;
  }
  if ((host === 'tiktok.com' || host.endsWith('.tiktok.com')) && /^\/t\/[A-Za-z0-9_-]+/i.test(url.pathname)) {
    return true;
  }
  return false;
}

/**
 * Inspects a user search input to distinguish normal keyword queries from
 * single TikTok Shop / Kalodata product URLs, TikTok app short links, or numeric product IDs.
 */
export function inspectQueryLink(rawInput: string): InspectedQueryLink {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { isLinkOrId: false, productId: null, isShortLink: false };
  }

  if (/^\d{12,24}$/.test(trimmed)) {
    return { isLinkOrId: true, productId: trimmed, isShortLink: false };
  }

  const extractedUrl = extractUrlCandidate(trimmed);
  const looksLikeUrl =
    Boolean(extractedUrl) ||
    /^https?:\/\//i.test(trimmed) ||
    /(?:tiktok\.com|tiktokv\.com|kalodata\.com)/i.test(trimmed);

  if (!looksLikeUrl) {
    return { isLinkOrId: false, productId: null, isShortLink: false };
  }

  const candidate = extractedUrl ?? (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);

  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname;

    // Explicit product query params first
    for (const key of ['product_id', 'productId', 'item_id']) {
      const val = url.searchParams.get(key)?.trim();
      if (val && /^\d{12,24}$/.test(val)) {
        return { isLinkOrId: true, productId: val, isShortLink: false };
      }
    }

    const genericId = url.searchParams.get('id')?.trim();
    if (
      genericId &&
      /^\d{12,24}$/.test(genericId) &&
      (host.includes('kalodata.com') || /\/(?:product|pdp|shop)\b/i.test(pathname))
    ) {
      return { isLinkOrId: true, productId: genericId, isShortLink: false };
    }

    // Structured product paths
    const productPathPatterns = [
      /\/view\/product\/(\d{12,24})(?:\/|$)/i,
      /\/product\/(\d{12,24})(?:\/|$)/i,
      /\/shop\/(?:[a-z]{2}\/)?pdp\/(?:[^/]+\/)?(\d{12,24})(?:\/|$)/i,
      /\/pdp\/(?:[^/]+\/)?(\d{12,24})(?:\/|$)/i,
    ];
    for (const pattern of productPathPatterns) {
      const pathMatch = pathname.match(pattern);
      if (pathMatch?.[1]) {
        return { isLinkOrId: true, productId: pathMatch[1], isShortLink: false };
      }
    }

    // Embedded JSON query params (e.g. ec_search_share_params)
    for (const jsonKey of ['ec_search_share_params', 'og_info', 'share_params']) {
      const rawParam = url.searchParams.get(jsonKey);
      if (!rawParam) continue;
      const jsonId = rawParam.match(/"(?:product_id|productId)"\s*:\s*"?(\d{12,24})"?/);
      if (jsonId?.[1]) {
        return { isLinkOrId: true, productId: jsonId[1], isShortLink: false };
      }
    }

    if (isTikTokShortUrl(url)) {
      return { isLinkOrId: true, productId: null, isShortLink: true };
    }

    // Avoid falsely treating TikTok video/profile URLs as product IDs
    if (/\/@[^/]+\/video\/\d+/i.test(pathname)) {
      return { isLinkOrId: true, productId: null, isShortLink: false };
    }

    // Generic path numeric ID fallback for non-video product URLs (e.g. Kalodata paths)
    const fallbackPathMatch = pathname.match(/(\d{12,24})/);
    if (fallbackPathMatch?.[1]) {
      return { isLinkOrId: true, productId: fallbackPathMatch[1], isShortLink: false };
    }
  } catch {
    // Fallback regex scan below
  }

  const isShort = /(?:v[tm]\.tiktok\.com\/|tiktok\.com\/t\/)/i.test(trimmed);
  if (isShort) {
    return { isLinkOrId: true, productId: null, isShortLink: true };
  }

  const anyId = trimmed.match(/\b(\d{12,24})\b/);
  if (anyId?.[1] && !/\/@[^/]+\/video\/\d+/i.test(trimmed)) {
    return { isLinkOrId: true, productId: anyId[1], isShortLink: false };
  }

  return {
    isLinkOrId: true,
    productId: null,
    isShortLink: false,
  };
}

