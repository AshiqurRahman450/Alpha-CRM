import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri:
    process.env.MONGODB_URI ||
    'mongodb+srv://asksarkar0786_db_user:zk5gV4YNpPeLBtkx@cluster0.jrqz9vl.mongodb.net/alpha_crm?retryWrites=true&w=majority',
  jwtSecret: process.env.JWT_SECRET || 'alpha_elevators_jwt_super_secret_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Meta WhatsApp Business Cloud API
  meta: {
    accessToken: process.env.META_ACCESS_TOKEN || '',
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
    wabaId: process.env.META_WABA_ID || '',
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    verifyToken: process.env.META_VERIFY_TOKEN || 'alpha_elevators_webhook_token_secure_99',
    apiVersion: process.env.META_API_VERSION || 'v20.0',
    baseUrl: 'https://graph.facebook.com',
  },

  // WATI WhatsApp Business API
  wati: {
    baseUrl: process.env.WATI_API_BASE_URL || 'https://live-mt-server.wati.io/10269884',
    token: (process.env.WATI_API_TOKEN || '').replace(/^Bearer\s+/i, '').trim(),
    ownerEmail: process.env.WATI_OWNER_EMAIL || 'alphaelevators01@gmail.com',
    webhookSecret: process.env.WATI_WEBHOOK_SECRET || '',
    dryRun: process.env.WATI_DRY_RUN === 'true',
    timeoutMs: parseInt(process.env.WATI_TIMEOUT_MS || '15000', 10),
  },

  // CRM Global Settings
  defaultUpdateFrequencyDays: parseInt(process.env.DEFAULT_UPDATE_FREQUENCY || '20', 10),
  defaultUpdateTime: process.env.DEFAULT_UPDATE_TIME || '09:00',
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
