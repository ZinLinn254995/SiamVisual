import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectQueryLink } from '../src/lib/productLinkInspector.ts';
import { parseProductLinkInput } from '../server/kalodata.ts';
import {
  clearShortLinkResolverCacheForTests,
  extractProductIdFromHtml,
  extractProductIdFromTikTokUrl,
  isAllowedTikTokHostname,
  resolveTikTokShortLinkProductId,
  validateTikTokFetchUrl,
} from '../server/tiktokLinkResolver.ts';

test('TikTok short link inspection handles vt/vm/t links, share text, and rejects video IDs', () => {
  const cases = [
    'https://vt.tiktok.com/ZS9Pbdv6TfLcg-TvJcg/',
    'https://vm.tiktok.com/ZM9AbCdEf/',
    'https://www.tiktok.com/t/ZT8AbCdEf/',
    'กระเป๋าสะพายทรงสี่เหลี่ยมสไตล์เกาหลี https://vt.tiktok.com/ZS9Pbdv6TfLcg-TvJcg/',
    'vt.tiktok.com/ZS9Pbdv6TfLcg-TvJcg/',
  ];

  for (const input of cases) {
    assert.deepEqual(inspectQueryLink(input), {
      isLinkOrId: true,
      productId: null,
      isShortLink: true,
    });
    assert.deepEqual(parseProductLinkInput(input), {
      isLinkOrId: true,
      productId: null,
      isShortLink: true,
    });
  }

  // Full product link embedded in share text extracts exact product ID (not user_id)
  const shareTextWithFullUrl =
    'กระเป๋าสะพายทรงสี่เหลี่ยม https://www.tiktok.com/view/product/1732824442872301494?user_id=7641829209836618753&share_iid=7709425135912290049';
  assert.deepEqual(inspectQueryLink(shareTextWithFullUrl), {
    isLinkOrId: true,
    productId: '1732824442872301494',
    isShortLink: false,
  });
  assert.deepEqual(parseProductLinkInput(shareTextWithFullUrl), {
    isLinkOrId: true,
    productId: '1732824442872301494',
    isShortLink: false,
  });

  // Regular TikTok video URL must NOT be mistaken for a product ID
  const videoUrl = 'https://www.tiktok.com/@creator/video/7412345678901234567?user_id=7641829209836618753';
  assert.deepEqual(inspectQueryLink(videoUrl), {
    isLinkOrId: true,
    productId: null,
    isShortLink: false,
  });
  assert.deepEqual(parseProductLinkInput(videoUrl), {
    isLinkOrId: true,
    productId: null,
    isShortLink: false,
  });
});

test('SSRF defenses allow only official TikTok domains and block local/private/third-party targets', () => {
  assert.equal(isAllowedTikTokHostname('vt.tiktok.com'), true);
  assert.equal(isAllowedTikTokHostname('vm.tiktok.com'), true);
  assert.equal(isAllowedTikTokHostname('www.tiktok.com'), true);
  assert.equal(isAllowedTikTokHostname('shop.tiktok.com'), true);
  assert.equal(isAllowedTikTokHostname('oec-api.tiktokv.com'), true);

  // Blocked hostnames
  assert.equal(isAllowedTikTokHostname('localhost'), false);
  assert.equal(isAllowedTikTokHostname('127.0.0.1'), false);
  assert.equal(isAllowedTikTokHostname('169.254.169.254'), false);
  assert.equal(isAllowedTikTokHostname('[::1]'), false);
  assert.equal(isAllowedTikTokHostname('vt.tiktok.com.evil.com'), false);
  assert.equal(isAllowedTikTokHostname('faketiktok.com'), false);
  assert.equal(isAllowedTikTokHostname('evil.example'), false);

  // Blocked URLs (schemes, credentials, non-standard ports, private IPs)
  assert.equal(validateTikTokFetchUrl('http://127.0.0.1:3000/api/health'), null);
  assert.equal(validateTikTokFetchUrl('http://169.254.169.254/latest/meta-data/'), null);
  assert.equal(validateTikTokFetchUrl('file:///etc/passwd'), null);
  assert.equal(validateTikTokFetchUrl('https://user:pass@vt.tiktok.com/abc'), null);
  assert.equal(validateTikTokFetchUrl('https://vt.tiktok.com:8443/abc'), null);
  assert.equal(validateTikTokFetchUrl('https://vt.tiktok.com.attacker.com/abc'), null);

  // Valid TikTok URL upgrades http -> https
  const upgraded = validateTikTokFetchUrl('http://vt.tiktok.com/ZS9Pbdv6TfLcg-TvJcg/');
  assert.equal(upgraded?.toString(), 'https://vt.tiktok.com/ZS9Pbdv6TfLcg-TvJcg/');
});

test('extractProductIdFromTikTokUrl extracts product IDs accurately and ignores user/video IDs', () => {
  assert.equal(
    extractProductIdFromTikTokUrl(
      'https://www.tiktok.com/view/product/1732824442872301494?user_id=7641829209836618753'
    ),
    '1732824442872301494'
  );
  assert.equal(
    extractProductIdFromTikTokUrl(
      'https://shop.tiktok.com/shop/th/pdp/korean-bag/1732824442872301494'
    ),
    '1732824442872301494'
  );
  assert.equal(
    extractProductIdFromTikTokUrl(
      'https://oec-api.tiktokv.com/share?ec_search_share_params=%7B%22product_id%22%3A%221732824442872301494%22%7D'
    ),
    '1732824442872301494'
  );
  assert.equal(
    extractProductIdFromTikTokUrl(
      'https://www.tiktok.com/@creator/video/7412345678901234567?user_id=7641829209836618753'
    ),
    null
  );
});

test('extractProductIdFromHtml extracts canonical and embedded JSON product IDs', () => {
  assert.equal(
    extractProductIdFromHtml(
      '<html><head><link rel="canonical" href="https://shop.tiktok.com/view/product/1732824442872301494?region=TH"></head></html>'
    ),
    '1732824442872301494'
  );
  assert.equal(
    extractProductIdFromHtml('<script>window.__DATA__={"product_id":"1732824442872301494"};</script>'),
    '1732824442872301494'
  );
  assert.equal(extractProductIdFromHtml('<html><body>No product here</body></html>'), null);
});

test('resolveTikTokShortLinkProductId resolves single-hop 301 redirect and caches result', async () => {
  clearShortLinkResolverCacheForTests();
  let fetchCalls = 0;

  const mockFetch: typeof fetch = async (input) => {
    fetchCalls += 1;
    assert.equal(String(input), 'https://vt.tiktok.com/ZS9Pbdv6TfLcg-TvJcg/');
    return new Response(null, {
      status: 301,
      headers: {
        location:
          'https://www.tiktok.com/view/product/1732824442872301494?user_id=7641829209836618753&share_region=TH',
      },
    });
  };

  const first = await resolveTikTokShortLinkProductId(
    'กระเป๋าสะพายทรงสี่เหลี่ยม https://vt.tiktok.com/ZS9Pbdv6TfLcg-TvJcg/',
    { fetchImpl: mockFetch }
  );
  assert.equal(first.reason, 'resolved');
  assert.equal(first.productId, '1732824442872301494');
  assert.equal(fetchCalls, 1);

  // Second call should hit cache without calling fetch again
  const second = await resolveTikTokShortLinkProductId(
    'https://vt.tiktok.com/ZS9Pbdv6TfLcg-TvJcg/',
    { fetchImpl: mockFetch }
  );
  assert.equal(second.reason, 'resolved');
  assert.equal(second.productId, '1732824442872301494');
  assert.equal(fetchCalls, 1);
});

test('resolveTikTokShortLinkProductId follows multi-hop TikTok redirects and supports HTML canonical fallback', async () => {
  clearShortLinkResolverCacheForTests();
  let hop = 0;

  const mockFetch: typeof fetch = async () => {
    hop += 1;
    if (hop === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: 'https://m.tiktok.com/share/landing?code=abc' },
      });
    }
    return new Response(
      '<html><head><meta property="og:url" content="https://shop.tiktok.com/view/product/1731299385569545105?region=TH"></head></html>',
      {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }
    );
  };

  const result = await resolveTikTokShortLinkProductId('https://vm.tiktok.com/ZM9TestHtml/', {
    fetchImpl: mockFetch,
  });
  assert.equal(result.reason, 'resolved');
  assert.equal(result.productId, '1731299385569545105');
  assert.equal(hop, 2);
});

test('resolveTikTokShortLinkProductId rejects non-product TikTok videos and SSRF redirect hops', async () => {
  clearShortLinkResolverCacheForTests();

  // Video short link must return not_a_product_link
  const videoFetch: typeof fetch = async () =>
    new Response(null, {
      status: 301,
      headers: {
        location: 'https://www.tiktok.com/@creator/video/7412345678901234567?user_id=7641829209836618753',
      },
    });

  const videoRes = await resolveTikTokShortLinkProductId('https://vt.tiktok.com/ZSVideoOnly/', {
    fetchImpl: async (input) => {
      if (String(input).includes('ZSVideoOnly')) {
        return videoFetch(input);
      }
      return new Response('<html><body>Video page</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    },
  });
  assert.equal(videoRes.productId, null);
  assert.equal(videoRes.reason, 'not_a_product_link');

  // SSRF redirect to metadata IP must be blocked immediately before fetching the target
  let fetchedUrls: string[] = [];
  const ssrfRedirectRes = await resolveTikTokShortLinkProductId('https://vt.tiktok.com/ZSSsrfHop/', {
    fetchImpl: async (input) => {
      fetchedUrls.push(String(input));
      return new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data/' },
      });
    },
  });
  assert.equal(ssrfRedirectRes.productId, null);
  assert.equal(ssrfRedirectRes.reason, 'blocked_host');
  assert.deepEqual(fetchedUrls, ['https://vt.tiktok.com/ZSSsrfHop/']);

  // Direct non-TikTok host must be blocked with 0 fetch calls
  let directCalls = 0;
  const blockedDirect = await resolveTikTokShortLinkProductId('http://127.0.0.1:3000/api/health', {
    fetchImpl: async () => {
      directCalls += 1;
      return new Response('nope');
    },
  });
  assert.equal(blockedDirect.productId, null);
  assert.equal(blockedDirect.reason, 'blocked_host');
  assert.equal(directCalls, 0);
});
