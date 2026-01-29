#!/usr/bin/env node

/**
 * Test script to verify GridFS file retrieval functionality
 * Run with: node test-gridfs-retrieval.js
 */

require('dotenv').config({ path: '.env.local' });

const { connectToDatabase } = require('./src/lib/db');
const AccountingDocument = require('./src/models/AccountingDocument');
const { getFileFromGridFS } = require('./src/lib/gridfsStorage');

async function testGridFSRetrieval() {
  console.log('=== GridFS File Retrieval Test ===\n');

  try {
    // 1. Connect to database
    console.log('1. Connecting to database...');
    await connectToDatabase();
    console.log('   ✓ Database connected');

    // 2. Get some sample documents
    console.log('\n2. Finding sample documents...');
    const documents = await AccountingDocument.find({
      processingStatus: { $in: ['uploaded', 'stored', 'failed'] }
    }).limit(5).lean();

    console.log(`   Found ${documents.length} documents`);

    if (documents.length === 0) {
      console.log('   ⚠️  No documents found to test');
      return;
    }

    // 3. Test file retrieval for each document
    console.log('\n3. Testing file retrieval...');
    
    let successfulRetrievals = 0;
    let failedRetrievals = 0;

    for (const doc of documents) {
      console.log(`\n   Testing document: ${doc._id}`);
      console.log(`     Company: ${doc.company}`);
      console.log(`     Period: ${doc.month} ${doc.year}`);
      console.log(`     Storage Type: ${doc.storageType}`);
      console.log(`     Processing Status: ${doc.processingStatus}`);

      try {
        // Try to retrieve the file
        console.log('     Attempting file retrieval...');
        
        if (doc.storageType === 'gridfs' && doc.gridfsFileId) {
          const fileData = await getFileFromGridFS(doc.gridfsFileId);
          
          if (fileData) {
            console.log(`     ✓ Successfully retrieved file`);
            console.log(`       Filename: ${fileData.filename}`);
            console.log(`       Buffer size: ${fileData.buffer.length} bytes`);
            console.log(`       Metadata:`, Object.keys(fileData.metadata || {}));
            successfulRetrievals++;
          } else {
            console.log(`     ✗ File not found in GridFS`);
            failedRetrievals++;
          }
        } else if (doc.storageType === 'supabase' && doc.supabasePath) {
          console.log(`     ⚠️  Supabase storage - skipping GridFS test`);
          console.log(`       Supabase path: ${doc.supabasePath}`);
        } else {
          console.log(`     ✗ Unknown storage type or missing file ID`);
          console.log(`       Storage: ${doc.storageType}`);
          console.log(`       GridFS ID: ${doc.gridfsFileId}`);
          console.log(`       Supabase Path: ${doc.supabasePath}`);
          failedRetrievals++;
        }
      } catch (error) {
        console.log(`     ✗ Retrieval failed: ${error.message}`);
        failedRetrievals++;
      }
    }

    // 4. Summary
    console.log('\n4. Test Summary:');
    console.log(`   ✓ Successful retrievals: ${successfulRetrievals}`);
    console.log(`   ✗ Failed retrievals: ${failedRetrievals}`);
    console.log(`   📊 Success rate: ${successfulRetrievals > 0 ? ((successfulRetrievals / documents.length) * 100).toFixed(1) : 0}%`);

    if (failedRetrievals > 0) {
      console.log('\n⚠️  Recommendations:');
      console.log('   1. Check MongoDB connection');
      console.log('   2. Verify GridFS bucket exists');
      console.log('   3. Ensure file IDs are valid ObjectId format');
      console.log('   4. Check if files were properly uploaded');
    }

    if (successfulRetrievals > 0) {
      console.log('\n✅ GridFS retrieval is working correctly');
      console.log('   The storage system should be functional for new uploads');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }

  console.log('\n=== Test Complete ===');
}

// Run the test
testGridFSRetrieval().catch(console.error);