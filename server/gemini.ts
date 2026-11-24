import { GoogleGenAI } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export const GEMINI_MODEL = 'gemini-4-hydrogen';

export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 2,
  baseDelayMs = 600
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      // Do not retry auth or invalid request errors
      if (
        message.includes('GEMINI_API_KEY_MISSING') ||
        message.includes('API_KEY_INVALID') ||
        message.includes('PERMISSION_DENIED') ||
        message.includes('400') ||
        message.includes('403')
      ) {
        throw err;
      }
      if (attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
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
