import { Schema, model, Document, Types } from 'mongoose';

export interface IPayment extends Document {
  projectId: Types.ObjectId; // Ref Project
  projectCode: string; // e.g. ALP-001
  customerId: Types.ObjectId; // Ref Customer
  customerName: string;
  totalOrderValue: number;
  advanceRequired: number;
  amountPaid: number;
  balanceAmount: number;
  paymentType: 'Booking Advance' | 'Production Payment' | 'Rediness Notification' | 'Dispatch Materials' | 'After Installation' | 'OTHER';
  paymentDate: Date;
  paymentMethod: 'BANK_TRANSFER' | 'RTGS_NEFT' | 'UPI' | 'CHEQUE' | 'CASH';
  transactionReference: string;
  paymentStatus: 'SUCCESS' | 'PENDING' | 'FAILED';
  receiptNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
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
    totalOrderValue: {
      type: Number,
      required: true,
    },
    advanceRequired: {
      type: Number,
      required: true,
    },
    amountPaid: {
      type: Number,
      required: true,
    },
    balanceAmount: {
      type: Number,
      required: true,
    },
    paymentType: {
      type: String,
      enum: ['Booking Advance', 'Production Payment', 'Rediness Notification', 'Dispatch Materials', 'After Installation', 'OTHER'],
      default: 'Booking Advance',
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ['BANK_TRANSFER', 'RTGS_NEFT', 'UPI', 'CHEQUE', 'CASH'],
      default: 'BANK_TRANSFER',
    },
    transactionReference: {
      type: String,
      required: true,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ['SUCCESS', 'PENDING', 'FAILED'],
      default: 'SUCCESS',
    },
    receiptNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

PaymentSchema.index({ projectId: 1, paymentDate: -1 });
PaymentSchema.index({ customerId: 1 });
PaymentSchema.index({ transactionReference: 1 });

export const Payment = model<IPayment>('Payment', PaymentSchema);
