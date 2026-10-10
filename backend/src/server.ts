import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { connectDB } from './config/db';
import path from 'path';
import { initScheduler } from './services/scheduler/schedulerService';

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Serve uploaded documents
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

import { User } from './models';
import { seed } from './scripts/seed';

export async function startServer() {
  try {
    await connectDB();

    // Auto-bootstrap initial users & templates if database is empty
    try {
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        console.log('[Server] Database is empty. Bootstrapping Admin, CRM users & templates...');
        await seed();
      }
    } catch (seedErr: any) {
      console.warn('[Server] Auto-bootstrap warning:', seedErr.message);
    }

    initScheduler();

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
