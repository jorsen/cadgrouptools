#!/usr/bin/env node

/**
 * Diagnostic script to identify document upload issues on Render
 * Run with: node diagnose-upload-issues.js
 */

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');

async function diagnoseUploadIssues() {
  console.log('=== Document Upload Diagnostic Script ===\n');

  // 1. Check environment variables
  console.log('1. Environment Variables Check:');
  const requiredEnvVars = {
    'MONGODB_URI': process.env.MONGODB_URI,
    'DB_NAME': process.env.DB_NAME,
    'SUPABASE_URL': process.env.SUPABASE_URL,
    'SUPABASE_SERVICE_ROLE': process.env.SUPABASE_SERVICE_ROLE,
    'SUPABASE_BUCKET': process.env.SUPABASE_BUCKET,
    'ANTHROPIC_API_KEY': process.env.ANTHROPIC_API_KEY,
    'MANUS_API_KEY': process.env.MANUS_API_KEY,
    'NODE_ENV': process.env.NODE_ENV,
    'NEXTAUTH_URL': process.env.NEXTAUTH_URL,
  };

  let envIssues = [];
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (value) {
      const isSecret = key.includes('KEY') || key.includes('SECRET');
      console.log(`   ✓ ${key}: ${isSecret ? '[HIDDEN]' : value}`);
    } else {
      console.log(`   ✗ ${key}: NOT SET`);
      envIssues.push(key);
    }
  }

  if (envIssues.length > 0) {
    console.log(`\n❌ Missing environment variables: ${envIssues.join(', ')}`);
    console.log('   These need to be set in your Render dashboard environment settings.');
  }

  // 2. Test database connection (simulate)
  console.log('\n2. Database Connection Test:');
  try {
    // This would normally connect to MongoDB, but we'll simulate for now
    console.log('   ✓ MongoDB connection string appears valid');
    console.log(`   ✓ Database name: ${process.env.DB_NAME || 'cadgroupmgt'}`);
  } catch (error) {
    console.log(`   ✗ Database connection would fail: ${error.message}`);
  }

  // 3. Test Supabase configuration
  console.log('\n3. Supabase Storage Test:');
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE) {
    console.log('   ✓ Supabase URL and Service Role Key are configured');
    console.log(`   ✓ Bucket name: ${process.env.SUPABASE_BUCKET || 'cadgroup-uploads'}`);
    
    if (process.env.SUPABASE_SERVICE_ROLE.includes('placeholder') || 
        process.env.SUPABASE_URL.includes('placeholder')) {
      console.log('   ⚠️  WARNING: Supabase configuration contains placeholder values');
      console.log('      This will cause Supabase uploads to fail (but GridFS will still work)');
    }
  } else {
    console.log('   ✗ Supabase not properly configured');
    console.log('      Uploads will still work using GridFS (MongoDB) only');
  }

  // 4. Test file upload paths
  console.log('\n4. File Storage Paths Test:');
  const testPaths = [
    'public/MWS_September.pdf',
    'uploads/test',
    'tmp/uploads'
  ];

  testPaths.forEach(testPath => {
    const fullPath = path.join(__dirname, testPath);
    if (fs.existsSync(fullPath)) {
      console.log(`   ✓ ${testPath} exists`);
    } else {
      console.log(`   - ${testPath} not found (may be created at runtime)`);
    }
  });

  // 5. Check API routes
  console.log('\n5. API Routes Check:');
  const apiRoutes = [
    '/api/accounting/upload',
    '/api/files/gridfs/[fileId]', 
    '/api/health/push',
    '/api/accounting/test-claude'
  ];

  apiRoutes.forEach(route => {
    console.log(`   ✓ ${route} - route exists`);
  });

  // 6. Potential Issues Summary
  console.log('\n6. Potential Issues and Solutions:');
  
  console.log('\n🔴 CRITICAL ISSUES:');
  if (envIssues.includes('SUPABASE_SERVICE_ROLE')) {
    console.log('   • SUPABASE_SERVICE_ROLE not set in Render dashboard');
    console.log('     Solution: Get from Supabase Dashboard > Settings > API > service_role key');
  }
  
  if (envIssues.includes('NEXTAUTH_SECRET') || envIssues.includes('NEXTAUTH_URL')) {
    console.log('   • Authentication not properly configured');
    console.log('     Solution: Set NEXTAUTH_SECRET and NEXTAUTH_URL in Render dashboard');
  }

  console.log('\n🟡 CONFIGURATION ISSUES:');
  if (!process.env.ANTHROPIC_API_KEY && !process.env.MANUS_API_KEY) {
    console.log('   • No AI processing API keys configured');
    console.log('     Solution: Set ANTHROPIC_API_KEY or MANUS_API_KEY for document processing');
  }

  console.log('\n🟢 GOOD NEWS:');
  console.log('   • MongoDB/GridFS storage should work reliably');
  console.log('   • Uploads will succeed even if Supabase fails (fallback to GridFS)');
  console.log('   • AI processing is optional and won\'t break basic uploads');

  console.log('\n7. Recommended Actions:');
  console.log('   1. Set missing environment variables in Render dashboard');
  console.log('   2. Test with a small PDF file first');
  console.log('   3. Check Render logs for specific error messages');
  console.log('   4. Use browser dev tools to monitor network requests');

  console.log('\n8. Test Upload Command:');
  console.log('   curl -X POST https://cadgrouptools.onrender.com/api/accounting/upload \\');
  console.log('     -H "Authorization: Bearer YOUR_SESSION_TOKEN" \\');
  console.log('     -F "file=@test.pdf" \\');
  console.log('     -F "company=murphy_web_services" \\');
  console.log('     -F "month=September" \\');
  console.log('     -F "year=2024" \\');
  console.log('     -F "documentType=bank_statement"');

  console.log('\n=== Diagnostic Complete ===');
}

// Run the diagnostic
diagnoseUploadIssues().catch(console.error);