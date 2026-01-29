import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import crypto from 'crypto';
import emailNotificationService from '@/services/emailNotificationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await connectToDatabase();

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      console.log('Forgot password requested for non-existent email:', email);
      return NextResponse.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Token expires in 1 hour
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    // Save token to user
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();

    // Generate reset URL
    const portalUrl = process.env.NEXTAUTH_URL || 'https://cadgrouptools-qtf0.onrender.com';
    const resetUrl = `${portalUrl}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send email
    const subject = 'CADGroup Tools Portal - Password Reset Request';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              border-bottom: 2px solid #1890ff;
              padding-bottom: 20px;
              margin-bottom: 20px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #1890ff;
            }
            .cta-button {
              display: inline-block;
              background-color: #1890ff;
              color: white !important;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 500;
              margin: 20px 0;
              font-size: 16px;
            }
            .warning-box {
              background-color: #fff7e6;
              border-left: 4px solid #faad14;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e8e8e8;
              font-size: 14px;
              color: #8c8c8c;
            }
            .code-box {
              background-color: #f5f5f5;
              padding: 10px 15px;
              border-radius: 4px;
              font-family: monospace;
              word-break: break-all;
              font-size: 12px;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">CADGroup Tools Portal</div>
            </div>
            
            <h2>Password Reset Request</h2>
            
            <p>Hello ${user.name},</p>
            
            <p>We received a request to reset the password for your CADGroup Tools Portal account.</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="cta-button">Reset My Password</a>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ Important:</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>This link will expire in <strong>1 hour</strong></li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password will not change until you create a new one</li>
              </ul>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <div class="code-box">${resetUrl}</div>
            
            <div class="footer">
              <p>If you didn't request a password reset, you can safely ignore this email.</p>
              <p>This is an automated email from CADGroup Tools Portal. Please do not reply.</p>
              <p style="font-size: 12px; color: #bfbfbf;">
                Sent at: ${new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Password Reset Request

Hello ${user.name},

We received a request to reset the password for your CADGroup Tools Portal account.

Click the link below to reset your password:
${resetUrl}

⚠️ Important:
- This link will expire in 1 hour
- If you didn't request this reset, please ignore this email
- Your password will not change until you create a new one

If you didn't request a password reset, you can safely ignore this email.

This is an automated email from CADGroup Tools Portal.
Sent at: ${new Date().toLocaleString()}
    `;

    const emailSent = await emailNotificationService.sendCustomEmail(
      user.email,
      subject,
      html,
      text
    );

    if (!emailSent) {
      console.error('Failed to send password reset email to:', user.email);
      // Still return success to prevent enumeration
    } else {
      console.log('Password reset email sent to:', user.email);
    }

    return NextResponse.json({ 
      message: 'If an account exists with this email, a password reset link has been sent.',
      success: true
    });
  } catch (error) {
    console.error('Error in forgot password:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
