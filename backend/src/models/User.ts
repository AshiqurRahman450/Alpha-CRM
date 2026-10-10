import { Schema, model, Document } from 'mongoose';

export type UserRole = 'ADMIN' | 'CRM' | 'MANAGER' | 'VIEWER' | 'BDM';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  phone?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['ADMIN', 'CRM', 'MANAGER', 'VIEWER', 'BDM'],
      default: 'CRM',
      required: true,
    },
    isActive: { type: Boolean, default: true },
    phone: { type: String, trim: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
UserSchema.index({ role: 1 });

export const User = model<IUser>('User', UserSchema);
