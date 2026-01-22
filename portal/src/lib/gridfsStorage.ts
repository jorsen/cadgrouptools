import { connectToDatabase } from './db';
import { GridFSBucket, ObjectId } from 'mongodb';
import mongoose from 'mongoose';

let gridFSBucket: GridFSBucket | null = null;

// Get or create GridFS bucket for file storage
export async function getGridFSBucket(): Promise<GridFSBucket> {
  if (gridFSBucket) {
    return gridFSBucket;
  }

  await connectToDatabase();
  
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  gridFSBucket = new GridFSBucket(db, {
    bucketName: 'uploads'
  });

  return gridFSBucket;
}

// Upload file to GridFS
export async function uploadToGridFS(
  buffer: Buffer | Uint8Array,
  filename: string,
  metadata: {
    contentType: string;
    company?: string;
    month?: string;
    year?: number;
    documentType?: string;
    uploadedBy?: string;
  }
): Promise<{ fileId: string; filename: string }> {
  const bucket = await getGridFSBucket();
  
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        ...metadata,
        uploadedAt: new Date(),
      },
    });

    uploadStream.on('error', (error) => {
      console.error('[GridFS] Upload error:', error);
      reject(error);
    });

    uploadStream.on('finish', () => {
      console.log('[GridFS] Upload complete:', uploadStream.id.toString());
      resolve({
        fileId: uploadStream.id.toString(),
        filename: filename,
      });
    });

    // Write buffer to stream
    const bufferToWrite = buffer instanceof Uint8Array ? Buffer.from(buffer) : buffer;
    uploadStream.write(bufferToWrite);
    uploadStream.end();
  });
}

// Helper function to clean file ID
function cleanGridFSFileId(fileId: string): string {
  let cleanId = fileId;
  if (cleanId.startsWith('gridfs://')) {
    cleanId = cleanId.replace('gridfs://', '');
  }
  return cleanId;
}

// Download file from GridFS
export async function downloadFromGridFS(fileId: string): Promise<Buffer> {
  const cleanFileId = cleanGridFSFileId(fileId);
  
  // Validate ObjectId format
  if (!ObjectId.isValid(cleanFileId)) {
    throw new Error(`Invalid ObjectId format: ${cleanFileId}`);
  }
  
  const bucket = await getGridFSBucket();
  
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const downloadStream = bucket.openDownloadStream(new ObjectId(cleanFileId));

    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on('error', (error) => {
      console.error('[GridFS] Download error:', error);
      reject(error);
    });

    downloadStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

// Delete file from GridFS
export async function deleteFromGridFS(fileId: string): Promise<void> {
  const cleanFileId = cleanGridFSFileId(fileId);
  
  // Validate ObjectId format
  if (!ObjectId.isValid(cleanFileId)) {
    throw new Error(`Invalid ObjectId format: ${cleanFileId}`);
  }
  
  const bucket = await getGridFSBucket();
  await bucket.delete(new ObjectId(cleanFileId));
}

// Get file info from GridFS
export async function getFileInfo(fileId: string): Promise<any> {
  try {
    const cleanFileId = cleanGridFSFileId(fileId);
    
    // Validate ObjectId format
    if (!ObjectId.isValid(cleanFileId)) {
      console.error('[GridFS] Invalid ObjectId format:', cleanFileId);
      return null;
    }
    
    const bucket = await getGridFSBucket();
    const cursor = bucket.find({ _id: new ObjectId(cleanFileId) });
    const files = await cursor.toArray();
    return files[0] || null;
  } catch (error) {
    console.error('[GridFS] Error getting file info:', error);
    return null;
  }
}

// Get file from GridFS with buffer and metadata
export async function getFileFromGridFS(fileId: string): Promise<{ buffer: Buffer; filename: string; metadata: any } | null> {
  try {
    const cleanFileId = cleanGridFSFileId(fileId);
    console.log(`[GridFS] Getting file: original=${fileId}, cleaned=${cleanFileId}`);
    
    const fileInfo = await getFileInfo(cleanFileId);
    if (!fileInfo) {
      console.log(`[GridFS] File info not found for: ${cleanFileId}`);
      return null;
    }
    
    console.log(`[GridFS] File info found:`, {
      filename: fileInfo.filename,
      length: fileInfo.length,
      uploadDate: fileInfo.uploadDate,
    });

    const buffer = await downloadFromGridFS(cleanFileId);
    console.log(`[GridFS] Downloaded buffer size: ${buffer.length} bytes`);
    
    return {
      buffer,
      filename: fileInfo.filename || 'document.pdf',
      metadata: fileInfo.metadata || {},
    };
  } catch (error) {
    console.error('[GridFS] Error getting file:', error);
    return null;
  }
}

// Generate a URL for accessing the file (via API route)
export function getGridFSFileUrl(fileId: string): string {
  return `/api/files/gridfs/${fileId}`;
}
