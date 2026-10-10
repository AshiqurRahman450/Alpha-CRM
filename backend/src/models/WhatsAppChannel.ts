import { Schema, model, Document, Types } from 'mongoose';

export type ChannelStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED' | 'ERROR';

export interface IWhatsAppChannel extends Document {
  whatsappGroupId: string; // Meta Group ID
  groupName: string;
  projectId: Types.ObjectId;
  projectCode: string;
  customerId: Types.ObjectId;
  customerName: string;
  groupStatus: ChannelStatus;
  groupCreatedDate: Date;
  lastMessageDate?: Date;
  automationEnabled: boolean;
  updateFrequencyDays: number;
  nextUpdateDate?: Date;
  lastUpdateDate?: Date;
  participants: Array<{
    phoneNumber: string;
    name?: string;
    role: 'ADMIN' | 'MEMBER';
  }>;
  groupInviteLink?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppChannelSchema = new Schema<IWhatsAppChannel>(
  {
    whatsappGroupId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    groupName: {
      type: String,
      required: true,
      trim: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      unique: true,
    },
    projectCode: {
      type: String,
      required: true,
      trim: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    groupStatus: {
      type: String,
      enum: ['ACTIVE', 'PAUSED', 'DISABLED', 'ERROR'],
      default: 'ACTIVE',
    },
    groupCreatedDate: {
      type: Date,
      default: Date.now,
    },
    lastMessageDate: {
      type: Date,
    },
    automationEnabled: {
      type: Boolean,
      default: true,
    },
    updateFrequencyDays: {
      type: Number,
      default: 20,
    },
    nextUpdateDate: {
      type: Date,
    },
    lastUpdateDate: {
      type: Date,
    },
    participants: [
      {
        phoneNumber: { type: String, required: true },
        name: { type: String },
        role: { type: String, enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' },
      },
    ],
    groupInviteLink: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

WhatsAppChannelSchema.index({ customerId: 1 });
WhatsAppChannelSchema.index({ groupStatus: 1 });

export const WhatsAppChannel = model<IWhatsAppChannel>('WhatsAppChannel', WhatsAppChannelSchema);
