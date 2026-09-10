import dns from 'dns/promises';
import net from 'net';

export class UrlSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UrlSafetyError';
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
]);

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain'];

export const MAX_SAFE_REDIRECTS = 5;
export const MAX_SAFE_RESPONSE_BYTES = 500_000;

const ALLOWED_CONTENT_TYPES = [
  'text/html',
  'text/plain',
  'application/xhtml+xml',
  'application/json',
  'text/markdown',
];

const ipv4ToLong = (ip) => {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
};

const isBlockedIpv4 = (ip) => {
  const value = ipv4ToLong(ip);
  if (value === null) return true;

  const masked = (bits) => (value & bits) >>> 0;

  if (masked(0xff000000) === 0x7f000000) return true; // 127.0.0.0/8
  if (masked(0xff000000) === 0x0a000000) return true; // 10.0.0.0/8
  if (masked(0xfff00000) === 0xac100000) return true; // 172.16.0.0/12
  if (masked(0xffff0000) === 0xc0a80000) return true; // 192.168.0.0/16
  if (masked(0xffff0000) === 0xa9fe0000) return true; // 169.254.0.0/16
  if (masked(0xff000000) === 0x00000000) return true; // 0.0.0.0/8
  if (masked(0xffc00000) === 0x64400000) return true; // 100.64.0.0/10
  if (masked(0xfffe0000) === 0xc6120000) return true; // 198.18.0.0/15
  if (masked(0xf0000000) === 0xe0000000) return true; // 224.0.0.0/4 multicast
  if (masked(0xf0000000) === 0xf0000000) return true; // 240.0.0.0/4 reserved

  return false;
};

const normalizeIpv6 = (ip) => ip.toLowerCase();

const isBlockedIpv6 = (ip) => {
  const normalized = normalizeIpv6(ip);
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
  if (normalized.startsWith('ff')) return true; // multicast

  const mappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedMatch) return isBlockedIpv4(mappedMatch[1]);

  return false;
};

export const isBlockedIpAddress = (ip) => {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  return true;
};

const isBlockedHostname = (hostname) => {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (host.endsWith('.localhost')) return true;

  const family = net.isIP(host);
  if (family === 4) return isBlockedIpv4(host);
  if (family === 6) return isBlockedIpv6(host);

  return false;
};

const resolveHostnameAddresses = async (hostname) => {
  if (net.isIP(hostname)) return [hostname];
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

/**
 * Validate a URL for SSRF safety. Resolves DNS and rejects private/reserved targets.
 */
export const assertSafeUrl = async (urlString, { allowRedirects = false } = {}) => {
  let parsed;
  try {
    parsed = new URL(String(urlString).trim());
  } catch {
    throw new UrlSafetyError('Invalid URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new UrlSafetyError('Only http and https URLs are allowed.');
  }

  if (parsed.username || parsed.password) {
    throw new UrlSafetyError('URLs with embedded credentials are not allowed.');
  }

  const hostname = parsed.hostname;
  if (isBlockedHostname(hostname)) {
    throw new UrlSafetyError('URL hostname is not allowed.');
  }

  const addresses = await resolveHostnameAddresses(hostname);
  if (!addresses.length) {
    throw new UrlSafetyError('URL hostname could not be resolved.');
  }

  for (const address of addresses) {
    if (isBlockedIpAddress(address)) {
      throw new UrlSafetyError('URL resolves to a blocked network address.');
    }
  }

  return parsed.toString();
};

const isAllowedContentType = (contentTypeHeader) => {
  const value = String(contentTypeHeader || '').toLowerCase().split(';')[0].trim();
  if (!value) return true;
  return ALLOWED_CONTENT_TYPES.some((allowed) => value === allowed || value.startsWith(`${allowed};`));
};

const readLimitedBody = async (response, maxBytes) => {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    return text.slice(0, maxBytes);
  }

  const chunks = [];
  let total = 0;

  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const slice = value.byteLength > maxBytes - total ? value.slice(0, maxBytes - total) : value;
    chunks.push(slice);
    total += slice.byteLength;
  }

  try {
    await reader.cancel();
  } catch {
    // ignore cancel errors
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
};

/**
 * Safe HTTP GET with redirect revalidation, size limits, and content-type checks.
 */
export const safeHttpGet = async (urlString, options = {}) => {
  const {
    timeoutMs = 20000,
    maxRedirects = MAX_SAFE_REDIRECTS,
    maxBytes = MAX_SAFE_RESPONSE_BYTES,
    headers = {},
    allowedContentTypes = ALLOWED_CONTENT_TYPES,
  } = options;

  let currentUrl = await assertSafeUrl(urlString);
  let redirectCount = 0;

  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'SkincarePlatformBot/1.0 (+product-import)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
          ...headers,
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new UrlSafetyError('Redirect response missing Location header.');
        }
        if (redirectCount >= maxRedirects) {
          throw new UrlSafetyError('Too many redirects.');
        }
        redirectCount += 1;
        const nextUrl = new URL(location, currentUrl).toString();
        currentUrl = await assertSafeUrl(nextUrl);
        continue;
      }

      if (!response.ok) {
        throw new UrlSafetyError(`Unable to fetch URL (HTTP ${response.status}).`);
      }

      const contentType = response.headers.get('content-type');
      const allowed = allowedContentTypes.some((type) => {
        const normalized = String(contentType || '').toLowerCase();
        return normalized.includes(type);
      });
      if (contentType && !allowed) {
        throw new UrlSafetyError(`Disallowed content type: ${contentType}`);
      }

      const body = await readLimitedBody(response, maxBytes);
      return {
        url: currentUrl,
        body,
        contentType: contentType || '',
        truncated: false,
        redirectCount,
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new UrlSafetyError('Request timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
};

export default {
  UrlSafetyError,
  assertSafeUrl,
  safeHttpGet,
  isBlockedIpAddress,
  MAX_SAFE_REDIRECTS,
  MAX_SAFE_RESPONSE_BYTES,
};
