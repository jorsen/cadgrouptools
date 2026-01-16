import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import ManusTask from '@/models/ManusTask';
import { requireAuth } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { createClient } from '@supabase/supabase-js';
import manusService from '@/services/manusService';

// Helper function to get Supabase client (created lazily to ensure env vars are available)
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;
  
  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error('Supabase configuration missing. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseServiceRole);
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

    // Validation
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!company || !month || !year || !documentType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get Supabase client
    const supabase = getSupabaseClient();
    const bucketName = process.env.SUPABASE_BUCKET || 'cadgroup-uploads';

    // Upload file to Supabase
    const fileExt = file.name.split('.').pop();
    const fileName = `accounting/${company}/${year}/${month}/${Date.now()}.${fileExt}`;
    
    console.log('Uploading to Supabase:', { bucketName, fileName, fileType: file.type, fileSize: file.size });
    
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      throw new Error(`Failed to upload to storage: ${uploadError.message}`);
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

