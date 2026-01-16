import { NextRequest, NextResponse } from 'next/server';
import { downloadFromGridFS, getFileInfo } from '@/lib/gridfsStorage';

// GET /api/files/gridfs/[fileId] - Download file from GridFS
export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params;

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Get file info
    const fileInfo = await getFileInfo(fileId);
    if (!fileInfo) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Download file
    const buffer = await downloadFromGridFS(fileId);

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(buffer);

    // Return file with appropriate headers
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': fileInfo.metadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${fileInfo.filename}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error: any) {
    console.error('Error downloading file from GridFS:', error);
    return NextResponse.json(
      { error: 'Failed to download file', message: error.message },
      { status: 500 }
    );
  }
}
