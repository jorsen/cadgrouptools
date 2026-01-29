import Anthropic from '@anthropic-ai/sdk';

interface PLStatement {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  categories: Record<string, number>;
}

interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  category?: string;
}

interface DocumentAnalysisResult {
  documentType: string;
  transactions: Transaction[];
  summary: {
    totalDebits: number;
    totalCredits: number;
    transactionCount: number;
  };
  plStatement: PLStatement;
  insights: string[];
  extractedAt: Date;
}

class DocumentProcessingService {
  private client: Anthropic | null = null;
  private apiKey: string = '';

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    // Re-read the API key in case it was set after initial load
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    
    if (this.apiKey && !this.client) {
      console.log('[DocumentProcessingService] Initializing Anthropic client...');
      this.client = new Anthropic({
        apiKey: this.apiKey,
      });
      console.log('[DocumentProcessingService] Anthropic client initialized successfully');
    } else if (!this.apiKey) {
      console.warn('[DocumentProcessingService] ANTHROPIC_API_KEY not set - Document processing will not work');
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    // Try to reinitialize if not configured
    if (!this.apiKey || !this.client) {
      this.initializeClient();
    }
    return !!this.apiKey && !!this.client;
  }

  /**
   * Ensure client is ready before processing
   */
  private ensureClient(): Anthropic {
    if (!this.client) {
      this.initializeClient();
    }
    if (!this.client) {
      throw new Error('Document processing service not configured - ANTHROPIC_API_KEY missing');
    }
    return this.client;
  }

  /**
   * Process a document using Claude AI
   */
  async processDocument(
    fileBuffer: Buffer,
    filename: string,
    documentType: string,
    company: string,
    month: string,
    year: number
  ): Promise<DocumentAnalysisResult> {
    const client = this.ensureClient();
    
    console.log(`[DocumentProcessingService] Processing document: ${filename}`);
    console.log(`[DocumentProcessingService] File size: ${fileBuffer.length} bytes`);
    console.log(`[DocumentProcessingService] Document type: ${documentType}, Company: ${company}, Period: ${month} ${year}`);

    try {
      // Convert file to base64
      const base64Content = fileBuffer.toString('base64');

      // Create the prompt for Claude
      const systemPrompt = `You are an expert financial document analyzer specializing in extracting P&L (Profit & Loss) data from financial documents.

CRITICAL INSTRUCTIONS:
1. You MUST extract actual financial numbers from the document
2. NEVER return 0 values unless the document truly shows zero amounts
3. Look for: deposits, credits, income, revenue, sales, payments received (these are REVENUE)
4. Look for: withdrawals, debits, expenses, payments made, charges, fees (these are EXPENSES)
5. For bank statements: credits/deposits = revenue, debits/withdrawals = expenses

EXTRACTION RULES:
- Scan the ENTIRE document for monetary values (look for $, £, € symbols or numbers with decimals)
- Extract ALL transaction lines with dates, descriptions, and amounts
- Pay special attention to transaction tables, running balances, and summary sections
- If you see multiple pages, analyze each page for transactions
- Convert all monetary values to plain numbers (e.g., "$1,234.56" becomes 1234.56)

For bank statements, extract:
1. All transactions with dates, descriptions, and amounts
2. Identify debits (expenses) and credits (income) - check for indicators like DR/CR or +/- signs
3. Categorize transactions into standard accounting categories
4. Calculate totals and generate a P&L summary

CRITICAL: The plStatement MUST contain the actual totals from the document:
- totalRevenue = sum of ALL credits/deposits/income (must be > 0 if income exists)
- totalExpenses = sum of ALL debits/withdrawals/expenses (must be > 0 if expenses exist)
- netIncome = totalRevenue - totalExpenses
- categories = breakdown by transaction type

Return your analysis as a JSON object with this exact structure:
{
  "documentType": "bank_statement" | "invoice" | "receipt" | "other",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": number,
      "type": "debit" | "credit",
      "category": "string"
    }
  ],
  "summary": {
    "totalDebits": number,
    "totalCredits": number,
    "transactionCount": number
  },
  "plStatement": {
    "totalRevenue": number,
    "totalExpenses": number,
    "netIncome": number,
    "categories": {
      "category_name": amount
    }
  },
  "insights": ["string array of key observations"]
}

Be thorough and extract ALL transactions. Use these standard categories:
- Revenue: Sales, Services, Interest Income, Other Income, Deposits, Credits
- Expenses: Payroll, Rent, Utilities, Supplies, Marketing, Insurance, Professional Services, Bank Fees, Other Expenses, Withdrawals, Debits

FINAL REMINDER: Extract REAL numbers from the document. If you see amounts like $1,234.56, use 1234.56 as the number value. DO NOT DEFAULT TO ZEROS.`;

      const userPrompt = `Please analyze this ${documentType} for ${company} for ${month} ${year}.

CRITICAL REQUIREMENTS:
1. Extract ALL financial transactions visible in the document
2. Calculate the P&L (Profit & Loss) statement with REAL values from the document
3. DO NOT return 0 values unless the document truly shows no transactions

For the plStatement section, you MUST:
1. Sum ALL credits/deposits/income as totalRevenue (must be > 0 if income exists)
2. Sum ALL debits/withdrawals/expenses as totalExpenses (must be > 0 if expenses exist)
3. Calculate netIncome = totalRevenue - totalExpenses
4. Break down totals by categories in the categories object

Document details:
- Filename: ${filename}
- Type: ${documentType}
- Company: ${company}
- Period: ${month} ${year}

SCAN THOROUGHLY for:
- Transaction tables with dates, descriptions, and amounts
- Running balances that indicate transaction activity
- Summary sections showing totals
- Any monetary values (look for currency symbols)
- Multiple pages if present

IMPORTANT: If you find transactions but are unsure about categorization:
- Categorize deposits/credits as "Revenue"
- Categorize withdrawals/debits as "Expenses"
- Use "Other" category for unclear items

Return ONLY the JSON object with the analysis results. Ensure plStatement contains the actual calculated totals from the document.`;

      // Call Claude API with the document
      // Build the content array based on file type
      const contentParts: any[] = [];

      // Determine file type and add appropriate content
      const isPDF = filename.toLowerCase().endsWith('.pdf');
      
      if (isPDF) {
        console.log('[DocumentProcessingService] Processing PDF document');
        console.log('[DocumentProcessingService] File size:', fileBuffer.length, 'bytes');
        console.log('[DocumentProcessingService] Base64 content length:', base64Content.length);
        
        // Check file size - Claude has limits on document size
        const fileSizeInMB = fileBuffer.length / (1024 * 1024);
        if (fileSizeInMB > 10) {
          throw new Error(`PDF file is too large (${fileSizeInMB.toFixed(1)}MB). Maximum size is 10MB for Claude processing.`);
        }
        
        // Validate base64 content
        if (!base64Content || base64Content.length === 0) {
          throw new Error('PDF file content is empty or invalid');
        }
        
        // Clean base64 content - remove any whitespace or invalid characters
        const cleanBase64 = base64Content.replace(/[^a-zA-Z0-9+/=]/g, '');
        
        console.log('[DocumentProcessingService] Cleaned base64 length:', cleanBase64.length);
        console.log('[DocumentProcessingService] Base64 preview (first 100 chars):', cleanBase64.substring(0, 100));
        
        // Use the document type for PDFs with proper formatting
        try {
          contentParts.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: cleanBase64,
            },
          });
        } catch (formatError) {
          console.warn('[DocumentProcessingService] Document format failed, trying image fallback:', formatError);
          // If document type fails, try as image (some PDFs can be processed as images)
          contentParts.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: cleanBase64,
            },
          });
        }
      } else {
        // For images (png, jpg, etc.)
        console.log('[DocumentProcessingService] Processing image document');
        const imageMimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' :
                              filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' :
                              filename.toLowerCase().endsWith('.gif') ? 'image/gif' :
                              filename.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png';
        
        // Clean base64 content for images too
        const cleanBase64 = base64Content.replace(/[^a-zA-Z0-9+/=]/g, '');
        
        contentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageMimeType,
            data: cleanBase64,
          },
        });
      }

      // Add the text prompt after the document
      contentParts.push({
        type: 'text',
        text: userPrompt,
      });
      
      console.log('[DocumentProcessingService] Content parts prepared:', contentParts.length);
      console.log('[DocumentProcessingService] Content types:', contentParts.map(p => p.type));

      console.log('[DocumentProcessingService] Calling Claude API...');
      console.log('[DocumentProcessingService] Content parts:', contentParts.length, 'parts');
      console.log('[DocumentProcessingService] First part type:', contentParts[0]?.type);
      console.log('[DocumentProcessingService] Second part type:', contentParts[1]?.type);
      
      // Use the messages API
      // Note: PDF support is now generally available in Claude, no beta needed
      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20240620', // Use the correct stable model version
        max_tokens: 4096, // Reduce max tokens to avoid issues
        messages: [
          {
            role: 'user',
            content: contentParts,
          },
        ],
        system: systemPrompt,
      }).catch((apiError: any) => {
        // Log detailed error information
        console.error('[DocumentProcessingService] Claude API Error Details:', {
          message: apiError.message,
          status: apiError.status,
          error: apiError.error,
          type: apiError.type,
          request_id: apiError.request_id,
        });
        
        // Re-throw with more context
        throw new Error(`Claude API error: ${apiError.status} ${JSON.stringify(apiError.error || apiError.message)}`);
      });
      console.log('[DocumentProcessingService] Claude API response received');
      console.log('[DocumentProcessingService] Response usage:', response.usage);
      console.log('[DocumentProcessingService] Response stop_reason:', response.stop_reason);

      // Extract the response text
      const responseText = response.content[0];
      if (responseText.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      console.log('[DocumentProcessingService] Claude response length:', responseText.text.length);
      console.log('[DocumentProcessingService] Claude response preview:', responseText.text.substring(0, 500));

      // Parse the JSON response - try multiple approaches
      let analysisResult: any = null;
      
      // First, try to find and parse JSON directly
      const jsonMatch = responseText.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('[DocumentProcessingService] Found JSON match, length:', jsonMatch[0].length);
        try {
          analysisResult = JSON.parse(jsonMatch[0]);
          console.log('[DocumentProcessingService] Successfully parsed JSON response');
          console.log('[DocumentProcessingService] Parsed P&L Statement:', JSON.stringify(analysisResult.plStatement, null, 2));
          console.log('[DocumentProcessingService] Transaction count:', analysisResult.transactions?.length || 0);
        } catch (parseError: any) {
          console.warn('[DocumentProcessingService] JSON parse failed, trying to fix:', parseError.message);
          console.warn('[DocumentProcessingService] JSON that failed to parse:', jsonMatch[0].substring(0, 500));
          
          // Try to fix common JSON issues
          let fixedJson = jsonMatch[0];
          
          // Remove trailing commas before ] or }
          fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
          
          // Try parsing again
          try {
            analysisResult = JSON.parse(fixedJson);
            console.log('[DocumentProcessingService] Successfully parsed fixed JSON');
            console.log('[DocumentProcessingService] Parsed P&L Statement:', JSON.stringify(analysisResult.plStatement, null, 2));
          } catch (fixError: any) {
            console.error('[DocumentProcessingService] Could not fix JSON:', fixError.message);
            console.error('[DocumentProcessingService] Full response text:', responseText.text);
            
            // Try to extract any numeric values from the raw text as a fallback
            const numericValues = responseText.text.match(/[$£€]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g) || [];
            const totalAmount = numericValues.reduce((sum, val) => {
              const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
              return sum + (isNaN(num) ? 0 : Math.abs(num));
            }, 0);
            
            // Return a minimal result with the raw text as insight
            analysisResult = {
              documentType: documentType,
              transactions: [],
              summary: { totalDebits: 0, totalCredits: 0, transactionCount: 0 },
              plStatement: {
                totalRevenue: totalAmount > 0 ? totalAmount / 2 : 0, // Split amount as rough estimate
                totalExpenses: totalAmount > 0 ? totalAmount / 2 : 0,
                netIncome: 0,
                categories: totalAmount > 0 ? { 'Uncategorized': totalAmount } : {}
              },
              insights: [
                `Document was analyzed but response parsing failed. Found ${numericValues.length} numeric values totaling approximately $${totalAmount.toFixed(2)}.`,
                'Please check the document format or try re-uploading.',
                `Parse error: ${fixError.message}`
              ],
              rawResponse: responseText.text.substring(0, 1000),
              parseError: fixError.message,
              extractedAmounts: numericValues,
            };
          }
        }
      } else {
        console.error('[DocumentProcessingService] No JSON pattern found in response');
        console.error('[DocumentProcessingService] Full response text:', responseText.text);
      }

      if (!analysisResult) {
        // Try to extract any numeric values from the raw text as a fallback
        const numericValues = responseText.text.match(/[$£€]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g) || [];
        const totalAmount = numericValues.reduce((sum, val) => {
          const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
          return sum + (isNaN(num) ? 0 : Math.abs(num));
        }, 0);
        
        console.error('[DocumentProcessingService] No JSON found in response');
        analysisResult = {
          documentType: documentType,
          transactions: [],
          summary: { totalDebits: 0, totalCredits: 0, transactionCount: 0 },
          plStatement: {
            totalRevenue: totalAmount > 0 ? totalAmount / 2 : 0, // Split amount as rough estimate
            totalExpenses: totalAmount > 0 ? totalAmount / 2 : 0,
            netIncome: 0,
            categories: totalAmount > 0 ? { 'Uncategorized': totalAmount } : {}
          },
          insights: [
            `No valid JSON found in Claude response. Found ${numericValues.length} numeric values totaling approximately $${totalAmount.toFixed(2)}.`,
            'The document may be in an unsupported format or may not contain clear financial data.',
            'Please try re-uploading the document or contact support.'
          ],
          rawResponse: responseText.text.substring(0, 1000),
          extractedAmounts: numericValues,
        };
      }

      // Validate and recalculate P&L if transactions exist but P&L is all zeros
      let plStatement = analysisResult.plStatement || {
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0,
        categories: {},
      };

      const transactions = analysisResult.transactions || [];
      
      // Always recalculate P&L from transactions if we have any
      // This ensures accuracy even if Claude's calculation is wrong
      if (transactions.length > 0) {
        console.log('[DocumentProcessingService] Recalculating P&L from transactions...');
        
        let totalRevenue = 0;
        let totalExpenses = 0;
        const categories: Record<string, number> = {};
        
        for (const tx of transactions) {
          const amount = Math.abs(tx.amount || 0);
          const category = tx.category || 'Other';
          
          if (tx.type === 'credit') {
            totalRevenue += amount;
            categories[category] = (categories[category] || 0) + amount;
          } else if (tx.type === 'debit') {
            totalExpenses += amount;
            categories[category] = (categories[category] || 0) - amount;
          }
        }
        
        // Only use recalculated values if they're non-zero
        // Otherwise keep Claude's original calculation
        if (totalRevenue > 0 || totalExpenses > 0) {
          plStatement = {
            totalRevenue,
            totalExpenses,
            netIncome: totalRevenue - totalExpenses,
            categories,
          };
          
          console.log('[DocumentProcessingService] Recalculated P&L from transactions:', plStatement);
        } else {
          console.log('[DocumentProcessingService] Using Claude P&L (recalculation resulted in zeros):', plStatement);
        }
      }

      // Also recalculate summary if needed
      let summary = analysisResult.summary || {
        totalDebits: 0,
        totalCredits: 0,
        transactionCount: 0,
      };
      
      if (transactions.length > 0 && summary.transactionCount === 0) {
        summary = {
          totalDebits: transactions.filter((t: any) => t.type === 'debit').reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0),
          totalCredits: transactions.filter((t: any) => t.type === 'credit').reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0),
          transactionCount: transactions.length,
        };
        console.log('[DocumentProcessingService] Recalculated summary:', summary);
      }

      const finalResult = {
        documentType: analysisResult.documentType || documentType,
        transactions: transactions,
        summary: summary,
        plStatement: plStatement,
        insights: analysisResult.insights || [],
        extractedAt: new Date(),
        // Store Claude's raw response for debugging (truncated)
        claudeResponse: responseText.text.substring(0, 2000),
      };

      console.log('[DocumentProcessingService] Final P&L result:', JSON.stringify(finalResult.plStatement, null, 2));
      console.log('[DocumentProcessingService] Claude raw response (first 500 chars):', responseText.text.substring(0, 500));
      
      return finalResult;

    } catch (error: any) {
      console.error('[DocumentProcessingService] Error processing document with Claude:', error);
      console.error('[DocumentProcessingService] Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type,
      });
      
      // Check if it's an API key issue
      if (error.message?.includes('401') || error.message?.includes('authentication')) {
        throw new Error('Claude API authentication failed. Please check your ANTHROPIC_API_KEY is valid and active.');
      }
      
      // Check if it's a rate limit issue
      if (error.message?.includes('429') || error.message?.includes('rate')) {
        throw new Error('Claude API rate limit exceeded. Please try again later.');
      }
      
      // Check if it's a bad request (400) - might be model or content issue
      if (error.message?.includes('400')) {
        throw new Error(`Claude API request format error. This might be due to:
1. Invalid document format
2. File too large
3. Unsupported content type
Error details: ${error.message}`);
      }
      
      // Re-throw the error so the caller can handle it properly
      throw new Error(`Claude API error: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate a P&L statement from multiple documents
   */
  async generatePLStatement(
    documents: any[],
    company: string,
    month: string,
    year: number
  ): Promise<PLStatement> {
    // Aggregate data from all completed documents
    let totalRevenue = 0;
    let totalExpenses = 0;
    const categories: Record<string, number> = {};

    for (const doc of documents) {
      if (doc.analysisResult?.plStatement) {
        totalRevenue += doc.analysisResult.plStatement.totalRevenue || 0;
        totalExpenses += doc.analysisResult.plStatement.totalExpenses || 0;

        // Merge categories
        const docCategories = doc.analysisResult.plStatement.categories || {};
        for (const [category, amount] of Object.entries(docCategories)) {
          categories[category] = (categories[category] || 0) + (amount as number);
        }
      }
    }

    return {
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      categories,
    };
  }
}

// Export singleton instance
export const documentProcessingService = new DocumentProcessingService();
export default documentProcessingService;
