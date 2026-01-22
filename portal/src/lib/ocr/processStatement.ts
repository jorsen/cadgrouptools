import { Statement } from '@/models/Statement';
import { Transaction } from '@/models/Transaction';
import { Category } from '@/models/Category';
import { Account } from '@/models/Account';
import { Types } from 'mongoose';
// Use Tesseract OCR service
import { tesseractOCRService } from '@/lib/ocr-tesseract';
import type { ExtractedTransaction } from '@/lib/ocr-tesseract';

// Shared OCR processor used by upload and retry endpoints
export async function processStatementOCR(statementId: string, buffer: Buffer, mimeType: string) {
  try {
    let extractedText = '';
    let ocrProvider: 'pdf-parse' | 'pdfjs-dist' | 'google-vision' | 'tesseract' = 'tesseract';
    let confidence: number | undefined;

    // PDFs: try pdf-parse then pdfjs-dist fallback
    if (mimeType === 'application/pdf') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse');
        const pdfResult = await pdfParse(buffer);
        extractedText = pdfResult.text;
        ocrProvider = 'pdf-parse';

        if (!extractedText || extractedText.trim().length < 50) {
          const fallbackText = await extractTextFromPdfWithPdfJs(buffer);
          extractedText = fallbackText;
          ocrProvider = 'pdfjs-dist';
        }
      } catch (err) {
        try {
          const fallbackText = await extractTextFromPdfWithPdfJs(buffer);
          extractedText = fallbackText;
          ocrProvider = 'pdfjs-dist';
        } catch (fallbackErr) {
          await Statement.findByIdAndUpdate(statementId, {
            status: 'failed',
            processingErrors: ['PDF processing failed', `Fallback failed: ${(fallbackErr as Error).message}`],
          });
          return;
        }
      }
    } else {
      // Images: use Tesseract OCR
      const ocrResult = await tesseractOCRService.extractTextFromImage(buffer, mimeType);
      
      // Check if OCR failed
      if (ocrResult.error) {
        await Statement.findByIdAndUpdate(statementId, {
          status: 'failed',
          processingErrors: [
            'OCR processing failed',
            ocrResult.error
          ],
        });
        return;
      }
      
      extractedText = ocrResult.text;
      ocrProvider = 'tesseract';
      confidence = ocrResult.confidence;
    }

    // Parse bank statement text
    const statementData = tesseractOCRService.parseBankStatement(extractedText);

    // Update statement
    await Statement.findByIdAndUpdate(statementId, {
      status: 'extracted',
      ocrProvider,
      extractedData: {
        rawText: extractedText,
        parsedData: statementData,
        confidence,
      },
      extractedAt: new Date(),
    });

    // Persist transactions with dedupe
    if (statementData.transactions && statementData.transactions.length > 0) {
      await createTransactionsFromOCR(statementId, statementData.transactions);
    } else {
      await Statement.findByIdAndUpdate(statementId, {
        status: 'completed',
        transactionsFound: 0,
        transactionsImported: 0,
      });
    }
  } catch (error) {
    await Statement.findByIdAndUpdate(statementId, {
      status: 'failed',
      processingErrors: ['OCR processing failed: ' + (error as Error).message],
    });
  }
}

// Fallback PDF text extraction using pdfjs-dist legacy build for Node.js
async function extractTextFromPdfWithPdfJs(buffer: Buffer): Promise<string> {
  // Use legacy build to avoid DOM dependencies like DOMMatrix in Node
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  
  // Disable worker to avoid module loading issues in production
  pdfjs.GlobalWorkerOptions.workerSrc = false;
  
  // Convert Buffer to Uint8Array for pdfjs-dist
  const uint8Array = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({ 
    data: uint8Array, 
    disableWorker: true,
    useSystemFonts: true,
    standardFontDataUrl: undefined
  });
  const pdf = await loadingTask.promise;
  let combinedText = '';
  const maxPages = Math.min(pdf.numPages || 1, 20);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items || []).map((it: any) => it.str).join(' ');
    combinedText += `\n${pageText}`;
  }
  return combinedText.trim();
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

async function createTransactionsFromOCR(
  statementId: string,
  extractedTransactions: ExtractedTransaction[]
): Promise<void> {
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
  }

  // Get or create default categories
  const { incomeCategory, expenseCategory } = await getOrCreateDefaultCategories();

  const existingTransactions = await Transaction.find({ statement: statementId })
    .select('txnDate description amount direction')
    .lean();

  const existingSignatures = new Set(
    existingTransactions.map(t =>
      `${new Date(t.txnDate).toISOString().split('T')[0]}_${t.description}_${t.amount}_${t.direction}`
    )
  );

  const newTransactions: any[] = [];
  const currentYear = new Date().getFullYear();

  for (const extracted of extractedTransactions) {
    let txnDate: Date;
    const dateParts = extracted.date.split('/');
    if (dateParts.length === 2) {
      const [month, day] = dateParts;
      txnDate = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    } else if (dateParts.length === 3) {
      const [month, day, year] = dateParts;
      const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
      txnDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
    } else {
      continue;
    }

    const signature = `${txnDate.toISOString().split('T')[0]}_${extracted.description}_${extracted.amount}_${extracted.type}`;
    if (existingSignatures.has(signature)) continue;

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
      confidence: 0.8,
      taxDeductible: true,
    };

    // Only add company if we have one
    if (companyId) {
      transactionData.company = companyId;
    }

    newTransactions.push(transactionData);
  }

  if (newTransactions.length > 0) {
    await Transaction.insertMany(newTransactions);
    console.log(`Created ${newTransactions.length} new transactions for statement ${statementId}${companyId ? ` (company: ${companyId})` : ' (no company)'}`);
    
    await Statement.findByIdAndUpdate(statementId, {
      status: 'completed',
      $inc: {
        transactionsFound: extractedTransactions.length,
        transactionsImported: newTransactions.length,
      },
    });
  } else {
    await Statement.findByIdAndUpdate(statementId, {
      status: 'completed',
      transactionsFound: extractedTransactions.length,
      transactionsImported: 0,
    });
  }
}


