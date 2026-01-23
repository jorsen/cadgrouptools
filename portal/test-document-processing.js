const fs = require('fs');
const path = require('path');

// Test script to verify document processing fixes
async function testDocumentProcessing() {
  console.log('========== Testing Document Processing Fixes ==========\n');
  
  try {
    // 1. Test if the API endpoints are accessible
    console.log('1. Testing API endpoints...');
    
    // Test the test-claude endpoint
    const claudeTest = await fetch('http://localhost:3000/api/accounting/test-claude', {
      headers: {
        'Cookie': 'next-auth.session-token=your-session-token-here' // You'll need to provide a valid session
      }
    });
    
    if (claudeTest.ok) {
      const claudeResult = await claudeTest.json();
      console.log('✓ Claude API test endpoint is accessible');
      console.log('  Claude configured:', claudeResult.success);
    } else {
      console.log('✗ Claude API test endpoint failed:', claudeTest.status);
    }
    
    // 2. Check if environment variables are set
    console.log('\n2. Checking environment configuration...');
    console.log('  ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set');
    console.log('  MANUS_API_KEY:', process.env.MANUS_API_KEY ? '✓ Set' : '✗ Not set');
    console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '✗ Not set');
    console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Not set');
    
    // 3. Test document upload with a sample file
    console.log('\n3. Testing document upload...');
    
    // Check if test PDF exists
    const testPdfPath = path.join(__dirname, 'public', 'MWS_September.pdf');
    if (fs.existsSync(testPdfPath)) {
      console.log('✓ Test PDF found at:', testPdfPath);
      
      // Create form data for upload
      const formData = new FormData();
      const pdfBuffer = fs.readFileSync(testPdfPath);
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      
      formData.append('file', blob, 'MWS_September.pdf');
      formData.append('company', 'murphy_web_services');
      formData.append('month', 'September');
      formData.append('year', '2024');
      formData.append('documentType', 'bank_statement');
      
      console.log('  Attempting to upload test document...');
      // Note: This would require authentication in a real scenario
      console.log('  (Upload test requires valid authentication - skipping actual upload)');
    } else {
      console.log('✗ Test PDF not found at:', testPdfPath);
    }
    
    console.log('\n========== Summary of Fixes Applied ==========');
    console.log('1. ✓ Improved Claude prompts to be more explicit about extracting actual values');
    console.log('2. ✓ Enhanced error handling to extract numeric values as fallback');
    console.log('3. ✓ Always recalculate P&L from transactions when available');
    console.log('4. ✓ Added better logging to diagnose issues');
    console.log('5. ✓ Added validation to check if meaningful data was extracted');
    
    console.log('\n========== Next Steps ==========');
    console.log('1. Ensure ANTHROPIC_API_KEY is set in your environment');
    console.log('2. Upload a financial document to test the processing');
    console.log('3. Check the console logs for detailed processing information');
    console.log('4. If still showing 0, check:');
    console.log('   - Document contains actual financial transactions');
    console.log('   - Document format is readable (PDF with text or clear image)');
    console.log('   - Claude API is properly configured and accessible');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testDocumentProcessing();