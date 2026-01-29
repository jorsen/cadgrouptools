import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { activityLogger } from '@/services/activityLogger';
import { checkEnvironmentVariables } from '@/lib/env-check';

// Ensure NEXTAUTH_SECRET is set
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is not set. Please set it to a secure random string.');
}

// Ensure we have proper environment variables
const requiredEnvVars = {
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || (process.env.NODE_ENV === 'production' ? 'https://cadgrouptools-qtf0.onrender.com' : 'http://localhost:3000'),
  NODE_ENV: process.env.NODE_ENV || 'production'
};

// Log environment configuration (without secrets)
console.log('[Auth Config] Environment:', {
  hasSecret: !!requiredEnvVars.NEXTAUTH_SECRET,
  url: requiredEnvVars.NEXTAUTH_URL,
  env: requiredEnvVars.NODE_ENV
});

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "email@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.error('Missing credentials');
            return null;
          }

          await connectToDatabase();

          const user = await User.findOne({ email: credentials.email.toLowerCase() });
          if (!user) {
            console.error('User not found:', credentials.email);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          if (!isPasswordValid) {
            console.error('Invalid password for user:', credentials.email);
            
            // Log failed login attempt
            await activityLogger.logSystemActivity(
              {
                id: user._id.toString(),
                name: user.name || user.email,
                email: user.email,
                role: user.role || 'staff'
              },
              {
                actionType: 'login',
                resourceType: 'auth',
                method: 'POST',
                endpoint: '/api/auth/signin',
                metadata: { reason: 'invalid_password' }
              },
              {
                success: false,
                statusCode: 401,
                errorMessage: 'Invalid password'
              }
            );
            
            // Send push notification about failed login attempt
            try {
              const pushNotificationService = await import('@/services/pushNotificationService').then(m => m.default);
              const userAgent = 'Unknown'; // In a real scenario, this would come from the request headers
              const ip = 'Unknown'; // In a real scenario, this would come from the request
              await pushNotificationService.notifyFailedLogin(
                user._id.toString(),
                {
                  ip,
                  userAgent,
                  location: 'Unknown Location'
                }
              );
            } catch (notificationError) {
              console.error('Failed to send security alert notification:', notificationError);
            }
            
            return null;
          }

          // Update last login
          user.lastLogin = new Date();
          await user.save();
          
          // Log successful login
          await activityLogger.logSystemActivity(
            {
              id: user._id.toString(),
              name: user.name || user.email,
              email: user.email,
              role: user.role || 'staff'
            },
            {
              actionType: 'login',
              resourceType: 'auth',
              method: 'POST',
              endpoint: '/api/auth/signin'
            },
            {
              success: true,
              statusCode: 200
            }
          );

          // Return user object for JWT
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name || user.email,
            role: user.role || 'staff',
          };
        } catch (error) {
          console.error('Authorization error:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.iat = Date.now() / 1000; // Issued at timestamp
        token.exp = Date.now() / 1000 + (24 * 60 * 60); // Expires in 24 hours
      }
      
      // Return previous token if the user is already signed in
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
      }
      
      // Include token expiry in session for client-side checks
      session.expires = new Date(token.exp as number * 1000).toISOString();
      
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Update session every hour
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: requiredEnvVars.NEXTAUTH_SECRET,
  debug: requiredEnvVars.NODE_ENV !== 'production',
  // Use secure cookies in production, but allow them on Render.com
  cookies: {
    sessionToken: {
      name: `${requiredEnvVars.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: requiredEnvVars.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: `${requiredEnvVars.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: requiredEnvVars.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: `${requiredEnvVars.NODE_ENV === 'production' ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: requiredEnvVars.NODE_ENV === 'production',
      },
    },
  },
};