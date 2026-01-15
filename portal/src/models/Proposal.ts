import { Schema, model, models, Types } from 'mongoose';

const ProposalSchema = new Schema(
  {
    client: { type: Types.ObjectId, ref: 'Client', required: true, index: true },
    status: { type: String, enum: ['draft', 'finalized', 'sent'], default: 'draft', index: true },
    selectedServices: { type: [String], default: [] },
    murphyRate: { type: Number },
    clientRate: { type: Number },
    researchJson: { type: Schema.Types.Mixed },
    htmlDraft: { type: String },
    pdfKey: { type: String },
  },
  { timestamps: true }
);

ProposalSchema.index({ createdAt: -1 });

export const Proposal = models.Proposal || model('Proposal', ProposalSchema);
export default Proposal;


