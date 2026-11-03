import { Schema, model, Document, Types } from 'mongoose';

export type ReminderType = 'GENERAL' | 'QUOTATION_APPROVAL' | 'PROJECT_NEXT_WORK' | 'SITE_VISIT' | 'WHATSAPP_MESSAGE';

export interface IReminder extends Document {
  userId: Types.ObjectId;
  title: string;
  notes?: string;
  dueAt: Date;
  status: 'PENDING' | 'DISMISSED';
  type?: ReminderType;
  relatedProjectId?: Types.ObjectId;
  relatedQuotationId?: Types.ObjectId;
  relatedQuotationOfferNo?: string;
  relatedCustomerId?: Types.ObjectId;
  customerName?: string;
  actionRequired?: boolean;
  whatsappSent?: boolean;
  whatsappSentAt?: Date;
  whatsappSenderPhone?: string;
  whatsappGroupId?: string;
  whatsappGroupName?: string;
  whatsappMessageId?: string;
  whatsappSource?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
    },
    dueAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'DISMISSED'],
      default: 'PENDING',
    },
    type: {
      type: String,
      enum: ['GENERAL', 'QUOTATION_APPROVAL', 'PROJECT_NEXT_WORK', 'SITE_VISIT', 'WHATSAPP_MESSAGE'],
      default: 'GENERAL',
    },
    relatedProjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    relatedQuotationId: {
      type: Schema.Types.ObjectId,
      ref: 'Quotation',
    },
    relatedQuotationOfferNo: {
      type: String,
      trim: true,
    },
    relatedCustomerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
    },
    customerName: {
      type: String,
      trim: true,
    },
    actionRequired: {
      type: Boolean,
      default: false,
    },
    whatsappSent: {
      type: Boolean,
      default: false,
    },
    whatsappSentAt: {
      type: Date,
    },
    whatsappSenderPhone: {
      type: String,
      trim: true,
    },
    whatsappGroupId: {
      type: String,
      trim: true,
    },
    whatsappGroupName: {
      type: String,
      trim: true,
    },
    whatsappMessageId: {
      type: String,
      trim: true,
    },
    whatsappSource: {
      type: String,
      trim: true,
      default: 'WHATSAPP_WEB_BOT',
    },
  },
  { timestamps: true }
);

ReminderSchema.index({ userId: 1, status: 1, dueAt: 1 });

export const Reminder = model<IReminder>('Reminder', ReminderSchema);
