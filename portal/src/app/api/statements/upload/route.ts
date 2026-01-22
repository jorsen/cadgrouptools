import { NextRequest, NextResponse } from 'next/server';

// Ensure Node.js runtime (needed for Buffer, require, pdf-parse)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToDatabase } from '@/lib/db';
import { Statement } from '@/models/Statement';
import { File } from '@/models/File';
import { Transaction } from '@/models/Transaction';
import { Category } from '@/models/Category';
import { Account } from '@/models/Account';
import { Types } from 'mongoose';
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabaseAdmin';
// Use Tesseract OCR service for all OCR processing
import { tesseractOCRService } from '@/lib/ocr-tesseract';
import type { ExtractedTransaction } from '@/lib/ocr-tesseract';
import { notificationService } from '@/services/notificationService';
import { withActivityTracking } from '@/middleware/activityTracking';
import { claudeCodeOCRService } from '@/lib/ocr-claude';

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Ensure Supabase is configured
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Storage is not configured', details: 'Supabase Admin client is not initialized. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE env vars.' },
        { status: 500 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const accountName = formData.get('accountName') as string;
    const bankName = formData.get('bankName') as string;
    const month = parseInt(formData.get('month') as string);
    const year = parseInt(formData.get('year') as string);

    // Validate required fields
    if (!file || !accountName || !month || !year) {
      return NextResponse.json(
        { error: 'Missing required fields: file, accountName, month, year' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PDF, JPEG, PNG, or TIFF files.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileExtension = file.name.split('.').pop();
    const fileName = `statements/${year}/${month}/${timestamp}_${sanitizedFileName}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from(STORAGE_BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    // Create file record in database
    const fileDoc = await File.create({
      fileName: fileName,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedBy: new Types.ObjectId(session.user.id),
      storageProvider: 'supabase',
      path: fileName,
    });

    // Create statement record
    const statement = await Statement.create({
      accountName,
      bankName: bankName || 'Unknown Bank',
      month,
      year,
      sourceFile: fileDoc._id,
      status: 'uploaded',
      currency: 'USD',
      createdBy: new Types.ObjectId(session.user.id),
    });

    // Start OCR processing asynchronously
    processOCR(statement._id.toString(), buffer, file.type).catch(error => {
      console.error('Background OCR processing failed:', error);
    });

    // Send real-time notification about statement upload
    try {
      await notificationService.notifyStatementUpload({
        statementId: statement._id.toString(),
        accountName,
        month,
        year,
        uploadedBy: session.user.id,
        uploadedByName: session.user.name,
      });
    } catch (notificationError) {
      console.error('Failed to send notification for statement upload:', notificationError);
    }

    // Populate the file reference for response
    const populatedStatement = await Statement
      .findById(statement._id)
      .populate('sourceFile')
      .lean();

    return NextResponse.json({
      success: true,
      data: populatedStatement,
      message: 'Statement uploaded successfully. OCR processing has started.',
    });

  } catch (error: any) {
    console.error('Statement upload error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload statement',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Background OCR processing function
async function processOCR(statementId: string, buffer: Buffer, mimeType: string) {
  try {
    let extractedText = '';
    let ocrProvider = 'claude-code';
    let confidence: number | undefined;
    let statementData: any = null;

    // Handle PDFs - Try Claude Code first, then fallback to Tesseract
    if (mimeType === 'application/pdf') {
      try {
        // First try Claude Code OCR for best results
        if (claudeCodeOCRService.isConfigured()) {
          console.log('Using Claude Code OCR for PDF processing...');
          const claudeResult = await claudeCodeOCRService.extractTextFromPDF(buffer);
          
          if (!claudeResult.error && claudeResult.text) {
            console.log('Claude Code OCR successful');
            extractedText = claudeResult.text;
            ocrProvider = 'claude-code';
            confidence = claudeResult.confidence;
            
            // Parse the structured data from Claude
            statementData = claudeCodeOCRService.parseBankStatement(extractedText);
            
            if (statementData.transactions.length > 0) {
              console.log(`Claude Code extracted ${statementData.transactions.length} transactions`);
            }
          } else {
            console.log('Claude Code OCR failed, falling back to Tesseract');
            throw new Error('Claude Code OCR failed');
          }
        } else {
          console.log('Claude Code not configured, using Tesseract OCR');
          throw new Error('Claude Code not configured');
        }
      } catch (claudeError) {
        console.log('Claude Code OCR failed, falling back to Tesseract:', claudeError);
        
        try {
          // Fallback to pdf-parse for embedded text
          const pdfParse = require('pdf-parse');
          const pdfResult = await pdfParse(buffer);
          
          if (pdfResult.text && pdfResult.text.trim().length > 100) {
            console.log('PDF has embedded text, using pdf-parse');
            extractedText = pdfResult.text;
            ocrProvider = 'pdf-parse';
          } else {
            // PDF appears to be scanned, use Tesseract OCR
            console.log('PDF has minimal embedded text, using Tesseract OCR');
            const tesseractResult = await tesseractOCRService.extractTextFromPDF(buffer);
            
            if (tesseractResult.error) {
              throw new Error(`Tesseract OCR failed: ${tesseractResult.error}`);
            }
            
            extractedText = tesseractResult.text;
            ocrProvider = 'tesseract';
            confidence = tesseractResult.confidence;
          }
        } catch (fallbackError) {
          console.error('All OCR methods failed:', fallbackError);
          await Statement.findByIdAndUpdate(statementId, {
            status: 'failed',
            processingErrors: ['All OCR methods failed', (fallbackError as Error).message],
          });
          return;
        }
      }
    } else {
      // Process images with Tesseract OCR (Claude Code doesn't handle images directly)
      console.log('Processing image with Tesseract OCR...');
      const tesseractResult = await tesseractOCRService.extractTextFromImage(buffer, mimeType);
      
      if (tesseractResult.error) {
        console.error('Tesseract OCR failed:', tesseractResult.error);
        await Statement.findByIdAndUpdate(statementId, {
          status: 'failed',
          processingErrors: ['OCR processing failed', tesseractResult.error],
        });
        return;
      }
      
      extractedText = tesseractResult.text;
      ocrProvider = 'tesseract';
      confidence = tesseractResult.confidence;
    }

    // If we don't have structured data yet, parse the text
    if (!statementData) {
      if (ocrProvider === 'claude-code') {
        statementData = claudeCodeOCRService.parseBankStatement(extractedText);
      } else {
        statementData = tesseractOCRService.parseBankStatement(extractedText);
      }
    }

    // Update statement with extracted data
    await Statement.findByIdAndUpdate(statementId, {
      status: 'extracted',
      ocrProvider,
      extractedData: {
        rawText: extractedText,
        parsedData: statementData,
        confidence: confidence,
      },
      extractedAt: new Date(),
    });

    // Create transaction records from parsed data
    if (statementData.transactions && statementData.transactions.length > 0) {
      await createTransactionsFromOCR(statementId, statementData.transactions);
    }

    console.log(`OCR processing completed for statement ${statementId}`);

  } catch (error) {
    console.error(`OCR processing failed for statement ${statementId}:`, error);
    
    await Statement.findByIdAndUpdate(statementId, {
      status: 'failed',
      processingErrors: ['OCR processing failed: ' + (error as Error).message],
    });
  }
}

// Fallback PDF text extraction using pdfjs-dist
async function extractTextFromPdfWithPdfJs(buffer: Buffer): Promise<string> {
  try {
    // For now, we'll skip pdfjs-dist due to worker issues and rely on pdf-parse and Tesseract
    // This function will just return empty string to trigger Tesseract OCR
    console.log('Skipping pdfjs-dist due to worker configuration issues, will use Tesseract OCR');
    return '';
    
    /* Original pdfjs-dist code commented out due to workerSrc issues
    // Use legacy build for Node.js environment to avoid DOM dependencies
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    // Convert Buffer to Uint8Array for pdfjs-dist
    const uint8Array = new Uint8Array(buffer);
    
    // Load the PDF document with proper options for Node.js
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      // Disable worker completely for Node.js environment
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableAutoFetch: true,
      disableStream: true,
      disableFontFace: true,
    });
    
    const pdf = await loadingTask.promise;
    let combinedText = '';
    const maxPages = Math.min(pdf.numPages || 1, 20);
    
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => {
            // Handle both TextItem and TextMarkedContent types
            if ('str' in item) {
              return item.str;
            }
            return '';
          })
          .filter((text: string) => text.length > 0)
          .join(' ');
        
        if (pageText) {
          combinedText += `\n${pageText}`;
        }
      } catch (pageError) {
        console.warn(`Failed to extract text from page ${i}:`, pageError);
        // Continue with other pages even if one fails
      }
    }
    
    // Clean up the document
    await loadingTask.destroy();
    
    return combinedText.trim();
    */
  } catch (error) {
    console.error('PDF.js text extraction failed:', error);
    // Return empty string to trigger Tesseract OCR fallback
    return '';
  }
}

// Helper function to get or create default categories for uncategorized transactions
async function getOrCreateDefaultCategories(): Promise<{ incomeCategory: Types.ObjectId; expenseCategory: Types.ObjectId }> {
  // Try to find existing uncategorized categories
  let incomeCategory = await Category.findOne({ name: 'Uncategorized Income', type: 'income' });
  let expenseCategory = await Category.findOne({ name: 'Uncategorized Expense', type: 'expense' });

  // Create if they don't exist
  if (!incomeCategory) {
    incomeCategory = await Category.create({
      name: 'Uncategorized Income',
      type: 'income',
      description: 'Default category for uncategorized income transactions',
      isSystem: true,
      isDeductible: true,
      status: 'active',
    });
    console.log('Created default Uncategorized Income category');
  }

  if (!expenseCategory) {
    expenseCategory = await Category.create({
      name: 'Uncategorized Expense',
      type: 'expense',
      description: 'Default category for uncategorized expense transactions',
      isSystem: true,
      isDeductible: true,
      status: 'active',
    });
    console.log('Created default Uncategorized Expense category');
  }

  return {
    incomeCategory: incomeCategory._id,
    expenseCategory: expenseCategory._id,
  };
}

// Helper function to create transactions from OCR data with deduplication
async function createTransactionsFromOCR(
  statementId: string,
  extractedTransactions: ExtractedTransaction[]
): Promise<void> {
  try {
    // Get the statement with its account to find the company
    const statement = await Statement.findById(statementId).populate('account').lean();
    if (!statement) {
      throw new Error(`Statement not found: ${statementId}`);
    }

    // Get company ID from the account, or try to find account by accountName
    let companyId: Types.ObjectId | null = null;
    
    if (statement.account && (statement.account as any).company) {
      companyId = (statement.account as any).company;
    } else if (statement.accountName) {
      // Try to find account by name to get company
      const account = await Account.findOne({ name: statement.accountName }).lean();
      if (account && account.company) {
        companyId = account.company as Types.ObjectId;
        
        // Update statement with account reference for future use
        await Statement.findByIdAndUpdate(statementId, { account: account._id });
      }
    }

    if (!companyId) {
      console.warn(`No company found for statement ${statementId}. Transactions will be created without company reference.`);
      // For now, we'll still create transactions but they won't appear in P&L reports
      // In production, you might want to throw an error or handle this differently
    }

    // Get or create default categories
    const { incomeCategory, expenseCategory } = await getOrCreateDefaultCategories();

    // Get existing transactions for this statement to avoid duplicates
    const existingTransactions = await Transaction.find({ statement: statementId })
      .select('txnDate description amount direction')
      .lean();

    // Create a Set of existing transaction signatures for deduplication
    const existingSignatures = new Set(
      existingTransactions.map(t =>
        `${new Date(t.txnDate).toISOString().split('T')[0]}_${t.description}_${t.amount}_${t.direction}`
      )
    );

    // Prepare new transactions for bulk insert
    const newTransactions = [];
    const currentYear = new Date().getFullYear();

    for (const extracted of extractedTransactions) {
      // Parse date (handle various formats)
      let txnDate: Date;
      const dateParts = extracted.date.split('/');
      
      if (dateParts.length === 2) {
        // MM/DD format - assume current year
        const [month, day] = dateParts;
        txnDate = new Date(currentYear, parseInt(month) - 1, parseInt(day));
      } else if (dateParts.length === 3) {
        // MM/DD/YY or MM/DD/YYYY format
        const [month, day, year] = dateParts;
        const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
        txnDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
      } else {
        console.warn(`Skipping transaction with invalid date format: ${extracted.date}`);
        continue;
      }

      // Create transaction signature for deduplication
      const signature = `${txnDate.toISOString().split('T')[0]}_${extracted.description}_${extracted.amount}_${extracted.type}`;
      
      // Skip if transaction already exists
      if (existingSignatures.has(signature)) {
        console.log(`Skipping duplicate transaction: ${signature}`);
        continue;
      }

      // Determine category based on transaction direction
      const category = extracted.type === 'credit' ? incomeCategory : expenseCategory;

      // Build transaction object with required fields
      const transactionData: any = {
        statement: new Types.ObjectId(statementId),
        txnDate,
        description: extracted.description,
        amount: extracted.amount,
        direction: extracted.type,
        balance: extracted.balance,
        category: category,
        confidence: 0.8, // Default confidence for OCR-extracted transactions
        taxDeductible: true,
      };

      // Only add company if we have one
      if (companyId) {
        transactionData.company = companyId;
      }

      // Add to new transactions list
      newTransactions.push(transactionData);
    }

    // Bulk insert new transactions
    if (newTransactions.length > 0) {
      await Transaction.insertMany(newTransactions);
      console.log(`Created ${newTransactions.length} new transactions for statement ${statementId}${companyId ? ` (company: ${companyId})` : ' (no company)'}`);
      
      // Update statement status to completed
      await Statement.findByIdAndUpdate(statementId, {
        status: 'completed',
        $inc: {
          transactionsFound: extractedTransactions.length,
          transactionsImported: newTransactions.length,
        },
      });
    } else {
      console.log(`No new transactions to create for statement ${statementId}`);
      
      // Update statement status to completed even if no new transactions
      await Statement.findByIdAndUpdate(statementId, {
        status: 'completed',
        transactionsFound: extractedTransactions.length,
        transactionsImported: 0,
      });
    }
  } catch (error) {
    console.error(`Error creating transactions for statement ${statementId}:`, error);
    throw error;
  }
}
