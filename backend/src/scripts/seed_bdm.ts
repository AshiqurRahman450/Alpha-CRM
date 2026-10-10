import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models';

dotenv.config({ path: '../.env' });

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alpha_crm');
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const bdmUsers = [
    { name: 'Naveen', email: 'naveen@alpha.com', role: 'BDM' },
    { name: 'Eswar', email: 'eswar@alpha.com', role: 'BDM' },
    { name: 'Nitesh', email: 'nitesh@alpha.com', role: 'BDM' },
  ];

  for (const u of bdmUsers) {
    await User.findOneAndUpdate(
      { email: u.email },
      { ...u, passwordHash },
      { upsert: true, new: true }
    );
  }
  console.log('BDM Users seeded successfully: naveen@alpha.com, eswar@alpha.com, nitesh@alpha.com (Password: password123)');
  process.exit(0);
}

seed();
