import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearSessionKalodataKey,
  fetchKalodataCreditBalance,
  getActiveKalodataKey,
  getCachedKalodataStatus,
  KalodataApiError,
  maskApiKey,
  sanitizeKalodataErrorText,
  setSessionKalodataKey,
  verifyAndConnectKalodataKey,
} from '../server/kalodata.ts';

const ORIGINAL_ENV_KEY = process.env.KALODATA_API_KEY;
const ORIGINAL_FETCH = globalThis.fetch;

function restoreEnvAndFetch() {
  if (ORIGINAL_ENV_KEY === undefined) {
    delete process.env.KALODATA_API_KEY;
  } else {
    process.env.KALODATA_API_KEY = ORIGINAL_ENV_KEY;
  }
  clearSessionKalodataKey();
  globalThis.fetch = ORIGINAL_FETCH;
}

describe('Phase 0 — Kalodata Backend Secret Isolation, Zero Leakage & Distinct Error Handling', () => {
  afterEach(() => {
    restoreEnvAndFetch();
  });

  it('prioritizes Backend Secret process.env.KALODATA_API_KEY over any UI session key and never exposes key characters', async () => {
    const fakeBackendSecret = 'kalo_backend_secret_TEST_ONLY_99887766';
    const fakeUiKey = 'kalo_ui_session_TEST_ONLY_11223344';

    process.env.KALODATA_API_KEY = fakeBackendSecret;
    setSessionKalodataKey(fakeUiKey);

    const active = getActiveKalodataKey();
    assert.equal(active.source, 'env');
    assert.equal(active.key, fakeBackendSecret);

    // Status response must NEVER expose raw or partial key characters
    const status = getCachedKalodataStatus();
    assert.equal(status.connected, true);
    assert.equal(status.keySource, 'env');
    assert.equal(status.maskedKey, null);
    assert.equal(maskApiKey(fakeBackendSecret), null);
    assert.ok(!JSON.stringify(status).includes(fakeBackendSecret.slice(0, 4)));

    // Attempting UI connect while Backend Secret is configured must be rejected without mixing keys
    await assert.rejects(
      () => verifyAndConnectKalodataKey(fakeUiKey),
      (err: unknown) => {
        assert.ok(err instanceof KalodataApiError);
        assert.equal(err.httpStatus, 409);
        assert.ok(!err.message.includes(fakeBackendSecret));
        assert.ok(!err.message.includes(fakeUiKey));
        return true;
      }
    );
  });

  it('sanitizes API keys, secret-key headers, and long tokens from upstream error messages', () => {
    const fakeKey = 'test_secret_abc123XYZ789000111';
    const raw = `The key ${fakeKey} is not allowed; secret-key=${fakeKey}`;
    const cleaned = sanitizeKalodataErrorText(raw, fakeKey);
    assert.ok(!cleaned.includes(fakeKey));
    assert.ok(cleaned.includes('[REDACTED]'));
  });

  it('throws distinct KALODATA_NOT_CONNECTED (503) when API key is missing', async () => {
    delete process.env.KALODATA_API_KEY;
    clearSessionKalodataKey();

    await assert.rejects(
      () => fetchKalodataCreditBalance(),
      (err: unknown) => {
        assert.ok(err instanceof KalodataApiError);
        assert.equal(err.code, 'KALODATA_NOT_CONNECTED');
        assert.equal(err.httpStatus, 503);
        return true;
      }
    );
  });

  it('throws distinct KALODATA_INVALID_KEY (401) without echoing raw upstream key text', async () => {
    const fakeKey = 'kalo_secret_should_never_echo_123456';
    process.env.KALODATA_API_KEY = fakeKey;

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          success: false,
          code: '501',
          message: `The key ${fakeKey} is not allowed to call this endpoint`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    await assert.rejects(
      () => fetchKalodataCreditBalance(),
      (err: unknown) => {
        assert.ok(err instanceof KalodataApiError);
        assert.equal(err.code, 'KALODATA_INVALID_KEY');
        assert.equal(err.httpStatus, 401);
        assert.ok(!err.message.includes(fakeKey), 'Error message must never echo API key');
        return true;
      }
    );
  });

  it('throws distinct KALODATA_RATE_LIMITED (429) for both JSON and non-JSON rate-limit responses', async () => {
    process.env.KALODATA_API_KEY = 'kalo_rate_limit_test_key_12345';

    // Non-JSON 429
    globalThis.fetch = (async () =>
      new Response('Too Many Requests', { status: 429 })) as typeof fetch;

    await assert.rejects(
      () => fetchKalodataCreditBalance(),
      (err: unknown) => {
        assert.ok(err instanceof KalodataApiError);
        assert.equal(err.code, 'KALODATA_RATE_LIMITED');
        assert.equal(err.httpStatus, 429);
        return true;
      }
    );

    // JSON envelope QPS limit
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ success: false, code: '429', message: 'QPS limit exceeded' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    await assert.rejects(
      () => fetchKalodataCreditBalance(),
      (err: unknown) => {
        assert.ok(err instanceof KalodataApiError);
        assert.equal(err.code, 'KALODATA_RATE_LIMITED');
        assert.equal(err.httpStatus, 429);
        return true;
      }
    );
  });

  it('throws distinct KALODATA_TIMEOUT (504) on AbortError and sanitized KALODATA_UPSTREAM_ERROR (502) on API errors', async () => {
    const fakeKey = 'kalo_upstream_test_secret_987654321';
    process.env.KALODATA_API_KEY = fakeKey;

    // AbortError -> KALODATA_TIMEOUT (504)
    globalThis.fetch = (async () => {
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }) as typeof fetch;

    await assert.rejects(
      () => fetchKalodataCreditBalance(),
      (err: unknown) => {
        assert.ok(err instanceof KalodataApiError);
        assert.equal(err.code, 'KALODATA_TIMEOUT');
        assert.equal(err.httpStatus, 504);
        return true;
      }
    );

    // Upstream API error echoing key -> sanitized KALODATA_UPSTREAM_ERROR (502)
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          success: false,
          code: '500',
          message: `Internal backend failure for secret-key=${fakeKey}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    await assert.rejects(
      () => fetchKalodataCreditBalance(),
      (err: unknown) => {
        assert.ok(err instanceof KalodataApiError);
        assert.equal(err.code, 'KALODATA_UPSTREAM_ERROR');
        assert.equal(err.httpStatus, 502);
        assert.ok(!err.message.includes(fakeKey), 'Upstream error message must never leak API key');
        return true;
      }
    );
  });
});
