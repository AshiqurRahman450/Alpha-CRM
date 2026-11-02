import { Schema, model, Document, Types } from 'mongoose';

export type QuotationStatus = 'DRAFT' | 'SENT_TO_CUSTOMER' | 'FINALIZED' | 'APPROVAL_REQUESTED' | 'CRM_APPROVED' | 'REJECTED';
export type QuotationStage = 1 | 2 | 3;

export interface IQuotation extends Document {
  baseOfferNo: string; // Base code without suffix e.g. "AE/QTN/AE-261026-131"
  stage: QuotationStage; // 1 | 2 | 3
  offerNo: string; // Formatted with stage suffix e.g. "AE/QTN/AE-261026-131-1"
  customerName: string;
  customerPhone?: string;
  customerCity?: string;
  data: Record<string, any>; // Complete QuotationData snapshot
  status: QuotationStatus;
  sentToWhatsAppAt?: Date;
  finalizedAt?: Date;
  approvalRequestedAt?: Date;
  approvalRequestedBy?: Types.ObjectId | string;
  approvalRequestedByName?: string;
  approvalRequestedByRole?: string;
  crmApprovedAt?: Date;
  crmApprovedBy?: Types.ObjectId | string;
  createdCustomerId?: Types.ObjectId;
  createdCustomerCode?: string;
  createdProjectId?: Types.ObjectId;
  createdProjectCode?: string;
  stageNotes?: string;
  bdmId?: Types.ObjectId;
  bdmName?: string;
  bdmEmail?: string;
  bdmPhone?: string;
  createdByRole?: string;
  createdById?: Types.ObjectId | string;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuotationSchema = new Schema<IQuotation>(
  {
    baseOfferNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    stage: {
      type: Number,
      required: true,
      enum: [1, 2, 3],
      default: 1,
      index: true,
    },
    offerNo: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerCity: {
      type: String,
      trim: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT_TO_CUSTOMER', 'FINALIZED', 'APPROVAL_REQUESTED', 'CRM_APPROVED', 'REJECTED'],
      default: 'DRAFT',
    },
    sentToWhatsAppAt: {
      type: Date,
    },
    finalizedAt: {
      type: Date,
    },
    approvalRequestedAt: {
      type: Date,
    },
    approvalRequestedBy: {
      type: Schema.Types.Mixed,
    },
    approvalRequestedByName: {
      type: String,
      trim: true,
    },
    approvalRequestedByRole: {
      type: String,
      trim: true,
    },
    crmApprovedAt: {
      type: Date,
    },
    crmApprovedBy: {
      type: Schema.Types.Mixed,
    },
    createdCustomerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
    },
    createdCustomerCode: {
      type: String,
      trim: true,
    },
    createdProjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    createdProjectCode: {
      type: String,
      trim: true,
    },
    stageNotes: {
      type: String,
      trim: true,
    },
    bdmId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    bdmName: {
      type: String,
      trim: true,
      index: true,
    },
    bdmEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    bdmPhone: {
      type: String,
      trim: true,
    },
    createdByRole: {
      type: String,
      trim: true,
      default: 'BDM',
    },
    createdById: {
      type: Schema.Types.Mixed,
    },
    createdByName: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

QuotationSchema.index({ baseOfferNo: 1, stage: 1 });
QuotationSchema.index({ customerPhone: 1 });
QuotationSchema.index({ customerName: 'text' });
QuotationSchema.index({ bdmId: 1, baseOfferNo: 1 });
QuotationSchema.index({ bdmName: 1 });

export const Quotation = model<IQuotation>('Quotation', QuotationSchema);

