import { Schema, model, Document, Types } from 'mongoose';

export type SiteProblemStatus = 'ASSIGNED' | 'FINISHED';
export type SiteProblemType = 'SITE_INSPECTION' | 'POST_HANDOVER_CALLBACK';

export interface ISiteProblem extends Document {
  problemId: string;
  problemType?: SiteProblemType;
  customerId?: Types.ObjectId;
  customerName: string;
  customerCode?: string;
  customerPhone?: string;
  projectId?: Types.ObjectId;
  projectName?: string;
  projectCode?: string;
  siteAddress?: string;
  problemDescription: string;
  images: string[];
  status: SiteProblemStatus;
  assignedTo: string;
  reportedBy?: Types.ObjectId;
  reportedByName?: string;
  reportedByRole?: string;
  finishedAt?: Date;
  finishedByName?: string;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SiteProblemSchema = new Schema<ISiteProblem>(
  {
    problemId: { type: String, required: true, unique: true, trim: true },
    problemType: {
      type: String,
      enum: ['SITE_INSPECTION', 'POST_HANDOVER_CALLBACK'],
      default: 'POST_HANDOVER_CALLBACK',
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, required: true, trim: true },
    customerCode: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    projectName: { type: String, trim: true },
    projectCode: { type: String, trim: true },
    siteAddress: { type: String, trim: true },
    problemDescription: { type: String, required: true, trim: true },
    images: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['ASSIGNED', 'FINISHED'],
      default: 'ASSIGNED',
    },
    assignedTo: { type: String, default: 'Sundaram', trim: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reportedByName: { type: String, trim: true },
    reportedByRole: { type: String, trim: true },
    finishedAt: { type: Date },
    finishedByName: { type: String, trim: true },
    resolutionNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

SiteProblemSchema.index({ status: 1, createdAt: -1 });
SiteProblemSchema.index({ assignedTo: 1 });
SiteProblemSchema.index({ customerId: 1 });

export const SiteProblem = model<ISiteProblem>('SiteProblem', SiteProblemSchema);
