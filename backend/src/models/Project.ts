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
  bdmPhone?: string;
  notes?: string;
  drawingUrl?: string;
  vrlLrNumber?: string;
  trackingNumber?: string;

  // WhatsApp Automation Fields
  whatsappGroupId?: string;
  whatsappGroupName?: string;
  automationEnabled: boolean;
  updateFrequencyDays: number; // 10, 15, 20 or custom
  lastUpdateAt?: Date;
  nextUpdateAt?: Date;
  postponedUntil?: Date;
  pauseReason?: string;
  productionStage?: number; // 1: Stage 1 due, 2: Stage 2 due, 3: Stage 3 due, 4: All 3 stages completed
  escalationMatrixScheduledAt?: Date;
  escalationMatrixSent?: boolean;
  escalationMatrixSentAt?: Date;
  productionTimelineDays?: number; // Days from production payment to material delivery
  productionPaymentReminderScheduledAt?: Date; // Scheduled 2 days after Drawing and cabin Approved
  productionPaymentReminderSent?: boolean;
  productionPaymentReminderSentAt?: Date;

  // Dedicated WATI WhatsApp Group Data Model
  whatsapp?: {
    provider: string; // 'WATI'
    groupId?: string;
    groupName?: string;
    inviteLink?: string;
    botPhoneNumber?: string;
    participants?: Array<{
      phoneNumber: string;
      name?: string;
      role?: string;
    }>;
    invitationStatus: 'NOT_INVITED' | 'PENDING' | 'SENT' | 'ACCEPTED' | 'FAILED';
    groupStatus: 'NOT_LINKED' | 'ACTIVE' | 'PAUSED' | 'FAILED' | 'DISCONNECTED' | 'AWAITING_OBA_APPROVAL';
    updatesEnabled: boolean;
    paused: boolean;
    intervalDays: 1 | 10 | 15 | 20;
    nextUpdateAt?: Date;
    lastUpdateAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
  };

  stageDates?: Map<string, { scheduleDate?: Date | null; executedDate?: Date | null }>;

  installationStages?: IInstallationStage[];

  paymentRequest?: {
    status: 'NONE' | 'REQUESTED' | 'RECORDED';
    requestedAmount?: number;
    paymentType?: string;
    requestedBy?: string;
    requestedByPhone?: string;
    accountantPhone?: string;
    accountantName?: string;
    requestedAt?: Date;
    notes?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface IInstallationStage {
  slNo: number; // 1 to 11
  stageKey: string;
  stageName: string;
  startDate: string; // YYYY-MM-DD
  completeDate: string; // YYYY-MM-DD
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
  durationWorkingDays: number;
  delayReason?: 'HOLIDAY' | 'TECHNICAL_ISSUE' | null;
  delayNotes?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: Date;
}

export const DEFAULT_INSTALLATION_STAGES: Array<{
  slNo: number;
  stageKey: string;
  stageName: string;
  defaultWorkingDays: number;
}> = [
  { slNo: 1, stageKey: 'SHAFT_READINESS', stageName: 'Shaft readiness,', defaultWorkingDays: 2 },
  { slNo: 2, stageKey: 'SITE_SURVEY', stageName: 'Site survey, shaft measurement', defaultWorkingDays: 1 },
  { slNo: 3, stageKey: 'BRACKETS_GUIDE_RAILS', stageName: 'Installation of brackets and guide rails Alingment', defaultWorkingDays: 2 },
  { slNo: 4, stageKey: 'MACHINE_CAR_CWT', stageName: 'Machine , Car and Cwt Frame Instalation', defaultWorkingDays: 1 },
  { slNo: 5, stageKey: 'BELT_STARTUP', stageName: 'Belt installation And Startup Prepration', defaultWorkingDays: 1 },
  { slNo: 6, stageKey: 'PLATFORM_ALIGNMENT', stageName: 'Platform Instalation and Alignment', defaultWorkingDays: 1 },
  { slNo: 7, stageKey: 'DOOR_FRAME', stageName: 'Door Frame Instalation', defaultWorkingDays: 1 },
  { slNo: 8, stageKey: 'CABIN_DOOR_ALIGNMENT', stageName: 'Cabin Installation  and Door Alignment', defaultWorkingDays: 1 },
  { slNo: 9, stageKey: 'SHAFT_GLASS_FIXING', stageName: 'Shaft Glass Fixing', defaultWorkingDays: 2 },
  { slNo: 10, stageKey: 'HIGH_SPEED_OPERATION', stageName: 'Preparing for high speed operation', defaultWorkingDays: 2 },
  { slNo: 11, stageKey: 'HANDOVER', stageName: 'HANDOVER', defaultWorkingDays: 1 },
];

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
    bdmPhone: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
    },
    drawingUrl: {
      type: String,
    },
    vrlLrNumber: {
      type: String,
      trim: true,
    },
    trackingNumber: {
      type: String,
      trim: true,
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
    productionStage: {
      type: Number,
      default: 1,
    },
    whatsapp: {
      provider: { type: String, default: 'WATI' },
      groupId: { type: String, trim: true },
      groupName: { type: String, trim: true },
      inviteLink: { type: String, trim: true },
      botPhoneNumber: { type: String, trim: true, default: '+91 93848 20316' },
      participants: [
        {
          name: { type: String, trim: true },
          phoneNumber: { type: String, required: true, trim: true },
          role: { type: String, default: 'MEMBER' },
        },
      ],
      invitationStatus: {
        type: String,
        enum: ['NOT_INVITED', 'PENDING', 'SENT', 'ACCEPTED', 'FAILED'],
        default: 'NOT_INVITED',
      },
      groupStatus: {
        type: String,
        enum: ['NOT_LINKED', 'ACTIVE', 'PAUSED', 'FAILED', 'DISCONNECTED', 'AWAITING_OBA_APPROVAL'],
        default: 'NOT_LINKED',
      },
      updatesEnabled: { type: Boolean, default: false },
      paused: { type: Boolean, default: false },
      intervalDays: {
        type: Number,
        enum: [1, 10, 15, 20],
        default: 15,
      },
      nextUpdateAt: { type: Date },
      lastUpdateAt: { type: Date },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    escalationMatrixScheduledAt: { type: Date },
    escalationMatrixSent: { type: Boolean, default: false },
    escalationMatrixSentAt: { type: Date },
    productionTimelineDays: { type: Number, default: 60 },
    productionPaymentReminderScheduledAt: { type: Date },
    productionPaymentReminderSent: { type: Boolean, default: false },
    productionPaymentReminderSentAt: { type: Date },
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
    installationStages: [
      {
        slNo: { type: Number, required: true },
        stageKey: { type: String, required: true },
        stageName: { type: String, required: true },
        startDate: { type: String, required: true },
        completeDate: { type: String, required: true },
        status: {
          type: String,
          enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED'],
          default: 'PENDING',
        },
        durationWorkingDays: { type: Number, default: 1 },
        delayReason: {
          type: String,
          enum: ['HOLIDAY', 'TECHNICAL_ISSUE', null],
          default: null,
        },
        delayNotes: { type: String, trim: true },
        lastUpdatedBy: { type: String, trim: true },
        lastUpdatedAt: { type: Date },
      },
    ],
    paymentRequest: {
      status: {
        type: String,
        enum: ['NONE', 'REQUESTED', 'RECORDED'],
        default: 'NONE',
      },
      requestedAmount: { type: Number },
      paymentType: { type: String, trim: true },
      requestedBy: { type: String, trim: true },
      requestedByPhone: { type: String, trim: true },
      accountantPhone: { type: String, trim: true },
      accountantName: { type: String, trim: true },
      requestedAt: { type: Date },
      notes: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

// Two-way synchronization hook between legacy flat fields and whatsapp subdocument
ProjectSchema.pre('save', function (next) {
  if (this.vrlLrNumber && !this.trackingNumber) {
    this.trackingNumber = this.vrlLrNumber;
  } else if (this.trackingNumber && !this.vrlLrNumber) {
    this.vrlLrNumber = this.trackingNumber;
  }
  if (this.whatsapp) {
    if (this.whatsappGroupId && !this.whatsapp.groupId) {
      this.whatsapp.groupId = this.whatsappGroupId;
    }
    if (this.whatsappGroupName && !this.whatsapp.groupName) {
      this.whatsapp.groupName = this.whatsappGroupName;
    }
    if (this.automationEnabled !== undefined && (this.whatsapp.updatesEnabled === undefined || this.whatsapp.updatesEnabled === false)) {
      if (this.automationEnabled) {
        this.whatsapp.updatesEnabled = true;
        this.whatsapp.paused = false;
        this.whatsapp.groupStatus = 'ACTIVE';
      }
    }
    if (this.whatsapp.groupId) this.whatsappGroupId = this.whatsapp.groupId;
    if (this.whatsapp.groupName) this.whatsappGroupName = this.whatsapp.groupName;
    if (typeof this.whatsapp.updatesEnabled === 'boolean') {
      this.automationEnabled = this.whatsapp.updatesEnabled && !this.whatsapp.paused;
    }
    if (this.whatsapp.intervalDays) this.updateFrequencyDays = this.whatsapp.intervalDays;
    if (this.whatsapp.nextUpdateAt) {
      this.nextUpdateAt = this.whatsapp.nextUpdateAt;
    } else if (this.nextUpdateAt) {
      this.whatsapp.nextUpdateAt = this.nextUpdateAt;
    }
    if (this.whatsapp.lastUpdateAt) {
      this.lastUpdateAt = this.whatsapp.lastUpdateAt;
    } else if (this.lastUpdateAt) {
      this.whatsapp.lastUpdateAt = this.lastUpdateAt;
    }
    this.whatsapp.updatedAt = new Date();
  } else if (this.whatsappGroupId) {
    const days = [1, 10, 15, 20].includes(this.updateFrequencyDays)
      ? (this.updateFrequencyDays as 1 | 10 | 15 | 20)
      : 15;
    this.whatsapp = {
      provider: 'WATI',
      groupId: this.whatsappGroupId,
      groupName: this.whatsappGroupName,
      invitationStatus: 'PENDING',
      groupStatus: this.automationEnabled ? 'ACTIVE' : 'PAUSED',
      updatesEnabled: this.automationEnabled,
      paused: !this.automationEnabled,
      intervalDays: days,
      nextUpdateAt: this.nextUpdateAt,
      lastUpdateAt: this.lastUpdateAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  next();
});

// Indexes
ProjectSchema.index({ customerId: 1 });
ProjectSchema.index({ nextUpdateAt: 1 });
ProjectSchema.index({ projectStatus: 1 });
ProjectSchema.index({ whatsappGroupId: 1 });
ProjectSchema.index({ 'whatsapp.groupId': 1 });
ProjectSchema.index({ 'whatsapp.updatesEnabled': 1, 'whatsapp.nextUpdateAt': 1 });
ProjectSchema.index({ automationEnabled: 1, nextUpdateAt: 1, projectStatus: 1 });
ProjectSchema.index({ 'paymentRequest.status': 1 });

export const Project = model<IProject>('Project', ProjectSchema);
