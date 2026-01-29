import sgMail from '@sendgrid/mail';
import User from '@/models/User';
import { NotificationPayload } from './pushNotificationService';
import { connectToDatabase } from '@/lib/db';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

class EmailNotificationService {
  private isConfigured: boolean;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.isConfigured = !!process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'notifications@cadgroupmgt.com';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'CADGroup Tools Portal';
  }

  /**
   * Check if email service is configured
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Create email template from push notification
   */
  private createEmailTemplate(notification: NotificationPayload): EmailTemplate {
    const portalUrl = process.env.NEXTAUTH_URL || 'https://cadgrouptools-qtf0.onrender.com';
    
    // Determine the appropriate CTA based on notification type
    let ctaUrl = `${portalUrl}/dashboard`;
    let ctaText = 'View in Portal';
    
    if (notification.data?.type) {
      switch (notification.data.type) {
        case 'user_registration':
          ctaUrl = `${portalUrl}/admin/users`;
          ctaText = 'View User';
          break;
        case 'report_complete':
          ctaUrl = `${portalUrl}/reports/${notification.data.reportId || ''}`;
          ctaText = 'View Report';
          break;
        case 'login_attempt':
          ctaUrl = `${portalUrl}/settings?tab=security`;
          ctaText = 'Check Security Settings';
          break;
        case 'system_alert':
          ctaUrl = `${portalUrl}/dashboard`;
          ctaText = 'View Dashboard';
          break;
        default:
          if (notification.data.url) {
            ctaUrl = notification.data.url;
          }
      }
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${notification.title}</title>
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
            .title {
              font-size: 20px;
              font-weight: 600;
              margin: 20px 0 10px;
              color: #262626;
            }
            .body {
              font-size: 16px;
              color: #595959;
              margin: 20px 0;
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
            .cta-button:hover {
              background-color: #40a9ff;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e8e8e8;
              font-size: 14px;
              color: #8c8c8c;
            }
            .timestamp {
              font-size: 12px;
              color: #bfbfbf;
              margin-top: 10px;
            }
            .alert-warning {
              background-color: #fff7e6;
              border-left: 4px solid #faad14;
              padding: 10px 15px;
              margin: 20px 0;
            }
            .alert-error {
              background-color: #fff2f0;
              border-left: 4px solid #ff4d4f;
              padding: 10px 15px;
              margin: 20px 0;
            }
            .alert-info {
              background-color: #e6f7ff;
              border-left: 4px solid #1890ff;
              padding: 10px 15px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">CADGroup Tools Portal</div>
            </div>
            
            <h2 class="title">${notification.title}</h2>
            
            ${notification.data?.severity ? 
              `<div class="alert-${notification.data.severity}">
                <div class="body">${notification.body}</div>
              </div>` : 
              `<div class="body">${notification.body}</div>`
            }
            
            <a href="${ctaUrl}" class="cta-button">${ctaText}</a>
            
            <div class="footer">
              <p>This is an automated notification from CADGroup Tools Portal.</p>
              <p>You're receiving this email because push notifications are unavailable or failed to deliver.</p>
              <p class="timestamp">Sent at: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
${notification.title}

${notification.body}

View in Portal: ${ctaUrl}

---
This is an automated notification from CADGroup Tools Portal.
Sent at: ${new Date().toLocaleString()}
    `;

    return {
      subject: notification.title,
      html,
      text
    };
  }

  /**
   * Send email notification to specific users
   */
  async sendToUsers(
    userIds: string[], 
    notification: NotificationPayload
  ): Promise<{ successCount: number; failureCount: number; errors: string[] }> {
    if (!this.isConfigured) {
      console.log('Email service not configured, skipping email fallback');
      return { successCount: 0, failureCount: 0, errors: ['SendGrid not configured'] };
    }

    await connectToDatabase();

    // Get user emails
    const users = await User.find(
      { _id: { $in: userIds }, isActive: true },
      'email name'
    );

    if (users.length === 0) {
      return { successCount: 0, failureCount: 0, errors: ['No users found'] };
    }

    const template = this.createEmailTemplate(notification);
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // Send emails in batches to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      const sendPromises = batch.map(async (user) => {
        try {
          const msg = {
            to: user.email,
            from: {
              email: this.fromEmail,
              name: this.fromName
            },
            subject: template.subject,
            text: template.text,
            html: template.html,
            // Add custom headers for tracking
            customArgs: {
              userId: user._id.toString(),
              notificationType: notification.data?.type || 'custom',
              timestamp: new Date().toISOString()
            }
          };

          await sgMail.send(msg);
          successCount++;
          console.log(`Email sent successfully to ${user.email}`);
        } catch (error: any) {
          failureCount++;
          const errorMsg = `Failed to send email to ${user.email}: ${error.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      });

      await Promise.all(sendPromises);
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    return { successCount, failureCount, errors };
  }

  /**
   * Send email to all admins
   */
  async sendToAdmins(notification: NotificationPayload): Promise<{ successCount: number; failureCount: number; errors: string[] }> {
    await connectToDatabase();
    
    const admins = await User.find(
      { role: 'admin', isActive: true },
      '_id'
    );
    
    const adminIds = admins.map(admin => admin._id.toString());
    return this.sendToUsers(adminIds, notification);
  }

  /**
   * Send email to all users
   */
  async sendToAll(notification: NotificationPayload): Promise<{ successCount: number; failureCount: number; errors: string[] }> {
    await connectToDatabase();
    
    const users = await User.find(
      { isActive: true },
      '_id'
    );
    
    const userIds = users.map(user => user._id.toString());
    return this.sendToUsers(userIds, notification);
  }

  /**
   * Send a custom email with full control over content
   */
  async sendCustomEmail(
    to: string | string[],
    subject: string,
    html: string,
    text?: string
  ): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('Email service not configured');
      return false;
    }

    try {
      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
      };

      await sgMail.send(msg);
      return true;
    } catch (error) {
      console.error('Failed to send custom email:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationService();
export default emailNotificationService;