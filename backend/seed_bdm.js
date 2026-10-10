const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dns = require('dns');
require('dotenv').config();

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://asksarkar0786_db_user:zk5gV4YNpPeLBtkx@cluster0.jrqz9vl.mongodb.net/alpha_crm?retryWrites=true&w=majority');
    console.log('Connected to MongoDB');
    
    const passwordHash = await bcrypt.hash('password123', 10);
    
    // We use the raw collection so we don't need to import the TS model
    const db = mongoose.connection.db;
    const users = db.collection('users');
    
    const bdmUsers = [
      { name: 'Naveen', email: 'naveen@alpha.com', role: 'BDM', passwordHash, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Eswar', email: 'eswar@alpha.com', role: 'BDM', passwordHash, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Nitesh', email: 'nitesh@alpha.com', role: 'BDM', passwordHash, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ];

    for (const u of bdmUsers) {
      await users.updateOne({ email: u.email }, { $set: u }, { upsert: true });
    }
    
    console.log('BDM Users seeded successfully:');
    console.log('1. naveen@alpha.com');
    console.log('2. eswar@alpha.com');
    console.log('3. nitesh@alpha.com');
    console.log('Password for all: password123');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
