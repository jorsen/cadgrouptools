import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getSupabaseStatus, STORAGE_BUCKET, resetSupabaseAdmin } from '@/lib/supabaseAdmin';

// Debug endpoint to check Supabase configuration
// This should be removed or protected in production
export async function GET(request: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
  
  results.envCheck = {
    SUPABASE_URL: supabaseUrl ? 'set' : 'missing',
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE ? 'set' : 'missing',
    SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || `${STORAGE_BUCKET} (default)`,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'set' : 'missing',
  };

  // Test direct HTTP connectivity to Supabase (bypassing the client)
  if (supabaseUrl) {
    try {
      console.log('[Debug] Testing direct HTTP to Supabase:', supabaseUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const directResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': supabaseKey || '',
          'Authorization': `Bearer ${supabaseKey || ''}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      results.directHttpTest = {
        success: true,
        status: directResponse.status,
        statusText: directResponse.statusText,
      };
    } catch (httpError: any) {
      results.directHttpTest = {
        success: false,
        error: httpError.message,
        name: httpError.name,
        cause: httpError.cause?.message || httpError.cause?.code,
      };
    }
    
    // Test storage endpoint directly
    try {
      console.log('[Debug] Testing direct HTTP to Supabase Storage');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const storageResponse = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
        method: 'GET',
        headers: {
          'apikey': supabaseKey || '',
          'Authorization': `Bearer ${supabaseKey || ''}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      results.directStorageTest = {
        success: true,
        status: storageResponse.status,
        statusText: storageResponse.statusText,
      };
      
      if (storageResponse.ok) {
        const buckets = await storageResponse.json();
        results.directStorageTest.buckets = buckets;
      }
    } catch (storageError: any) {
      results.directStorageTest = {
        success: false,
        error: storageError.message,
        name: storageError.name,
        cause: storageError.cause?.message || storageError.cause?.code,
      };
    }
  }

  // Get Supabase status
  results.supabaseStatus = getSupabaseStatus();

  // Reset and recreate client to ensure fresh connection
  resetSupabaseAdmin();
  
  // Try to get Supabase client
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    results.error = 'Supabase client not initialized';
    return NextResponse.json(results, { status: 500 });
  }

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
  const bucketName = process.env.SUPABASE_BUCKET || STORAGE_BUCKET;
  results.targetBucket = bucketName;
  
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
    const testContent = new TextEncoder().encode('test-' + Date.now());
    const testFileName = `_debug_test_${Date.now()}.txt`;
    
    console.log('Attempting test upload to:', bucketName, testFileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(testFileName, testContent, {
        contentType: 'text/plain',
        upsert: true,
      });

    if (uploadError) {
      results.testUploadError = {
        message: uploadError.message,
        name: (uploadError as any).name,
        details: uploadError,
      };
    } else {
      results.testUploadSuccess = true;
      results.testUploadPath = uploadData?.path;

      // Clean up test file
      const { error: deleteError } = await supabase.storage.from(bucketName).remove([testFileName]);
      results.testFileCleanedUp = !deleteError;
      if (deleteError) {
        results.deleteError = deleteError.message;
      }
    }
  } catch (e: any) {
    results.testUploadException = {
      message: e.message,
      stack: e.stack?.split('\n').slice(0, 3),
    };
  }

  return NextResponse.json(results);
}
