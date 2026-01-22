import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { documentProcessingService } from '@/services/documentProcessingService';

// GET /api/accounting/test-document-processing - Test document processing with a sample
export const GET = requireAuth(async (request: NextRequest) => {
  try {
    // Check if service is configured
    const isConfigured = documentProcessingService.isConfigured();
    
    if (!isConfigured) {
      return NextResponse.json({
        success: false,
        error: 'Document processing service not configured',
        apiKeySet: !!process.env.ANTHROPIC_API_KEY,
        apiKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      message: 'Document processing service is configured',
      apiKeySet: true,
      apiKeyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 20) + '...',
    });

  } catch (error: any) {
    console.error('Error testing document processing:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
});

// POST /api/accounting/test-document-processing - Test with actual document
export const POST = requireAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided',
      }, { status: 400 });
    }

    console.log('========== TEST DOCUMENT PROCESSING ==========');
    console.log('File:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Check if service is configured
    const isConfigured = documentProcessingService.isConfigured();
    if (!isConfigured) {
      return NextResponse.json({
        success: false,
        error: 'Document processing service not configured',
      }, { status: 503 });
    }

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);

    console.log('Buffer size:', buffer.length);

    // Process the document
    const startTime = Date.now();
    const result = await documentProcessingService.processDocument(
      buffer,
      file.name,
      'bank_statement',
      'test_company',
      'January',
      2025
    );
    const processingTime = Date.now() - startTime;

    console.log('========== PROCESSING RESULT ==========');
    console.log('Processing time:', processingTime, 'ms');
    console.log('Document type:', result.documentType);
    console.log('Transaction count:', result.transactions?.length || 0);
    console.log('P&L Statement:', JSON.stringify(result.plStatement, null, 2));
    console.log('Summary:', JSON.stringify(result.summary, null, 2));
    console.log('Insights:', result.insights);

    return NextResponse.json({
      success: true,
      processingTime: `${processingTime}ms`,
      result: {
        documentType: result.documentType,
        transactionCount: result.transactions?.length || 0,
        transactions: result.transactions?.slice(0, 5), // First 5 transactions
        plStatement: result.plStatement,
        summary: result.summary,
        insights: result.insights,
      },
    });

  } catch (error: any) {
    console.error('========== PROCESSING ERROR ==========');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    return NextResponse.json({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
    }, { status: 500 });
  }
});
