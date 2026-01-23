import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import Anthropic from '@anthropic-ai/sdk';
import { getFileInfo } from '@/lib/gridfsStorage';
import { getSupabaseAdmin, getSupabaseStatus } from '@/lib/supabaseAdmin';

// GET /api/accounting/diagnostics - Run comprehensive diagnostics
export const GET = requireAuth(async (request: NextRequest) => {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {},
    claude: {},
    storage: {},
    documents: {},
    recommendations: []
  };

  try {
    // 1. Check environment variables
    diagnostics.environment = {
      ANTHROPIC_API_KEY: {
        exists: !!process.env.ANTHROPIC_API_KEY,
        length: process.env.ANTHROPIC_API_KEY?.length || 0,
        prefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 7) + '...' : 'not set'
      },
      MANUS_API_KEY: {
        exists: !!process.env.MANUS_API_KEY,
        length: process.env.MANUS_API_KEY?.length || 0,
        prefix: process.env.MANUS_API_KEY ? process.env.MANUS_API_KEY.substring(0, 7) + '...' : 'not set'
      },
      MONGODB_URI: {
        exists: !!process.env.MONGODB_URI,
        hasCredentials: process.env.MONGODB_URI?.includes('@') || false
      },
      SUPABASE_URL: {
        exists: !!process.env.SUPABASE_URL,
        prefix: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 20) + '...' : 'not set'
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
      }
    };

    // 2. Test Claude API
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const client = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const response = await client.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: 'Respond with "OK"',
            },
          ],
        });

        diagnostics.claude = {
          status: 'working',
          model: response.model,
          usage: response.usage,
        };
      } catch (claudeError: any) {
        diagnostics.claude = {
          status: 'error',
          error: claudeError.message,
          type: claudeError.type,
          status_code: claudeError.status,
        };

        if (claudeError.message?.includes('401') || claudeError.message?.includes('authentication')) {
          diagnostics.recommendations.push('ANTHROPIC_API_KEY is invalid or expired. Please generate a new key from the Anthropic console.');
        } else if (claudeError.message?.includes('429')) {
          diagnostics.recommendations.push('Claude API rate limit exceeded. Please wait before trying again.');
        } else if (claudeError.message?.includes('400')) {
          diagnostics.recommendations.push('Claude API request format error. This might be due to model availability or content restrictions.');
        }
      }
    } else {
      diagnostics.claude = {
        status: 'not_configured',
      };
      diagnostics.recommendations.push('Set ANTHROPIC_API_KEY in your environment variables to enable Claude AI processing.');
    }

    // 3. Test storage systems
    await connectToDatabase();

    // Test GridFS
    try {
      const sampleDocs = await AccountingDocument.find({ 
        gridfsFileId: { $exists: true, $ne: null }
      }).limit(3).select('gridfsFileId');

      if (sampleDocs.length > 0) {
        const testDoc = sampleDocs[0];
        const fileInfo = await getFileInfo(testDoc.gridfsFileId);
        
        if (fileInfo) {
          diagnostics.storage.gridfs = {
            status: 'working',
            sample_file: {
              id: testDoc.gridfsFileId,
              filename: fileInfo.filename,
              size: fileInfo.length,
              upload_date: fileInfo.uploadDate
            }
          };
        } else {
          diagnostics.storage.gridfs = {
            status: 'error',
            error: 'File exists in database but not in GridFS storage'
          };
          diagnostics.recommendations.push('GridFS files exist in database but not in storage. The GridFS collections might be out of sync.');
        }
      } else {
        diagnostics.storage.gridfs = {
          status: 'no_files',
        };
      }
    } catch (gridfsError: any) {
      diagnostics.storage.gridfs = {
        status: 'error',
        error: gridfsError.message
      };
      diagnostics.recommendations.push('GridFS storage access failed. Check MongoDB connection and GridFS collections.');
    }

    // Test Supabase
    const supabaseStatus = getSupabaseStatus();
    diagnostics.storage.supabase = supabaseStatus;

    if (supabaseStatus.initialized) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          // Test list operation
          const { data, error } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET || 'cadgroup-uploads')
            .list('', { limit: 1 });
          
          if (error) {
            diagnostics.storage.supabase.status = 'error';
            diagnostics.storage.supabase.error = error.message;
            diagnostics.recommendations.push('Supabase storage access failed. Check bucket permissions and service role key.');
          } else {
            diagnostics.storage.supabase.status = 'working';
            diagnostics.storage.supabase.sample_files = data?.length || 0;
          }
        }
      } catch (supabaseError: any) {
        diagnostics.storage.supabase = {
          ...diagnostics.storage.supabase,
          status: 'error',
          error: supabaseError.message
        };
      }
    } else {
      diagnostics.recommendations.push('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable Supabase storage.');
    }

    // 4. Analyze documents
    const docStats = await AccountingDocument.aggregate([
      {
        $group: {
          _id: '$processingStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const documentsByStatus: Record<string, number> = {};
    docStats.forEach(stat => {
      documentsByStatus[stat._id] = stat.count;
    });

    diagnostics.documents = {
      total: await AccountingDocument.countDocuments(),
      by_status: documentsByStatus,
      needs_processing: documentsByStatus.stored + documentsByStatus.uploaded + documentsByStatus.failed,
    };

    // Get documents with storage issues
    const storageIssueDocs = await AccountingDocument.find({
      $or: [
        { processingStatus: 'failed', errorMessage: /Could not retrieve file/ },
        { gridfsFileId: { $exists: true }, processingStatus: { $in: ['stored', 'uploaded', 'failed'] } }
      ]
    }).limit(5).select('_id company month year processingStatus errorMessage gridfsFileId supabasePath supabaseUrl');

    if (storageIssueDocs.length > 0) {
      diagnostics.documents.storage_issues = storageIssueDocs.map(doc => ({
        id: doc._id,
        company: doc.company,
        period: `${doc.month} ${doc.year}`,
        status: doc.processingStatus,
        has_gridfs: !!doc.gridfsFileId,
        has_supabase: !!(doc.supabasePath || doc.supabaseUrl),
        error: doc.errorMessage
      }));
      
      diagnostics.recommendations.push(`${storageIssueDocs.length} documents have storage issues. Consider re-uploading these documents.`);
    }

    // 5. Overall recommendations
    if (diagnostics.claude.status === 'working' && 
        (diagnostics.storage.gridfs.status === 'working' || diagnostics.storage.supabase.status === 'working') &&
        diagnostics.documents.needs_processing > 0) {
      diagnostics.recommendations.push('System is ready. You can retry processing documents with storage issues.');
    }

    return NextResponse.json({
      success: true,
      diagnostics
    });

  } catch (error: any) {
    console.error('Diagnostics error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      diagnostics
    }, { status: 500 });
  }
});