import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Temporarily ignore TypeScript errors during build
    ignoreBuildErrors: true,
  },
  eslint: {
    // Temporarily ignore ESLint errors during build
    ignoreDuringBuilds: true,
  },
  // Ensure proper handling of environment variables in production
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || (process.env.NODE_ENV === 'production' ? 'https://cadgrouptools.onrender.com' : 'http://localhost:3000'),
    NEXT_PUBLIC_WEBSOCKET_URL: process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXTAUTH_URL || '',
  },
  // Optimize for production
  poweredByHeader: false,
  compress: true,
  // Handle image optimization
  images: {
    unoptimized: true, // Disable Next.js image optimization for Render
  },
  // Disable static generation for App Router
  output: undefined, // Let Next.js handle output mode automatically
  // External packages that should not be bundled by Next.js
  serverExternalPackages: [
    'socket.io',
    'pdfjs-dist',
    'pdf-parse',
    'tesseract.js',
    'pdf2pic',
    'canvas'
  ],
  // Webpack configuration for PDF.js and other packages
  webpack: (config, { isServer }) => {
    // Handle pdfjs-dist worker issues
    config.resolve.alias = {
      ...config.resolve.alias,
      // Force pdfjs-dist to use the build without workers
      'pdfjs-dist/build/pdf.worker.entry': false,
    };

    // Ignore optional canvas dependency warnings
    if (isServer) {
      config.externals = [...(config.externals || []), 'canvas'];
    }

    return config;
  },
  // Skip static generation for error pages
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
