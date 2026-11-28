import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { connectDB } from './config/db';
import path from 'path';
import fs from 'fs';
import { initScheduler } from './services/scheduler/schedulerService';
import { whatsAppWebBot } from './services/whatsapp';

import { authRouter } from './routes/auth';
import { customerRouter } from './routes/customers';
import { projectRouter, slimProjectInstallationStageImages } from './routes/projects';
import { paymentRouter } from './routes/payments';
import { whatsappRouter } from './routes/whatsapp';
import { templateRouter } from './routes/templates';
import { dashboardRouter } from './routes/dashboard';
import { reportRouter } from './routes/reports';
import { settingsRouter } from './routes/settings';
import { webhookRouter } from './routes/webhooks';
import { reminderRouter } from './routes/reminders';
import { qcRouter } from './routes/qc';
import { quotationRouter } from './routes/quotations';
import { siteProblemRouter } from './routes/siteProblems';
import { splitSharedCustomerProjects, resequenceCustomerIds } from './utils/idGenerators';
import { invalidateApiCache } from './utils/apiCache';
import bcrypt from 'bcryptjs';

const app = express();

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: '*', // Allow frontend development & VPS origins
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Automatically invalidate in-memory GET query cache on any mutating API request (POST, PUT, PATCH, DELETE)
app.use('/api', (req: Request, _res: Response, next: NextFunction) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    invalidateApiCache();
  }
  next();
});

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Ensure uploaded document directories exist and serve uploaded documents
const uploadDirs = [
  path.join(__dirname, '../uploads'),
  path.resolve(__dirname, '../../uploads'),
  path.resolve(process.cwd(), 'uploads'),
  path.resolve(process.cwd(), 'backend/uploads'),
];

uploadDirs.forEach((dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    app.use('/uploads', express.static(dir));
    app.use('/api/uploads', express.static(dir));
  } catch {}
});

const getMimeTypeFromFilename = (filename: string, fallback = 'application/pdf'): string => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.dwg') return 'application/acad';
  return fallback;
};

const escapePdfText = (text: string): string =>
  String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' ');

const buildProjectDrawingFallbackPdf = (project: any, filename: string): Buffer => {
  const lines = [
    'ALPHA ELEVATORS - DRAWING & CABIN DESIGN RECORD',
    '----------------------------------------------------------------',
    `Project ID       : ${project?.projectId || 'N/A'}`,
    `Project Name     : ${project?.projectName || 'Elevator Project'}`,
    `Lift Model       : ${project?.liftModel || 'Standard Elevator'}`,
    `Floors / Stops   : ${project?.numberOfFloors ?? 'N/A'}`,
    `Capacity         : ${project?.capacity || 'Standard'}`,
    `Cabin Finish     : ${project?.cabinFinish || 'Standard'}`,
    `Door Type        : ${project?.doorType || 'Automatic'}`,
    `Site Address     : ${project?.siteAddress || 'N/A'}`,
    `Current Stage    : ${project?.projectStatus || 'DESIGN'}`,
    `Drawing File     : ${filename}`,
    '----------------------------------------------------------------',
    'Note: This drawing record was uploaded prior to cloud database',
    'attachment sync. Re-upload the CAD/PDF file using "Upload New',
    '& Send to Group" to replace this specification sheet with the',
    'full drawing file.',
  ];

  const textOps = lines
    .map((line, idx) => {
      const y = 750 - idx * 24;
      const font = idx === 0 ? '/F2 14 Tf' : '/F1 11 Tf';
      return `BT ${font} 50 ${y} Td (${escapePdfText(line)}) Tj ET`;
    })
    .join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `6 0 obj\n<< /Length ${Buffer.byteLength(textOps, 'utf8')} >>\nstream\n${textOps}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
};

// MongoDB fallback route for /uploads/:filename and /api/uploads/:filename when container ephemeral disk is wiped
app.get(['/uploads/:filename', '/api/uploads/:filename'], async (req: Request, res: Response) => {
  try {
    const safeFilename = path.basename(String(req.params.filename || ''));
    if (!safeFilename) {
      return res.status(404).json({ success: false, message: 'Filename is required' });
    }

    // 1. Check all local upload directories first
    for (const dir of uploadDirs) {
      const candidate = path.join(dir, safeFilename);
      if (fs.existsSync(candidate)) {
        return res.sendFile(candidate);
      }
    }

    const escapedFilename = safeFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fileRegex = new RegExp(`${escapedFilename}$`, 'i');
    const prefixMatch = safeFilename.match(/^([a-f0-9]{24})-drawing-/i);

    // 2. Check Project drawing stored in MongoDB
    const projectOrConditions: any[] = [{ drawingUrl: fileRegex }];
    if (prefixMatch && prefixMatch[1]) {
      projectOrConditions.push({ _id: prefixMatch[1] });
    }

    const project = await Project.findOne({ $or: projectOrConditions }).select('+drawingData').lean();
    if (project) {
      let drawingBase64 = project.drawingData;
      if (!drawingBase64) {
        const backupDoc = await Customer.db.collection('project_drawings').findOne({ projectId: project._id });
        if (backupDoc?.drawingData) {
          drawingBase64 = backupDoc.drawingData;
        }
      }
      if (drawingBase64) {
        const buffer = Buffer.from(drawingBase64, 'base64');
        const mimeType = getMimeTypeFromFilename(safeFilename, project.drawingMimeType || 'application/pdf');
        try {
          fs.writeFileSync(path.join(uploadDirs[0], safeFilename), buffer);
        } catch {}
        res.setHeader('Content-Type', mimeType);
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${encodeURIComponent(project.drawingOriginalName || safeFilename)}"`
        );
        return res.send(buffer);
      }

      // Legacy drawing uploaded before MongoDB base64 persistence whose ephemeral disk file was cleared
      const fallbackPdf = buildProjectDrawingFallbackPdf(project, safeFilename);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(safeFilename)}"`);
      return res.send(fallbackPdf);
    }

    // 3. Check Customer documents stored in MongoDB
    const custPrefixMatch = safeFilename.match(/^([a-f0-9]{24})-/i);
    const customerOrConditions: any[] = [{ 'documents.url': fileRegex }];
    if (custPrefixMatch && custPrefixMatch[1]) {
      customerOrConditions.push({ _id: custPrefixMatch[1] });
    }
    const customer = await Customer.findOne({ $or: customerOrConditions }).select('+documents.data').lean();
    if (customer && Array.isArray(customer.documents)) {
      const matchedDoc = customer.documents.find((d: any) => d?.url && fileRegex.test(d.url));
      if (matchedDoc?.data) {
        const buffer = Buffer.from(matchedDoc.data, 'base64');
        const mimeType = getMimeTypeFromFilename(safeFilename, matchedDoc.mimeType || 'application/pdf');
        try {
          fs.writeFileSync(path.join(uploadDirs[0], safeFilename), buffer);
        } catch {}
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(matchedDoc.name || safeFilename)}"`);
        return res.send(buffer);
      }
    }

    return res.status(404).json({
      success: false,
      message: `Uploaded file not found: ${safeFilename}`,
    });
  } catch (err: any) {
    console.error('[UploadsFallback] Error serving uploaded file:', err);
    return res.status(500).json({ success: false, message: 'Failed to load uploaded document' });
  }
});

// WhatsApp Web Bot Public Diagnostic Route
app.get('/api/health/whatsapp-bot', async (req: Request, res: Response) => {
  try {
    const diag = whatsAppWebBot.getDiagnostic();
    res.json({
      success: true,
      service: 'WhatsApp Web Bot',
      timestamp: new Date().toISOString(),
      ...diag,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    service: 'Alpha Elevators CRM & WhatsApp Automation Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    metaApiVersion: config.meta.apiVersion,
  });
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/customers', customerRouter);
app.use('/api/projects', projectRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/templates', templateRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/reminders', reminderRouter);
app.use('/api/qc', qcRouter);
app.use('/api/quotations', quotationRouter);
app.use('/api/site-problems', siteProblemRouter);

app.get('/', (req, res) => {
  res.send('Hello, backend is running CRM Server!');
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.url}` });
});

// Central Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ServerError]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: config.nodeEnv === 'development' ? err.stack : undefined,
  });
});

import { User, Customer, Project } from './models';
import { seed } from './scripts/seed';
import { seedBdms } from './scripts/seed_bdm';
import { autoSyncTimelineTemplates } from './routes/templates';

export async function startServer() {
  try {
    await connectDB();

    // Auto-bootstrap initial users & templates if database is empty
    try {
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        console.log('[Server] Database is empty. Bootstrapping Admin, CRM users & templates...');
        await seed();
      } else {
        // Synchronize WhatsApp template stage names with Project Execution Timeline
        await autoSyncTimelineTemplates();
      }

      // Ensure CRM user name is Dimple Sharma (migrating any legacy Sneha Roy record)
      try {
        const crmHash = await bcrypt.hash('crm123', 10);
        const existingCrm = await User.findOne({
          $or: [{ email: 'crm@alphaelevators.com' }, { name: /sneha\s*roy/i }, { role: 'CRM' }],
        });
        if (!existingCrm) {
          await User.create({
            name: 'Dimple Sharma',
            email: 'crm@alphaelevators.com',
            passwordHash: crmHash,
            role: 'CRM',
            phone: '+91 93848 20316',
            isActive: true,
          });
          console.log('[Server] Created CRM user: Dimple Sharma (crm@alphaelevators.com / crm123)');
        } else if (/sneha\s*roy/i.test(existingCrm.name) || existingCrm.email === 'crm@alphaelevators.com') {
          await User.updateOne(
            { _id: existingCrm._id },
            { $set: { name: 'Dimple Sharma', role: 'CRM', isActive: true } }
          );
          console.log('[Server] Updated CRM user name to Dimple Sharma');
        }
      } catch (crmInitErr: any) {
        console.warn('[Server] Notice updating CRM user Dimple Sharma:', crmInitErr.message);
      }

      // Ensure default QC inspector exists
      const qcUser = await User.findOne({ email: 'qc@alphaelevators.com' });
      if (!qcUser) {
        const hash = await bcrypt.hash('qc123', 10);
        await User.create({
          name: 'Dinesh Kumar S (QC Inspector)',
          email: 'qc@alphaelevators.com',
          passwordHash: hash,
          role: 'QC',
          phone: '+91 98400 11223',
          isActive: true,
        });
        console.log('[Server] Created default QC user: qc@alphaelevators.com / qc123');
      }

      // Ensure default Technical Team Lead exists
      const techLeadUser = await User.findOne({ email: 'techlead@alphaelevators.com' });
      if (!techLeadUser) {
        const hash = await bcrypt.hash('tech123', 10);
        await User.create({
          name: 'Suresh Kumar (Technical Team Lead)',
          email: 'techlead@alphaelevators.com',
          passwordHash: hash,
          role: 'TECHNICAL_LEAD',
          phone: '+91 98401 55667',
          isActive: true,
        });
        console.log('[Server] Created default Technical Team Lead user: techlead@alphaelevators.com / tech123');
      }

      // Ensure Technical Manager (Kishore) exists
      try {
        const techManagerUser = await User.findOne({
          $or: [{ email: 'kishore@alphaelevators.in' }, { email: 'kishore@alphaelevators.com' }],
        });
        if (!techManagerUser) {
          const hash = await bcrypt.hash('kishore123', 10);
          await User.create({
            name: 'Kishore (Technical Manager)',
            email: 'kishore@alphaelevators.in',
            passwordHash: hash,
            role: 'TECHNICAL_MANAGER',
            phone: '+91 93848 20214',
            isActive: true,
          });
          console.log('[Server] Created Technical Manager user: kishore@alphaelevators.in / kishore123');
        } else if (techManagerUser.role !== 'TECHNICAL_MANAGER') {
          await User.updateOne(
            { _id: techManagerUser._id },
            { $set: { role: 'TECHNICAL_MANAGER', phone: '+91 93848 20214' } }
          );
          console.log('[Server] Updated Kishore role to TECHNICAL_MANAGER');
        }
      } catch (userInitErr: any) {
        console.warn('[Server] Notice initializing Technical Manager Kishore:', userInitErr.message);
      }

      // Ensure Admin (Abeal) exists
      try {
        const abealUser = await User.findOne({
          $or: [
            { email: 'abeal@alphaelevators.in' },
            { email: 'abeal@alphaelevators.com' },
            { name: /abeal/i },
          ],
        });
        if (!abealUser) {
          const hash = await bcrypt.hash('abeal123', 10);
          await User.create({
            name: 'Abeal (Operational Head)',
            email: 'abeal@alphaelevators.in',
            passwordHash: hash,
            role: 'ADMIN',
            phone: '+91 93848 20499',
            isActive: true,
          });
          console.log('[Server] Created Admin user: abeal@alphaelevators.in / abeal123');
        } else if (abealUser.role !== 'ADMIN') {
          await User.updateOne(
            { _id: abealUser._id },
            { $set: { role: 'ADMIN', isActive: true, phone: '+91 93848 20499' } }
          );
          console.log('[Server] Updated Abeal role to ADMIN');
        }
      } catch (abealInitErr: any) {
        console.warn('[Server] Notice initializing Admin Abeal:', abealInitErr.message);
      }

      // Ensure Admin (Nithesh Babu) exists with full Admin privileges
      try {
        const hash = await bcrypt.hash('nithesh123', 10);
        const nitheshUser = await User.findOne({
          $or: [
            { email: 'nithesh@alphaelevators.com' },
            { email: 'nithesh@alphaelevators.in' },
            { email: 'nitesh@alpha.com' },
            { name: /nithesh/i },
          ],
        });
        if (!nitheshUser) {
          await User.create({
            name: 'Nithesh Babu (Admin)',
            email: 'nithesh@alphaelevators.com',
            passwordHash: hash,
            role: 'ADMIN',
            phone: '+91 78100 91290',
            isActive: true,
          });
          console.log('[Server] Created Admin user: Nithesh Babu (Admin) - nithesh@alphaelevators.com / nithesh123');
        } else {
          // Always ensure role is ADMIN and allow nithesh123 login
          await User.updateOne(
            { _id: nitheshUser._id },
            {
              $set: {
                role: 'ADMIN',
                name: 'Nithesh Babu (Admin)',
                email: 'nithesh@alphaelevators.com',
                passwordHash: hash,
                phone: '+91 78100 91290',
                isActive: true,
              },
            }
          );
          console.log('[Server] Verified Nithesh Babu role as ADMIN (nithesh@alphaelevators.com / nithesh123)');
        }
      } catch (nitheshInitErr: any) {
        console.warn('[Server] Notice initializing Admin Nithesh Babu:', nitheshInitErr.message);
      }

      // Ensure Logistics Users exist: Bilal, Srinivasan (TL), Sundaram, Bala
      try {
        const logisticsUsers = [
          { name: 'Bilal (Logistics)', email: 'bilal@alphaelevators.com', pass: 'bilal123', role: 'LOGISTICS' as const, phone: '+91 98401 77881', altRegex: /^bilal/i },
          { name: 'Srinivasan (TL)', email: 'srinivasan@alphaelevators.com', pass: 'srini123', role: 'LOGISTICS_TL' as const, phone: '+91 98401 77882', altRegex: /^srinivasan/i },
          { name: 'Sundaram', email: 'sundaram@alphaelevators.com', pass: 'sundaram123', role: 'LOGISTICS_TL' as const, phone: '+91 98401 77883', altRegex: /^sundaram/i },
          { name: 'Bala', email: 'bala@alphaelevators.com', pass: 'bala123', role: 'LOGISTICS_TL' as const, phone: '+91 98401 77884', altRegex: /^bala(@|\s|$)/i },
          { name: 'Maari', email: 'maari@alphaelevators.com', pass: 'maari123', role: 'SITE_INSPECTOR' as const, phone: '+91 98401 77885', altRegex: /^(maari|siteinspector)/i },
          { name: 'Maari', email: 'siteinspector@alphaelevators.com', pass: 'site123', role: 'SITE_INSPECTOR' as const, phone: '+91 98401 77885', altRegex: /^siteinspector@/i },
        ];

        for (const lu of logisticsUsers) {
          const userDoc = await User.findOne({
            email: { $not: /balaji/i },
            name: { $not: /balaji/i },
            $or: [
              { email: lu.email },
              { email: lu.altRegex },
              { name: lu.altRegex },
            ],
          });
          const hash = await bcrypt.hash(lu.pass, 10);
          if (!userDoc) {
            await User.create({
              name: lu.name,
              email: lu.email,
              passwordHash: hash,
              role: lu.role,
              phone: lu.phone,
              isActive: true,
            });
            console.log(`[Server] Created Logistics user: ${lu.name} (${lu.email}) with role ${lu.role}`);
          } else {
            await User.updateOne(
              { _id: userDoc._id },
              {
                $set: {
                  role: lu.role,
                  name: userDoc.name || lu.name,
                  passwordHash: hash,
                  phone: userDoc.phone || lu.phone,
                  isActive: true,
                },
              }
            );
            console.log(`[Server] Verified Logistics user: ${userDoc.name} (${userDoc.email}) with role ${lu.role}`);
          }
        }

        // Ensure any customer assigned to a TL has their projects synchronized
        const customersWithTl = await Customer.find({
          assignedTl: { $exists: true, $nin: [null, ''] },
        }).select('_id assignedTl assignedTlId');

        for (const c of customersWithTl) {
          await Project.updateMany(
            { customerId: c._id, $or: [{ assignedTl: { $exists: false } }, { assignedTl: null }, { assignedTl: '' }] },
            { $set: { assignedTl: c.assignedTl, assignedTlId: c.assignedTlId } }
          );
        }
      } catch (logisticsInitErr: any) {
        console.warn('[Server] Notice initializing Logistics users:', logisticsInitErr.message);
      }

      // Ensure all 10 BDM users (including balaji@alpha.com / password123) exist and are restored as BDM
      try {
        await seedBdms(true);
      } catch (bdmInitErr: any) {
        console.warn('[Server] Notice initializing BDM users:', bdmInitErr.message);
      }

      // Ensure sample Tamil Nadu clients exist for QC autofill
      const custCount = await Customer.countDocuments();
      if (custCount < 3) {
        const sampleTN = [
          {
            customerId: 'CUST-002',
            fullName: 'Dr. Rajesh Mehra',
            phoneNumber: '+91 98401 22334',
            whatsappNumber: '+91 98401 22334',
            city: 'Chennai',
            state: 'Tamil Nadu',
            address: '45, Harrington Road, Chetpet, Chennai',
            customerType: 'Residential',
            whatsappOptIn: true,
          },
          {
            customerId: 'CUST-003',
            fullName: 'Kavitha Sundaram',
            phoneNumber: '+91 94432 55667',
            whatsappNumber: '+91 94432 55667',
            city: 'Coimbatore',
            state: 'Tamil Nadu',
            address: '12, Race Course Road, Coimbatore',
            customerType: 'Residential',
            whatsappOptIn: true,
          },
          {
            customerId: 'CUST-004',
            fullName: 'Senthil Kumar',
            phoneNumber: '+91 98940 33445',
            whatsappNumber: '+91 98940 33445',
            city: 'Madurai',
            state: 'Tamil Nadu',
            address: '88, KK Nagar, Madurai',
            customerType: 'Residential',
            whatsappOptIn: true,
          },
          {
            customerId: 'CUST-005',
            fullName: 'Venkatesh Prasad',
            phoneNumber: '+91 94421 88990',
            whatsappNumber: '+91 94421 88990',
            city: 'Salem',
            state: 'Tamil Nadu',
            address: '24, Fairlands, Salem',
            customerType: 'Residential',
            whatsappOptIn: true,
          },
        ];
        for (const c of sampleTN) {
          const existing = await Customer.findOne({ customerId: c.customerId });
          if (!existing) {
            const created = await Customer.create(c);
            await Project.create({
              projectId: `ALP-${c.customerId.replace('CUST-', '')}`,
              customerId: created._id,
              customerCode: c.customerId,
              projectName: `${c.fullName.split(' ')[0]} Residence Lift`,
              siteAddress: c.address,
              liftModel: 'Gearless Belt Home Series EV',
              liftType: 'Home Lift',
              numberOfFloors: 'G+2 (3 Stops)',
              liftAmount: 1250000,
              shaftAmount: 0,
              orderValue: 1250000,
              advancePercentage: 30,
              advanceAmount: 375000,
              totalPaid: 375000,
              balanceAmount: 875000,
              paymentStatus: 'ADVANCE_PAID',
              orderDate: new Date(),
              expectedDeliveryDate: new Date(Date.now() + 90 * 86400000),
              projectStatus: 'SITE_MEASUREMENT',
              automationEnabled: true,
              updateFrequencyDays: 15,
            });
          }
        }
        console.log('[Server] Verified Tamil Nadu sample clients & projects for QC inspection autofill.');
      }
    } catch (seedErr: any) {
      console.warn('[Server] Auto-bootstrap warning:', seedErr.message);
    }

    // Offload any multi-megabyte inline stage images to disk and ensure all projects have their own customer
    try {
      await slimProjectInstallationStageImages();
      await splitSharedCustomerProjects();
    } catch (splitErr: any) {
      console.warn('[Server] Auto-split customer projects warning:', splitErr.message);
    }

    // Ensure all historical old customers retain isOldCustomer: true and resequence all IDs continuously (CUST-001, CUST-002, ...)
    try {
      const { Customer } = await import('./models');
      await Customer.updateMany(
        { customerId: /^OLD/i },
        { $set: { isOldCustomer: true } }
      );
      await resequenceCustomerIds();
    } catch (normErr: any) {
      console.warn('[Server] Customer classification & resequencing warning:', normErr.message);
    }

    initScheduler();

    // Initialize WhatsApp Web Bot for automated inside-group posting
    try {
      console.log('[Server] 🤖 Starting WhatsApp Web Bot initialization...');
      await whatsAppWebBot.initialize();
      console.log('[Server] 🤖 WhatsApp Web Bot initialization routine completed.');
    } catch (botErr: any) {
      console.error('[Server] Fatal error initializing WhatsApp Web Bot:', botErr.message);
    }

    const server = app.listen(config.port, () => {
      console.log(`====================================================`);
      console.log(` Alpha Elevators CRM & WhatsApp Automation Server`);
      console.log(` Listening on http://localhost:${config.port}`);
      console.log(` Webhook URL: http://localhost:${config.port}/api/webhooks/whatsapp`);
      console.log(` Mode: ${config.nodeEnv}`);
      console.log(`====================================================`);
    });

    return server;
  } catch (err: any) {
    console.error('Fatal error starting server:', err.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
