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
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    
    if (this.apiKey) {
      this.client = new Anthropic({
        apiKey: this.apiKey,
      });
    } else {
      console.warn('ANTHROPIC_API_KEY not set - Document processing will not work');
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.client;
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
    if (!this.client) {
      throw new Error('Document processing service not configured - ANTHROPIC_API_KEY missing');
    }

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

      const response = await this.client.messages.create({
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

      // Extract the response text
      const responseText = response.content[0];
      if (responseText.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse the JSON response
      const jsonMatch = responseText.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in Claude response');
      }

      const analysisResult = JSON.parse(jsonMatch[0]);

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
      console.error('Error processing document with Claude:', error);
      
      // Return a default result with error info
      return {
        documentType,
        transactions: [],
        summary: {
          totalDebits: 0,
          totalCredits: 0,
          transactionCount: 0,
        },
        plStatement: {
          totalRevenue: 0,
          totalExpenses: 0,
          netIncome: 0,
          categories: {},
        },
        insights: [`Document processing failed: ${error.message}`],
        extractedAt: new Date(),
      };
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
