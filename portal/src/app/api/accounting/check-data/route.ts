import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import { requireAuth } from '@/lib/auth';

// GET /api/accounting/check-data - Check what data is stored in documents
export const GET = requireAuth(async (request: NextRequest) => {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company') || 'murphy_web_services';

    // Get all documents for this company
    const documents = await AccountingDocument.find({ company })
      .sort({ year: -1, month: -1, createdAt: -1 })
      .lean();

    const documentDetails = documents.map((doc: any) => ({
      id: doc._id,
      month: doc.month,
      year: doc.year,
      documentType: doc.documentType,
      processingStatus: doc.processingStatus,
      errorMessage: doc.errorMessage,
      hasAnalysisResult: !!doc.analysisResult,
      analysisResult: doc.analysisResult ? {
        documentType: doc.analysisResult.documentType,
        transactionCount: doc.analysisResult.transactions?.length || 0,
        plStatement: doc.analysisResult.plStatement,
        summary: doc.analysisResult.summary,
        insightsCount: doc.analysisResult.insights?.length || 0,
        rawResponse: doc.analysisResult.rawResponse?.substring(0, 500),
        parseError: doc.analysisResult.parseError,
      } : null,
      gridfsFileId: doc.gridfsFileId,
      supabasePath: doc.supabasePath,
      storageType: doc.storageType,
      createdAt: doc.createdAt,
    }));

    // Summary
    const summary = {
      totalDocuments: documents.length,
      completed: documents.filter((d: any) => d.processingStatus === 'completed').length,
      failed: documents.filter((d: any) => d.processingStatus === 'failed').length,
      stored: documents.filter((d: any) => d.processingStatus === 'stored' || d.processingStatus === 'uploaded').length,
      withPLData: documents.filter((d: any) => {
        const pl = d.analysisResult?.plStatement;
        return pl && (pl.totalRevenue > 0 || pl.totalExpenses > 0);
      }).length,
      withZeroPL: documents.filter((d: any) => {
        const pl = d.analysisResult?.plStatement;
        return pl && pl.totalRevenue === 0 && pl.totalExpenses === 0;
      }).length,
      withTransactions: documents.filter((d: any) => {
        return d.analysisResult?.transactions?.length > 0;
      }).length,
    };

    return NextResponse.json({
      success: true,
      company,
      summary,
      documents: documentDetails,
    });

  } catch (error: any) {
    console.error('Error checking data:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
});
