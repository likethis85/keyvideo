import { supabase, isSupabaseConfigured } from './supabaseClient';
import { SSO_SESSION_STORAGE_KEY } from './requestIdentity';

export { SSO_SESSION_STORAGE_KEY };

interface StoredSsoToken {
  token?: unknown;
  expiresAt?: unknown;
}

export function getSsoAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(SSO_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSsoToken;
    if (typeof parsed.token !== 'string' || !parsed.token) return null;
    if (typeof parsed.expiresAt === 'number' && parsed.expiresAt <= Date.now()) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const ssoToken = getSsoAccessToken();
  if (ssoToken) return { Authorization: `Bearer ${ssoToken}` };

  if (!isSupabaseConfigured) return {};
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
