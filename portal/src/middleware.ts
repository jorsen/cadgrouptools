import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    
    // Debug logging for authentication issues
    const pathname = req.nextUrl.pathname;
    console.log('[Middleware] Request:', {
      path: pathname,
      hasToken: !!token,
      user: token?.email,
      role: token?.role,
      timestamp: new Date().toISOString()
    });
    
    // Admin-only routes
    const adminOnlyPaths = [
      '/admin',
      '/api/admin',
      '/settings/users',
    ];
    
    const isAdminRoute = adminOnlyPaths.some(path => 
      pathname.startsWith(path)
    );
    
    if (isAdminRoute && token?.role !== 'admin') {
      console.log('[Middleware] Admin access denied for:', token?.email);
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        
        // Allow public routes
        if (pathname.startsWith('/auth/') ||
            pathname === '/' ||
            pathname.startsWith('/api/auth/') ||
            pathname === '/api/health/push' ||
            // Debug endpoints (should be removed in production)
            pathname.startsWith('/api/debug/') ||
            // Temporarily allow transactions for debugging
            pathname.startsWith('/accounting/transactions') ||
            pathname.startsWith('/api/transactions')) {
          return true;
        }
        
        // Check if user has valid token
        const isAuthorized = !!token;
        
        if (!isAuthorized) {
          console.log('[Middleware] Unauthorized access attempt to:', pathname);
        }
        
        return isAuthorized;
      },
    },
    pages: {
      signIn: '/auth/signin',
      error: '/auth/error',
    }
  }
);

// Configure which routes require authentication
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/auth (authentication endpoints)
     * - auth pages (signin, signup, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api/auth|auth).*)',
  ],
};