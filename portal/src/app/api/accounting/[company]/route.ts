import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingDocument from '@/models/AccountingDocument';
import { requireAuth } from '@/lib/auth';

// GET /api/accounting/[company] - Get all accounting data for a company
export const GET = requireAuth(async (request: NextRequest, context: { params: Promise<{ company: string }> }) => {
  try {
    await connectToDatabase();

    // In Next.js 15+, params is a Promise that needs to be awaited
    const { company } = await context.params;

    // Fetch all documents for this company
    const documents = await AccountingDocument.find({ company })
      .sort({ year: -1, month: -1, createdAt: -1 })
      .populate('uploadedBy', 'name email')
      .lean();

    // Extract P&L statements from completed analyses
    const plStatements: any[] = [];
    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    documents.forEach((doc: any) => {
      if (doc.processingStatus === 'completed' && doc.analysisResult?.plStatement) {
        plStatements.push({
          month: doc.month,
          year: doc.year,
          totalRevenue: doc.analysisResult.plStatement.totalRevenue || 0,
          totalExpenses: doc.analysisResult.plStatement.totalExpenses || 0,
          netIncome: doc.analysisResult.plStatement.netIncome || 0,
          categories: doc.analysisResult.plStatement.categories || {},
          insights: doc.analysisResult.insights || [],
        });
      }
    });

    // Sort P&L statements by year and month
    plStatements.sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year;
      }
      return monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month);
    });

    return NextResponse.json({
      company,
      documents,
      plStatements,
      summary: {
        totalDocuments: documents.length,
        processed: documents.filter((d: any) => d.processingStatus === 'completed').length,
        processing: documents.filter((d: any) => d.processingStatus === 'processing').length,
        stored: documents.filter((d: any) => d.processingStatus === 'stored' || d.processingStatus === 'uploaded').length,
        failed: documents.filter((d: any) => d.processingStatus === 'failed').length,
      },
    });

  } catch (error: any) {
    console.error('Error fetching accounting data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounting data', message: error.message },
      { status: 500 }
    );
  }
});

