import { Schema, model, models } from 'mongoose';

const AccountingDocumentSchema = new Schema(
  {
    company: { 
      type: String, 
      required: true,
      enum: [
        'murphy_web_services',
        'esystems_management',
        'mm_secretarial',
        'dpm',
        'linkage_web_solutions',
        'wdds',
        'mm_leasing',
        'hardin_bar_grill',
        'mphi'
      ],
      index: true
    },
    month: { type: String, required: true },
    year: { type: Number, required: true, index: true },
    documentType: { 
      type: String, 
      required: true,
      enum: ['bank_statement', 'invoice', 'receipt', 'other'],
      default: 'bank_statement'
    },
    supabasePath: { type: String, required: false },  // Optional - may use GridFS instead
    supabaseUrl: { type: String, required: false },   // Optional - may use GridFS instead
    gridfsFileId: { type: String, required: false },  // GridFS file ID
    storageType: {
      type: String,
      enum: ['gridfs', 'supabase'],
      default: 'gridfs'
    },
    uploadedBy: {
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true
    },
    manusTaskId: {
      type: String,
      required: false,  // Optional - may not have Manus configured
      index: true
    },
    analysisResult: { type: Schema.Types.Mixed },
    processingStatus: {
      type: String,
      enum: ['uploaded', 'stored', 'processing', 'completed', 'failed'],
      default: 'uploaded',
      index: true
    },
    errorMessage: { type: String }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
AccountingDocumentSchema.index({ company: 1, year: -1, month: -1 });
AccountingDocumentSchema.index({ uploadedBy: 1, createdAt: -1 });
AccountingDocumentSchema.index({ manusTaskId: 1, createdAt: -1 });

const AccountingDocument = models.AccountingDocument || model('AccountingDocument', AccountingDocumentSchema);

export default AccountingDocument;

