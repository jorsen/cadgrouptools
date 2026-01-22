import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import { requireAuth } from '@/lib/auth';
import { deleteFromGridFS } from '@/lib/gridfsStorage';

// DELETE /api/accounting/documents/[id] - Delete a document
export const DELETE = requireAuth(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    await connectToDatabase();
    
    const { id } = await context.params;

    // Find the document
    const doc = await AccountingDocument.findById(id);
    
    if (!doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Try to delete from GridFS if it has a file
    if (doc.gridfsFileId) {
      try {
        await deleteFromGridFS(doc.gridfsFileId);
        console.log(`Deleted GridFS file: ${doc.gridfsFileId}`);
      } catch (error: any) {
        console.warn(`Failed to delete GridFS file: ${error.message}`);
        // Continue with document deletion even if file deletion fails
      }
    }

    // Delete the document record
    await AccountingDocument.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });

  } catch (error: any) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document', message: error.message },
      { status: 500 }
    );
  }
});

// GET /api/accounting/documents/[id] - Get a single document
export const GET = requireAuth(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    await connectToDatabase();
    
    const { id } = await context.params;

    const doc = await AccountingDocument.findById(id)
      .populate('uploadedBy', 'name email')
      .lean();
    
    if (!doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ document: doc });

  } catch (error: any) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document', message: error.message },
      { status: 500 }
    );
  }
});
