import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ProductItem, VideoIdeaConcept, VideoIdeasStrategyPack } from './src/types.ts';
import {
  clearSessionKalodataKey,
  enrichSingleKalodataProduct,
  fetchKalodataCreditBalance,
  fetchKalodataLiveCategories,
  getCachedKalodataStatus,
  KalodataApiError,
  OFFICIAL_TH_CATEGORIES,
  sanitizeKalodataErrorText,
  verifyAndConnectKalodataKey,
} from './server/kalodata.ts';
import {
  analyzeProductWithAi,
  explainExistingProducts,
  generateIdeaVideoPlan,
  searchSilentVisualProducts,
  syncThailandRankBoard,
} from './server/productService.ts';
import { sanitizeProductPayloadForAi } from './server/productSanitizer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseOptionalNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
    return val;
  }
  return null;
}

function mapApiError(err: unknown): { status: number; code: string; message: string } {
  if (err instanceof KalodataApiError) {
    return {
      status: err.httpStatus,
      code: err.code,
      message: err.message,
    };
  }
  const raw = err instanceof Error ? err.message : String(err);
  if (
    raw.includes('GEMINI_API_KEY_MISSING') ||
    raw.includes('API_KEY_INVALID') ||
    raw.includes('PERMISSION_DENIED') ||
    raw.includes('403')
  ) {
    return {
      status: 503,
      code: 'API_KEY_REQUIRED',
      message: 'Please check that your Gemini API key is configured in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message: 'Rate limit reached. Please wait a moment and try again.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 502,
      code: 'MODEL_UNAVAILABLE',
      message: 'AI model is temporarily unavailable. Please try again shortly.',
    };
  }
  if (
    raw.includes('503') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('high demand') ||
    raw.includes('overloaded')
  ) {
    return {
      status: 503,
      code: 'AI_BUSY',
      message: 'AI server is temporarily busy due to high demand. Please try again in a few seconds.',
    };
  }
  if (raw.includes('TIMEOUT')) {
    return {
      status: 504,
      code: 'AI_TIMEOUT',
      message: 'AI generation took longer than expected. Please try again.',
    };
  }
  return {
    status: 500,
    code: 'REQUEST_FAILED',
    message: 'Unable to complete the request right now. Please try again in a moment.',
  };
}

/**
 * Streams NDJSON keep-alive heartbeats every 2.5s while an async AI task runs so
 * reverse proxies (Cloud Run / Preview Gateway) never drop the connection with a 504 HTML page.
 */
async function streamNdjsonAction<T>(
  _req: express.Request,
  res: express.Response,
  work: (onProgress: () => void) => Promise<T>
): Promise<void> {
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let closed = false;
  res.on('close', () => {
    if (!res.writableFinished) {
      closed = true;
    }
  });

  const safeWrite = (payload: Record<string, unknown>) => {
    if (closed || res.writableEnded || res.destroyed) return;
    try {
      res.write(`${JSON.stringify(payload)}\n`);
    } catch {
      closed = true;
    }
  };

  // Emit an immediate keep-alive frame so the proxy sees live upstream bytes at t=0
  safeWrite({ type: 'ping' });

  let lastPingAt = Date.now();
  const heartbeat = setInterval(() => {
    if (closed || res.writableEnded || res.destroyed) {
      clearInterval(heartbeat);
      return;
    }
    safeWrite({ type: 'ping' });
    lastPingAt = Date.now();
  }, 2500);

  const onProgress = () => {
    const now = Date.now();
    if (now - lastPingAt >= 2000) {
      lastPingAt = now;
      safeWrite({ type: 'ping' });
    }
  };

  try {
    const data = await work(onProgress);
    clearInterval(heartbeat);
    safeWrite({ type: 'result', data });
    if (!closed && !res.writableEnded && !res.destroyed) {
      res.end();
    }
  } catch (err) {
    clearInterval(heartbeat);
    const mapped = mapApiError(err);
    if (mapped.code === 'API_KEY_REQUIRED') {
      console.warn('[SiamVisual AI] GEMINI_API_KEY is not configured in Settings > Secrets.');
    } else if (
      mapped.code === 'AI_BUSY' ||
      mapped.code === 'QUOTA_EXCEEDED' ||
      mapped.code === 'AI_TIMEOUT'
    ) {
      console.warn(
        `[SiamVisual AI Stream Notice] code=${mapped.code} status=${mapped.status} msg=${sanitizeKalodataErrorText(mapped.message)}`
      );
    } else {
      console.error(
        `[SiamVisual AI Stream Error] code=${mapped.code} status=${mapped.status} msg=${sanitizeKalodataErrorText(mapped.message)}`
      );
    }
    safeWrite({
      type: 'error',
      error: mapped.message,
      code: mapped.code,
      status: mapped.status,
    });
    if (!closed && !res.writableEnded && !res.destroyed) {
      res.end();
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Kalodata Open Center connection status + live credit balance + official TH categories
  app.get('/api/kalodata/status', async (_req, res) => {
    const status = getCachedKalodataStatus();
    if (status.connected && !status.balance) {
      try {
        status.balance = await fetchKalodataCreditBalance();
      } catch {
        // Keep connected status cleanly; user can manually refresh
      }
    }
    res.json({
      ...status,
      officialCategories: OFFICIAL_TH_CATEGORIES,
    });
  });

  app.post('/api/kalodata/connect', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
      if (!apiKey) {
        res.status(400).json({
          code: 'KALODATA_INVALID_KEY',
          error: 'Please paste your Kalodata API key.',
        });
        return;
      }

      const status = await verifyAndConnectKalodataKey(apiKey);
      res.json(status);
    } catch (err) {
      const mapped = mapApiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  app.delete('/api/kalodata/connect', (_req, res) => {
    clearSessionKalodataKey();
    res.json(getCachedKalodataStatus());
  });

  app.get('/api/kalodata/balance', async (_req, res) => {
    try {
      const balance = await fetchKalodataCreditBalance();
      res.json({ balance });
    } catch (err) {
      const mapped = mapApiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Explicit user-triggered sync of live Thailand L1 TikTok Shop categories from Kalodata (~0.2 cr)
  app.post('/api/kalodata/categories/sync', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const minBalanceReserve = parseOptionalNumber(body?.minBalanceReserve);
      const maxSpendRemaining = parseOptionalNumber(body?.maxSpendRemaining);

      const result = await fetchKalodataLiveCategories({
        minBalanceReserve,
        maxSpendRemaining,
      });
      res.json(result);
    } catch (err) {
      const mapped = mapApiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Explicit user-triggered Thailand TikTok Shop Product Rank Board sync (~0.4 cr: Top 100 Products + L1 Category Market)
  app.post('/api/rank-board/sync', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const dateRange: 'last7Day' | 'last30Day' =
        body?.dateRange === 'last30Day' ? 'last30Day' : 'last7Day';
      const minBalanceReserve = parseOptionalNumber(body?.minBalanceReserve);
      const maxSpendRemaining = parseOptionalNumber(body?.maxSpendRemaining);

      const result = await syncThailandRankBoard({
        dateRange,
        guardrails: {
          minBalanceReserve,
          maxSpendRemaining,
          estimatedCost: 0.4,
        },
      });
      res.json(result);
    } catch (err) {
      const mapped = mapApiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Ultra-lean (~0.2 cr) Kalodata-only Search (Default Best Matches, Keyword, Multi-Category, or Single Product Link)
  app.post('/api/products/search', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const rawQuery = typeof body?.query === 'string' ? body.query.trim().slice(0, 2048) : '';
      const rawCateIds = Array.isArray(body?.cateIds) ? body.cateIds : [];
      const cateIds = rawCateIds
        .filter((item): item is string => typeof item === 'string')
        .map((id) => id.trim())
        .filter((id) => /^\d{3,15}$/.test(id))
        .slice(0, 12);

      const forceRefresh = body?.forceRefresh === true;
      const rawPageNumber = parseOptionalNumber(body?.pageNumber);
      const pageNumber =
        rawPageNumber !== null ? Math.max(1, Math.min(10, Math.floor(rawPageNumber))) : 1;
      const rawPageSize = parseOptionalNumber(body?.pageSize);
      const pageSize =
        rawPageSize !== null && rawPageSize > 0
          ? Math.max(1, Math.min(100, Math.floor(rawPageSize)))
          : 20;
      const dateRange: 'last7Day' | 'last30Day' =
        body?.dateRange === 'last30Day' ? 'last30Day' : 'last7Day';
      const minBalanceReserve = parseOptionalNumber(body?.minBalanceReserve);
      const maxSpendRemaining = parseOptionalNumber(body?.maxSpendRemaining);

      const rawCateMeta =
        body?.selectedCategoryMeta && typeof body.selectedCategoryMeta === 'object'
          ? (body.selectedCategoryMeta as Record<string, unknown>)
          : null;
      const selectedCategoryMeta =
        rawCateMeta && typeof rawCateMeta.id === 'string' && /^\d{3,15}$/.test(rawCateMeta.id.trim())
          ? {
              id: rawCateMeta.id.trim(),
              my: typeof rawCateMeta.my === 'string' ? rawCateMeta.my.trim().slice(0, 80) : undefined,
              en: typeof rawCateMeta.en === 'string' ? rawCateMeta.en.trim().slice(0, 80) : undefined,
            }
          : null;

      const result = await searchSilentVisualProducts({
        query: rawQuery,
        cateIds,
        selectedCategoryMeta,
        pageNumber,
        pageSize,
        dateRange,
        forceRefresh,
        guardrails: {
          minBalanceReserve,
          maxSpendRemaining,
          estimatedCost: 0.2,
        },
      });
      res.json(result);
    } catch (err) {
      const mapped = mapApiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Retry AI Myanmar/English explanation on already-fetched Kalodata products (0 Kalodata credits)
  app.post('/api/products/explain', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const rawProducts = Array.isArray(body?.products) ? (body.products as ProductItem[]) : [];
      if (rawProducts.length === 0) {
        res.status(400).json({ error: 'No products provided to explain.' });
        return;
      }
      const explained = await explainExistingProducts(rawProducts);
      res.json({ products: explained });
    } catch (err) {
      const mapped = mapApiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Choice (ခ): Single-Product Optional Deep Kalodata Enrichment inside Video Studio
  app.post('/api/products/enrich', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const productId = typeof body?.productId === 'string' ? body.productId.trim().slice(0, 64) : '';
      if (!productId) {
        res.status(400).json({ error: 'Valid productId is required.' });
        return;
      }

      const rawOptions =
        body?.options && typeof body.options === 'object'
          ? (body.options as Record<string, unknown>)
          : {};

      const options = {
        includeDetails: rawOptions.includeDetails === true,
        includeSpecs: rawOptions.includeSpecs === true,
        includeComments: rawOptions.includeComments === true,
        ...(rawOptions.dateRange === 'last30Day' || rawOptions.dateRange === 'last7Day'
          ? { dateRange: rawOptions.dateRange as 'last7Day' | 'last30Day' }
          : {}),
      };

      const minBalanceReserve = parseOptionalNumber(body?.minBalanceReserve);
      const maxSpendRemaining = parseOptionalNumber(body?.maxSpendRemaining);

      const result = await enrichSingleKalodataProduct(productId, options, {
        minBalanceReserve,
        maxSpendRemaining,
      });
      res.json(result);
    } catch (err) {
      const mapped = mapApiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // AI Deep Product Analysis strictly grounded in available Kalodata data (0 Kalodata credits)
  app.post('/api/products/analyze', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const product = body?.product as ProductItem | undefined;

      if (
        !product ||
        typeof product !== 'object' ||
        typeof product.thaiTitle !== 'string' ||
        !product.thaiTitle.trim()
      ) {
        res.status(400).json({ error: 'Valid product details are required.' });
        return;
      }

      const safeProduct = sanitizeProductPayloadForAi(product, { forVideoPlan: false });

      await streamNdjsonAction(req, res, async (onProgress) => {
        const analysis = await analyzeProductWithAi(safeProduct, onProgress);
        return { analysis };
      });
    } catch (err) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const mapped = mapApiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  app.post('/api/video/generate', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const product = body?.product as ProductItem | undefined;
      const rawIdeaIndex = parseOptionalNumber(body?.ideaIndex);
      const ideaIndex =
        rawIdeaIndex === 1 || rawIdeaIndex === 2 ? rawIdeaIndex : 0;
      const concept =
        body?.concept && typeof body.concept === 'object'
          ? (body.concept as VideoIdeaConcept)
          : undefined;
      const videoIdeasPack =
        body?.videoIdeasPack && typeof body.videoIdeasPack === 'object'
          ? (body.videoIdeasPack as VideoIdeasStrategyPack)
          : undefined;

      if (
        !product ||
        typeof product !== 'object' ||
        typeof product.thaiTitle !== 'string' ||
        !product.thaiTitle.trim() ||
        !product.clearTitle ||
        typeof product.clearTitle.en !== 'string'
      ) {
        res.status(400).json({ error: 'Valid product details are required.' });
        return;
      }

      const safeProduct = sanitizeProductPayloadForAi(product, { forVideoPlan: true });

      await streamNdjsonAction(req, res, async (onProgress) => {
        const plan = await generateIdeaVideoPlan(
          {
            product: safeProduct,
            ideaIndex,
            concept,
            videoIdeasPack,
          },
          onProgress
        );
        return { plan };
      });
    } catch (err) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const mapped = mapApiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Ensure unknown /api/* paths always return JSON 404 instead of falling through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: 'API endpoint not found.',
      code: 'API_NOT_FOUND',
    });
  });

  // Ensure Express middleware errors on /api/* (e.g. malformed JSON, payload limit) always return JSON
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.path.startsWith('/api')) {
      next(err);
      return;
    }
    if (res.headersSent) {
      next(err);
      return;
    }
    const status =
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    const isSyntaxError = err instanceof SyntaxError && status === 400;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: isSyntaxError
        ? 'Invalid JSON request body.'
        : 'Server encountered an unexpected error. Please try again.',
      code: isSyntaxError ? 'INVALID_JSON' : 'SERVER_ERROR',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SiamVisual server running on http://localhost:${PORT}`);
  });
}

startServer();
