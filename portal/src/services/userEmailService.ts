import emailNotificationService from './emailNotificationService';

interface UserInviteData {
  name: string;
  email: string;
  tempPassword: string;
  role: string;
  invitedBy: string;
}

interface PasswordResetData {
  name: string;
  email: string;
  tempPassword: string;
  resetBy: string;
}

class UserEmailService {
  /**
   * Send invitation email to new user
   */
  async sendUserInvitation(data: UserInviteData): Promise<boolean> {
    const portalUrl = process.env.NEXTAUTH_URL || 'https://cadgrouptools-qtf0.onrender.com';
    
    const subject = 'Welcome to CADGroup Tools Portal - Account Created';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to CADGroup Tools Portal</title>
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
            .welcome-box {
              background-color: #e6f7ff;
              border-radius: 4px;
              padding: 20px;
              margin: 20px 0;
            }
            .credentials {
              background-color: #f5f5f5;
              border-radius: 4px;
              padding: 20px;
              margin: 20px 0;
              border: 1px solid #d9d9d9;
            }
            .credential-item {
              margin: 10px 0;
            }
            .credential-label {
              font-weight: 600;
              color: #595959;
            }
            .credential-value {
              font-family: monospace;
              background-color: #fff;
              padding: 5px 10px;
              border: 1px solid #d9d9d9;
              border-radius: 2px;
              display: inline-block;
              margin-top: 5px;
            }
            .cta-button {
              display: inline-block;
              background-color: #1890ff;
              color: white !important;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 500;
              margin: 20px 0;
            }
            .security-notice {
              background-color: #fff7e6;
              border-left: 4px solid #faad14;
              padding: 15px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e8e8e8;
              font-size: 14px;
              color: #8c8c8c;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">CADGroup Tools Portal</div>
            </div>
            
            <h2>Welcome to CADGroup Tools Portal, ${data.name}!</h2>
            
            <div class="welcome-box">
              <p>Your account has been created by ${data.invitedBy}. You now have access to the CADGroup Tools Portal as a <strong>${data.role}</strong>.</p>
            </div>
            
            <div class="credentials">
              <h3>Your Login Credentials</h3>
              <div class="credential-item">
                <div class="credential-label">Email:</div>
                <div class="credential-value">${data.email}</div>
              </div>
              <div class="credential-item">
                <div class="credential-label">Temporary Password:</div>
                <div class="credential-value">${data.tempPassword}</div>
              </div>
            </div>
            
            <div class="security-notice">
              <strong>⚠️ Important Security Notice:</strong>
              <ul>
                <li>You will be required to change your password on your first login</li>
                <li>Please keep your credentials secure and do not share them with anyone</li>
                <li>This temporary password will expire after first use</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${portalUrl}/auth/signin" class="cta-button">Login to Portal</a>
            </div>
            
            <h3>What's Next?</h3>
            <ol>
              <li>Click the button above to go to the login page</li>
              <li>Enter your email and temporary password</li>
              <li>You'll be prompted to create a new, secure password</li>
              <li>Once logged in, you can access all portal features based on your role</li>
            </ol>
            
            <div class="footer">
              <p>If you have any questions or need assistance, please contact your administrator.</p>
              <p>This is an automated email from CADGroup Tools Portal. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const text = `
Welcome to CADGroup Tools Portal, ${data.name}!

Your account has been created by ${data.invitedBy}. You now have access to the CADGroup Tools Portal as a ${data.role}.

Your Login Credentials:
- Email: ${data.email}
- Temporary Password: ${data.tempPassword}

⚠️ Important Security Notice:
- You will be required to change your password on your first login
- Please keep your credentials secure and do not share them with anyone
- This temporary password will expire after first use

To login, visit: ${portalUrl}/auth/signin

What's Next?
1. Go to the login page
2. Enter your email and temporary password
3. You'll be prompted to create a new, secure password
4. Once logged in, you can access all portal features based on your role

If you have any questions or need assistance, please contact your administrator.

This is an automated email from CADGroup Tools Portal.
    `;
    
    return emailNotificationService.sendCustomEmail(
      data.email,
      subject,
      html,
      text
    );
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(data: PasswordResetData): Promise<boolean> {
    const portalUrl = process.env.NEXTAUTH_URL || 'https://cadgrouptools-qtf0.onrender.com';
    
    const subject = 'CADGroup Tools Portal - Password Reset';
    
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
            .alert-box {
              background-color: #fff2f0;
              border-left: 4px solid #ff4d4f;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .credentials {
              background-color: #f5f5f5;
              border-radius: 4px;
              padding: 20px;
              margin: 20px 0;
              border: 1px solid #d9d9d9;
            }
            .credential-item {
              margin: 10px 0;
            }
            .credential-label {
              font-weight: 600;
              color: #595959;
            }
            .credential-value {
              font-family: monospace;
              background-color: #fff;
              padding: 5px 10px;
              border: 1px solid #d9d9d9;
              border-radius: 2px;
              display: inline-block;
              margin-top: 5px;
            }
            .cta-button {
              display: inline-block;
              background-color: #1890ff;
              color: white !important;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 500;
              margin: 20px 0;
            }
            .security-notice {
              background-color: #fff7e6;
              border-left: 4px solid #faad14;
              padding: 15px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e8e8e8;
              font-size: 14px;
              color: #8c8c8c;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">CADGroup Tools Portal</div>
            </div>
            
            <h2>Password Reset Request</h2>
            
            <div class="alert-box">
              <p><strong>Your password has been reset</strong> by ${data.resetBy}.</p>
            </div>
            
            <p>Hello ${data.name},</p>
            <p>A password reset has been initiated for your CADGroup Tools Portal account.</p>
            
            <div class="credentials">
              <h3>New Login Credentials</h3>
              <div class="credential-item">
                <div class="credential-label">Email:</div>
                <div class="credential-value">${data.email}</div>
              </div>
              <div class="credential-item">
                <div class="credential-label">Temporary Password:</div>
                <div class="credential-value">${data.tempPassword}</div>
              </div>
            </div>
            
            <div class="security-notice">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>You will be required to change this password immediately upon login</li>
                <li>If you did not request this reset, please contact your administrator immediately</li>
                <li>This temporary password is only valid for one use</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${portalUrl}/auth/signin" class="cta-button">Login with New Password</a>
            </div>
            
            <div class="footer">
              <p>If you didn't request this password reset, please contact your administrator immediately at ${data.resetBy}.</p>
              <p>This is an automated email from CADGroup Tools Portal. Please do not reply to this email.</p>
              <p style="color: #8c8c8c; font-size: 12px;">Reset requested at: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const text = `
Password Reset Request

Your password has been reset by ${data.resetBy}.

Hello ${data.name},

A password reset has been initiated for your CADGroup Tools Portal account.

New Login Credentials:
- Email: ${data.email}
- Temporary Password: ${data.tempPassword}

⚠️ Security Notice:
- You will be required to change this password immediately upon login
- If you did not request this reset, please contact your administrator immediately
- This temporary password is only valid for one use

To login with your new password, visit: ${portalUrl}/auth/signin

If you didn't request this password reset, please contact your administrator immediately at ${data.resetBy}.

This is an automated email from CADGroup Tools Portal.
Reset requested at: ${new Date().toLocaleString()}
    `;
    
    return emailNotificationService.sendCustomEmail(
      data.email,
      subject,
      html,
      text
    );
  }
}

// Export singleton instance
export const userEmailService = new UserEmailService();
export default userEmailService;
