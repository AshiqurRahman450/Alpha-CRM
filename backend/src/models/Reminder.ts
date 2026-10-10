import { Schema, model, Document, Types } from 'mongoose';

export interface IReminder extends Document {
  userId: Types.ObjectId;
  title: string;
  notes?: string;
  dueAt: Date;
  status: 'PENDING' | 'DISMISSED';
  relatedProjectId?: Types.ObjectId;
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
    relatedProjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
  },
  { timestamps: true }
);

ReminderSchema.index({ userId: 1, status: 1, dueAt: 1 });

export const Reminder = model<IReminder>('Reminder', ReminderSchema);
