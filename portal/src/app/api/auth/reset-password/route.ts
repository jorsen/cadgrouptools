import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email, password } = body;

    if (!token || !email || !password) {
      return NextResponse.json({ 
        error: 'Token, email, and new password are required' 
      }, { status: 400 });
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json({ 
        error: 'Password must be at least 8 characters long' 
      }, { status: 400 });
    }

    await connectToDatabase();

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: tokenHash,
      resetPasswordExpiry: { $gt: new Date() }
    });

    if (!user) {
      return NextResponse.json({ 
        error: 'Invalid or expired reset token. Please request a new password reset.' 
      }, { status: 400 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    user.requirePasswordChange = false;
    user.lastPasswordReset = new Date();
    await user.save();

    console.log('Password successfully reset for user:', user.email);

    return NextResponse.json({ 
      message: 'Password has been successfully reset. You can now sign in with your new password.',
      success: true
    });
  } catch (error) {
    console.error('Error in reset password:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}

// GET endpoint to verify token is valid
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      return NextResponse.json({ valid: false, error: 'Token and email are required' }, { status: 400 });
    }

    await connectToDatabase();

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: tokenHash,
      resetPasswordExpiry: { $gt: new Date() }
    });

    if (!user) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid or expired reset token' 
      });
    }

    return NextResponse.json({ 
      valid: true,
      userName: user.name
    });
  } catch (error) {
    console.error('Error verifying reset token:', error);
    return NextResponse.json({ valid: false, error: 'Failed to verify token' }, { status: 500 });
  }
}
