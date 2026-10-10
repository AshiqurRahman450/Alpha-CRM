import { Schema, model, Document } from 'mongoose';

export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED';

export interface IWhatsAppTemplate extends Document {
  templateName: string; // e.g. MANUFACTURING_UPDATE
  displayName: string;
  category: string; // UTILITY
  stageMapping?: string; // Associated ProjectStatus (e.g. MANUFACTURING)
  templateLanguage: string; // en_US
  templateStatus: TemplateStatus;
  metaTemplateId?: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  variablesList: string[]; // ['customer_name', 'project_name', 'project_stage', 'next_milestone']
  sampleValues?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppTemplateSchema = new Schema<IWhatsAppTemplate>(
  {
    templateName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'UTILITY',
    },
    stageMapping: {
      type: String,
      trim: true,
      uppercase: true,
    },
    templateLanguage: {
      type: String,
      default: 'en_US',
    },
    templateStatus: {
      type: String,
      enum: ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED'],
      default: 'APPROVED',
    },
    metaTemplateId: {
      type: String,
      trim: true,
    },
    headerText: {
      type: String,
    },
    bodyText: {
      type: String,
      required: true,
    },
    footerText: {
      type: String,
      default: 'Alpha Elevators — Engineering Safety & Luxury',
    },
    variablesList: [
      {
        type: String,
      },
    ],
    sampleValues: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

WhatsAppTemplateSchema.index({ stageMapping: 1 });
WhatsAppTemplateSchema.index({ templateStatus: 1 });

export const WhatsAppTemplate = model<IWhatsAppTemplate>('WhatsAppTemplate', WhatsAppTemplateSchema);
