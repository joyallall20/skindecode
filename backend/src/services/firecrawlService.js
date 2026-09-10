import { getFirecrawlConfig, isFirecrawlConfigured } from '../config/aiConfig.js';
import { assertSafeUrl, UrlSafetyError } from '../utils/urlSafety.js';

const sanitizeError = (message) =>
  String(message || 'Firecrawl request failed.')
    .replace(/fc-[a-zA-Z0-9_-]+/gi, '[REDACTED_KEY]')
    .trim();

/**
 * Scrape a URL and return clean Markdown via Firecrawl.
 * Falls back to null when not configured — caller handles fallback.
 */
export const scrapeUrlToMarkdown = async (url, options = {}) => {
  if (!isFirecrawlConfigured()) {
    return { success: false, error: 'Firecrawl API is not configured. Set FIRECRAWL_API_KEY.', provider: 'fallback' };
  }

  let safeUrl;
  try {
    safeUrl = await assertSafeUrl(url);
  } catch (error) {
    const message = error instanceof UrlSafetyError ? error.message : 'URL is not allowed.';
    return { success: false, error: message, provider: 'firecrawl' };
  }

  const { apiKey, baseUrl, timeoutMs } = getFirecrawlConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: safeUrl,
        formats: ['markdown'],
        onlyMainContent: options.onlyMainContent ?? true,
        timeout: Math.min(timeoutMs, 60000),
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[firecrawl] scrape failed', { url: safeUrl, status: response.status, error: payload?.error });
      return {
        success: false,
        error: sanitizeError(payload?.error || `Firecrawl returned HTTP ${response.status}.`),
        provider: 'firecrawl',
        rawResponse: payload,
      };
    }

    const markdown = payload?.data?.markdown || payload?.markdown || '';
    if (!markdown.trim()) {
      return {
        success: false,
        error: 'Firecrawl returned empty markdown content.',
        provider: 'firecrawl',
        rawResponse: payload,
      };
    }

    console.info('[firecrawl] scrape success', { url: safeUrl, length: markdown.length });
    return {
      success: true,
      markdown: markdown.slice(0, options.maxChars || 50000),
      metadata: payload?.data?.metadata || payload?.metadata || {},
      provider: 'firecrawl',
      rawResponse: payload,
    };
  } catch (error) {
    console.error('[firecrawl] scrape error', { url: safeUrl, message: error.message });
    return {
      success: false,
      error: sanitizeError(error.name === 'AbortError' ? 'Firecrawl request timed out.' : error.message),
      provider: 'firecrawl',
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Search the web via Firecrawl for seller discovery.
 */
export const searchWeb = async (query, options = {}) => {
  if (!isFirecrawlConfigured()) {
    return { success: false, error: 'Firecrawl API is not configured.', results: [] };
  }

  const { apiKey, baseUrl, timeoutMs } = getFirecrawlConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit: options.limit || 5,
        lang: options.lang || 'en',
        country: options.country || 'in',
        scrapeOptions: { formats: ['markdown'] },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[firecrawl] search failed', { query, status: response.status });
      return { success: false, error: sanitizeError(payload?.error), results: [] };
    }

    const results = (payload?.data || payload?.results || []).map((entry) => ({
      url: entry.url || entry.link,
      title: entry.title || '',
      markdown: entry.markdown || entry.description || '',
      metadata: entry.metadata || {},
    }));

    console.info('[firecrawl] search success', { query, resultCount: results.length });
    return { success: true, results, provider: 'firecrawl' };
  } catch (error) {
    console.error('[firecrawl] search error', { query, message: error.message });
    return { success: false, error: sanitizeError(error.message), results: [] };
  } finally {
    clearTimeout(timeoutId);
  }
};

export default { scrapeUrlToMarkdown, searchWeb };
