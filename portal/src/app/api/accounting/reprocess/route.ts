import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import { requireAuth } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { getFileFromGridFS } from '@/lib/gridfsStorage';
import { documentProcessingService } from '@/services/documentProcessingService';

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

        // Get the file from GridFS
        let fileBuffer: Buffer | null = null;
        let filename = 'document.pdf';

        if (doc.gridfsFileId) {
          const gridfsFile = await getFileFromGridFS(doc.gridfsFileId);
          if (gridfsFile) {
            fileBuffer = gridfsFile.buffer;
            filename = gridfsFile.filename || filename;
          }
        }

        if (!fileBuffer) {
          results.push({
            documentId: doc._id,
            status: 'error',
            error: 'Could not retrieve file from storage',
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
