const ALLOWED_TIKTOK_DOMAINS = ['tiktok.com', 'tiktokv.com'] as const;
const MAX_REDIRECT_HOPS = 6;
const DEFAULT_HOP_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 262_144; // 256 KB upper bound for HTML fallback inspection
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_ENTRIES = 500;

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

export interface ResolvedTikTokShortLink {
  productId: string | null;
  resolvedUrl: string | null;
  reason: 'resolved' | 'not_a_product_link' | 'blocked_host' | 'timeout' | 'network_error';
}

interface CacheEntry {
  productId: string;
  resolvedUrl: string | null;
  expiresAt: number;
}

const resolvedLinkCache = new Map<string, CacheEntry>();

export function clearShortLinkResolverCacheForTests(): void {
  resolvedLinkCache.clear();
}

function getCachedResolution(key: string): CacheEntry | null {
  const entry = resolvedLinkCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    resolvedLinkCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedResolution(key: string, productId: string, resolvedUrl: string | null): void {
  if (resolvedLinkCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = resolvedLinkCache.keys().next().value;
    if (oldestKey !== undefined) {
      resolvedLinkCache.delete(oldestKey);
    }
  }
  resolvedLinkCache.set(key, {
    productId,
    resolvedUrl,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Extracts the first HTTP(S) or bare TikTok/Kalodata URL from raw pasted input,
 * handling TikTok Shop mobile app share text that prepends titles or emojis.
 */
export function extractUrlFromPastedText(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const explicitMatch = trimmed.match(/https?:\/\/[^\s<>"'`]+/i);
  if (explicitMatch?.[0]) {
    return explicitMatch[0].replace(/[.,!?;:)\]}]+$/, '');
  }

  const bareHostMatch = trimmed.match(
    /(?:^|[\s(])((?:[a-z0-9-]+\.)?(?:tiktok\.com|tiktokv\.com|kalodata\.com)\/[^\s<>"'`]+)/i
  );
  if (bareHostMatch?.[1]) {
    return `https://${bareHostMatch[1].replace(/[.,!?;:)\]}]+$/, '')}`;
  }

  return null;
}

function isIpLiteral(hostname: string): boolean {
  // IPv4 literal (including shorthand numeric forms)
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return true;
  if (/^\d+$/.test(hostname)) return true;
  // IPv6 literal
  if (hostname.includes(':') || hostname.startsWith('[') || hostname.endsWith(']')) {
    return true;
  }
  return false;
}

/**
 * Strict SSRF hostname allowlist: permits ONLY official TikTok domains and their subdomains.
 */
export function isAllowedTikTokHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.+$/, '');
  if (!normalized) return false;
  if (isIpLiteral(normalized)) return false;
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    return false;
  }

  return ALLOWED_TIKTOK_DOMAINS.some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`)
  );
}

/**
 * Validates that a URL is safe to fetch server-side for TikTok redirect resolution.
 * Enforces HTTP(S) only, no credentials, standard ports only, and strict TikTok hostname allowlist.
 */
export function validateTikTokFetchUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    if (parsed.port && parsed.port !== '443' && parsed.port !== '80') {
      return null;
    }
    if (!isAllowedTikTokHostname(parsed.hostname)) {
      return null;
    }
    // Upgrade http:// to https:// for TikTok domains
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Extracts a TikTok Shop / Kalodata numeric Product ID from a structured URL without
 * falsely capturing non-product TikTok IDs (such as user_id, share_iid, group_id, or video IDs).
 */
export function extractProductIdFromTikTokUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname;

    // 1) Explicit product-specific query parameters
    for (const key of ['product_id', 'productId', 'item_id']) {
      const val = url.searchParams.get(key)?.trim();
      if (val && /^\d{12,24}$/.test(val)) {
        return val;
      }
    }

    // Generic `id` parameter is valid on Kalodata or explicit product/pdp paths
    const genericId = url.searchParams.get('id')?.trim();
    if (
      genericId &&
      /^\d{12,24}$/.test(genericId) &&
      (host.includes('kalodata.com') || /\/(?:product|pdp|shop)\b/i.test(pathname))
    ) {
      return genericId;
    }

    // 2) Structured product URL paths
    const pathPatterns = [
      /\/view\/product\/(\d{12,24})(?:\/|$)/i,
      /\/product\/(\d{12,24})(?:\/|$)/i,
      /\/shop\/(?:[a-z]{2}\/)?pdp\/(?:[^/]+\/)?(\d{12,24})(?:\/|$)/i,
      /\/pdp\/(?:[^/]+\/)?(\d{12,24})(?:\/|$)/i,
    ];
    for (const pattern of pathPatterns) {
      const match = pathname.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    // 3) Embedded JSON query parameters used by TikTok Shop share redirects
    // e.g., ec_search_share_params={"product_id":"1732824442872301494",...}
    for (const jsonParamKey of ['ec_search_share_params', 'og_info', 'share_params', 'trackParams']) {
      const rawParam = url.searchParams.get(jsonParamKey);
      if (!rawParam) continue;
      const jsonIdMatch = rawParam.match(/"(?:product_id|productId)"\s*:\s*"?(\d{12,24})"?/);
      if (jsonIdMatch?.[1]) {
        return jsonIdMatch[1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fallback scanner for bounded HTML responses returned by TikTok Shop share pages.
 */
export function extractProductIdFromHtml(html: string): string | null {
  if (!html) return null;

  // 1) Canonical or OpenGraph URL tags
  const tagPatterns = [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i,
  ];
  for (const pattern of tagPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const decodedUrl = match[1].replace(/&amp;/g, '&');
      const pid = extractProductIdFromTikTokUrl(decodedUrl);
      if (pid) return pid;
    }
  }

  // 2) Embedded TikTok Shop product URLs in scripts/markup
  const embeddedUrlMatch = html.match(
    /https?:\\?\/\\?\/(?:www\.|m\.|shop\.)?tiktok\.com\\?\/(?:view\\?\/product|product|shop\\?\/pdp)\\?\/(\d{12,24})/i
  );
  if (embeddedUrlMatch?.[1]) {
    return embeddedUrlMatch[1];
  }

  // 3) Explicit JSON product_id field
  const jsonFieldMatch = html.match(/"(?:product_id|productId)"\s*:\s*"(\d{12,24})"/);
  if (jsonFieldMatch?.[1]) {
    return jsonFieldMatch[1];
  }

  return null;
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    const fallback = await response.text();
    return fallback.slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const remaining = maxBytes - total;
      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancel errors on already-closed streams
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

/**
 * Securely resolves a TikTok Shop app short share link (e.g. vt.tiktok.com, vm.tiktok.com,
 * tiktok.com/t/...) to its numeric TikTok Shop Product ID using manual hop-by-hop redirect
 * validation against a strict TikTok hostname allowlist.
 */
export async function resolveTikTokShortLinkProductId(
  rawInput: string,
  options?: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    maxHops?: number;
  }
): Promise<ResolvedTikTokShortLink> {
  const extractedUrl = extractUrlFromPastedText(rawInput);
  if (!extractedUrl) {
    return { productId: null, resolvedUrl: null, reason: 'not_a_product_link' };
  }

  // Fast path: if the extracted URL already contains a Product ID, no network fetch needed
  const directPid = extractProductIdFromTikTokUrl(extractedUrl);
  if (directPid) {
    return { productId: directPid, resolvedUrl: extractedUrl, reason: 'resolved' };
  }

  const initialUrl = validateTikTokFetchUrl(extractedUrl);
  if (!initialUrl) {
    return { productId: null, resolvedUrl: null, reason: 'blocked_host' };
  }

  const cacheKey = initialUrl.toString();
  const cached = getCachedResolution(cacheKey);
  if (cached) {
    return {
      productId: cached.productId,
      resolvedUrl: cached.resolvedUrl,
      reason: 'resolved',
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_HOP_TIMEOUT_MS;
  const maxHops = Math.max(1, Math.min(8, options?.maxHops ?? MAX_REDIRECT_HOPS));

  let currentUrl = initialUrl.toString();

  for (let hop = 0; hop < maxHops; hop++) {
    const validatedCurrent = validateTikTokFetchUrl(currentUrl);
    if (!validatedCurrent) {
      return { productId: null, resolvedUrl: null, reason: 'blocked_host' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetchImpl(validatedCurrent.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
    } catch (err) {
      clearTimeout(timer);
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || /abort|timeout/i.test(err.message));
      return {
        productId: null,
        resolvedUrl: currentUrl,
        reason: isAbort ? 'timeout' : 'network_error',
      };
    } finally {
      clearTimeout(timer);
    }

    // Handle HTTP 3xx redirects manually so EVERY hop is validated against the allowlist
    if (response.status >= 300 && response.status < 400) {
      const locationHeader = response.headers.get('location');
      // Cancel body stream immediately on redirects
      try {
        await response.body?.cancel();
      } catch {
        // Ignore
      }
      if (!locationHeader) {
        return { productId: null, resolvedUrl: currentUrl, reason: 'not_a_product_link' };
      }

      let nextUrlStr: string;
      try {
        nextUrlStr = new URL(locationHeader, validatedCurrent).toString();
      } catch {
        return { productId: null, resolvedUrl: currentUrl, reason: 'blocked_host' };
      }

      const validatedNext = validateTikTokFetchUrl(nextUrlStr);
      if (!validatedNext) {
        return { productId: null, resolvedUrl: null, reason: 'blocked_host' };
      }

      // Check immediately if the redirect target already reveals the Product ID!
      const nextPid = extractProductIdFromTikTokUrl(validatedNext.toString());
      if (nextPid) {
        setCachedResolution(cacheKey, nextPid, validatedNext.toString());
        return {
          productId: nextPid,
          resolvedUrl: validatedNext.toString(),
          reason: 'resolved',
        };
      }

      currentUrl = validatedNext.toString();
      continue;
    }

    // Non-redirect response (e.g., 200 OK): inspect URL and bounded HTML fallback
    const urlPid = extractProductIdFromTikTokUrl(currentUrl);
    if (urlPid) {
      try {
        await response.body?.cancel();
      } catch {
        // Ignore
      }
      setCachedResolution(cacheKey, urlPid, currentUrl);
      return { productId: urlPid, resolvedUrl: currentUrl, reason: 'resolved' };
    }

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && /(?:text\/html|application\/xhtml|text\/plain)/i.test(contentType)) {
      try {
        const html = await readBoundedText(response, MAX_HTML_BYTES);
        const htmlPid = extractProductIdFromHtml(html);
        if (htmlPid) {
          setCachedResolution(cacheKey, htmlPid, currentUrl);
          return { productId: htmlPid, resolvedUrl: currentUrl, reason: 'resolved' };
        }
      } catch {
        return { productId: null, resolvedUrl: currentUrl, reason: 'network_error' };
      }
    } else {
      try {
        await response.body?.cancel();
      } catch {
        // Ignore
      }
    }

    return { productId: null, resolvedUrl: currentUrl, reason: 'not_a_product_link' };
  }

  return { productId: null, resolvedUrl: currentUrl, reason: 'not_a_product_link' };
}
