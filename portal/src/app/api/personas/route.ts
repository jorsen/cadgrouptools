import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import Persona from '@/models/Persona';

/**
 * GET /api/personas
 * Returns a list of personas, optionally filtered by company
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company');

    const query: any = {};
    if (company) {
      query.company = company;
    }

    const personas = await Persona.find(query)
      .sort({ isActive: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({ personas }, { status: 200 });
  } catch (error) {
    console.error('Error fetching personas:', error);
    return NextResponse.json(
      { error: 'Failed to load personas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/personas
 * Create a new persona
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { name, company, promptText, ghlFormId, ghlFormName, isActive } = body;

    // Validate required fields
    if (!name || !company || !promptText || !ghlFormId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, company, promptText, ghlFormId' },
        { status: 400 }
      );
    }

    // Validate company
    if (!['murphy', 'esystems'].includes(company)) {
      return NextResponse.json(
        { error: 'Invalid company. Must be "murphy" or "esystems"' },
        { status: 400 }
      );
    }

    // Validate promptText length
    if (promptText.length < 50) {
      return NextResponse.json(
        { error: 'Prompt text must be at least 50 characters' },
        { status: 400 }
      );
    }

    // If setting as active, deactivate other personas for the same form
    if (isActive) {
      await Persona.updateMany(
        { ghlFormId, isActive: true },
        { isActive: false }
      );
    }

    const persona = new Persona({
      name,
      company,
      promptText,
      ghlFormId,
      ghlFormName: ghlFormName || '',
      isActive: isActive || false,
      createdBy: session.user.id,
    });

    await persona.save();

    return NextResponse.json({ persona }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating persona:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create persona' },
      { status: 500 }
    );
  }
}
