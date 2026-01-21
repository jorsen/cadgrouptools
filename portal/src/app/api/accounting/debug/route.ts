import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import { requireAuth } from '@/lib/auth';
import { documentProcessingService } from '@/services/documentProcessingService';
import { getSupabaseAdmin, getSupabaseStatus } from '@/lib/supabaseAdmin';

// GET /api/accounting/debug - Debug endpoint to check configuration and document status
export const GET = requireAuth(async (request: NextRequest) => {
  try {
    await connectToDatabase();

    // Check service configurations
    const claudeConfigured = documentProcessingService.isConfigured();
    const supabaseStatus = getSupabaseStatus();
    const anthropicKeySet = !!process.env.ANTHROPIC_API_KEY;
    const anthropicKeyLength = process.env.ANTHROPIC_API_KEY?.length || 0;

    // Get document statistics
    const allDocs = await AccountingDocument.find({}).select(
      '_id company month year documentType processingStatus gridfsFileId supabasePath supabaseUrl storageType createdAt errorMessage'
    ).lean();

    const stats = {
      total: allDocs.length,
      byStatus: {
        uploaded: allDocs.filter((d: any) => d.processingStatus === 'uploaded').length,
        stored: allDocs.filter((d: any) => d.processingStatus === 'stored').length,
        processing: allDocs.filter((d: any) => d.processingStatus === 'processing').length,
        completed: allDocs.filter((d: any) => d.processingStatus === 'completed').length,
        failed: allDocs.filter((d: any) => d.processingStatus === 'failed').length,
      },
      withGridFS: allDocs.filter((d: any) => d.gridfsFileId).length,
      withSupabase: allDocs.filter((d: any) => d.supabasePath || d.supabaseUrl).length,
    };

    // Get sample documents for debugging
    const sampleDocs = allDocs.slice(0, 5).map((d: any) => ({
      _id: d._id,
      company: d.company,
      month: d.month,
      year: d.year,
      processingStatus: d.processingStatus,
      hasGridfsFileId: !!d.gridfsFileId,
      gridfsFileId: d.gridfsFileId,
      hasSupabasePath: !!d.supabasePath,
      supabasePath: d.supabasePath,
      hasSupabaseUrl: !!d.supabaseUrl,
      supabaseUrl: d.supabaseUrl?.substring(0, 100) + '...',
      storageType: d.storageType,
      errorMessage: d.errorMessage,
    }));

    return NextResponse.json({
      configuration: {
        claudeConfigured,
        anthropicKeySet,
        anthropicKeyLength,
        anthropicKeyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10) + '...',
        supabaseStatus,
      },
      documentStats: stats,
      sampleDocuments: sampleDocs,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: 'Debug endpoint failed', message: error.message },
      { status: 500 }
    );
  }
});
