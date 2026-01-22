import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import { requireAuth } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { getFileFromGridFS, getFileInfo } from '@/lib/gridfsStorage';
import { documentProcessingService } from '@/services/documentProcessingService';
import { getSupabaseAdmin, getSupabaseStatus } from '@/lib/supabaseAdmin';

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
      const storageAttempts: any[] = [];
      
      try {
        console.log(`\n========== Reprocessing document ${doc._id} ==========`);
        console.log(`Document details:`, {
          gridfsFileId: doc.gridfsFileId,
          supabasePath: doc.supabasePath,
          supabaseUrl: doc.supabaseUrl ? doc.supabaseUrl.substring(0, 80) + '...' : 'none',
          storageType: doc.storageType,
          company: doc.company,
          period: `${doc.month} ${doc.year}`,
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
          
          console.log(`[GridFS] Attempting to fetch file: ${gridfsId}`);
          try {
            // First check if file exists
            const fileInfo = await getFileInfo(gridfsId);
            if (fileInfo) {
              console.log(`[GridFS] File info found:`, {
                filename: fileInfo.filename,
                length: fileInfo.length,
                uploadDate: fileInfo.uploadDate,
              });
              
              const gridfsFile = await getFileFromGridFS(gridfsId);
              if (gridfsFile) {
                fileBuffer = gridfsFile.buffer;
                filename = gridfsFile.filename || filename;
                console.log(`[GridFS] Successfully retrieved file, size: ${fileBuffer.length} bytes`);
                storageAttempts.push({ method: 'gridfs', success: true, size: fileBuffer.length });
              }
            } else {
              console.log(`[GridFS] File not found in database for ID: ${gridfsId}`);
              storageAttempts.push({ method: 'gridfs', success: false, error: 'File not found in GridFS' });
            }
          } catch (gridfsError: any) {
            console.error(`[GridFS] Fetch failed:`, gridfsError.message);
            storageAttempts.push({ method: 'gridfs', success: false, error: gridfsError.message });
          }
        } else {
          console.log(`[GridFS] No gridfsFileId configured for this document`);
        }

        // Fallback to Supabase URL if GridFS didn't work
        if (!fileBuffer && doc.supabaseUrl) {
          console.log(`[Supabase URL] Attempting to fetch: ${doc.supabaseUrl.substring(0, 80)}...`);
          try {
            const response = await fetch(doc.supabaseUrl, {
              headers: {
                'Accept': '*/*',
              },
            });
            console.log(`[Supabase URL] Response: status=${response.status}, statusText=${response.statusText}, contentType=${response.headers.get('content-type')}`);
            
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              fileBuffer = Buffer.from(arrayBuffer);
              filename = doc.supabasePath?.split('/').pop() || 'document.pdf';
              console.log(`[Supabase URL] Successfully retrieved file, size: ${fileBuffer.length} bytes`);
              storageAttempts.push({ method: 'supabase-url', success: true, size: fileBuffer.length });
            } else {
              const errorText = await response.text().catch(() => 'Could not read error body');
              console.error(`[Supabase URL] Fetch failed: ${response.status} ${response.statusText}`, errorText.substring(0, 200));
              storageAttempts.push({ method: 'supabase-url', success: false, error: `${response.status} ${response.statusText}` });
            }
          } catch (supabaseError: any) {
            console.error(`[Supabase URL] Fetch error:`, supabaseError.message);
            storageAttempts.push({ method: 'supabase-url', success: false, error: supabaseError.message });
          }
        } else if (!fileBuffer) {
          console.log(`[Supabase URL] No supabaseUrl configured for this document`);
        }

        // Try Supabase storage API as last resort
        if (!fileBuffer && doc.supabasePath) {
          console.log(`[Supabase API] Attempting to download from path: ${doc.supabasePath}`);
          const supabaseStatus = getSupabaseStatus();
          console.log(`[Supabase API] Configuration status:`, supabaseStatus);
          
          try {
            const supabase = getSupabaseAdmin();
            if (supabase) {
              const bucketName = process.env.SUPABASE_BUCKET || 'cadgroup-uploads';
              console.log(`[Supabase API] Using bucket: ${bucketName}`);
              
              const { data, error } = await supabase.storage
                .from(bucketName)
                .download(doc.supabasePath);
              
              if (data && !error) {
                const arrayBuffer = await data.arrayBuffer();
                fileBuffer = Buffer.from(arrayBuffer);
                filename = doc.supabasePath.split('/').pop() || 'document.pdf';
                console.log(`[Supabase API] Successfully retrieved file, size: ${fileBuffer.length} bytes`);
                storageAttempts.push({ method: 'supabase-api', success: true, size: fileBuffer.length });
              } else if (error) {
                console.error(`[Supabase API] Download error:`, error.message);
                storageAttempts.push({ method: 'supabase-api', success: false, error: error.message });
              }
            } else {
              console.error(`[Supabase API] Supabase admin client not available`);
              storageAttempts.push({ method: 'supabase-api', success: false, error: 'Supabase admin client not available' });
            }
          } catch (storageError: any) {
            console.error(`[Supabase API] Error:`, storageError.message);
            storageAttempts.push({ method: 'supabase-api', success: false, error: storageError.message });
          }
        } else if (!fileBuffer) {
          console.log(`[Supabase API] No supabasePath configured for this document`);
        }

        if (!fileBuffer) {
          console.error(`\n[STORAGE FAILURE] Could not retrieve file for document ${doc._id}`);
          console.error(`Storage attempts:`, JSON.stringify(storageAttempts, null, 2));
          
          results.push({
            documentId: doc._id,
            status: 'error',
            error: `Could not retrieve file from storage. gridfsFileId: ${doc.gridfsFileId || 'none'}, supabasePath: ${doc.supabasePath || 'none'}, supabaseUrl: ${doc.supabaseUrl ? 'set' : 'none'}`,
            storageAttempts,
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
