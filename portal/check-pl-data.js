// Script to check P&L data in the database
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://marketing:wU8RzIIr6kq6I0@cadtools.dvvdsg1.mongodb.net/?appName=cadtools';
const DB_NAME = 'cadgroupmgt';

async function checkPLData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('accountingdocuments');

    // Get all documents for murphy_web_services
    const documents = await collection.find({ company: 'murphy_web_services' })
      .sort({ year: -1, month: -1 })
      .toArray();

    console.log(`\nFound ${documents.length} documents for murphy_web_services\n`);

    for (const doc of documents) {
      console.log('='.repeat(60));
      console.log(`Document ID: ${doc._id}`);
      console.log(`Period: ${doc.month} ${doc.year}`);
      console.log(`Document Type: ${doc.documentType}`);
      console.log(`Processing Status: ${doc.processingStatus}`);
      console.log(`Storage Type: ${doc.storageType}`);
      console.log(`GridFS File ID: ${doc.gridfsFileId || 'none'}`);
      console.log(`Has Analysis Result: ${!!doc.analysisResult}`);
      
      if (doc.analysisResult) {
        console.log('\nAnalysis Result:');
        console.log(`  Document Type: ${doc.analysisResult.documentType}`);
        console.log(`  Transaction Count: ${doc.analysisResult.transactions?.length || 0}`);
        
        if (doc.analysisResult.plStatement) {
          console.log('\n  P&L Statement:');
          console.log(`    Total Revenue: $${doc.analysisResult.plStatement.totalRevenue || 0}`);
          console.log(`    Total Expenses: $${doc.analysisResult.plStatement.totalExpenses || 0}`);
          console.log(`    Net Income: $${doc.analysisResult.plStatement.netIncome || 0}`);
          console.log(`    Categories: ${JSON.stringify(doc.analysisResult.plStatement.categories || {})}`);
        } else {
          console.log('\n  P&L Statement: NOT PRESENT');
        }
        
        if (doc.analysisResult.summary) {
          console.log('\n  Summary:');
          console.log(`    Total Debits: $${doc.analysisResult.summary.totalDebits || 0}`);
          console.log(`    Total Credits: $${doc.analysisResult.summary.totalCredits || 0}`);
          console.log(`    Transaction Count: ${doc.analysisResult.summary.transactionCount || 0}`);
        }
        
        if (doc.analysisResult.insights?.length > 0) {
          console.log(`\n  Insights: ${doc.analysisResult.insights.slice(0, 2).join(', ')}`);
        }
        
        if (doc.analysisResult.rawResponse) {
          console.log(`\n  Raw Response (first 300 chars): ${doc.analysisResult.rawResponse.substring(0, 300)}`);
        }
        
        if (doc.analysisResult.parseError) {
          console.log(`\n  Parse Error: ${doc.analysisResult.parseError}`);
        }
      }
      
      if (doc.errorMessage) {
        console.log(`\nError Message: ${doc.errorMessage}`);
      }
      
      console.log('');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Documents: ${documents.length}`);
    console.log(`Completed: ${documents.filter(d => d.processingStatus === 'completed').length}`);
    console.log(`Failed: ${documents.filter(d => d.processingStatus === 'failed').length}`);
    console.log(`Stored/Uploaded: ${documents.filter(d => ['stored', 'uploaded'].includes(d.processingStatus)).length}`);
    
    const withPLData = documents.filter(d => {
      const pl = d.analysisResult?.plStatement;
      return pl && (pl.totalRevenue > 0 || pl.totalExpenses > 0);
    });
    console.log(`With P&L Data (non-zero): ${withPLData.length}`);
    
    const withZeroPL = documents.filter(d => {
      const pl = d.analysisResult?.plStatement;
      return pl && pl.totalRevenue === 0 && pl.totalExpenses === 0;
    });
    console.log(`With Zero P&L: ${withZeroPL.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkPLData();
