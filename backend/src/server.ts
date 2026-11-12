import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { connectDB } from './config/db';
import path from 'path';
import { initScheduler } from './services/scheduler/schedulerService';
import { whatsAppWebBot } from './services/whatsapp';

import { authRouter } from './routes/auth';
import { customerRouter } from './routes/customers';
import { projectRouter } from './routes/projects';
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
import { splitSharedCustomerProjects, resequenceCustomerIds } from './utils/idGenerators';
import bcrypt from 'bcryptjs';

const app = express();

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
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

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Serve uploaded documents
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

      // Ensure all 10 BDM users from login page exist with login credentials and pilot data
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

    // Ensure all projects have their own dedicated individual customer
    try {
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
