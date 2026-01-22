import { Schema, model, models, Types } from 'mongoose';

const TransactionSchema = new Schema(
  {
    statement: { type: Types.ObjectId, ref: 'Statement', required: true, index: true },
    company: {
      type: Types.ObjectId,
      ref: 'Company',
      required: false,  // Made optional to handle legacy data and cases where company can't be determined
      index: true
    },
    txnDate: { type: Date, required: true, index: true },
    description: { type: String, required: true },
    vendor: { type: String, index: true }, // Extracted from description
    amount: { type: Number, required: true },
    direction: { type: String, enum: ['debit', 'credit'], required: true, index: true },
    checkNo: { type: String },
    balance: { type: Number },
    category: {
      type: Types.ObjectId,
      ref: 'Category',
      required: false,  // Made optional to handle legacy data
      index: true
    },
    subcategory: {
      type: Types.ObjectId,
      ref: 'Category',
      default: null
    },
    confidence: { type: Number, min: 0, max: 1 },
    isReconciled: { type: Boolean, default: false, index: true },
    reconciledAt: { type: Date },
    reconciledBy: {
      type: Types.ObjectId,
      ref: 'User'
    },
    taxDeductible: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
TransactionSchema.index({ txnDate: 1, amount: -1 });
TransactionSchema.index({ company: 1, txnDate: -1 });
TransactionSchema.index({ company: 1, category: 1, txnDate: -1 });
TransactionSchema.index({ company: 1, direction: 1, txnDate: -1 });
TransactionSchema.index({ vendor: 1, company: 1 });

export const Transaction = models.Transaction || model('Transaction', TransactionSchema);


