import mongoose from 'mongoose';
import dns from 'dns';
import { config } from './index';

// Resolve DNS SRV lookup issues on Windows / Node 18+ for Atlas mongodb+srv URIs
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  if ((dns as any).setDefaultResultOrder) {
    (dns as any).setDefaultResultOrder('ipv4first');
  }
} catch (e) {
  // Ignore if custom DNS cannot be set
}

let isConnected = false;

export async function connectDB(): Promise<typeof mongoose> {
  if (isConnected) {
    return mongoose;
  }

  // 1. Try connecting to configured MongoDB Atlas / custom URI
  if (config.mongoUri) {
    try {
      const maskedUri = config.mongoUri.replace(/:([^:@]+)@/, ':****@');
      console.log(`[DB] Attempting connection to MongoDB Atlas URI: ${maskedUri}`);
      const conn = await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 5000,
      });
      isConnected = true;
      console.log(`[DB] Successfully connected to MongoDB Atlas!`);
      return conn;
    } catch (err: any) {
      console.warn(`\n[DB] -------------------------------------------------------------`);
      console.warn(`[DB] MongoDB Atlas connection failed: ${err.message}`);
      if (err.message.includes('Could not connect to any servers') || err.message.includes('whitelist')) {
        console.warn(`[DB] IMPORTANT: Your current IP address is likely not whitelisted in MongoDB Atlas.`);
        console.warn(`[DB] Go to: MongoDB Atlas Dashboard -> Security -> Network Access -> Add IP Address.`);
        console.warn(`[DB] Add your current IP or allow access from anywhere (0.0.0.0/0).`);
      }
      console.warn(`[DB] Falling back to local/in-memory instance for seamless development...`);
      console.warn(`[DB] -------------------------------------------------------------\n`);
    }
  }

  // 2. Try local MongoDB service if available
  try {
    const localUri = 'mongodb://127.0.0.1:27017/alpha_crm';
    const conn = await mongoose.connect(localUri, {
      serverSelectionTimeoutMS: 2000,
    });
    isConnected = true;
    console.log(`[DB] Connected to local MongoDB at ${localUri}`);
    return conn;
  } catch (err) {
    // 3. Fallback to embedded in-memory MongoDB
    console.log('[DB] Starting in-memory MongoDB instance for seamless zero-config local run...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      const conn = await mongoose.connect(uri);
      isConnected = true;
      console.log(`[DB] Embedded in-memory MongoDB initialized at ${uri}`);
      return conn;
    } catch (innerErr: any) {
      console.error('[DB] Failed to initialize embedded MongoDB:', innerErr.message);
      throw innerErr;
    }
  }
}

export async function disconnectDB(): Promise<void> {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
