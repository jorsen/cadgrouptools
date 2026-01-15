import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import Persona from '@/models/Persona';

/**
 * GET /api/personas/[id]
 * Returns a specific persona by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;
    const persona = await Persona.findById(id).lean();

    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    return NextResponse.json({ persona }, { status: 200 });
  } catch (error) {
    console.error('Error fetching persona:', error);
    return NextResponse.json(
      { error: 'Failed to fetch persona' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/personas/[id]
 * Update a persona
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;
    const body = await request.json();
    const { name, company, promptText, ghlFormId, ghlFormName, isActive } = body;

    const persona = await Persona.findById(id);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // If setting as active, deactivate other personas for the same form
    if (isActive && !persona.isActive) {
      const formId = ghlFormId || persona.ghlFormId;
      await Persona.updateMany(
        { ghlFormId: formId, _id: { $ne: id }, isActive: true },
        { isActive: false }
      );
    }

    // Update fields
    if (name !== undefined) persona.name = name;
    if (company !== undefined) persona.company = company;
    if (promptText !== undefined) persona.promptText = promptText;
    if (ghlFormId !== undefined) persona.ghlFormId = ghlFormId;
    if (ghlFormName !== undefined) persona.ghlFormName = ghlFormName;
    if (isActive !== undefined) persona.isActive = isActive;

    await persona.save();

    return NextResponse.json({ persona }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating persona:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update persona' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/personas/[id]
 * Delete a persona
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;
    const persona = await Persona.findById(id);

    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Don't allow deleting active personas
    if (persona.isActive) {
      return NextResponse.json(
        { error: 'Cannot delete an active persona. Deactivate it first.' },
        { status: 400 }
      );
    }

    await Persona.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Persona deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting persona:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete persona' },
      { status: 500 }
    );
  }
}
