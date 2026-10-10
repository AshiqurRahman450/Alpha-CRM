const mongoose = require('mongoose');
require('dotenv').config();
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {}

async function assign() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alpha_crm');
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Find Naveen
    const naveen = await db.collection('users').findOne({ email: 'naveen@alpha.com' });
    if (!naveen) {
      console.log('Naveen not found. Please run seed_bdm.js first.');
      process.exit(1);
    }
    
    console.log(`Assigning Naveen (${naveen._id}) as BDM to all existing customers and projects for testing...`);
    
    const custResult = await db.collection('customers').updateMany(
      { bdmId: { $exists: false } }, 
      { $set: { bdmId: naveen._id } }
    );
    console.log(`Updated ${custResult.modifiedCount} customers.`);
    
    const projResult = await db.collection('projects').updateMany(
      { bdmId: { $exists: false } }, 
      { $set: { bdmId: naveen._id } }
    );
    console.log(`Updated ${projResult.modifiedCount} projects.`);
    
    console.log('Done! Now login as Naveen and you will see the customers and projects.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

assign();
