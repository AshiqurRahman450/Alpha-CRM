import { Schema, model, Document, Types } from 'mongoose';

export interface ICustomer extends Document {
  customerId: string; // e.g. CUST-001
  fullName: string;
  phoneNumber: string;
  whatsappNumber: string;
  email?: string;
  doorNo?: string;
  streetName?: string;
  landmark?: string;
  address: string;
  googleMapsLink?: string;
  city: string;
  state: string;
  pincode: string;
  customerType: string; // Residential, Villa, Commercial, Builder
  leadSource?: string;
  assignedEmployee?: string;
  bdmId?: Types.ObjectId;
  bdmPhone?: string;
  whatsappOptIn: boolean;
  optInDate?: Date;
  optInSource?: string; // PROJECT_CONFIRMATION, CONTRACT_SIGNING, DIRECT
  optInPhone?: string;
  notes?: string;
  documents?: {
    name: string;
    url: string;
    uploadedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    customerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    whatsappNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    doorNo: {
      type: String,
      trim: true,
    },
    streetName: {
      type: String,
      trim: true,
    },
    landmark: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    googleMapsLink: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      default: 'Mumbai',
      trim: true,
    },
    state: {
      type: String,
      default: 'Maharashtra',
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    customerType: {
      type: String,
      default: 'Residential',
    },
    leadSource: {
      type: String,
      default: 'Referral',
    },
    assignedEmployee: {
      type: String,
      trim: true,
    },
    bdmId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    bdmPhone: {
      type: String,
      trim: true,
    },
    whatsappOptIn: {
      type: Boolean,
      default: true,
    },
    optInDate: {
      type: Date,
      default: Date.now,
    },
    optInSource: {
      type: String,
      default: 'PROJECT_CONFIRMATION',
    },
    optInPhone: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
    },
    documents: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Indexes
CustomerSchema.index({ phoneNumber: 1 });
CustomerSchema.index({ whatsappNumber: 1 });
CustomerSchema.index({ fullName: 'text', city: 'text' });

export const Customer = model<ICustomer>('Customer', CustomerSchema);
