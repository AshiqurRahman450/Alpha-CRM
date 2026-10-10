import { Schema, model, Document, Types } from 'mongoose';

export type ActivityType =
  | 'PAYMENT'
  | 'STATUS_CHANGE'
  | 'WHATSAPP_SENT'
  | 'WHATSAPP_RECEIVED'
  | 'WHATSAPP_FAILED'
  | 'NOTE'
  | 'DELIVERY'
  | 'INSTALLATION'
  | 'CUSTOMER_UPDATE'
  | 'DOCUMENT_UPLOAD';

export interface IProjectActivity extends Document {
  projectId: Types.ObjectId;
  projectCode: string;
  type: ActivityType;
  description: string;
  userId?: Types.ObjectId;
  userName?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectActivitySchema = new Schema<IProjectActivity>(
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
    type: {
      type: String,
      enum: [
        'PAYMENT',
        'STATUS_CHANGE',
        'WHATSAPP_SENT',
        'WHATSAPP_RECEIVED',
        'WHATSAPP_FAILED',
        'NOTE',
        'DELIVERY',
        'INSTALLATION',
        'CUSTOMER_UPDATE',
        'DOCUMENT_UPLOAD',
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    userName: {
      type: String,
      default: 'System Automation',
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

ProjectActivitySchema.index({ projectId: 1, createdAt: -1 });
ProjectActivitySchema.index({ type: 1 });

export const ProjectActivity = model<IProjectActivity>('ProjectActivity', ProjectActivitySchema);
