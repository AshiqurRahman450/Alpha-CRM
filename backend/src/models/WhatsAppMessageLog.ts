import { Schema, model, Document, Types } from 'mongoose';

export type WhatsAppMessageLogStatus =
  | 'SCHEDULED'
  | 'PENDING'
  | 'SENDING'
  | 'AWAITING_PROVIDER_CAPABILITY'
  | 'ACCEPTED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'CANCELLED';

export type WhatsAppMessageType =
  | 'template'
  | 'text'
  | 'image'
  | 'video'
  | 'document';

export interface IWhatsAppMessageLog extends Document {
  projectId: Types.ObjectId;
  groupId?: string;
  recipientPhone?: string;
  recipientName?: string;
  messageText: string;
  messageType: WhatsAppMessageType;
  scheduledAt?: Date;
  attemptedAt?: Date;
  sentAt?: Date;
  providerMessageId?: string;
  status: WhatsAppMessageLogStatus;
  attemptCount: number;
  lastError?: string;
  idempotencyKey?: string;
  isDryRun?: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppMessageLogSchema = new Schema<IWhatsAppMessageLog>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    groupId: {
      type: String,
      trim: true,
      index: true,
      default: 'DIRECT_1TO1',
    },
    recipientPhone: {
      type: String,
      trim: true,
      index: true,
    },
    recipientName: {
      type: String,
      trim: true,
    },
    messageText: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ['template', 'text', 'image', 'video', 'document'],
      default: 'text',
    },
    scheduledAt: {
      type: Date,
      default: Date.now,
    },
    attemptedAt: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
    providerMessageId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: [
        'SCHEDULED',
        'PENDING',
        'SENDING',
        'AWAITING_PROVIDER_CAPABILITY',
        'ACCEPTED',
        'SENT',
        'DELIVERED',
        'READ',
        'FAILED',
        'CANCELLED',
      ],
      default: 'SCHEDULED',
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    isDryRun: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// Indexes for scheduling, deduplication, and query performance
WhatsAppMessageLogSchema.index({ projectId: 1, createdAt: -1 });
WhatsAppMessageLogSchema.index({ groupId: 1, createdAt: -1 });
WhatsAppMessageLogSchema.index({ status: 1, scheduledAt: 1 });

export const WhatsAppMessageLog = model<IWhatsAppMessageLog>(
  'WhatsAppMessageLog',
  WhatsAppMessageLogSchema
);
