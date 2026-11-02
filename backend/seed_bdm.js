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

const BDMS_LIST = [
  { name: 'Thirunavukarasu C', email: 'thirunavukarasu@alpha.com', role: 'BDM', phone: '+91 93848 20498' },
  { name: 'Gopinath S', email: 'gopinath@alpha.com', role: 'BDM', phone: '+91 92800 96311' },
  { name: 'Javith Rasha', email: 'javith@alpha.com', role: 'BDM', phone: '+91 93848 20023' },
  { name: 'Mohamed Ashik', email: 'mohamedashik@alpha.com', role: 'BDM', phone: '+91 93848 20011' },
  { name: 'Dhananjay R', email: 'dhananjay@alpha.com', role: 'BDM', phone: '+91 93848 20557' },
  { name: 'Balaji VB', email: 'balaji@alpha.com', role: 'BDM', phone: '+91 93848 20495' },
  { name: 'Aravind Balaji', email: 'aravind@alpha.com', role: 'BDM', phone: '+91 93848 20497' },
  { name: 'Naveenraj Murugan', email: 'naveen@alpha.com', role: 'BDM', phone: '+91 93848 20213' },
  { name: 'Eswaran S', email: 'eswar@alpha.com', role: 'BDM', phone: '+91 82209 22109' },
  
];

async function seed() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb+srv://asksarkar0786_db_user:zk5gV4YNpPeLBtkx@cluster0.jrqz9vl.mongodb.net/alpha_crm?retryWrites=true&w=majority';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const passwordHash = await bcrypt.hash('password123', 10);
    const db = mongoose.connection.db;
    const users = db.collection('users');
    const customers = db.collection('customers');
    const projects = db.collection('projects');
    
    console.log('Upserting all 10 BDM users from login page...');
    for (let i = 0; i < BDMS_LIST.length; i++) {
      const bdm = BDMS_LIST[i];
      const res = await users.findOneAndUpdate(
        {
          $or: [
            { email: bdm.email },
            { name: bdm.name, role: 'BDM' },
          ],
        },
        {
          $set: {
            name: bdm.name,
            email: bdm.email,
            role: 'BDM',
            phone: bdm.phone,
            passwordHash,
            isActive: true,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
      const bdmUser = res.value || res;

      // Link pilot customer & project
      const custCode = `CUST-${String(i + 1).padStart(3, '0')}`;
      const projCode = `ALP-${String(i + 1).padStart(3, '0')}`;

      if (bdmUser && bdmUser._id) {
        await customers.updateOne(
          { customerId: custCode },
          { $set: { bdmId: bdmUser._id, bdmPhone: bdm.phone, assignedEmployee: bdm.name } }
        );
        await projects.updateOne(
          { projectId: projCode },
          { $set: { bdmId: bdmUser._id, bdmPhone: bdm.phone, assignedEmployee: bdm.name } }
        );
        console.log(`✓ ${bdm.name} (${bdm.email}) linked to ${custCode} & ${projCode}`);
      }
    }

    // Alias for Ashik
    await users.updateOne(
      { email: 'ashik@alpha.com' },
      {
        $set: {
          name: 'Mohamed Ashik',
          email: 'ashik@alpha.com',
          role: 'BDM',
          phone: '+91 98401 10004',
          passwordHash,
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    
    console.log('\nAll 10 BDM users seeded and linked successfully!');
    console.log('Default Password for all: password123');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
