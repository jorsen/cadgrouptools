import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cached client instance
let _supabaseAdmin: SupabaseClient | null = null;
let _initializationAttempted = false;

// Get the bucket name from server env (default to cadgroup-uploads to match Render config)
export const STORAGE_BUCKET = process.env.SUPABASE_BUCKET || 'cadgroup-uploads';

// Lazy initialization function to get Supabase admin client
export function getSupabaseAdmin(): SupabaseClient | null {
  // Return cached client if already initialized
  if (_supabaseAdmin) {
    return _supabaseAdmin;
  }

  // Only attempt initialization once per process
  if (_initializationAttempted) {
    return null;
  }

  _initializationAttempted = true;

  // Try both with and without NEXT_PUBLIC prefix for compatibility
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('[Supabase] Initializing admin client...', {
    hasUrl: !!SUPABASE_URL,
    hasServiceRole: !!SUPABASE_SERVICE_ROLE,
    urlPrefix: SUPABASE_URL?.substring(0, 30),
  });

  if (!SUPABASE_URL || SUPABASE_URL === 'https://placeholder.supabase.co') {
    console.warn('[Supabase] URL not configured or using placeholder. File operations will not work.');
    return null;
  }

  if (!SUPABASE_SERVICE_ROLE || SUPABASE_SERVICE_ROLE === 'placeholder_key') {
    console.warn('[Supabase] Service role key not configured or using placeholder. File operations will not work.');
    return null;
  }

  try {
    _supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            'x-client-info': 'cadgroup-portal'
          }
        }
      }
    );
    console.log('[Supabase] Admin client initialized successfully');
    return _supabaseAdmin;
  } catch (error) {
    console.error('[Supabase] Failed to create admin client:', error);
    return null;
  }
}

// For backward compatibility - lazy getter
export const supabaseAdmin = {
  get storage() {
    const client = getSupabaseAdmin();
    if (!client) {
      throw new Error('Supabase admin client not initialized. Check environment variables.');
    }
    return client.storage;
  },
  get from() {
    const client = getSupabaseAdmin();
    if (!client) {
      throw new Error('Supabase admin client not initialized. Check environment variables.');
    }
    return client.from.bind(client);
  }
};

// Export initialization status for debugging
export function getSupabaseStatus() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  return {
    initialized: !!_supabaseAdmin,
    initializationAttempted: _initializationAttempted,
    hasUrl: !!SUPABASE_URL && SUPABASE_URL !== 'https://placeholder.supabase.co',
    hasServiceRole: !!SUPABASE_SERVICE_ROLE && SUPABASE_SERVICE_ROLE !== 'placeholder_key',
    hasPlaceholders: SUPABASE_URL === 'https://placeholder.supabase.co' || SUPABASE_SERVICE_ROLE === 'placeholder_key',
    bucket: STORAGE_BUCKET,
    url: SUPABASE_URL ? (SUPABASE_URL.includes('placeholder') ? 'PLACEHOLDER_VALUE' : 'configured') : 'not set',
    serviceRole: SUPABASE_SERVICE_ROLE ? (SUPABASE_SERVICE_ROLE.includes('placeholder') ? 'PLACEHOLDER_VALUE' : 'configured') : 'not set'
  };
}

// Legacy export for backward compatibility
export const SUPABASE_STATUS = {
  get initialized() { return getSupabaseStatus().initialized; },
  get hasUrl() { return getSupabaseStatus().hasUrl; },
  get hasServiceRole() { return getSupabaseStatus().hasServiceRole; },
  get hasPlaceholders() { return getSupabaseStatus().hasPlaceholders; },
  get bucket() { return getSupabaseStatus().bucket; },
  get url() { return getSupabaseStatus().url; },
  get serviceRole() { return getSupabaseStatus().serviceRole; },
};
