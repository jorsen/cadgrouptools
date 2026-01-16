import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import ManusTask from '@/models/ManusTask';
import { requireAuth } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { getSupabaseAdmin, STORAGE_BUCKET, getSupabaseStatus } from '@/lib/supabaseAdmin';
import manusService from '@/services/manusService';

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

    // Get Supabase client (lazy initialization)
    const supabaseStatus = getSupabaseStatus();
    console.log('Supabase status:', supabaseStatus);
    
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Supabase admin client not initialized');
      return NextResponse.json(
        { error: 'Storage service not configured', details: supabaseStatus },
        { status: 503 }
      );
    }

    const bucketName = process.env.SUPABASE_BUCKET || STORAGE_BUCKET || 'cadgroup-uploads';

    // Upload file to Supabase
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `accounting/${company}/${year}/${month}/${Date.now()}.${fileExt}`;
    
    console.log('Preparing Supabase upload:', { bucketName, fileName, fileType: file.type, fileSize: file.size });
    
    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);
    
    console.log('File buffer ready, size:', uint8Array.length);
    
    // Upload to Supabase with retry logic
    let uploadData;
    let uploadError;
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        const result = await supabase.storage
          .from(bucketName)
          .upload(fileName, uint8Array, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });
        
        uploadData = result.data;
        uploadError = result.error;
        
        if (!uploadError) {
          break;
        }
        
        console.error(`Supabase upload attempt ${retries + 1} failed:`, uploadError);
        retries++;
        
        if (retries <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      } catch (networkError: any) {
        console.error(`Supabase upload network error (attempt ${retries + 1}):`, networkError.message);
        retries++;
        
        if (retries <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        } else {
          throw new Error(`Network error uploading to storage after ${maxRetries + 1} attempts: ${networkError.message}`);
        }
      }
    }

    if (uploadError) {
      console.error('Supabase upload error after retries:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload to storage', message: uploadError.message, code: (uploadError as any).name },
        { status: 500 }
      );
    }

    console.log('Supabase upload successful:', uploadData);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    // Check if company already has a persistent Manus task
    let existingManusTask = await ManusTask.findOne({
      taskType: 'accounting',
      company,
      status: { $ne: 'failed' }, // Don't reuse failed tasks
    }).sort({ createdAt: -1 });

    let manusTaskId: string;

    if (existingManusTask) {
      // Use existing persistent task
      manusTaskId = existingManusTask.manusTaskId;
      console.log(`Using existing Manus task for ${company}:`, manusTaskId);
    } else {
      // Create new persistent task for this company
      const manusTask = await manusService.createAccountingTask(company);
      manusTaskId = manusTask.id;

      // Create ManusTask record
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
    }

    // Create AccountingDocument record
    const accountingDoc = await AccountingDocument.create({
      company,
      month,
      year,
      documentType,
      supabasePath: fileName,
      supabaseUrl: urlData.publicUrl,
      uploadedBy: session?.user?.id,
      manusTaskId,
      processingStatus: 'uploaded',
    });

    // Upload file to Manus task
    try {
      const buffer = Buffer.from(fileBuffer);
      await manusService.uploadFileToTask(manusTaskId, buffer, {
        filename: file.name,
        contentType: file.type,
      });

      // Update status to processing
      accountingDoc.processingStatus = 'processing';
      await accountingDoc.save();

      // Update Manus task status
      existingManusTask.status = 'processing';
      existingManusTask.accountingUploadId = accountingDoc._id;
      await existingManusTask.save();

      console.log(`Uploaded file to Manus task ${manusTaskId}`);
    } catch (manusError: any) {
      console.error('Error uploading to Manus:', manusError);
      accountingDoc.processingStatus = 'failed';
      accountingDoc.errorMessage = manusError.message;
      await accountingDoc.save();

      return NextResponse.json(
        { 
          error: 'Document uploaded to storage but failed to send to Manus AI',
          document: accountingDoc,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document: accountingDoc,
      manusTaskId,
      message: 'Document uploaded and sent to Manus AI for processing',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error uploading accounting document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document', message: error.message },
      { status: 500 }
    );
  }
});

