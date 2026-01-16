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

// Download file from GridFS
export async function downloadFromGridFS(fileId: string): Promise<Buffer> {
  const bucket = await getGridFSBucket();
  
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));

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
  const bucket = await getGridFSBucket();
  await bucket.delete(new ObjectId(fileId));
}

// Get file info from GridFS
export async function getFileInfo(fileId: string): Promise<any> {
  const bucket = await getGridFSBucket();
  const cursor = bucket.find({ _id: new ObjectId(fileId) });
  const files = await cursor.toArray();
  return files[0] || null;
}

// Generate a URL for accessing the file (via API route)
export function getGridFSFileUrl(fileId: string): string {
  return `/api/files/gridfs/${fileId}`;
}
