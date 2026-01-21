import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';

interface ManusTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

interface CreateTaskPayload {
  instructions: string;
  metadata?: Record<string, any>;
}

interface UploadFileOptions {
  filename: string;
  contentType: string;
}

class ManusService {
  private client: AxiosInstance;
  private apiKey: string;
  private webhookSecret: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = process.env.MANUS_API_KEY || '';
    this.webhookSecret = process.env.MANUS_WEBHOOK_SECRET || '';
    this.isConfigured = false;
    
    if (!this.apiKey) {
      console.warn('MANUS_API_KEY not set - Manus AI integration will not work');
    } else {
      // Validate API key format - Manus expects either a JWT token (3 segments) or an API key
      const segments = this.apiKey.split('.');
      if (segments.length !== 3 && !this.apiKey.startsWith('sk-')) {
        console.warn('MANUS_API_KEY format may be invalid. Expected JWT token (3 segments) or API key starting with "sk-"');
      }
      this.isConfigured = true;
    }

    this.client = axios.create({
      baseURL: process.env.MANUS_BASE_URL || 'https://api.manus.ai/v1',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });
  }

  /**
   * Check if Manus service is properly configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured && !!this.apiKey;
  }

  /**
   * Create a new Manus task
   */
  async createTask(type: 'proposal' | 'accounting', data: CreateTaskPayload): Promise<ManusTask> {
    try {
      const response = await this.client.post('/tasks', {
        instructions: data.instructions,
        metadata: {
          ...data.metadata,
          type,
          createdAt: new Date().toISOString(),
        },
      });

      return {
        id: response.data.id || response.data.task_id,
        status: response.data.status || 'pending',
        result: response.data.result,
      };
    } catch (error: any) {
      console.error('Error creating Manus task:', error.response?.data || error.message);
      throw new Error(`Failed to create Manus task: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Upload a file to an existing Manus task
   */
  async uploadFileToTask(
    taskId: string,
    fileBuffer: Buffer,
    options: UploadFileOptions
  ): Promise<{ success: boolean; fileId?: string }> {
    try {
      const formData = new FormData();
      // Convert Buffer to ArrayBuffer then to Blob for compatibility
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: options.contentType });
      formData.append('file', blob, options.filename);

      const response = await this.client.post(
        `/tasks/${taskId}/files`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return {
        success: true,
        fileId: response.data.file_id || response.data.id,
      };
    } catch (error: any) {
      console.error('Error uploading file to Manus task:', error.response?.data || error.message);
      throw new Error(`Failed to upload file: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get the status and results of a Manus task
   */
  async getTaskStatus(taskId: string): Promise<ManusTask> {
    try {
      const response = await this.client.get(`/tasks/${taskId}`);

      return {
        id: response.data.id || taskId,
        status: response.data.status || 'pending',
        result: response.data.result,
        error: response.data.error,
      };
    } catch (error: any) {
      console.error('Error getting Manus task status:', error.response?.data || error.message);
      throw new Error(`Failed to get task status: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify webhook signature from Manus
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn('MANUS_WEBHOOK_SECRET not set - webhook verification will fail');
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Create a persistent accounting task for a company
   */
  async createAccountingTask(company: string): Promise<ManusTask> {
    const companyNames: Record<string, string> = {
      murphy_web_services: 'Murphy Web Services Incorporated',
      esystems_management: 'E-Systems Management Incorporated',
      mm_secretarial: 'M&M Secretarial Services Incorporated',
      dpm: 'DPM Incorporated',
      linkage_web_solutions: 'Linkage Web Solutions Enterprise Incorporated',
      wdds: 'WDDS',
      mm_leasing: 'M&M Leasing Services',
      hardin_bar_grill: 'Hardin Bar & Grill',
      mphi: 'MPHI',
    };

    const companyName = companyNames[company] || company;

    const instructions = `You are the accounting assistant for ${companyName}.

Your responsibilities:
1. OCR and extract data from uploaded financial documents (PDFs, images)
2. Parse bank statements, invoices, receipts
3. Extract transactions with dates, descriptions, amounts
4. Categorize expenses and income
5. Generate monthly P&L statements automatically
6. Maintain running financial analysis
7. Track cash flow and balances

For each uploaded document:
- Perform OCR extraction
- Identify document type (bank statement, invoice, receipt, etc.)
- Parse all transactions
- Update financial records
- Generate insights

Generate monthly P&L statements including:
- Total Revenue by category
- Total Expenses by category
- Net Income
- Month-over-month comparison
- Year-over-year comparison
- Key financial metrics

Maintain a comprehensive financial history and provide analysis when requested.`;

    return this.createTask('accounting', {
      instructions,
      metadata: {
        company,
        companyName,
        persistent: true,
        taskType: 'accounting',
      },
    });
  }

  /**
   * Create a Murphy Consulting proposal task
   */
  async createMurphyProposalTask(formData: any, personaPrompt?: string): Promise<ManusTask> {
    const baseInstructions = `Company: ${formData.organization || 'Unknown'}
Website: ${formData.website || 'Not provided'}
Hourly Rate: $35/hour

Analyze their current website and business needs based on the following form data:
${JSON.stringify(formData, null, 2)}

Research:
- Website technology stack and issues
- Industry best practices
- Competitor analysis
- SEO recommendations

Generate a detailed proposal including:
- Current state analysis
- Recommended services from the selected options
- Time estimates per task
- Total cost calculation at $35/hour
- Timeline and deliverables

Create a Google Slides presentation with:
- Cover slide with Murphy Consulting branding
- Current state findings
- Recommendations
- Pricing breakdown
- Next steps

Provide the Google Slides link in the output.`;

    const instructions = personaPrompt
      ? `${personaPrompt}\n\n---\n\nCLIENT INFORMATION:\n\n${baseInstructions}`
      : baseInstructions;

    return this.createTask('proposal', {
      instructions,
      metadata: {
        company: 'murphy',
        companyName: 'Murphy Consulting',
        organization: formData.organization,
        website: formData.website,
        taskType: 'proposal_murphy',
      },
    });
  }

  /**
   * Create an E-Systems Management proposal task
   */
  async createESystemsProposalTask(formData: any, personaPrompt?: string): Promise<ManusTask> {
    const baseInstructions = `Company: ${formData.organization || 'Unknown'}
Form Data: ${JSON.stringify(formData, null, 2)}

Conduct product research based on client requirements.

Research:
- Products/services they need
- Market pricing for similar solutions
- Implementation timeline
- Technical specifications

Generate a product proposal including:
- Product recommendations
- Detailed specifications
- Pricing breakdown
- Implementation plan
- Support and maintenance

Create a Google Slides presentation with E-Systems Management branding.
Include:
- Cover slide
- Client needs analysis
- Product recommendations
- Technical specifications
- Pricing and packages
- Implementation timeline
- Support details

Provide the Google Slides link in the output.`;

    const instructions = personaPrompt
      ? `${personaPrompt}\n\n---\n\nCLIENT INFORMATION:\n\n${baseInstructions}`
      : baseInstructions;

    return this.createTask('proposal', {
      instructions,
      metadata: {
        company: 'esystems',
        companyName: 'E-Systems Management',
        organization: formData.organization,
        taskType: 'proposal_esystems',
      },
    });
  }

  /**
   * Register a webhook with Manus AI
   */
  async registerWebhook(webhookUrl: string, events: string[] = ['task.completed', 'task.failed']): Promise<any> {
    try {
      const response = await this.client.post('/webhooks', {
        url: webhookUrl,
        events,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error registering webhook:', error.response?.data || error.message);
      throw new Error(`Failed to register webhook: ${error.response?.data?.message || error.message}`);
    }
  }
}

// Export singleton instance
export default new ManusService();

