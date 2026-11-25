import { GoogleGenAI, ThinkingLevel, type GenerateContentConfig } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedApiKey = apiKey;
  }
  return cachedClient;
}

// Primary model per Gemini API guidance: gemini-4-hydrogen (fast, reliable free-tier default)
// with gemini-3.1-flash-lite as automatic sibling fallback during transient 503/429 spikes.
export const GEMINI_MODEL = 'gemini-4-hydrogen';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

// Adaptive in-memory model health tracker: when a model returns 503/429,
// route straight to the healthier sibling first for 90s.
const modelCooldownUntil = new Map<string, number>();
const MODEL_COOLDOWN_MS = 90_000;

function markModelBusy(model: string) {
  modelCooldownUntil.set(model, Date.now() + MODEL_COOLDOWN_MS);
}

function markModelHealthy(model: string) {
  modelCooldownUntil.delete(model);
}

function getOrderedModels(): [string, string] {
  const now = Date.now();
  const primaryCooldown = modelCooldownUntil.get(GEMINI_MODEL) ?? 0;
  const fallbackCooldown = modelCooldownUntil.get(GEMINI_FALLBACK_MODEL) ?? 0;

  if (primaryCooldown > now && fallbackCooldown <= now) {
    return [GEMINI_FALLBACK_MODEL, GEMINI_MODEL];
  }
  return [GEMINI_MODEL, GEMINI_FALLBACK_MODEL];
}

export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

function extractHttpStatus(err: unknown): number | null {
  if (typeof err === 'object' && err !== null) {
    const candidate = (err as { status?: unknown; statusCode?: unknown }).status ??
      (err as { statusCode?: unknown }).statusCode;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
}

function isNonRetryableGeminiError(err: unknown): boolean {
  const status = extractHttpStatus(err);
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('GEMINI_API_KEY_MISSING') ||
    message.includes('API_KEY_INVALID') ||
    message.includes('PERMISSION_DENIED') ||
    message.includes('NOT_FOUND') ||
    /\b(400|401|403|404)\b/.test(message)
  );
}

function isRateLimitError(err: unknown): boolean {
  const status = extractHttpStatus(err);
  if (status === 429) return true;
  const message = err instanceof Error ? err.message : String(err);
  return /\b429\b/.test(message) || message.includes('RESOURCE_EXHAUSTED');
}

function isBusy503Error(err: unknown): boolean {
  const status = extractHttpStatus(err);
  if (status === 503 || status === 502 || status === 504) return true;
  const message = err instanceof Error ? err.message : String(err);
  return (
    /\b(502|503|504)\b/.test(message) ||
    message.includes('UNAVAILABLE') ||
    message.toLowerCase().includes('high demand') ||
    message.toLowerCase().includes('overloaded') ||
    message.toLowerCase().includes('temporarily unavailable')
  );
}

function isTransientUpstreamError(err: unknown): boolean {
  const status = extractHttpStatus(err);
  if (status !== null && status >= 500) return true;
  const message = err instanceof Error ? err.message : String(err);
  return (
    isBusy503Error(err) ||
    isRateLimitError(err) ||
    /\b500\b/.test(message) ||
    message.includes('INTERNAL') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('fetch failed') ||
    message.includes('_TIMEOUT') ||
    message.includes('_EMPTY_RESPONSE') ||
    message.includes('_INVALID_JSON')
  );
}

function jitteredDelayMs(baseMs: number): number {
  if (baseMs <= 0) return 0;
  return baseMs + Math.floor(Math.random() * 400);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 2,
  baseDelayMs = 900
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (isNonRetryableGeminiError(err) || isRateLimitError(err)) {
        throw err;
      }
      if (attempt < retries) {
        const delay = jitteredDelayMs(baseDelayMs * Math.pow(2, attempt));
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

function buildConfigForModel(
  model: string,
  config: GenerateContentConfig
): GenerateContentConfig {
  if (model === 'gemini-3.1-flash-lite') {
    return {
      ...config,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    };
  }
  return {
    ...config,
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  };
}

async function runSingleModelJson<T>(params: {
  ai: GoogleGenAI;
  model: string;
  contents: string;
  config: GenerateContentConfig;
  timeoutMs: number;
  label: string;
  onProgress?: () => void;
}): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${params.label}_TIMEOUT`));
    }, params.timeoutMs);
  });

  const work = (async (): Promise<T> => {
    const stream = await params.ai.models.generateContentStream({
      model: params.model,
      contents: params.contents,
      config: buildConfigForModel(params.model, params.config),
    });

    let fullText = '';
    for await (const chunk of stream) {
      if (chunk.text) {
        fullText += chunk.text;
        params.onProgress?.();
      }
    }

    const combined = extractJsonText(fullText);
    if (!combined) {
      throw new Error(`${params.label}_EMPTY_RESPONSE`);
    }

    try {
      return JSON.parse(combined) as T;
    } catch {
      const firstBrace = combined.indexOf('{');
      const lastBrace = combined.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(combined.slice(firstBrace, lastBrace + 1)) as T;
      }
      const firstBracket = combined.indexOf('[');
      const lastBracket = combined.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        return JSON.parse(combined.slice(firstBracket, lastBracket + 1)) as T;
      }
      throw new Error(`${params.label}_INVALID_JSON`);
    }
  })();

  try {
    const result = await Promise.race([work, timeoutPromise]);
    markModelHealthy(params.model);
    return result;
  } catch (err) {
    if (isBusy503Error(err) || isRateLimitError(err)) {
      markModelBusy(params.model);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Sequential, resilient streaming Gemini structured JSON generation:
 * - Routes to the healthiest free-tier model first (gemini-4-hydrogen primary,
 *   gemini-3.1-flash-lite sibling fallback).
 * - On transient 503/429/500 spikes, alternates across both models with jittered
 *   exponential backoff so brief high-demand spikes recover automatically without
 *   parallel request bursts.
 */
export async function generateStructuredJsonStream<T>(params: {
  contents: string;
  config: GenerateContentConfig;
  timeoutMs?: number;
  retries?: number;
  label: string;
  onProgress?: () => void;
}): Promise<T> {
  const ai = getGeminiClient();
  const perCallTimeoutMs = Math.min(params.timeoutMs ?? 35000, 40000);
  const [firstModel, secondModel] = getOrderedModels();

  // Strictly sequential 5-step alternating schedule with jittered exponential backoff
  // (~15s total backoff window across both models to ride out transient 503 spikes).
  const schedule: Array<{ model: string; delayBeforeMs: number }> = [
    { model: firstModel, delayBeforeMs: 0 },
    { model: secondModel, delayBeforeMs: 1000 },
    { model: firstModel, delayBeforeMs: 2500 },
    { model: secondModel, delayBeforeMs: 4500 },
    { model: firstModel, delayBeforeMs: 7000 },
  ];

  const rateLimitedModels = new Set<string>();
  let lastError: unknown;

  for (const step of schedule) {
    if (rateLimitedModels.has(step.model)) {
      continue;
    }
    if (step.delayBeforeMs > 0) {
      params.onProgress?.();
      await new Promise((resolve) => setTimeout(resolve, jitteredDelayMs(step.delayBeforeMs)));
    }

    try {
      params.onProgress?.();
      return await runSingleModelJson<T>({
        ai,
        model: step.model,
        contents: params.contents,
        config: params.config,
        timeoutMs: perCallTimeoutMs,
        label: params.label,
        onProgress: params.onProgress,
      });
    } catch (err) {
      lastError = err;
      if (isNonRetryableGeminiError(err) || !isTransientUpstreamError(err)) {
        throw err;
      }
      if (isRateLimitError(err)) {
        rateLimitedModels.add(step.model);
      }
    }
  }

  throw lastError;
}

export function sanitizeExternalUrl(url: unknown): string | undefined {
  if (typeof url !== 'string' || !url.trim()) return undefined;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}
