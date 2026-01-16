import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Debug endpoint to check Supabase configuration
// This should be removed or protected in production
export async function GET(request: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  // Check environment variables
  results.envCheck = {
    SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'missing',
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE ? 'set' : 'missing',
    SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || 'cadgroup-uploads (default)',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'set' : 'missing',
  };

  // Try to create Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !supabaseServiceRole) {
    results.error = 'Missing Supabase configuration';
    return NextResponse.json(results, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    results.clientCreated = true;

    // List buckets
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        results.bucketsError = bucketsError.message;
      } else {
        results.buckets = buckets?.map(b => ({ name: b.name, public: b.public, id: b.id })) || [];
      }
    } catch (e: any) {
      results.bucketsException = e.message;
    }

    // Check specific bucket
    const bucketName = process.env.SUPABASE_BUCKET || 'cadgroup-uploads';
    try {
      const { data: files, error: filesError } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 1 });

      if (filesError) {
        results.bucketAccessError = filesError.message;
      } else {
        results.bucketAccessible = true;
        results.sampleFiles = files?.length || 0;
      }
    } catch (e: any) {
      results.bucketAccessException = e.message;
    }

    // Try a test upload
    try {
      const testContent = new TextEncoder().encode('test');
      const testFileName = `_debug_test_${Date.now()}.txt`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(testFileName, testContent, {
          contentType: 'text/plain',
          upsert: true,
        });

      if (uploadError) {
        results.testUploadError = uploadError.message;
      } else {
        results.testUploadSuccess = true;
        results.testUploadPath = uploadData?.path;

        // Clean up test file
        await supabase.storage.from(bucketName).remove([testFileName]);
        results.testFileCleanedUp = true;
      }
    } catch (e: any) {
      results.testUploadException = e.message;
    }

  } catch (e: any) {
    results.clientError = e.message;
  }

  return NextResponse.json(results);
}
