import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

// GET /api/accounting/test-claude - Test Claude API connection
export const GET = requireAuth(async (request: NextRequest) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'ANTHROPIC_API_KEY is not set',
        keyExists: false,
      }, { status: 503 });
    }

    console.log('[test-claude] API key found, length:', apiKey.length);
    console.log('[test-claude] API key prefix:', apiKey.substring(0, 15) + '...');

    // Try to create a client and make a simple request
    const client = new Anthropic({
      apiKey: apiKey,
    });

    console.log('[test-claude] Anthropic client created, making test request...');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello, the API is working!" in exactly those words.',
        },
      ],
    });

    console.log('[test-claude] Response received:', response);

    const responseText = response.content[0];
    if (responseText.type !== 'text') {
      return NextResponse.json({
        success: false,
        error: 'Unexpected response type',
        responseType: responseText.type,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Claude API is working!',
      response: responseText.text,
      model: response.model,
      usage: response.usage,
    });

  } catch (error: any) {
    console.error('[test-claude] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      status: error.status,
      code: error.code,
    }, { status: 500 });
  }
});
