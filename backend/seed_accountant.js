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
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://asksarkar0786_db_user:zk5gV4YNpPeLBtkx@cluster0.jrqz9vl.mongodb.net/alpha_crm?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    
    const passwordHash = await bcrypt.hash('vincy123', 10);
    
    const db = mongoose.connection.db;
    const users = db.collection('users');
    
    const accountantUser = {
      name: 'Vincy',
      email: 'vincy@alphaelevators.com',
      passwordHash,
      role: 'ACCOUNTANT',
      phone: '+91 98400 99881',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await users.updateOne(
      { email: accountantUser.email },
      { $set: accountantUser },
      { upsert: true }
    );
    
    console.log('Accountant Vincy seeded successfully:');
    console.log('Email: vincy@alphaelevators.com');
    console.log('Role: ACCOUNTANT');
    console.log('Password: vincy123');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
