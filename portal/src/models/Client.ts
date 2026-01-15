import { Schema, model, models } from 'mongoose';

const AddressSchema = new Schema(
  {
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String },
  },
  { _id: false }
);

const ClientSchema = new Schema(
  {
    organization: { type: String, required: true, index: true },
    website: { type: String, index: true },
    industry: { type: String },
    address: { type: AddressSchema },
    email: { type: String },
    phone: { type: String },
    avatar: { type: String }, // URL to avatar image in Supabase storage
    // Additional fields for better client management
    firstName: { type: String },
    lastName: { type: String },
    jobTitle: { type: String },
    status: { 
      type: String, 
      enum: ['active', 'inactive', 'prospect'],
      default: 'active'
    },
    companySize: { type: String },
    notes: { type: String },
    leadSource: { type: String },
    estimatedValue: { type: Number, default: 0 },
    linkedin: { type: String },
    twitter: { type: String },
  },
  { timestamps: true }
);

ClientSchema.index({ organization: 1, website: 1 });

export const Client = models.Client || model('Client', ClientSchema);
export default Client;


