import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db';
import { User } from '../models';

export const ALL_BDMS = [
  { name: 'Naveen', email: 'naveen@alpha.com', role: 'BDM' },
  { name: 'Eswar', email: 'eswar@alpha.com', role: 'BDM' },
  { name: 'Nitesh', email: 'nitesh@alpha.com', role: 'BDM' },
  { name: 'Thirunavukarasu', email: 'thirunavukarasu@alpha.com', role: 'BDM' },
  { name: 'Gopinath', email: 'gopinath@alpha.com', role: 'BDM' },
  { name: 'Javith', email: 'javith@alpha.com', role: 'BDM' },
  { name: 'Mohamed Ashik', email: 'mohamedashik@alpha.com', role: 'BDM' },
  { name: 'Dhananjay', email: 'dhananjay@alpha.com', role: 'BDM' },
  { name: 'Balaji', email: 'balaji@alpha.com', role: 'BDM' },
  { name: 'Aravind', email: 'aravind@alpha.com', role: 'BDM' },
];

async function seed() {
  try {
    await connectDB();
    const passwordHash = await bcrypt.hash('password123', 10);

    console.log('[SeedBDM] Upserting BDM users...');
    for (const u of ALL_BDMS) {
      const user = await User.findOneAndUpdate(
        {
          $or: [
            { email: u.email.toLowerCase() },
            { name: u.name, role: 'BDM' },
          ],
        },
        {
          name: u.name,
          email: u.email.toLowerCase(),
          role: 'BDM',
          isActive: true,
          passwordHash,
        },
        { upsert: true, new: true }
      );
      console.log(`[SeedBDM] ✓ Ready: ${user.name} (${user.email}) - Role: ${user.role}`);
    }

    // Also support ashik@alpha.com alias if someone uses short email
    await User.findOneAndUpdate(
      { email: 'ashik@alpha.com' },
      {
        name: 'Mohamed Ashik',
        email: 'ashik@alpha.com',
        role: 'BDM',
        isActive: true,
        passwordHash,
      },
      { upsert: true, new: true }
    );
    console.log(`[SeedBDM] ✓ Ready alias: Mohamed Ashik (ashik@alpha.com)`);

    console.log('\n[SeedBDM] All BDMs successfully created and ready for login! (Default Password: password123)');
    process.exit(0);
  } catch (err: any) {
    console.error('[SeedBDM] Error seeding BDMs:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}
