import { Schema, model, Document, Types } from 'mongoose';

export type ProjectStatus =
  | 'PAYMENT_RECEIVED'
  | 'SITE_MEASUREMENT'
  | 'DESIGN'
  | 'CUSTOMER_APPROVAL'
  | 'ENGINEERING'
  | 'MANUFACTURING'
  | 'QUALITY_CHECK'
  | 'DISPATCH'
  | 'DELIVERY'
  | 'INSTALLATION'
  | 'TESTING'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'ADVANCE_PAID' | 'PARTIAL_PAID' | 'FULLY_PAID';

export interface IProject extends Document {
  projectId: string; // e.g. ALP-001
  customerId: Types.ObjectId; // Ref to Customer
  customerCode: string; // denormalized for quick querying, e.g. CUST-001
  projectName: string; // e.g. Kumar Residence
  siteAddress: string;
  liftModel: string; // e.g. Alpha EV, Alpha Premier, Alpha Luxe
  liftType: string; // e.g. Home Lift, Villa Elevator, Glass Panoramic
  numberOfFloors?: string;
  shaftModel?: string;
  liftAmount: number;
  shaftAmount: number;
  orderValue: number; // total amount
  advancePercentage: number; // e.g. 30
  productionPaymentPercent?: number; // e.g. 40
  readinessNotificationPercent?: number; // e.g. 20
  dispatchMaterialsPercent?: number; // e.g. 5
  afterInstallationPercent?: number; // e.g. 5
  advanceAmount: number; // e.g. 255000
  totalPaid: number;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
  orderDate: Date;
  expectedDeliveryDate: Date;
  actualDeliveryDate?: Date;
  installationDate?: Date;
  projectStatus: ProjectStatus;
  assignedEmployee?: string;
  projectManager?: string;
  bdmId?: Types.ObjectId;
  notes?: string;
  drawingUrl?: string;

  // WhatsApp Automation Fields
  whatsappGroupId?: string;
  whatsappGroupName?: string;
  automationEnabled: boolean;
  updateFrequencyDays: number; // 10, 15, 20 or custom
  lastUpdateAt?: Date;
  nextUpdateAt?: Date;
  postponedUntil?: Date;
  pauseReason?: string;

  stageDates?: Map<string, { scheduleDate?: Date | null; executedDate?: Date | null }>;

  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    projectId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    customerCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    siteAddress: {
      type: String,
      required: true,
      trim: true,
    },
    liftModel: {
      type: String,
      required: true,
      default: 'Hydraulic Home Series',
    },
    liftType: {
      type: String,
      required: true,
      default: 'Home Lift',
    },
    numberOfFloors: {
      type: String,
      enum: ['G+1', 'G+2', 'G+3', 'G+4', 'G+5'],
    },
    shaftModel: {
      type: String,
      trim: true,
    },
    liftAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    shaftAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    orderValue: {
      type: Number,
      required: true,
      min: 0,
    },
    advancePercentage: {
      type: Number,
      default: 30,
      min: 0,
      max: 100,
    },
    productionPaymentPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    readinessNotificationPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    dispatchMaterialsPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    afterInstallationPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    advanceAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'ADVANCE_PAID', 'PARTIAL_PAID', 'FULLY_PAID'],
      default: 'PENDING',
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    expectedDeliveryDate: {
      type: Date,
      required: true,
    },
    actualDeliveryDate: {
      type: Date,
    },
    installationDate: {
      type: Date,
    },
    projectStatus: {
      type: String,
      enum: [
        'PAYMENT_RECEIVED',
        'SITE_MEASUREMENT',
        'DESIGN',
        'CUSTOMER_APPROVAL',
        'ENGINEERING',
        'MANUFACTURING',
        'QUALITY_CHECK',
        'DISPATCH',
        'DELIVERY',
        'INSTALLATION',
        'TESTING',
        'COMPLETED',
        'ON_HOLD',
        'CANCELLED',
      ],
      default: 'PAYMENT_RECEIVED',
    },
    assignedEmployee: {
      type: String,
      trim: true,
    },
    projectManager: {
      type: String,
      trim: true,
    },
    bdmId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
    },
    drawingUrl: {
      type: String,
    },
    whatsappGroupId: {
      type: String,
      trim: true,
    },
    whatsappGroupName: {
      type: String,
      trim: true,
    },
    automationEnabled: {
      type: Boolean,
      default: true,
    },
    updateFrequencyDays: {
      type: Number,
      default: 20,
    },
    lastUpdateAt: {
      type: Date,
    },
    nextUpdateAt: {
      type: Date,
    },
    postponedUntil: {
      type: Date,
    },
    pauseReason: {
      type: String,
    },
    stageDates: {
      type: Map,
      of: new Schema(
        {
          scheduleDate: { type: Date, default: null },
          executedDate: { type: Date, default: null },
        },
        { _id: false }
      ),
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes
ProjectSchema.index({ customerId: 1 });
ProjectSchema.index({ nextUpdateAt: 1 });
ProjectSchema.index({ projectStatus: 1 });
ProjectSchema.index({ whatsappGroupId: 1 });
ProjectSchema.index({ automationEnabled: 1, nextUpdateAt: 1, projectStatus: 1 });

export const Project = model<IProject>('Project', ProjectSchema);
