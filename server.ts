import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ProductItem, VisualStyle } from './src/types.ts';
import {
  clearSessionKalodataKey,
  enrichSingleKalodataProduct,
  fetchKalodataCreditBalance,
  fetchKalodataLiveCategories,
  getCachedKalodataStatus,
  KalodataApiError,
  OFFICIAL_TH_CATEGORIES,
  verifyAndConnectKalodataKey,
} from './server/kalodata.ts';
import {
  explainExistingProducts,
  generateSilentVideoPlan,
  searchSilentVisualProducts,
} from './server/productService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_STYLES = new Set<VisualStyle>([
  'cinematic',
  'asmr',
  'before_after',
  'problem_fix',
]);

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
  return {
    status: 500,
    code: 'REQUEST_FAILED',
    message: 'Unable to complete the request right now. Please try again in a moment.',
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '512kb' }));

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

  // Ultra-lean (~0.2 cr) Kalodata-only Search (Default Best Matches, Keyword, Multi-Category, or Single Product Link)
  app.post('/api/products/search', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const rawQuery = typeof body?.query === 'string' ? body.query.trim().slice(0, 400) : '';
      const rawCateIds = Array.isArray(body?.cateIds) ? body.cateIds : [];
      const cateIds = rawCateIds
        .filter((item): item is string => typeof item === 'string')
        .map((id) => id.trim())
        .filter((id) => /^\d{3,15}$/.test(id))
        .slice(0, 12);

      const forceRefresh = body?.forceRefresh === true;
      const minBalanceReserve = parseOptionalNumber(body?.minBalanceReserve);
      const maxSpendRemaining = parseOptionalNumber(body?.maxSpendRemaining);

      const result = await searchSilentVisualProducts({
        query: rawQuery,
        cateIds,
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

  app.post('/api/video/generate', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const product = body?.product as ProductItem | undefined;
      const rawStyle = typeof body?.style === 'string' ? body.style : 'cinematic';
      const style: VisualStyle = ALLOWED_STYLES.has(rawStyle as VisualStyle)
        ? (rawStyle as VisualStyle)
        : 'cinematic';

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

      const rawDeep = product.deepInsights;
      const safeDeepInsights =
        rawDeep && typeof rawDeep === 'object'
          ? {
              description:
                typeof rawDeep.description === 'string'
                  ? rawDeep.description.slice(0, 700)
                  : undefined,
              highlights: Array.isArray(rawDeep.highlights)
                ? rawDeep.highlights.map((h) => String(h).slice(0, 100)).slice(0, 8)
                : undefined,
              painPoints: Array.isArray(rawDeep.painPoints)
                ? rawDeep.painPoints.map((p) => String(p).slice(0, 180)).slice(0, 6)
                : undefined,
              usageScenarios: Array.isArray(rawDeep.usageScenarios)
                ? rawDeep.usageScenarios.map((u) => String(u).slice(0, 180)).slice(0, 6)
                : undefined,
              fetchedAt: String(rawDeep.fetchedAt || new Date().toISOString()),
            }
          : undefined;

      const safeProduct: ProductItem = {
        ...product,
        id: String(product.id || 'product').slice(0, 80),
        thaiTitle: product.thaiTitle.trim().slice(0, 260),
        clearTitle: {
          my: String(product.clearTitle.my || product.clearTitle.en).slice(0, 200),
          en: String(product.clearTitle.en).slice(0, 200),
        },
        whatItIs: {
          my: String(product.whatItIs?.my || '').slice(0, 600),
          en: String(product.whatItIs?.en || '').slice(0, 600),
        },
        whySilentWorks: {
          my: String(product.whySilentWorks?.my || '').slice(0, 400),
          en: String(product.whySilentWorks?.en || '').slice(0, 400),
        },
        shopName: String(product.shopName || 'TikTok Shop TH').slice(0, 120),
        priceThb:
          typeof product.priceThb === 'number' && Number.isFinite(product.priceThb)
            ? Math.max(1, Math.min(1000000, Math.round(product.priceThb)))
            : null,
        commissionRate:
          typeof product.commissionRate === 'number' && Number.isFinite(product.commissionRate)
            ? Math.max(0.1, Math.min(60, product.commissionRate))
            : null,
        commissionThb:
          typeof product.commissionThb === 'number' && Number.isFinite(product.commissionThb)
            ? Math.max(1, Math.min(200000, Math.round(product.commissionThb)))
            : null,
        deepInsights: safeDeepInsights,
      };

      const plan = await generateSilentVideoPlan(safeProduct, style);
      res.json({ plan });
    } catch (err) {
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
