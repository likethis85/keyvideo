import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_EXTERNAL_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`External request timed out after ${Math.round(timeoutMs / 1000)}s`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const isPrivateIpv4 = (address) => {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
};

const isPrivateAddress = (address) => {
  const normalized = String(address).toLowerCase().split('%')[0];
  const version = isIP(normalized);
  if (version === 4) return isPrivateIpv4(normalized);
  if (version !== 6) return true;
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('ff')) return true;
  if (normalized.startsWith('::ffff:')) return isPrivateIpv4(normalized.slice(7));
  return false;
};

export const assertSafeRemoteUrl = async (value) => {
  let url;
  try {
    url = value instanceof URL ? value : new URL(String(value));
  } catch {
    throw new Error('Invalid remote URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only HTTP(S) remote URLs are allowed');
  }
  if (url.username || url.password) throw new Error('Remote URL must not contain credentials');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')
    || hostname.endsWith('.internal') || hostname.endsWith('.lan') || hostname === '[::1]') {
    throw new Error('Remote URL host is not allowed');
  }
  const literalVersion = isIP(hostname.replace(/^\[|\]$/g, ''));
  if (literalVersion && isPrivateAddress(hostname.replace(/^\[|\]$/g, ''))) {
    throw new Error('Remote URL host is not allowed');
  }
  if (!literalVersion) {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address))) {
      throw new Error('Remote URL host is not allowed');
    }
  }
  return url;
};

export const safeFetchRemote = async (value, options = {}, timeoutMs = 60_000) => {
  let current = value instanceof URL ? value : new URL(String(value));
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await assertSafeRemoteUrl(current);
    const response = await fetchWithTimeout(current.toString(), { ...options, redirect: 'manual' }, timeoutMs);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) return response;
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new Error('Too many remote redirects');
};
