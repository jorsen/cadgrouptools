import { Schema, model, models } from 'mongoose';

const CompanySchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    legalName: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    taxId: { type: String }, // BIR TIN for Philippines
    currency: { type: String, default: 'PHP' },
    fiscalYearEnd: { type: Number, min: 1, max: 12, default: 12 }, // Month (1-12)
    status: { 
      type: String, 
      enum: ['active', 'inactive'],
      default: 'active',
      index: true
    },
    // Contact information
    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String, default: 'Philippines' },
      postalCode: { type: String },
    },
    phone: { type: String },
    email: { type: String },
    // Additional fields
    logo: { type: String }, // URL to logo in Supabase storage
    description: { type: String },
  },
  { timestamps: true }
);

// Indexes
CompanySchema.index({ name: 1, status: 1 });
CompanySchema.index({ slug: 1 });

export const Company = models.Company || model('Company', CompanySchema);


