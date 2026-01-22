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
      const systemPrompt = `You are an expert financial document analyzer. Your task is to extract and analyze financial data from uploaded documents.

For bank statements, extract:
1. All transactions with dates, descriptions, and amounts
2. Identify debits (expenses) and credits (income)
3. Categorize transactions into standard accounting categories
4. Calculate totals and generate a P&L summary

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
- Revenue: Sales, Services, Interest Income, Other Income
- Expenses: Payroll, Rent, Utilities, Supplies, Marketing, Insurance, Professional Services, Bank Fees, Other Expenses`;

      const userPrompt = `Please analyze this ${documentType} for ${company} for ${month} ${year}.

Extract all financial data and provide a complete analysis. The document is attached as a base64-encoded file.

Document filename: ${filename}
Document type: ${documentType}
Company: ${company}
Period: ${month} ${year}

Please return ONLY the JSON object with the analysis results.`;

      // Call Claude API with the document
      // Build the content array based on file type
      const contentParts: any[] = [
        {
          type: 'text',
          text: userPrompt,
        },
      ];

      // For PDFs, use document type; for images, use image type
      if (filename.toLowerCase().endsWith('.pdf')) {
        contentParts.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Content,
          },
        });
      } else {
        // For images (png, jpg, etc.)
        const imageMimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' :
                              filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' :
                              filename.toLowerCase().endsWith('.gif') ? 'image/gif' :
                              filename.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png';
        
        contentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageMimeType,
            data: base64Content,
          },
        });
      }

      console.log('[DocumentProcessingService] Calling Claude API...');
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: contentParts,
          },
        ],
        system: systemPrompt,
      });
      console.log('[DocumentProcessingService] Claude API response received');

      // Extract the response text
      const responseText = response.content[0];
      if (responseText.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      console.log('[DocumentProcessingService] Claude response length:', responseText.text.length);

      // Parse the JSON response - try multiple approaches
      let analysisResult: any = null;
      
      // First, try to find and parse JSON directly
      const jsonMatch = responseText.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          analysisResult = JSON.parse(jsonMatch[0]);
          console.log('[DocumentProcessingService] Successfully parsed JSON response');
        } catch (parseError: any) {
          console.warn('[DocumentProcessingService] JSON parse failed, trying to fix:', parseError.message);
          
          // Try to fix common JSON issues
          let fixedJson = jsonMatch[0];
          
          // Remove trailing commas before ] or }
          fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
          
          // Try parsing again
          try {
            analysisResult = JSON.parse(fixedJson);
            console.log('[DocumentProcessingService] Successfully parsed fixed JSON');
          } catch (fixError: any) {
            console.error('[DocumentProcessingService] Could not fix JSON:', fixError.message);
            
            // Return a minimal result with the raw text as insight
            analysisResult = {
              documentType: documentType,
              transactions: [],
              summary: { totalDebits: 0, totalCredits: 0, transactionCount: 0 },
              plStatement: { totalRevenue: 0, totalExpenses: 0, netIncome: 0, categories: {} },
              insights: ['Document was analyzed but response parsing failed. Raw response available in logs.'],
              rawResponse: responseText.text.substring(0, 1000),
            };
          }
        }
      }

      if (!analysisResult) {
        console.error('[DocumentProcessingService] No JSON found in response');
        analysisResult = {
          documentType: documentType,
          transactions: [],
          summary: { totalDebits: 0, totalCredits: 0, transactionCount: 0 },
          plStatement: { totalRevenue: 0, totalExpenses: 0, netIncome: 0, categories: {} },
          insights: ['No valid JSON found in Claude response'],
        };
      }

      return {
        documentType: analysisResult.documentType || documentType,
        transactions: analysisResult.transactions || [],
        summary: analysisResult.summary || {
          totalDebits: 0,
          totalCredits: 0,
          transactionCount: 0,
        },
        plStatement: analysisResult.plStatement || {
          totalRevenue: 0,
          totalExpenses: 0,
          netIncome: 0,
          categories: {},
        },
        insights: analysisResult.insights || [],
        extractedAt: new Date(),
      };

    } catch (error: any) {
      console.error('[DocumentProcessingService] Error processing document with Claude:', error);
      console.error('[DocumentProcessingService] Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
      });
      
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
