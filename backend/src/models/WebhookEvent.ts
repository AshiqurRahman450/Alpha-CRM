import { Schema, model, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
  eventId: string; // Meta message ID or status ID to prevent duplicate processing
  eventType: string; // messages | statuses | group_updates
  payload: Record<string, any>;
  processedAt: Date;
  status: 'PROCESSED' | 'IGNORED' | 'ERROR';
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['PROCESSED', 'IGNORED', 'ERROR'],
      default: 'PROCESSED',
    },
    errorDetails: {
      type: String,
    },
  },
  { timestamps: true }
);

WebhookEventSchema.index({ createdAt: -1 });

export const WebhookEvent = model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
