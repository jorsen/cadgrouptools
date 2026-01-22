import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import { requireAuth } from '@/lib/auth';
import { getFileFromGridFS, getFileInfo, getGridFSBucket } from '@/lib/gridfsStorage';
import { getSupabaseAdmin, getSupabaseStatus } from '@/lib/supabaseAdmin';
import mongoose from 'mongoose';

// GET /api/accounting/storage-debug - Debug storage issues for accounting documents
export const GET = requireAuth(async (request: NextRequest) => {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const company = searchParams.get('company');

    // Get storage configuration status
    const supabaseStatus = getSupabaseStatus();
    
    // Check GridFS connection
    let gridfsStatus = { connected: false, error: null as string | null, filesCount: 0 };
    try {
      const bucket = await getGridFSBucket();
      const db = mongoose.connection.db;
      if (db) {
        // Count files in GridFS
        const filesCollection = db.collection('uploads.files');
        const count = await filesCollection.countDocuments();
        gridfsStatus = { connected: true, error: null, filesCount: count };
      }
    } catch (gridfsError: any) {
      gridfsStatus = { connected: false, error: gridfsError.message, filesCount: 0 };
    }

    // Build query for documents
    const query: any = {};
    if (documentId) {
      query._id = documentId;
    } else if (company) {
      query.company = company;
    }

    // Get documents with storage info
    const documents = await AccountingDocument.find(query)
      .select('_id company month year documentType processingStatus gridfsFileId supabasePath supabaseUrl storageType createdAt errorMessage')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Check each document's file accessibility
    const documentDetails = await Promise.all(
      documents.map(async (doc: any) => {
        const storageChecks: any = {
          documentId: doc._id,
          company: doc.company,
          period: `${doc.month} ${doc.year}`,
          processingStatus: doc.processingStatus,
          storageType: doc.storageType,
          errorMessage: doc.errorMessage,
          gridfs: { configured: false, fileExists: false, error: null as string | null, fileInfo: null as any },
          supabase: { configured: false, urlAccessible: false, storageApiAccessible: false, error: null as string | null },
        };

        // Check GridFS
        if (doc.gridfsFileId) {
          storageChecks.gridfs.configured = true;
          let gridfsId = doc.gridfsFileId;
          if (gridfsId.startsWith('gridfs://')) {
            gridfsId = gridfsId.replace('gridfs://', '');
          }
          
          try {
            const fileInfo = await getFileInfo(gridfsId);
            if (fileInfo) {
              storageChecks.gridfs.fileExists = true;
              storageChecks.gridfs.fileInfo = {
                filename: fileInfo.filename,
                length: fileInfo.length,
                uploadDate: fileInfo.uploadDate,
                contentType: fileInfo.metadata?.contentType,
              };
            } else {
              storageChecks.gridfs.error = 'File not found in GridFS';
            }
          } catch (error: any) {
            storageChecks.gridfs.error = error.message;
          }
        }

        // Check Supabase URL
        if (doc.supabaseUrl) {
          storageChecks.supabase.configured = true;
          try {
            const response = await fetch(doc.supabaseUrl, {
              method: 'HEAD',
              headers: { 'Accept': '*/*' },
            });
            storageChecks.supabase.urlAccessible = response.ok;
            if (!response.ok) {
              storageChecks.supabase.error = `URL returned ${response.status} ${response.statusText}`;
            }
          } catch (error: any) {
            storageChecks.supabase.error = `URL fetch error: ${error.message}`;
          }
        }

        // Check Supabase Storage API
        if (doc.supabasePath) {
          try {
            const supabase = getSupabaseAdmin();
            if (supabase) {
              const bucketName = process.env.SUPABASE_BUCKET || 'cadgroup-uploads';
              
              // Try to get file info (not download)
              const { data: files, error } = await supabase.storage
                .from(bucketName)
                .list(doc.supabasePath.split('/').slice(0, -1).join('/'), {
                  search: doc.supabasePath.split('/').pop(),
                });
              
              if (error) {
                storageChecks.supabase.error = `Storage API error: ${error.message}`;
              } else if (files && files.length > 0) {
                storageChecks.supabase.storageApiAccessible = true;
              } else {
                storageChecks.supabase.error = 'File not found via Storage API';
              }
            }
          } catch (error: any) {
            storageChecks.supabase.error = `Storage API error: ${error.message}`;
          }
        }

        return storageChecks;
      })
    );

    // Summary statistics
    const summary = {
      totalDocuments: documents.length,
      byStatus: {
        completed: documents.filter((d: any) => d.processingStatus === 'completed').length,
        stored: documents.filter((d: any) => d.processingStatus === 'stored').length,
        uploaded: documents.filter((d: any) => d.processingStatus === 'uploaded').length,
        processing: documents.filter((d: any) => d.processingStatus === 'processing').length,
        failed: documents.filter((d: any) => d.processingStatus === 'failed').length,
      },
      storageAccessibility: {
        gridfsAccessible: documentDetails.filter(d => d.gridfs.fileExists).length,
        supabaseUrlAccessible: documentDetails.filter(d => d.supabase.urlAccessible).length,
        supabaseApiAccessible: documentDetails.filter(d => d.supabase.storageApiAccessible).length,
        noAccessibleStorage: documentDetails.filter(d => !d.gridfs.fileExists && !d.supabase.urlAccessible && !d.supabase.storageApiAccessible).length,
      },
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      configuration: {
        supabase: supabaseStatus,
        gridfs: gridfsStatus,
        mongodbConnected: mongoose.connection.readyState === 1,
        supabaseBucket: process.env.SUPABASE_BUCKET || 'cadgroup-uploads',
      },
      summary,
      documents: documentDetails,
      recommendations: generateRecommendations(summary, gridfsStatus, supabaseStatus),
    });

  } catch (error: any) {
    console.error('Storage debug error:', error);
    return NextResponse.json(
      { error: 'Storage debug failed', message: error.message, stack: error.stack },
      { status: 500 }
    );
  }
});

function generateRecommendations(summary: any, gridfsStatus: any, supabaseStatus: any): string[] {
  const recommendations: string[] = [];

  if (!gridfsStatus.connected) {
    recommendations.push('GridFS is not connected. Check MongoDB connection and ensure the database is accessible.');
  }

  if (gridfsStatus.filesCount === 0 && gridfsStatus.connected) {
    recommendations.push('No files found in GridFS. Files may not have been uploaded correctly or the bucket name may be different.');
  }

  if (!supabaseStatus.configured) {
    recommendations.push('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE environment variables.');
  }

  if (summary.storageAccessibility.noAccessibleStorage > 0) {
    recommendations.push(`${summary.storageAccessibility.noAccessibleStorage} document(s) have no accessible storage. These files may need to be re-uploaded.`);
  }

  if (summary.byStatus.failed > 0) {
    recommendations.push(`${summary.byStatus.failed} document(s) are in failed status. Check error messages for details.`);
  }

  if (summary.byStatus.stored > 0 || summary.byStatus.uploaded > 0) {
    recommendations.push(`${summary.byStatus.stored + summary.byStatus.uploaded} document(s) are pending processing. Use the reprocess endpoint to process them.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('All storage systems appear to be working correctly.');
  }

  return recommendations;
}
