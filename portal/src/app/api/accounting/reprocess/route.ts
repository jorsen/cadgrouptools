import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import { requireAuth } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { getFileFromGridFS } from '@/lib/gridfsStorage';
import { documentProcessingService } from '@/services/documentProcessingService';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// POST /api/accounting/reprocess - Reprocess documents that are in stored/failed status
export const POST = requireAuth(async (request: NextRequest) => {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { documentId, company } = body;

    await connectToDatabase();

    // Check if Claude is configured
    if (!documentProcessingService.isConfigured()) {
      return NextResponse.json(
        { error: 'Document processing service not configured. ANTHROPIC_API_KEY is missing.' },
        { status: 503 }
      );
    }

    let documents: any[] = [];

    if (documentId) {
      // Reprocess a specific document
      const doc = await AccountingDocument.findById(documentId);
      if (!doc) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }
      documents = [doc];
    } else if (company) {
      // Reprocess all stored/failed documents for a company
      documents = await AccountingDocument.find({
        company,
        processingStatus: { $in: ['stored', 'uploaded', 'failed'] }
      });
    } else {
      // Reprocess all stored/failed documents
      documents = await AccountingDocument.find({
        processingStatus: { $in: ['stored', 'uploaded', 'failed'] }
      }).limit(10); // Limit to 10 at a time to avoid timeout
    }

    if (documents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No documents to reprocess',
        processed: 0,
      });
    }

    const results: any[] = [];

    for (const doc of documents) {
      try {
        console.log(`Reprocessing document ${doc._id}...`);
        console.log(`Document details:`, {
          gridfsFileId: doc.gridfsFileId,
          supabasePath: doc.supabasePath,
          supabaseUrl: doc.supabaseUrl,
          storageType: doc.storageType,
        });

        // Get the file from storage
        let fileBuffer: Buffer | null = null;
        let filename = 'document.pdf';

        // Try GridFS first
        if (doc.gridfsFileId) {
          // Extract the actual file ID if it's in gridfs:// format
          let gridfsId = doc.gridfsFileId;
          if (gridfsId.startsWith('gridfs://')) {
            gridfsId = gridfsId.replace('gridfs://', '');
          }
          
          console.log(`Trying to fetch from GridFS: ${gridfsId}`);
          try {
            const gridfsFile = await getFileFromGridFS(gridfsId);
            if (gridfsFile) {
              fileBuffer = gridfsFile.buffer;
              filename = gridfsFile.filename || filename;
              console.log(`Successfully retrieved from GridFS, size: ${fileBuffer.length}`);
            }
          } catch (gridfsError: any) {
            console.error(`GridFS fetch failed:`, gridfsError.message);
          }
        }

        // Fallback to Supabase if GridFS didn't work
        if (!fileBuffer && doc.supabaseUrl) {
          console.log(`Trying to fetch from Supabase URL: ${doc.supabaseUrl}`);
          try {
            const response = await fetch(doc.supabaseUrl, {
              headers: {
                'Accept': '*/*',
              },
            });
            console.log(`Supabase URL response: status=${response.status}, statusText=${response.statusText}`);
            
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              fileBuffer = Buffer.from(arrayBuffer);
              // Extract filename from URL or path
              filename = doc.supabasePath?.split('/').pop() || 'document.pdf';
              console.log(`Successfully retrieved from Supabase URL, size: ${fileBuffer.length}`);
            } else {
              // Try to get error details
              const errorText = await response.text().catch(() => 'Could not read error body');
              console.error(`Supabase URL fetch failed: ${response.status} ${response.statusText}`, errorText.substring(0, 200));
            }
          } catch (supabaseError: any) {
            console.error(`Supabase URL fetch error:`, supabaseError.message);
          }
        }

        // Try Supabase storage API as last resort
        if (!fileBuffer && doc.supabasePath) {
          console.log(`Trying Supabase storage API for path: ${doc.supabasePath}`);
          try {
            const supabase = getSupabaseAdmin();
            if (supabase) {
              const bucketName = process.env.SUPABASE_BUCKET || 'cadgroup-uploads';
              const { data, error } = await supabase.storage
                .from(bucketName)
                .download(doc.supabasePath);
              
              if (data && !error) {
                const arrayBuffer = await data.arrayBuffer();
                fileBuffer = Buffer.from(arrayBuffer);
                filename = doc.supabasePath.split('/').pop() || 'document.pdf';
                console.log(`Successfully retrieved from Supabase storage API, size: ${fileBuffer.length}`);
              } else if (error) {
                console.error(`Supabase storage API error:`, error.message);
              }
            }
          } catch (storageError: any) {
            console.error(`Supabase storage error:`, storageError.message);
          }
        }

        if (!fileBuffer) {
          console.error(`Could not retrieve file for document ${doc._id} from any storage`);
          results.push({
            documentId: doc._id,
            status: 'error',
            error: `Could not retrieve file from storage. gridfsFileId: ${doc.gridfsFileId || 'none'}, supabasePath: ${doc.supabasePath || 'none'}, supabaseUrl: ${doc.supabaseUrl ? 'set' : 'none'}`,
          });
          continue;
        }

        // Update status to processing
        doc.processingStatus = 'processing';
        await doc.save();

        // Process with Claude
        const analysisResult = await documentProcessingService.processDocument(
          fileBuffer,
          filename,
          doc.documentType,
          doc.company,
          doc.month,
          doc.year
        );

        // Update document with results
        doc.analysisResult = analysisResult;
        doc.processingStatus = 'completed';
        doc.errorMessage = undefined;
        await doc.save();

        results.push({
          documentId: doc._id,
          status: 'success',
          plStatement: analysisResult.plStatement,
        });

        console.log(`Document ${doc._id} processed successfully`);

      } catch (error: any) {
        console.error(`Error processing document ${doc._id}:`, error);
        
        doc.processingStatus = 'failed';
        doc.errorMessage = error.message;
        await doc.save();

        results.push({
          documentId: doc._id,
          status: 'error',
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      message: `Processed ${successCount} documents successfully, ${errorCount} failed`,
      processed: successCount,
      failed: errorCount,
      results,
    });

  } catch (error: any) {
    console.error('Error reprocessing documents:', error);
    return NextResponse.json(
      { error: 'Failed to reprocess documents', message: error.message },
      { status: 500 }
    );
  }
});

// GET /api/accounting/reprocess - Get status of documents that need reprocessing
export const GET = requireAuth(async (request: NextRequest) => {
  try {
    await connectToDatabase();

    const pendingDocs = await AccountingDocument.find({
      processingStatus: { $in: ['stored', 'uploaded', 'failed'] }
    }).select('_id company month year documentType processingStatus errorMessage createdAt');

    const isConfigured = documentProcessingService.isConfigured();

    return NextResponse.json({
      serviceConfigured: isConfigured,
      pendingCount: pendingDocs.length,
      documents: pendingDocs,
    });

  } catch (error: any) {
    console.error('Error fetching pending documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending documents', message: error.message },
      { status: 500 }
    );
  }
});
