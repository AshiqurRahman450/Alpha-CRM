import { Schema, model, Document, Types } from 'mongoose';

export interface IAttendee {
  role: string;
  present: boolean;
  name: string;
  phone: string;
}

export interface IQCReport extends Document {
  reportId: string;
  reportDate: string;
  region: string;
  jobNo: string;
  clientName: string;
  clientPhone: string;
  customerId?: Types.ObjectId;
  projectId?: Types.ObjectId;
  visitCount?: string;
  technician?: string;
  technicianEmail?: string;
  quotationNo?: string;
  automationCode?: string;
  automationEmail?: string;

  // Property & Elevator
  propertyStage: string;
  installationArea: string;
  product: string;
  floorConfig: number;
  doorClosing?: string;
  clientSignatureType?: string;

  // Measurements
  shaftG?: number;
  shaftA?: number;
  shaftB?: number;
  shaftC?: number;
  shaftAccuracy?: string;
  plasterStatus?: string;
  floorMeasurements?: any;
  totalTravel?: number;
  totalShaft?: number;
  pitClient?: number;

  // Wall Specs
  wallSpecifications?: any;

  // Attendees
  attendees?: IAttendee[];

  // Remarks & Confirmation
  clientRepName?: string;
  clientRepPhone?: string;
  timeIn?: string;
  timeOut?: string;
  technicianSignature?: string;
  clientSign?: string;
  remarks?: string;

  // Photos summary & data
  photos?: Record<string, string[]>;
  supportPhotos?: any[];
  uploadedFiles?: Record<string, Array<{ name: string; size?: number; type?: string }>>;
  pdfUrl?: string;

  createdBy?: Types.ObjectId;
  status: 'DRAFT' | 'SUBMITTED';
  createdAt: Date;
  updatedAt: Date;
}

const QCReportSchema = new Schema<IQCReport>(
  {
    reportId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    reportDate: { type: String, required: true },
    region: { type: String, required: true },
    jobNo: { type: String, required: true, trim: true },
    clientName: { type: String, required: true, trim: true },
    clientPhone: { type: String, required: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    visitCount: { type: String },
    technician: { type: String },
    technicianEmail: { type: String },
    quotationNo: { type: String },
    automationCode: { type: String },
    automationEmail: { type: String },

    propertyStage: { type: String, required: true },
    installationArea: { type: String, required: true },
    product: { type: String, required: true },
    floorConfig: { type: Number, required: true, default: 2 },
    doorClosing: { type: String },
    clientSignatureType: { type: String },

    shaftG: { type: Number },
    shaftA: { type: Number },
    shaftB: { type: Number },
    shaftC: { type: Number },
    shaftAccuracy: { type: String },
    plasterStatus: { type: String },
    floorMeasurements: { type: Schema.Types.Mixed },
    totalTravel: { type: Number },
    totalShaft: { type: Number },
    pitClient: { type: Number },

    wallSpecifications: { type: Schema.Types.Mixed },
    attendees: [
      {
        role: { type: String },
        present: { type: Boolean, default: false },
        name: { type: String },
        phone: { type: String },
      },
    ],

    clientRepName: { type: String },
    clientRepPhone: { type: String },
    timeIn: { type: String },
    timeOut: { type: String },
    technicianSignature: { type: String },
    clientSign: { type: String },
    remarks: { type: String },

    photos: { type: Schema.Types.Mixed },
    supportPhotos: { type: Schema.Types.Mixed },
    uploadedFiles: { type: Schema.Types.Mixed },
    pdfUrl: { type: String },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['DRAFT', 'SUBMITTED'], default: 'SUBMITTED' },
  },
  { timestamps: true }
);

QCReportSchema.index({ jobNo: 1 });
QCReportSchema.index({ clientName: 'text', jobNo: 'text' });

export const QCReport = model<IQCReport>('QCReport', QCReportSchema);
