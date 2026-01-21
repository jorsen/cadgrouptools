import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import ManusTask from '@/models/ManusTask';
import { requireAuth } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { uploadToGridFS, getGridFSFileUrl } from '@/lib/gridfsStorage';
import { getSupabaseAdmin, STORAGE_BUCKET, getSupabaseStatus } from '@/lib/supabaseAdmin';
import manusService from '@/services/manusService';

// Storage type for tracking where files are stored
type StorageType = 'gridfs' | 'supabase';

// Try to upload to Supabase (optional, may fail due to network issues)
async function trySupabaseUpload(
  uint8Array: Uint8Array,
  fileName: string,
  contentType: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    const bucketName = process.env.SUPABASE_BUCKET || STORAGE_BUCKET || 'cadgroup-uploads';
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, uint8Array, {
        contentType: contentType || 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return { success: true, url: urlData.publicUrl };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// POST /api/accounting/upload - Upload accounting document
export const POST = requireAuth(async (request: NextRequest) => {
  try {
    const session = await getServerSession(authOptions);
    const formData = await request.formData();

    const file = formData.get('file') as File;
    const company = formData.get('company') as string;
    const month = formData.get('month') as string;
    const year = parseInt(formData.get('year') as string);
    const documentType = formData.get('documentType') as string;

    console.log('Upload request received:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      company,
      month,
      year,
      documentType,
    });

    // Validation
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!company || !month || !year || !documentType) {
      return NextResponse.json(
        { error: 'Missing required fields', details: { company: !!company, month: !!month, year: !!year, documentType: !!documentType } },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);
    const buffer = Buffer.from(fileBuffer);
    
    console.log('File buffer ready, size:', uint8Array.length);

    // Generate file path
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `accounting/${company}/${year}/${month}/${Date.now()}.${fileExt}`;

    // Primary storage: GridFS (MongoDB) - this should always work since MongoDB is connected
    let storageType: StorageType = 'gridfs';
    let fileUrl: string;
    let storagePath: string;
    let gridfsFileId: string | undefined;

    console.log('Uploading to GridFS (primary storage)...');
    
    try {
      const gridfsResult = await uploadToGridFS(buffer, fileName, {
        contentType: file.type,
        company,
        month,
        year,
        documentType,
        uploadedBy: session?.user?.id,
      });
      
      gridfsFileId = gridfsResult.fileId;
      fileUrl = getGridFSFileUrl(gridfsResult.fileId);
      storagePath = `gridfs://${gridfsResult.fileId}`;
      
      console.log('GridFS upload successful:', gridfsResult);
    } catch (gridfsError: any) {
      console.error('GridFS upload failed:', gridfsError);
      return NextResponse.json(
        { error: 'Failed to upload file to storage', message: gridfsError.message },
        { status: 500 }
      );
    }

    // Optional: Try Supabase as secondary storage (for CDN/public access)
    // This is non-blocking - if it fails, we still have the file in GridFS
    const supabaseStatus = getSupabaseStatus();
    console.log('Supabase status:', supabaseStatus);
    
    if (supabaseStatus.initialized) {
      console.log('Attempting Supabase upload (secondary storage)...');
      const supabaseResult = await trySupabaseUpload(uint8Array, fileName, file.type);
      
      if (supabaseResult.success && supabaseResult.url) {
        console.log('Supabase upload successful:', supabaseResult.url);
        // Use Supabase URL as the public URL (better for CDN)
        fileUrl = supabaseResult.url;
        storagePath = fileName;
        storageType = 'supabase';
      } else {
        console.warn('Supabase upload failed (using GridFS):', supabaseResult.error);
        // Keep using GridFS URL
      }
    }

    // Check if Manus service is configured
    const isManusConfigured = manusService.isServiceConfigured();
    console.log('Manus service configured:', isManusConfigured);

    let existingManusTask: any = null;
    let manusTaskId: string | null = null;

    if (isManusConfigured) {
      // Check if company already has a persistent Manus task
      existingManusTask = await ManusTask.findOne({
        taskType: 'accounting',
        company,
        status: { $ne: 'failed' },
      }).sort({ createdAt: -1 });

      if (existingManusTask) {
        manusTaskId = existingManusTask.manusTaskId;
        console.log(`Using existing Manus task for ${company}:`, manusTaskId);
      } else {
        try {
          // Create new persistent task for this company
          const manusTask = await manusService.createAccountingTask(company);
          manusTaskId = manusTask.id;

          existingManusTask = await ManusTask.create({
            manusTaskId,
            taskType: 'accounting',
            company,
            status: 'pending',
            inputData: {
              company,
              createdAt: new Date().toISOString(),
            },
          });

          console.log(`Created new Manus task for ${company}:`, manusTaskId);
        } catch (manusCreateError: any) {
          console.error('Failed to create Manus task:', manusCreateError.message);
          // Continue without Manus - file is still stored
        }
      }
    } else {
      console.warn('Manus service not configured - skipping AI processing');
    }

    // Create AccountingDocument record
    const accountingDoc = await AccountingDocument.create({
      company,
      month,
      year,
      documentType,
      supabasePath: storagePath,
      supabaseUrl: fileUrl,
      gridfsFileId: gridfsFileId,
      storageType: storageType,
      uploadedBy: session?.user?.id,
      manusTaskId: manusTaskId || undefined,
      processingStatus: manusTaskId ? 'uploaded' : 'stored',
    });

    // Upload file to Manus task (only if Manus is configured and task was created)
    if (manusTaskId && existingManusTask) {
      try {
        await manusService.uploadFileToTask(manusTaskId, buffer, {
          filename: file.name,
          contentType: file.type,
        });

        accountingDoc.processingStatus = 'processing';
        await accountingDoc.save();

        existingManusTask.status = 'processing';
        existingManusTask.accountingUploadId = accountingDoc._id;
        await existingManusTask.save();

        console.log(`Uploaded file to Manus task ${manusTaskId}`);
      } catch (manusError: any) {
        console.error('Error uploading to Manus:', manusError);
        accountingDoc.processingStatus = 'failed';
        accountingDoc.errorMessage = manusError.message;
        await accountingDoc.save();

        // Still return success since file is stored - Manus can be retried
        return NextResponse.json({
          success: true,
          document: accountingDoc,
          manusTaskId,
          warning: 'Document uploaded to storage but failed to send to Manus AI. Processing can be retried.',
          storageType,
        }, { status: 201 });
      }

      return NextResponse.json({
        success: true,
        document: accountingDoc,
        manusTaskId,
        message: 'Document uploaded and sent to Manus AI for processing',
        storageType,
      }, { status: 201 });
    }

    // Return success without Manus processing
    return NextResponse.json({
      success: true,
      document: accountingDoc,
      message: 'Document uploaded to storage. Manus AI processing is not configured.',
      warning: 'MANUS_API_KEY is not set or invalid. Please configure a valid Manus API token to enable AI processing.',
      storageType,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error uploading accounting document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document', message: error.message },
      { status: 500 }
    );
  }
});
