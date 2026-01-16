import { createClient } from '@supabase/supabase-js';

// Log initialization status
// Try both with and without NEXT_PUBLIC prefix for compatibility
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || SUPABASE_URL === 'https://placeholder.supabase.co') {
  console.warn('[Supabase] URL not configured or using placeholder. File operations will not work.');
}

if (!SUPABASE_SERVICE_ROLE || SUPABASE_SERVICE_ROLE === 'placeholder_key') {
  console.warn('[Supabase] Service role key not configured or using placeholder. File operations will not work.');
}

// Server-side client using service role key (more permissions)
// Only create client if environment variables are available and not placeholders
export const supabaseAdmin = 
  SUPABASE_URL && 
  SUPABASE_SERVICE_ROLE && 
  SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  SUPABASE_SERVICE_ROLE !== 'placeholder_key'
    ? createClient(
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
      )
    : null;

// Get the bucket name from server env (default to cadgroup-uploads to match Render config)
export const STORAGE_BUCKET = process.env.SUPABASE_BUCKET || 'cadgroup-uploads';

// Export initialization status for debugging
export const SUPABASE_STATUS = {
  initialized: !!supabaseAdmin,
  hasUrl: !!SUPABASE_URL && SUPABASE_URL !== 'https://placeholder.supabase.co',
  hasServiceRole: !!SUPABASE_SERVICE_ROLE && SUPABASE_SERVICE_ROLE !== 'placeholder_key',
  hasPlaceholders: SUPABASE_URL === 'https://placeholder.supabase.co' || SUPABASE_SERVICE_ROLE === 'placeholder_key',
  bucket: STORAGE_BUCKET,
  url: SUPABASE_URL ? (SUPABASE_URL.includes('placeholder') ? 'PLACEHOLDER_VALUE' : 'configured') : 'not set',
  serviceRole: SUPABASE_SERVICE_ROLE ? (SUPABASE_SERVICE_ROLE.includes('placeholder') ? 'PLACEHOLDER_VALUE' : 'configured') : 'not set'
};

if (supabaseAdmin) {
  console.log('[Supabase] Admin client initialized successfully');
} else {
  console.log('[Supabase] Admin client not initialized - file operations will not work');
}
