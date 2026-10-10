import { Schema, model, Document, Types } from 'mongoose';

export type MessageStatus =
  | 'SCHEDULED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'CANCELLED';

export type MessageDirection = 'OUTGOING' | 'INCOMING';

export interface IWhatsAppMessage extends Document {
  projectId: Types.ObjectId;
  projectCode: string;
  customerId: Types.ObjectId;
  customerName: string;
  groupId: string;
  templateName?: string;
  metaMessageId?: string;
  messageType: 'template' | 'text' | 'image' | 'document';
  recipientType: 'group' | 'individual';
  direction: MessageDirection;
  senderName?: string;
  senderPhone?: string;
  messageContent: string;
  status: MessageStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  lastRetryAt?: Date;
  idempotencyKey?: string;
  isAutomated: boolean;
  variablesPayload?: Record<string, any>;
  rawResponse?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppMessageSchema = new Schema<IWhatsAppMessage>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
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
    groupId: {
      type: String,
      required: true,
      trim: true,
    },
    templateName: {
      type: String,
      trim: true,
    },
    metaMessageId: {
      type: String,
      trim: true,
    },
    messageType: {
      type: String,
      enum: ['template', 'text', 'image', 'document'],
      default: 'template',
    },
    recipientType: {
      type: String,
      enum: ['group', 'individual'],
      default: 'group',
    },
    direction: {
      type: String,
      enum: ['OUTGOING', 'INCOMING'],
      default: 'OUTGOING',
    },
    senderName: {
      type: String,
      trim: true,
    },
    senderPhone: {
      type: String,
      trim: true,
    },
    messageContent: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED'],
      default: 'SCHEDULED',
    },
    sentAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    errorCode: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastRetryAt: {
      type: Date,
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
    isAutomated: {
      type: Boolean,
      default: true,
    },
    variablesPayload: {
      type: Schema.Types.Mixed,
    },
    rawResponse: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

WhatsAppMessageSchema.index({ metaMessageId: 1 }, { sparse: true });
WhatsAppMessageSchema.index({ projectId: 1, createdAt: -1 });
WhatsAppMessageSchema.index({ groupId: 1, createdAt: -1 });
WhatsAppMessageSchema.index({ idempotencyKey: 1 }, { sparse: true });
WhatsAppMessageSchema.index({ status: 1 });
WhatsAppMessageSchema.index({ direction: 1 });

export const WhatsAppMessage = model<IWhatsAppMessage>('WhatsAppMessage', WhatsAppMessageSchema);
