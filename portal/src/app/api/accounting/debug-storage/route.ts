import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import { requireAuth } from '@/lib/auth';
import { getGridFSBucket, getFileInfo } from '@/lib/gridfsStorage';
import { ObjectId } from 'mongodb';

// GET /api/accounting/debug-storage - Debug storage issues
export const GET = requireAuth(async (request: NextRequest) => {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company');

    // Get all documents
    const query = company ? { company } : {};
    const documents = await AccountingDocument.find(query)
      .select('_id company month year gridfsFileId supabasePath supabaseUrl storageType processingStatus')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Check GridFS bucket
    const bucket = await getGridFSBucket();
    const allGridFSFiles = await bucket.find({}).limit(50).toArray();

    // Check each document's file
    const documentStatus = await Promise.all(
      documents.map(async (doc: any) => {
        let gridfsStatus = 'no_id';
        let gridfsFileExists = false;
        let cleanedId = null;

        if (doc.gridfsFileId) {
          cleanedId = doc.gridfsFileId.replace('gridfs://', '');
          
          if (ObjectId.isValid(cleanedId)) {
            try {
              const fileInfo = await getFileInfo(cleanedId);
              gridfsFileExists = !!fileInfo;
              gridfsStatus = fileInfo ? 'found' : 'not_found';
            } catch (e: any) {
              gridfsStatus = `error: ${e.message}`;
            }
          } else {
            gridfsStatus = 'invalid_objectid';
          }
        }

        return {
          documentId: doc._id,
          company: doc.company,
          period: `${doc.month} ${doc.year}`,
          processingStatus: doc.processingStatus,
          storageType: doc.storageType,
          gridfsFileId: doc.gridfsFileId,
          cleanedGridfsId: cleanedId,
          gridfsStatus,
          gridfsFileExists,
          supabasePath: doc.supabasePath,
          hasSupabaseUrl: !!doc.supabaseUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      totalDocuments: documents.length,
      totalGridFSFiles: allGridFSFiles.length,
      gridFSFiles: allGridFSFiles.map((f: any) => ({
        id: f._id.toString(),
        filename: f.filename,
        length: f.length,
        uploadDate: f.uploadDate,
        metadata: f.metadata,
      })),
      documents: documentStatus,
      summary: {
        withGridfsId: documentStatus.filter(d => d.gridfsFileId).length,
        gridfsFound: documentStatus.filter(d => d.gridfsStatus === 'found').length,
        gridfsNotFound: documentStatus.filter(d => d.gridfsStatus === 'not_found').length,
        gridfsInvalidId: documentStatus.filter(d => d.gridfsStatus === 'invalid_objectid').length,
        gridfsError: documentStatus.filter(d => d.gridfsStatus.startsWith('error')).length,
      },
    });

  } catch (error: any) {
    console.error('Error debugging storage:', error);
    return NextResponse.json(
      { error: 'Failed to debug storage', message: error.message },
      { status: 500 }
    );
  }
});
