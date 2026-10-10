import { Schema, model, Document } from 'mongoose';

export interface ISystemSettings extends Document {
  key: string; // 'GLOBAL_CONFIG'
  companyName: string;
  companyAddress: string;
  supportPhone: string;
  supportEmail: string;

  // Automation Settings
  automationEnabled: boolean;
  defaultUpdateFrequencyDays: number;
  defaultUpdateTime: string; // e.g. "09:00"
  timezone: string; // "Asia/Kolkata"
  allowEmployeeOverride: boolean;

  // Pilot & Test Modes
  pilotModeEnabled: boolean;
  pilotCustomerLimit: number;
  whatsappTestMode: boolean; // Safe mode: simulates or dry-runs API without charges if credentials not set

  // Meta Cloud API Settings (stored safely; token can be configured via env or settings)
  metaApiVersion: string;
  metaPhoneNumberId?: string;
  metaWabaId?: string;
  metaAppId?: string;
  metaWebhookStatus: 'HEALTHY' | 'PENDING' | 'ERROR';
  lastWebhookReceivedAt?: Date;

  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    key: {
      type: String,
      default: 'GLOBAL_CONFIG',
      unique: true,
    },
    companyName: {
      type: String,
      default: 'Alpha Elevators Pvt Ltd',
    },
    companyAddress: {
      type: String,
      default: 'Tower 4, Industrial Tech Park, Andheri East, Mumbai, Maharashtra 400069',
    },
    supportPhone: {
      type: String,
      default: '+91 98200 12345',
    },
    supportEmail: {
      type: String,
      default: 'support@alphaelevators.com',
    },
    automationEnabled: {
      type: Boolean,
      default: true,
    },
    defaultUpdateFrequencyDays: {
      type: Number,
      default: 20,
    },
    defaultUpdateTime: {
      type: String,
      default: '09:00',
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    allowEmployeeOverride: {
      type: Boolean,
      default: true,
    },
    pilotModeEnabled: {
      type: Boolean,
      default: true,
    },
    pilotCustomerLimit: {
      type: Number,
      default: 10,
    },
    whatsappTestMode: {
      type: Boolean,
      default: true, // safe default until live Meta production keys are verified
    },
    metaApiVersion: {
      type: String,
      default: 'v20.0',
    },
    metaPhoneNumberId: {
      type: String,
    },
    metaWabaId: {
      type: String,
    },
    metaAppId: {
      type: String,
    },
    metaWebhookStatus: {
      type: String,
      enum: ['HEALTHY', 'PENDING', 'ERROR'],
      default: 'PENDING',
    },
    lastWebhookReceivedAt: {
      type: Date,
    },
    updatedBy: {
      type: String,
    },
  },
  { timestamps: true }
);

export const SystemSettings = model<ISystemSettings>('SystemSettings', SystemSettingsSchema);
