import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// SSO is a first-class login method now, so a missing Supabase configuration must
// not prevent the app from booting. The placeholder client keeps legacy imports
// working; callers that need cloud sync are no-ops when no session exists.
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured. Email/password login and project cloud sync are disabled; SSO login remains available.'
  );
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_KEY || 'placeholder-anon-key',
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured
    }
  }
);
