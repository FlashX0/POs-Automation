import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClientInstance: SupabaseClient | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (supabaseClientInstance) return supabaseClientInstance;
  
  try {
    const res = await fetch('/api/supabase-config');
    if (res.ok) {
      const { supabaseUrl, supabaseAnonKey } = await res.json();
      if (supabaseUrl && supabaseAnonKey) {
        supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey);
        return supabaseClientInstance;
      }
    }
  } catch (err) {
    console.error('[Supabase Client Loader] Failed to get client:', err);
  }
  return null;
}
